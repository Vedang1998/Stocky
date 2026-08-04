/**
 * Dispatcher: claim PENDING / expired leases via FOR UPDATE SKIP LOCKED,
 * sign fresh envelope v2, enqueue to BullMQ, ack ENQUEUED.
 */
import { randomUUID } from "node:crypto";
import type { DurableJob } from "@prisma/client";
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
import { createTenantJobEnvelopeV2 } from "./envelope-v2.server";
import { assertTransition } from "./state-machine.server";

export const DEFAULT_DISPATCH_BATCH_SIZE = 50;
export const DEFAULT_DISPATCH_LEASE_MS = 30_000;

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
};

async function recoverExpiredLeases(
  prisma: ReturnType<typeof getControlPlanePrisma>,
  now: Date,
): Promise<number> {
  const expired = await prisma.durableJob.findMany({
    where: {
      state: "DISPATCH_LEASED",
      leaseExpiresAt: { lt: now },
    },
    select: { id: true, state: true },
    take: 200,
  });

  let recovered = 0;
  for (const job of expired) {
    assertTransition(job.state, "PENDING");
    await prisma.durableJob.update({
      where: { id: job.id },
      data: {
        state: "PENDING",
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
    recovered += 1;
  }
  return recovered;
}

async function claimBatch(
  prisma: ReturnType<typeof getControlPlanePrisma>,
  batchSize: number,
  leaseMs: number,
  workerId: string,
  now: Date,
): Promise<ClaimedJobRow[]> {
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);

  // FOR UPDATE SKIP LOCKED — cross-shop claim without BYPASSRLS.
  const rows = await prisma.$queryRaw<ClaimedJobRow[]>`
    SELECT
      id, "shopId", "jobType", source, "queueName",
      "payloadSchemaVersion", "sanitizedPayload", "payloadDigest",
      "correlationId", "causationId", state
    FROM "DurableJob"
    WHERE state IN ('PENDING', 'RETRY_WAIT')
      AND "nextEligibleAt" <= ${now}
    ORDER BY "nextEligibleAt" ASC, "createdAt" ASC
    LIMIT ${batchSize}
    FOR UPDATE SKIP LOCKED
  `;

  const claimed: ClaimedJobRow[] = [];
  for (const row of rows) {
    assertTransition(row.state as DurableJob["state"], "DISPATCH_LEASED");
    await prisma.durableJob.update({
      where: { id: row.id },
      data: {
        state: "DISPATCH_LEASED",
        leaseOwner: workerId,
        leaseExpiresAt,
      },
    });
    claimed.push({ ...row, state: "DISPATCH_LEASED" });
  }
  return claimed;
}

async function enqueueClaimedJob(job: ClaimedJobRow): Promise<void> {
  const shop = await getControlPlanePrisma().shop.findUnique({
    where: { id: job.shopId },
    select: {
      id: true,
      myshopifyDomain: true,
      processingEnabled: true,
    },
  });
  if (!shop || !shop.processingEnabled) {
    // Leave leased; lifecycle/uninstall will cancel or lease recovery returns PENDING.
    return;
  }

  assertTenantJobSource(job.source);
  const tenant = issueSyncDispatchAuthority({
    shopId: shop.id,
    myshopifyDomain: shop.myshopifyDomain,
    source: "verified_scheduler",
    correlationId: job.correlationId,
    causationId: job.causationId ?? undefined,
  });

  const envelope = createTenantJobEnvelopeV2({
    tenant,
    source: job.source as TenantJobSource,
    durableJobId: job.id,
    payloadDigest: job.payloadDigest,
  });

  const payload =
    typeof job.sanitizedPayload === "object" &&
    job.sanitizedPayload !== null &&
    !Array.isArray(job.sanitizedPayload)
      ? (job.sanitizedPayload as Record<string, unknown>)
      : {};

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
      },
      { jobId: job.id },
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
        payload,
      },
      { jobId: job.id },
    );
  }
}

async function ackEnqueued(
  prisma: ReturnType<typeof getControlPlanePrisma>,
  jobId: string,
  now: Date,
): Promise<void> {
  const current = await prisma.durableJob.findUnique({ where: { id: jobId } });
  if (!current || current.state !== "DISPATCH_LEASED") return;
  assertTransition("DISPATCH_LEASED", "ENQUEUED");
  await prisma.durableJob.update({
    where: { id: jobId },
    data: {
      state: "ENQUEUED",
      enqueuedAt: now,
      leaseOwner: null,
      leaseExpiresAt: null,
    },
  });
}

export type DispatchPendingJobsResult = {
  recoveredLeases: number;
  claimed: number;
  enqueued: number;
  failed: number;
  workerId: string;
};

/**
 * Claim eligible durable jobs and deliver to BullMQ.
 * Redis failure leaves jobs DISPATCH_LEASED until lease expiry recovery.
 */
export async function dispatchPendingJobs(options?: {
  batchSize?: number;
  leaseMs?: number;
  workerId?: string;
}): Promise<DispatchPendingJobsResult> {
  const batchSize = options?.batchSize ?? DEFAULT_DISPATCH_BATCH_SIZE;
  const leaseMs = options?.leaseMs ?? DEFAULT_DISPATCH_LEASE_MS;
  const workerId = options?.workerId ?? `dispatcher:${randomUUID()}`;
  const prisma = getControlPlanePrisma();
  const now = new Date();

  const recoveredLeases = await recoverExpiredLeases(prisma, now);
  const claimed = await claimBatch(prisma, batchSize, leaseMs, workerId, now);

  let enqueued = 0;
  let failed = 0;

  for (const job of claimed) {
    try {
      await enqueueClaimedJob(job);
      await ackEnqueued(prisma, job.id, new Date());
      enqueued += 1;
    } catch (err) {
      failed += 1;
      console.error(
        `dispatchPendingJobs failed for ${job.id}:`,
        err instanceof Error ? err.message : err,
      );
      // Leave DISPATCH_LEASED — lease expiry recovers to PENDING.
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

// Silence unused import when CRON_QUEUE only used for typing clarity.
void CRON_QUEUE;
