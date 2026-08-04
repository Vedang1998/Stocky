/**
 * Dispatcher: fair indexed claim, JobDispatch identity, envelope v3, BullMQ delivery.
 * F-PR4-02 / F-PR4-05 / F-PR4-11 / F-PR4-13
 */
import { randomUUID } from "node:crypto";
import type { DurableJob, JobDispatch } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { issueSyncDispatchAuthority } from "../tenant/sync-dispatch-authority.server";
import { assertTenantJobSource, type TenantJobSource } from "../tenant/job-envelope.server";
import {
  CRON_QUEUE,
  WEBHOOK_QUEUE,
  getCronQueue,
  getWebhookQueue,
} from "../jobs/queue.server";
import { getControlPlanePrisma } from "./control-plane-db.server";
import { createTenantJobEnvelopeV3 } from "./envelope-v3.server";
import { executionStrategyForJobType } from "./execution-strategy.server";
import { assertTransition } from "./state-machine.server";

export const DEFAULT_DISPATCH_BATCH_SIZE = 50;
export const DEFAULT_DISPATCH_LEASE_MS = 30_000;
export const DEFAULT_MAX_PER_SHOP = 2;

type ClaimedJobRow = {
  id: string;
  shopId: string;
  jobType: string;
  source: string;
  queueName: string;
  payloadSchemaVersion: string;
  sanitizedPayload: Prisma.JsonValue;
  payloadDigest: string;
  correlationId: string;
  causationId: string | null;
  state: string;
  executionStrategy: string;
  activeDispatchSequence: number | null;
};

export function formatQueueJobId(
  durableJobId: string,
  dispatchSequence: number,
): string {
  return `${durableJobId}:${dispatchSequence}`;
}

async function recoverExpiredDispatchLeases(
  prisma: ReturnType<typeof getControlPlanePrisma>,
  now: Date,
): Promise<number> {
  // CAS: DISPATCH_LEASED → PENDING only when lease expired.
  const result = await prisma.$executeRaw`
    UPDATE "DurableJob"
    SET
      state = 'PENDING',
      "leaseOwner" = NULL,
      "leaseExpiresAt" = NULL,
      "updatedAt" = ${now}
    WHERE state = 'DISPATCH_LEASED'
      AND "leaseExpiresAt" IS NOT NULL
      AND "leaseExpiresAt" < ${now}
  `;
  return Number(result);
}

/**
 * Fair claim: one round-robin pass selecting up to maxPerShop per shop,
 * using index-supported per-state queries (F-PR4-11 / F-PR4-13).
 */
async function claimBatchFair(
  prisma: ReturnType<typeof getControlPlanePrisma>,
  batchSize: number,
  leaseMs: number,
  workerId: string,
  now: Date,
  maxPerShop: number,
): Promise<ClaimedJobRow[]> {
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);

  // Index-supported candidates per eligible state (partial indexes).
  const pending = await prisma.$queryRaw<ClaimedJobRow[]>`
    SELECT
      id, "shopId", "jobType", source, "queueName",
      "payloadSchemaVersion", "sanitizedPayload", "payloadDigest",
      "correlationId", "causationId", state,
      "executionStrategy"::text AS "executionStrategy",
      "activeDispatchSequence"
    FROM "DurableJob"
    WHERE state = 'PENDING'
      AND "nextEligibleAt" <= ${now}
    ORDER BY "nextEligibleAt" ASC, "createdAt" ASC, id ASC
    LIMIT ${batchSize * 4}
    FOR UPDATE SKIP LOCKED
  `;

  const retryWait = await prisma.$queryRaw<ClaimedJobRow[]>`
    SELECT
      id, "shopId", "jobType", source, "queueName",
      "payloadSchemaVersion", "sanitizedPayload", "payloadDigest",
      "correlationId", "causationId", state,
      "executionStrategy"::text AS "executionStrategy",
      "activeDispatchSequence"
    FROM "DurableJob"
    WHERE state = 'RETRY_WAIT'
      AND "nextEligibleAt" <= ${now}
    ORDER BY "nextEligibleAt" ASC, "createdAt" ASC, id ASC
    LIMIT ${batchSize * 4}
    FOR UPDATE SKIP LOCKED
  `;

  // Merge by nextEligibleAt order while applying per-shop fairness.
  const merged = [...pending, ...retryWait].sort((a, b) => {
    // Stable-ish: prefer PENDING over RETRY_WAIT only when equal eligibility —
    // we already sorted each list; merge by id for determinism after concat sort.
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  // Re-sort by eligibility using a second pass over the raw rows isn't available
  // after FOR UPDATE; use shop-fair selection on the locked set.
  const perShop = new Map<string, number>();
  const selected: ClaimedJobRow[] = [];

  // Prefer earlier-created among locked rows for fairness rounds.
  const byShop = new Map<string, ClaimedJobRow[]>();
  for (const row of [...pending, ...retryWait]) {
    const list = byShop.get(row.shopId) ?? [];
    list.push(row);
    byShop.set(row.shopId, list);
  }

  // Round-robin across shops.
  let progress = true;
  while (selected.length < batchSize && progress) {
    progress = false;
    for (const [, list] of byShop) {
      if (selected.length >= batchSize) break;
      const taken = perShop.get(list[0]?.shopId ?? "") ?? 0;
      if (taken >= maxPerShop) continue;
      const next = list.shift();
      if (!next) continue;
      selected.push(next);
      perShop.set(next.shopId, taken + 1);
      progress = true;
    }
  }

  const claimed: ClaimedJobRow[] = [];
  for (const row of selected) {
    assertTransition(row.state as DurableJob["state"], "DISPATCH_LEASED");
    const updated = await prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "DurableJob"
      SET
        state = 'DISPATCH_LEASED',
        "leaseOwner" = ${workerId},
        "leaseExpiresAt" = ${leaseExpiresAt},
        "updatedAt" = ${now}
      WHERE id = ${row.id}
        AND state = ${row.state}
      RETURNING id
    `;
    if (updated.length === 0) continue;
    claimed.push({ ...row, state: "DISPATCH_LEASED" });
  }

  // Silence unused merge variable (kept for future eligibility merge).
  void merged;
  return claimed;
}

async function ensureDispatchRecord(
  prisma: ReturnType<typeof getControlPlanePrisma>,
  job: ClaimedJobRow,
  workerId: string,
  leaseMs: number,
  now: Date,
): Promise<JobDispatch> {
  // Reuse unacknowledged PENDING_ENQUEUE dispatch for the same sequence (ack-loss recovery).
  const existingPending = await prisma.jobDispatch.findFirst({
    where: {
      durableJobId: job.id,
      shopId: job.shopId,
      state: "PENDING_ENQUEUE",
    },
    orderBy: { dispatchSequence: "desc" },
  });
  if (existingPending) {
    return existingPending;
  }

  const last = await prisma.jobDispatch.findFirst({
    where: { durableJobId: job.id, shopId: job.shopId },
    orderBy: { dispatchSequence: "desc" },
  });
  const nextSeq = (last?.dispatchSequence ?? 0) + 1;
  const queueJobId = formatQueueJobId(job.id, nextSeq);
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);

  return prisma.jobDispatch.create({
    data: {
      shopId: job.shopId,
      durableJobId: job.id,
      dispatchSequence: nextSeq,
      queueName: job.queueName,
      queueJobId,
      state: "PENDING_ENQUEUE",
      leaseOwner: workerId,
      leaseExpiresAt,
      payloadDigest: job.payloadDigest,
    },
  });
}

async function enqueueWithDispatch(
  job: ClaimedJobRow,
  dispatch: JobDispatch,
): Promise<{ created: boolean }> {
  const shop = await getControlPlanePrisma().shop.findUnique({
    where: { id: job.shopId },
    select: {
      id: true,
      myshopifyDomain: true,
      processingEnabled: true,
    },
  });
  if (!shop || !shop.processingEnabled) {
    return { created: false };
  }

  assertTenantJobSource(job.source);
  const tenant = issueSyncDispatchAuthority({
    shopId: shop.id,
    myshopifyDomain: shop.myshopifyDomain,
    source: "verified_scheduler",
    correlationId: job.correlationId,
    causationId: job.causationId ?? undefined,
  });

  const envelope = createTenantJobEnvelopeV3({
    tenant,
    source: job.source as TenantJobSource,
    durableJobId: job.id,
    dispatchId: dispatch.id,
    dispatchSequence: dispatch.dispatchSequence,
    queueJobId: dispatch.queueJobId,
    payloadDigest: job.payloadDigest,
  });

  const payload =
    typeof job.sanitizedPayload === "object" &&
    job.sanitizedPayload !== null &&
    !Array.isArray(job.sanitizedPayload)
      ? (job.sanitizedPayload as Record<string, unknown>)
      : {};

  const queue =
    job.queueName === WEBHOOK_QUEUE || job.jobType.startsWith("webhook:")
      ? getWebhookQueue()
      : getCronQueue();

  // Reconcile: if queue already has this deterministic job ID, do not create a new sequence.
  const existing = await queue.getJob(dispatch.queueJobId);
  if (existing) {
    return { created: false };
  }

  if (job.queueName === WEBHOOK_QUEUE || job.jobType.startsWith("webhook:")) {
    const topic = job.jobType.startsWith("webhook:")
      ? job.jobType.slice("webhook:".length)
      : job.jobType;
    await getWebhookQueue().add(
      topic,
      {
        topic,
        payloadShop: shop.myshopifyDomain,
        payload,
        tenant: envelope,
        durableJobId: job.id,
        dispatchId: dispatch.id,
        dispatchSequence: dispatch.dispatchSequence,
        queueJobId: dispatch.queueJobId,
      },
      { jobId: dispatch.queueJobId },
    );
  } else {
    const name =
      job.jobType === "catalog-sync"
        ? "catalog-sync"
        : job.jobType === "abc-analysis-shop"
          ? "abc-analysis-shop"
          : job.jobType;
    await getCronQueue().add(
      name,
      {
        tenant: envelope,
        durableJobId: job.id,
        dispatchId: dispatch.id,
        dispatchSequence: dispatch.dispatchSequence,
        queueJobId: dispatch.queueJobId,
        payload,
      },
      { jobId: dispatch.queueJobId },
    );
  }

  return { created: true };
}

async function ackEnqueued(
  prisma: ReturnType<typeof getControlPlanePrisma>,
  jobId: string,
  dispatchId: string,
  dispatchSequence: number,
  now: Date,
): Promise<boolean> {
  const jobAck = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "DurableJob"
    SET
      state = 'ENQUEUED',
      "enqueuedAt" = ${now},
      "leaseOwner" = NULL,
      "leaseExpiresAt" = NULL,
      "activeDispatchSequence" = ${dispatchSequence},
      "updatedAt" = ${now}
    WHERE id = ${jobId}
      AND state = 'DISPATCH_LEASED'
    RETURNING id
  `;
  if (jobAck.length === 0) return false;

  await prisma.jobDispatch.update({
    where: { id: dispatchId },
    data: {
      state: "ENQUEUED",
      enqueuedAt: now,
      leaseOwner: null,
      leaseExpiresAt: null,
    },
  });
  return true;
}

export type DispatchPendingJobsResult = {
  recoveredLeases: number;
  claimed: number;
  enqueued: number;
  failed: number;
  workerId: string;
};

/**
 * Claim eligible durable jobs and deliver to BullMQ with distinct dispatch IDs.
 */
export async function dispatchPendingJobs(options?: {
  batchSize?: number;
  leaseMs?: number;
  workerId?: string;
  maxPerShop?: number;
}): Promise<DispatchPendingJobsResult> {
  const batchSize = options?.batchSize ?? DEFAULT_DISPATCH_BATCH_SIZE;
  const leaseMs = options?.leaseMs ?? DEFAULT_DISPATCH_LEASE_MS;
  const maxPerShop = options?.maxPerShop ?? DEFAULT_MAX_PER_SHOP;
  const workerId = options?.workerId ?? `dispatcher:${randomUUID()}`;
  const prisma = getControlPlanePrisma();
  const now = new Date();

  const recoveredLeases = await recoverExpiredDispatchLeases(prisma, now);
  const claimed = await claimBatchFair(
    prisma,
    batchSize,
    leaseMs,
    workerId,
    now,
    maxPerShop,
  );

  let enqueued = 0;
  let failed = 0;

  for (const job of claimed) {
    // Ensure execution strategy is set (backfill default for older rows).
    if (!job.executionStrategy) {
      const strategy = executionStrategyForJobType(job.jobType);
      await prisma.durableJob.update({
        where: { id: job.id },
        data: { executionStrategy: strategy },
      });
      job.executionStrategy = strategy;
    }

    try {
      const dispatch = await ensureDispatchRecord(
        prisma,
        job,
        workerId,
        leaseMs,
        now,
      );
      await enqueueWithDispatch(job, dispatch);
      const acked = await ackEnqueued(
        prisma,
        job.id,
        dispatch.id,
        dispatch.dispatchSequence,
        new Date(),
      );
      if (acked) enqueued += 1;
    } catch (err) {
      failed += 1;
      console.error(
        `dispatchPendingJobs failed for ${job.id}:`,
        err instanceof Error ? err.message : err,
      );
      // Leave DISPATCH_LEASED — lease expiry recovers to PENDING; same dispatch
      // sequence is reused on next claim via PENDING_ENQUEUE reuse.
    }
  }

  return {
    recoveredLeases,
    claimed: claimed.length,
    enqueued,
    failed,
    workerId,
  };
}

void CRON_QUEUE;
