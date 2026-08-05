/**
 * Dispatcher: fair indexed claim, JobDispatch identity, envelope v3, BullMQ delivery.
 * F-PR4-02 / F-PR4-05 / F-PR4-11 / F-PR4-13 / NEW-PR4-C01 (D-044).
 *
 * DurableJob may transition DISPATCH_LEASED → ENQUEUED only when the exact
 * JobDispatch is independently confirmed runnable in BullMQ.
 */
import { randomUUID } from "node:crypto";
import type { DurableJob, JobDispatch, Prisma } from "@prisma/client";
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
import {
  classifyAfterQueueAdd,
  inspectQueueDispatchPresence,
  type QueueDispatchPresence,
} from "./queue-presence.server";
import type { Queue } from "bullmq";

export const DEFAULT_DISPATCH_BATCH_SIZE = 50;
export const DEFAULT_DISPATCH_LEASE_MS = 30_000;
export const DEFAULT_MAX_PER_SHOP = 2;
/** Age after which ENQUEUED without unfinished attempt is considered stranded. */
export const DEFAULT_STRANDED_ENQUEUED_MS = 5 * 60_000;

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

export type EnqueueDispatchResult =
  | {
      outcome: "runnable";
      presence: Extract<
        QueueDispatchPresence,
        { status: "RUNNABLE_EXISTING" | "RUNNABLE_CREATED" }
      >;
      dispatch: JobDispatch;
    }
  | {
      outcome: "shop_disabled";
      dispatch: JobDispatch;
      cancelled: boolean;
    }
  | {
      outcome: "not_runnable";
      presence: QueueDispatchPresence;
      dispatch: JobDispatch;
    }
  | {
      outcome: "queue_unavailable";
      reason: string;
      dispatch: JobDispatch;
    };

export function formatQueueJobId(
  durableJobId: string,
  dispatchSequence: number,
): string {
  // BullMQ forbids `:` in custom job IDs. Equivalent deterministic encoding
  // of durableJobId + dispatchSequence (F-PR4-02).
  if (durableJobId.includes("__d")) {
    throw new Error("durableJobId_contains_dispatch_separator");
  }
  return `${durableJobId}__d${dispatchSequence}`;
}

export function parseQueueJobId(queueJobId: string): {
  durableJobId: string;
  dispatchSequence: number;
} {
  const idx = queueJobId.lastIndexOf("__d");
  if (idx <= 0) {
    throw new Error(`invalid_queue_job_id:${queueJobId}`);
  }
  const durableJobId = queueJobId.slice(0, idx);
  const dispatchSequence = Number(queueJobId.slice(idx + 3));
  if (!Number.isInteger(dispatchSequence) || dispatchSequence < 1) {
    throw new Error(`invalid_queue_job_id_sequence:${queueJobId}`);
  }
  return { durableJobId, dispatchSequence };
}

function resolveQueue(job: ClaimedJobRow): Queue {
  return job.queueName === WEBHOOK_QUEUE || job.jobType.startsWith("webhook:")
    ? getWebhookQueue()
    : getCronQueue();
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

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ClaimedJobRow[]>`
      WITH eligible AS (
        SELECT
          id, "shopId", "jobType", source, "queueName",
          "payloadSchemaVersion", "sanitizedPayload", "payloadDigest",
          "correlationId", "causationId", state,
          "executionStrategy"::text AS "executionStrategy",
          "activeDispatchSequence",
          "nextEligibleAt", "createdAt",
          ROW_NUMBER() OVER (
            PARTITION BY "shopId"
            ORDER BY "nextEligibleAt" ASC, "createdAt" ASC, id ASC
          ) AS shop_rank
        FROM "DurableJob"
        WHERE state IN ('PENDING', 'RETRY_WAIT')
          AND "nextEligibleAt" <= ${now}
      )
      SELECT
        id, "shopId", "jobType", source, "queueName",
        "payloadSchemaVersion", "sanitizedPayload", "payloadDigest",
        "correlationId", "causationId", state,
        "executionStrategy", "activeDispatchSequence"
      FROM eligible
      WHERE shop_rank <= ${maxPerShop}
      ORDER BY "nextEligibleAt" ASC, "createdAt" ASC, id ASC
      LIMIT ${batchSize}
    `;

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "DurableJob"
      WHERE id = ANY(${ids})
        AND state IN ('PENDING', 'RETRY_WAIT')
      FOR UPDATE SKIP LOCKED
    `;
    const lockedIds = new Set(locked.map((r) => r.id));

    const claimed: ClaimedJobRow[] = [];
    for (const row of rows) {
      if (!lockedIds.has(row.id)) continue;
      assertTransition(row.state as DurableJob["state"], "DISPATCH_LEASED");
      const updated = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE "DurableJob"
        SET
          state = 'DISPATCH_LEASED',
          "leaseOwner" = ${workerId},
          "leaseExpiresAt" = ${leaseExpiresAt},
          "updatedAt" = ${now}
        WHERE id = ${row.id}
          AND state = CAST(${row.state} AS "DurableJobState")
        RETURNING id
      `;
      if (updated.length === 0) continue;
      claimed.push({ ...row, state: "DISPATCH_LEASED" });
    }
    return claimed;
  });
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

async function supersedeTerminalDispatch(
  prisma: ReturnType<typeof getControlPlanePrisma>,
  dispatch: JobDispatch,
  reason: string,
  now: Date,
): Promise<void> {
  await prisma.jobDispatch.update({
    where: { id: dispatch.id },
    data: {
      state: "SUPERSEDED",
      completedAt: now,
      // Persist bounded reason on failureSummary-equivalent fields when present —
      // JobDispatch has no failureSummary; use leaseOwner clear + DataIssue separately.
      leaseOwner: null,
      leaseExpiresAt: null,
    },
  });
  await prisma.dataIssue.create({
    data: {
      shopId: dispatch.shopId,
      reasonCode: reason.slice(0, 64),
      severity: "WARNING",
      redactedEvidence: {
        durableJobId: dispatch.durableJobId,
        dispatchId: dispatch.id,
        dispatchSequence: dispatch.dispatchSequence,
        queueJobId: dispatch.queueJobId,
        reason,
      },
    },
  });
}

async function markDispatchFailed(
  prisma: ReturnType<typeof getControlPlanePrisma>,
  dispatch: JobDispatch,
  reason: string,
  now: Date,
): Promise<void> {
  await prisma.jobDispatch.update({
    where: { id: dispatch.id },
    data: {
      state: "FAILED",
      completedAt: now,
      leaseOwner: null,
      leaseExpiresAt: null,
    },
  });
  await prisma.dataIssue.create({
    data: {
      shopId: dispatch.shopId,
      reasonCode: reason.slice(0, 64),
      severity: "WARNING",
      redactedEvidence: {
        durableJobId: dispatch.durableJobId,
        dispatchId: dispatch.id,
        dispatchSequence: dispatch.dispatchSequence,
        queueJobId: dispatch.queueJobId,
        reason,
      },
    },
  });
}

async function addJobToQueue(
  job: ClaimedJobRow,
  dispatch: JobDispatch,
  shop: { id: string; myshopifyDomain: string },
  envelope: ReturnType<typeof createTenantJobEnvelopeV3>,
): Promise<Queue> {
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
    const queue = getWebhookQueue();
    await queue.add(
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
    return queue;
  }

  const name =
    job.jobType === "catalog-sync"
      ? "catalog-sync"
      : job.jobType === "abc-analysis-shop"
        ? "abc-analysis-shop"
        : job.jobType;
  const queue = getCronQueue();
  await queue.add(
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
  return queue;
}

/**
 * Ensure a runnable BullMQ dispatch exists for the JobDispatch identity.
 * Never treats mere getJob() object existence as runnable (NEW-PR4-C01).
 */
export async function enqueueWithDispatch(
  job: ClaimedJobRow,
  dispatch: JobDispatch,
  options?: { workerId?: string; leaseMs?: number },
): Promise<EnqueueDispatchResult> {
  const prisma = getControlPlanePrisma();
  const now = new Date();
  const shop = await prisma.shop.findUnique({
    where: { id: job.shopId },
    select: {
      id: true,
      myshopifyDomain: true,
      processingEnabled: true,
      uninstalledAt: true,
    },
  });

  if (!shop || !shop.processingEnabled) {
    await markDispatchFailed(prisma, dispatch, "shop_processing_disabled", now);
    let cancelled = false;
    if (shop?.uninstalledAt) {
      const cancelledRows = await prisma.$queryRaw<Array<{ id: string }>>`
        UPDATE "DurableJob"
        SET
          state = 'CANCELLED',
          "cancelledAt" = ${now},
          "leaseOwner" = NULL,
          "leaseExpiresAt" = NULL,
          "updatedAt" = ${now}
        WHERE id = ${job.id}
          AND state = 'DISPATCH_LEASED'
        RETURNING id
      `;
      cancelled = cancelledRows.length > 0;
    } else {
      // Processing disabled without uninstall — return to PENDING; do not ack ENQUEUED.
      await prisma.$executeRaw`
        UPDATE "DurableJob"
        SET
          state = 'PENDING',
          "leaseOwner" = NULL,
          "leaseExpiresAt" = NULL,
          "updatedAt" = ${now}
        WHERE id = ${job.id}
          AND state = 'DISPATCH_LEASED'
      `;
    }
    return { outcome: "shop_disabled", dispatch, cancelled };
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

  const queue = resolveQueue(job);

  let presence: QueueDispatchPresence;
  try {
    presence = await inspectQueueDispatchPresence(queue, dispatch.queueJobId);
  } catch (err) {
    return {
      outcome: "queue_unavailable",
      reason: err instanceof Error ? err.message : "inspect_failed",
      dispatch,
    };
  }

  if (presence.status === "QUEUE_UNAVAILABLE") {
    return {
      outcome: "queue_unavailable",
      reason: presence.reason,
      dispatch,
    };
  }

  if (
    presence.status === "RUNNABLE_EXISTING" ||
    presence.status === "RUNNABLE_CREATED"
  ) {
    return { outcome: "runnable", presence, dispatch };
  }

  if (
    presence.status === "TERMINAL_EXISTING" ||
    presence.status === "UNKNOWN_STATE"
  ) {
    // Prior deterministic ID is non-runnable — supersede and allocate a new sequence.
    await supersedeTerminalDispatch(
      prisma,
      dispatch,
      presence.status === "TERMINAL_EXISTING"
        ? "retained_terminal_queue_job"
        : "unknown_queue_state",
      now,
    );

    const workerId = options?.workerId ?? `dispatcher:${randomUUID()}`;
    const leaseMs = options?.leaseMs ?? DEFAULT_DISPATCH_LEASE_MS;
    const next = await ensureDispatchRecord(
      prisma,
      { ...job, /* force new sequence by having no PENDING_ENQUEUE */ },
      workerId,
      leaseMs,
      now,
    );
    // ensureDispatchRecord may reuse PENDING_ENQUEUE — after supersede there is none,
    // so it creates nextSeq. If somehow same id returned, force create.
    let newDispatch = next;
    if (newDispatch.id === dispatch.id || newDispatch.dispatchSequence === dispatch.dispatchSequence) {
      const last = await prisma.jobDispatch.findFirst({
        where: { durableJobId: job.id, shopId: job.shopId },
        orderBy: { dispatchSequence: "desc" },
      });
      const nextSeq = (last?.dispatchSequence ?? 0) + 1;
      newDispatch = await prisma.jobDispatch.create({
        data: {
          shopId: job.shopId,
          durableJobId: job.id,
          dispatchSequence: nextSeq,
          queueName: job.queueName,
          queueJobId: formatQueueJobId(job.id, nextSeq),
          state: "PENDING_ENQUEUE",
          leaseOwner: workerId,
          leaseExpiresAt: new Date(now.getTime() + leaseMs),
          payloadDigest: job.payloadDigest,
        },
      });
    }

    const newEnvelope = createTenantJobEnvelopeV3({
      tenant,
      source: job.source as TenantJobSource,
      durableJobId: job.id,
      dispatchId: newDispatch.id,
      dispatchSequence: newDispatch.dispatchSequence,
      queueJobId: newDispatch.queueJobId,
      payloadDigest: job.payloadDigest,
    });

    try {
      const targetQueue = await addJobToQueue(job, newDispatch, shop, newEnvelope);
      const after = await classifyAfterQueueAdd(
        targetQueue,
        newDispatch.queueJobId,
        await targetQueue.getJob(newDispatch.queueJobId),
      );
      if (
        after.status === "RUNNABLE_EXISTING" ||
        after.status === "RUNNABLE_CREATED"
      ) {
        return {
          outcome: "runnable",
          presence: after,
          dispatch: newDispatch,
        };
      }
      await markDispatchFailed(
        prisma,
        newDispatch,
        after.status === "TERMINAL_EXISTING"
          ? "retained_terminal_queue_job"
          : `enqueue_not_runnable:${after.status}`,
        new Date(),
      );
      return { outcome: "not_runnable", presence: after, dispatch: newDispatch };
    } catch (err) {
      return {
        outcome: "queue_unavailable",
        reason: err instanceof Error ? err.message : "queue_add_failed",
        dispatch: newDispatch,
      };
    }
  }

  // MISSING — create the queue job for this dispatch sequence.
  try {
    const targetQueue = await addJobToQueue(job, dispatch, shop, envelope);
    const after = await classifyAfterQueueAdd(
      targetQueue,
      dispatch.queueJobId,
      await targetQueue.getJob(dispatch.queueJobId),
    );
    if (
      after.status === "RUNNABLE_EXISTING" ||
      after.status === "RUNNABLE_CREATED"
    ) {
      return { outcome: "runnable", presence: after, dispatch };
    }
    if (after.status === "TERMINAL_EXISTING" || after.status === "UNKNOWN_STATE") {
      // queue.add returned a retained non-runnable job under this ID.
      await supersedeTerminalDispatch(
        prisma,
        dispatch,
        after.status === "TERMINAL_EXISTING"
          ? "retained_terminal_queue_job"
          : "unknown_queue_state",
        new Date(),
      );
      return { outcome: "not_runnable", presence: after, dispatch };
    }
    await markDispatchFailed(
      prisma,
      dispatch,
      `enqueue_not_runnable:${after.status}`,
      new Date(),
    );
    return { outcome: "not_runnable", presence: after, dispatch };
  } catch (err) {
    return {
      outcome: "queue_unavailable",
      reason: err instanceof Error ? err.message : "queue_add_failed",
      dispatch,
    };
  }
}

/**
 * Atomic acknowledgement: DurableJob + JobDispatch in one transaction with
 * exact identity checks (NEW-PR4-C01).
 */
async function ackEnqueued(
  prisma: ReturnType<typeof getControlPlanePrisma>,
  input: {
    jobId: string;
    shopId: string;
    dispatchId: string;
    dispatchSequence: number;
    queueName: string;
    queueJobId: string;
    payloadDigest: string;
    now: Date;
  },
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const jobAck = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE "DurableJob"
      SET
        state = 'ENQUEUED',
        "enqueuedAt" = ${input.now},
        "leaseOwner" = NULL,
        "leaseExpiresAt" = NULL,
        "activeDispatchSequence" = ${input.dispatchSequence},
        "updatedAt" = ${input.now}
      WHERE id = ${input.jobId}
        AND "shopId" = ${input.shopId}
        AND state = 'DISPATCH_LEASED'
      RETURNING id
    `;
    if (jobAck.length === 0) return false;

    const dispatchAck = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE "JobDispatch"
      SET
        state = 'ENQUEUED',
        "enqueuedAt" = ${input.now},
        "leaseOwner" = NULL,
        "leaseExpiresAt" = NULL
      WHERE id = ${input.dispatchId}
        AND "shopId" = ${input.shopId}
        AND "durableJobId" = ${input.jobId}
        AND "dispatchSequence" = ${input.dispatchSequence}
        AND "queueName" = ${input.queueName}
        AND "queueJobId" = ${input.queueJobId}
        AND "payloadDigest" = ${input.payloadDigest}
        AND state = 'PENDING_ENQUEUE'
      RETURNING id
    `;
    if (dispatchAck.length === 0) {
      throw new Error("ack_enqueued_dispatch_identity_mismatch");
    }
    return true;
  });
}

/**
 * Defense-in-depth: recover stranded ENQUEUED jobs with no unfinished attempt
 * and no runnable Redis dispatch (NEW-PR4-C01).
 */
export async function recoverStrandedEnqueuedJobs(options?: {
  olderThanMs?: number;
  limit?: number;
  now?: Date;
}): Promise<{ recovered: number; deadLettered: number }> {
  const prisma = getControlPlanePrisma();
  const now = options?.now ?? new Date();
  const olderThanMs = options?.olderThanMs ?? DEFAULT_STRANDED_ENQUEUED_MS;
  const limit = options?.limit ?? 50;
  const cutoff = new Date(now.getTime() - olderThanMs);
  let recovered = 0;
  let deadLettered = 0;

  const candidates = await prisma.durableJob.findMany({
    where: {
      state: "ENQUEUED",
      enqueuedAt: { lt: cutoff },
      attempts: { none: { finishedAt: null } },
    },
    take: limit,
    orderBy: { enqueuedAt: "asc" },
  });

  for (const job of candidates) {
    try {
      const outcome = await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<DurableJob[]>`
          SELECT * FROM "DurableJob"
          WHERE id = ${job.id} AND "shopId" = ${job.shopId} AND state = 'ENQUEUED'
          FOR UPDATE
        `;
        if (locked.length === 0) return "noop" as const;
        const live = locked[0];

        const unfinished = await tx.jobAttempt.count({
          where: { durableJobId: live.id, finishedAt: null },
        });
        if (unfinished > 0) return "noop" as const;

        const activeDispatch = await tx.jobDispatch.findFirst({
          where: {
            durableJobId: live.id,
            shopId: live.shopId,
            dispatchSequence: live.activeDispatchSequence ?? undefined,
            state: { in: ["ENQUEUED", "OBSERVED", "STARTED", "PENDING_ENQUEUE"] },
          },
          orderBy: { dispatchSequence: "desc" },
        });

        if (!activeDispatch) {
          // No active dispatch — recover to RETRY_WAIT.
          assertTransition("ENQUEUED", "RETRY_WAIT");
          await tx.$executeRaw`
            UPDATE "DurableJob"
            SET
              state = 'RETRY_WAIT',
              "nextEligibleAt" = ${now},
              "leaseOwner" = NULL,
              "leaseExpiresAt" = NULL,
              "failureCode" = 'stranded_enqueued',
              "failureSummary" = 'ENQUEUED with no active JobDispatch',
              "updatedAt" = ${now}
            WHERE id = ${live.id} AND state = 'ENQUEUED'
          `;
          await tx.dataIssue.create({
            data: {
              shopId: live.shopId,
              reasonCode: "stranded_enqueued",
              severity: "ERROR",
              redactedEvidence: { durableJobId: live.id },
            },
          });
          return "recovered" as const;
        }

        // Inspect Redis outside? We need queue state — do it after lock via non-tx check
        // then re-enter. For atomicity: mark dispatch based on presence inspected before.
        return { kind: "inspect" as const, live, activeDispatch };
      });

      if (outcome === "recovered") {
        recovered += 1;
        continue;
      }
      if (outcome === "noop" || !outcome || typeof outcome === "string") {
        continue;
      }

      const queue =
        outcome.live.queueName === WEBHOOK_QUEUE ||
        outcome.live.jobType.startsWith("webhook:")
          ? getWebhookQueue()
          : getCronQueue();
      const presence = await inspectQueueDispatchPresence(
        queue,
        outcome.activeDispatch.queueJobId,
      );

      if (
        presence.status === "RUNNABLE_EXISTING" ||
        presence.status === "RUNNABLE_CREATED"
      ) {
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.jobDispatch.updateMany({
          where: {
            id: outcome.activeDispatch.id,
            shopId: outcome.live.shopId,
            state: { in: ["ENQUEUED", "OBSERVED", "STARTED", "PENDING_ENQUEUE"] },
          },
          data: {
            state: "FAILED",
            completedAt: now,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });

        if (
          outcome.live.attemptCount >= outcome.live.maxAttempts ||
          outcome.live.executionStrategy === "NO_AUTOMATIC_RETRY"
        ) {
          assertTransition("ENQUEUED", "CANCELLED");
          // Prefer CANCELLED then operator replay — or FAILED path:
          // ENQUEUED → RETRY_WAIT is the recovery edge; max attempts → dead-letter via retry claim.
          await tx.$executeRaw`
            UPDATE "DurableJob"
            SET
              state = 'RETRY_WAIT',
              "nextEligibleAt" = ${now},
              "leaseOwner" = NULL,
              "leaseExpiresAt" = NULL,
              "failureCode" = 'stranded_enqueued',
              "failureSummary" = 'ENQUEUED without runnable Redis dispatch',
              "updatedAt" = ${now}
            WHERE id = ${outcome.live.id} AND state = 'ENQUEUED'
          `;
        } else {
          assertTransition("ENQUEUED", "RETRY_WAIT");
          await tx.$executeRaw`
            UPDATE "DurableJob"
            SET
              state = 'RETRY_WAIT',
              "nextEligibleAt" = ${now},
              "leaseOwner" = NULL,
              "leaseExpiresAt" = NULL,
              "failureCode" = 'stranded_enqueued',
              "failureSummary" = 'ENQUEUED without runnable Redis dispatch',
              "updatedAt" = ${now}
            WHERE id = ${outcome.live.id} AND state = 'ENQUEUED'
          `;
        }

        await tx.dataIssue.create({
          data: {
            shopId: outcome.live.shopId,
            reasonCode: "stranded_enqueued",
            severity: "ERROR",
            redactedEvidence: {
              durableJobId: outcome.live.id,
              dispatchId: outcome.activeDispatch.id,
              presence: presence.status,
            },
          },
        });
      });
      recovered += 1;
    } catch (err) {
      console.error(
        `recoverStrandedEnqueuedJobs failed for ${job.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { recovered, deadLettered };
}

export type DispatchPendingJobsResult = {
  recoveredLeases: number;
  claimed: number;
  enqueued: number;
  failed: number;
  skippedNotRunnable: number;
  shopDisabled: number;
  workerId: string;
};

/**
 * Claim eligible durable jobs and deliver to BullMQ with distinct dispatch IDs.
 * Acknowledges ENQUEUED only when a runnable queue job is confirmed.
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
  let skippedNotRunnable = 0;
  let shopDisabled = 0;

  for (const job of claimed) {
    if (!job.executionStrategy) {
      const strategy = executionStrategyForJobType(job.jobType);
      await prisma.durableJob.update({
        where: { id: job.id },
        data: { executionStrategy: strategy },
      });
      job.executionStrategy = strategy;
    }

    try {
      // Re-check shop after claim (disabled after claim, before ack).
      const shopLive = await prisma.shop.findUnique({
        where: { id: job.shopId },
        select: { processingEnabled: true, uninstalledAt: true },
      });
      if (!shopLive?.processingEnabled) {
        const dispatch = await ensureDispatchRecord(
          prisma,
          job,
          workerId,
          leaseMs,
          new Date(),
        );
        const disabled = await enqueueWithDispatch(job, dispatch, {
          workerId,
          leaseMs,
        });
        if (disabled.outcome === "shop_disabled") shopDisabled += 1;
        else skippedNotRunnable += 1;
        continue;
      }

      const dispatch = await ensureDispatchRecord(
        prisma,
        job,
        workerId,
        leaseMs,
        new Date(),
      );
      const result = await enqueueWithDispatch(job, dispatch, {
        workerId,
        leaseMs,
      });

      if (result.outcome === "runnable") {
        const acked = await ackEnqueued(prisma, {
          jobId: job.id,
          shopId: job.shopId,
          dispatchId: result.dispatch.id,
          dispatchSequence: result.dispatch.dispatchSequence,
          queueName: result.dispatch.queueName,
          queueJobId: result.dispatch.queueJobId,
          payloadDigest: result.dispatch.payloadDigest,
          now: new Date(),
        });
        if (acked) enqueued += 1;
        else skippedNotRunnable += 1;
      } else if (result.outcome === "shop_disabled") {
        shopDisabled += 1;
      } else if (result.outcome === "queue_unavailable") {
        // Leave DISPATCH_LEASED — lease expiry recovers; same sequence reused.
        failed += 1;
        console.error(
          `dispatchPendingJobs queue unavailable for ${job.id}: ${result.reason}`,
        );
      } else {
        skippedNotRunnable += 1;
        // Return to PENDING so a later cycle can allocate a fresh sequence.
        await prisma.$executeRaw`
          UPDATE "DurableJob"
          SET
            state = 'PENDING',
            "leaseOwner" = NULL,
            "leaseExpiresAt" = NULL,
            "updatedAt" = ${new Date()}
          WHERE id = ${job.id}
            AND state = 'DISPATCH_LEASED'
        `;
      }
    } catch (err) {
      failed += 1;
      console.error(
        `dispatchPendingJobs failed for ${job.id}:`,
        err instanceof Error ? err.message : err,
      );
      // Leave DISPATCH_LEASED — lease expiry recovers to PENDING; same dispatch
      // sequence is reused on next claim via PENDING_ENQUEUE reuse when outcome unknown.
    }
  }

  return {
    recoveredLeases,
    claimed: claimed.length,
    enqueued,
    failed,
    skippedNotRunnable,
    shopDisabled,
    workerId,
  };
}

void CRON_QUEUE;
