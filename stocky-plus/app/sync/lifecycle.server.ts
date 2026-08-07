/**
 * Durable job attempt lifecycle — CAS transitions, attempt leases, recovery.
 * F-PR4-04 / F-PR4-05 / F-PR4-14
 */
import type { DurableJob, JobAttempt, Prisma } from "@prisma/client";
import { getControlPlanePrisma } from "./control-plane-db.server";
import { SyncControlPlaneError } from "./errors";
import {
  APPLICATION_OUTCOME_UNCERTAIN,
  executionStrategyForJobType,
  tryResolveApplicationKey,
} from "./execution-strategy.server";
import { assertTransition } from "./state-machine.server";

const DEFAULT_BACKOFF_MS = 1000;
export const DEFAULT_ATTEMPT_LEASE_MS = 60_000;
export const DEFAULT_HEARTBEAT_RENEW_MS = 20_000;

export type ClaimAttemptResult = {
  job: DurableJob;
  attempt: JobAttempt;
};

type Tx = Prisma.TransactionClient;

async function lockDurableJob(
  tx: Tx,
  durableJobId: string,
  shopId: string,
): Promise<DurableJob | null> {
  const rows = await tx.$queryRaw<DurableJob[]>`
    SELECT * FROM "DurableJob"
    WHERE id = ${durableJobId} AND "shopId" = ${shopId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

/**
 * Transition ENQUEUED → RUNNING and append a new JobAttempt with lease.
 */
export async function claimAttempt(input: {
  durableJobId: string;
  shopId: string;
  workerId: string;
  jobDispatchId?: string | null;
  leaseMs?: number;
}): Promise<ClaimAttemptResult> {
  const prisma = getControlPlanePrisma();
  const leaseMs = input.leaseMs ?? DEFAULT_ATTEMPT_LEASE_MS;
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);

  return prisma.$transaction(async (tx) => {
    const job = await lockDurableJob(tx, input.durableJobId, input.shopId);
    if (!job) {
      throw new SyncControlPlaneError("job_not_found", "DurableJob not found");
    }

    if (job.state === "CANCELLED") {
      throw new SyncControlPlaneError(
        "illegal_job_transition",
        "Cannot claim cancelled job",
      );
    }

    if (job.state === "RUNNING") {
      throw new SyncControlPlaneError(
        "attempt_conflict",
        "DurableJob already has an active attempt",
      );
    }

    assertTransition(job.state, "RUNNING");

    const attemptNumber = job.attemptCount + 1;
    const attempt = await tx.jobAttempt.create({
      data: {
        shopId: job.shopId,
        durableJobId: job.id,
        attemptNumber,
        workerId: input.workerId,
        jobDispatchId: input.jobDispatchId ?? undefined,
        leaseOwner: input.workerId,
        leaseExpiresAt,
        heartbeatAt: now,
        startedAt: now,
      },
    });

    const updatedRows = await tx.$queryRaw<DurableJob[]>`
      UPDATE "DurableJob"
      SET
        state = 'RUNNING',
        "attemptCount" = ${attemptNumber},
        "startedAt" = COALESCE("startedAt", ${now}),
        "leaseOwner" = ${input.workerId},
        "leaseExpiresAt" = ${leaseExpiresAt},
        "updatedAt" = ${now}
      WHERE id = ${job.id}
        AND state = CAST(${job.state} AS "DurableJobState")
      RETURNING *
    `;
    if (updatedRows.length === 0) {
      throw new SyncControlPlaneError(
        "attempt_conflict",
        "Lost race claiming DurableJob",
      );
    }

    if (input.jobDispatchId) {
      await tx.jobDispatch.updateMany({
        where: { id: input.jobDispatchId, shopId: job.shopId },
        data: { state: "STARTED", startedAt: now },
      });
    }

    return { job: updatedRows[0], attempt };
  });
}

export async function renewAttemptHeartbeat(input: {
  attemptId: string;
  shopId: string;
  workerId: string;
  leaseMs?: number;
}): Promise<JobAttempt | null> {
  const prisma = getControlPlanePrisma();
  const leaseMs = input.leaseMs ?? DEFAULT_ATTEMPT_LEASE_MS;
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);

  // NEW-PR4-SC04: resolve the exact unfinished attempt first — never pass an
  // optional durableJobId that becomes an omitted Prisma filter.
  const attempt = await prisma.jobAttempt.findFirst({
    where: {
      id: input.attemptId,
      shopId: input.shopId,
      finishedAt: null,
      leaseOwner: input.workerId,
    },
    select: { id: true, durableJobId: true },
  });
  if (!attempt || !attempt.durableJobId) {
    return null;
  }

  const updated = await prisma.jobAttempt.updateMany({
    where: {
      id: attempt.id,
      shopId: input.shopId,
      finishedAt: null,
      leaseOwner: input.workerId,
    },
    data: {
      heartbeatAt: now,
      leaseExpiresAt,
    },
  });
  if (updated.count === 0) return null;

  await prisma.durableJob.updateMany({
    where: {
      id: attempt.durableJobId,
      shopId: input.shopId,
      state: "RUNNING",
      leaseOwner: input.workerId,
    },
    data: { leaseExpiresAt, leaseOwner: input.workerId },
  });

  return prisma.jobAttempt.findUnique({ where: { id: attempt.id } });
}

export async function completeAttemptSuccess(input: {
  durableJobId: string;
  shopId: string;
  attemptId: string;
  workerId?: string;
  resultMetadata?: Prisma.InputJsonValue;
}): Promise<DurableJob> {
  const prisma = getControlPlanePrisma();
  return prisma.$transaction(async (tx) => {
    const job = await lockDurableJob(tx, input.durableJobId, input.shopId);
    if (!job) {
      throw new SyncControlPlaneError("job_not_found", "DurableJob not found");
    }
    if (job.state === "CANCELLED" || job.state === "SUCCEEDED") {
      throw new SyncControlPlaneError(
        "illegal_job_transition",
        `Cannot complete success from ${job.state}`,
      );
    }
    assertTransition(job.state, "SUCCEEDED");

    const attempt = await tx.jobAttempt.findFirst({
      where: { id: input.attemptId, shopId: input.shopId },
    });
    if (!attempt || attempt.finishedAt) {
      throw new SyncControlPlaneError(
        "attempt_conflict",
        "Attempt missing or already finished",
      );
    }
    if (input.workerId && attempt.leaseOwner && attempt.leaseOwner !== input.workerId) {
      throw new SyncControlPlaneError(
        "stale_worker_completion",
        "Stale worker cannot complete after recovery",
      );
    }

    await tx.jobAttempt.update({
      where: { id: input.attemptId },
      data: {
        finishedAt: new Date(),
        outcome: "SUCCEEDED",
        resultMetadata: input.resultMetadata ?? undefined,
        leaseExpiresAt: null,
      },
    });

    const updatedRows = await tx.$queryRaw<DurableJob[]>`
      UPDATE "DurableJob"
      SET
        state = 'SUCCEEDED',
        "completedAt" = ${new Date()},
        "leaseOwner" = NULL,
        "leaseExpiresAt" = NULL,
        "updatedAt" = ${new Date()}
      WHERE id = ${job.id}
        AND state = CAST(${job.state} AS "DurableJobState")
      RETURNING *
    `;
    if (updatedRows.length === 0) {
      throw new SyncControlPlaneError(
        "illegal_job_transition",
        "Lost race completing success",
      );
    }

    if (job.webhookDeliveryId) {
      await tx.webhookDelivery.updateMany({
        where: { id: job.webhookDeliveryId, shopId: job.shopId },
        data: { state: "COMPLETED", completedAt: new Date() },
      });
    }

    if (attempt.jobDispatchId) {
      await tx.jobDispatch.updateMany({
        where: { id: attempt.jobDispatchId, shopId: job.shopId },
        data: { state: "COMPLETED", completedAt: new Date() },
      });
    }

    return updatedRows[0];
  });
}

export async function completeAttemptRetry(input: {
  durableJobId: string;
  shopId: string;
  attemptId: string;
  workerId?: string;
  errorCode?: string;
  failureSummary?: string;
  backoffMs?: number;
  retryClassification?: string;
}): Promise<DurableJob> {
  const prisma = getControlPlanePrisma();
  return prisma.$transaction(async (tx) => {
    const job = await lockDurableJob(tx, input.durableJobId, input.shopId);
    if (!job) {
      throw new SyncControlPlaneError("job_not_found", "DurableJob not found");
    }

    const strategy =
      job.executionStrategy ?? executionStrategyForJobType(job.jobType);

    if (strategy === "NO_AUTOMATIC_RETRY") {
      return completeAttemptDeadLetterInTx(tx, {
        job,
        attemptId: input.attemptId,
        terminalReason: APPLICATION_OUTCOME_UNCERTAIN,
        errorCode: APPLICATION_OUTCOME_UNCERTAIN,
        failureSummary:
          input.failureSummary ?? "Non-atomic job cannot be automatically retried",
      });
    }

    if (job.attemptCount >= job.maxAttempts) {
      return completeAttemptDeadLetterInTx(tx, {
        job,
        attemptId: input.attemptId,
        terminalReason: "max_attempts_exceeded",
        errorCode: input.errorCode ?? "max_attempts_exceeded",
        failureSummary: input.failureSummary ?? "Max attempts exceeded",
      });
    }

    assertTransition(job.state, "RETRY_WAIT");
    const backoff =
      input.backoffMs ?? DEFAULT_BACKOFF_MS * 2 ** (job.attemptCount - 1);

    await tx.jobAttempt.update({
      where: { id: input.attemptId },
      data: {
        finishedAt: new Date(),
        outcome: "RETRYABLE_FAILURE",
        errorCode: input.errorCode,
        failureSummary: input.failureSummary?.slice(0, 512),
        backoffMs: backoff,
        retryClassification: input.retryClassification ?? "retryable",
        leaseExpiresAt: null,
      },
    });

    const updatedRows = await tx.$queryRaw<DurableJob[]>`
      UPDATE "DurableJob"
      SET
        state = 'RETRY_WAIT',
        "nextEligibleAt" = ${new Date(Date.now() + backoff)},
        "failureCode" = ${input.errorCode ?? null},
        "failureSummary" = ${input.failureSummary?.slice(0, 512) ?? null},
        "leaseOwner" = NULL,
        "leaseExpiresAt" = NULL,
        "updatedAt" = ${new Date()}
      WHERE id = ${job.id}
        AND state = CAST(${job.state} AS "DurableJobState")
      RETURNING *
    `;
    if (updatedRows.length === 0) {
      throw new SyncControlPlaneError(
        "illegal_job_transition",
        "Lost race completing retry",
      );
    }
    return updatedRows[0];
  });
}

export async function completeAttemptFail(input: {
  durableJobId: string;
  shopId: string;
  attemptId: string;
  errorCode: string;
  failureSummary: string;
}): Promise<DurableJob> {
  // NEW-PR4-C06: non-retryable failure always enters the durable dead-letter path
  // in one transaction. No caller-controlled deadLetter bypass.
  const prisma = getControlPlanePrisma();
  return prisma.$transaction(async (tx) => {
    const job = await lockDurableJob(tx, input.durableJobId, input.shopId);
    if (!job) {
      throw new SyncControlPlaneError("job_not_found", "DurableJob not found");
    }
    return completeAttemptDeadLetterInTx(tx, {
      job,
      attemptId: input.attemptId,
      terminalReason: input.errorCode,
      errorCode: input.errorCode,
      failureSummary: input.failureSummary,
    });
  });
}

export async function completeAttemptDeadLetter(input: {
  durableJobId: string;
  shopId: string;
  attemptId: string;
  terminalReason: string;
  errorCode?: string;
  failureSummary?: string;
}): Promise<DurableJob> {
  const prisma = getControlPlanePrisma();
  return prisma.$transaction(async (tx) => {
    const job = await lockDurableJob(tx, input.durableJobId, input.shopId);
    if (!job) {
      throw new SyncControlPlaneError("job_not_found", "DurableJob not found");
    }
    return completeAttemptDeadLetterInTx(tx, {
      job,
      attemptId: input.attemptId,
      terminalReason: input.terminalReason,
      errorCode: input.errorCode,
      failureSummary: input.failureSummary,
    });
  });
}

async function completeAttemptDeadLetterInTx(
  tx: Tx,
  input: {
    job: DurableJob;
    attemptId: string;
    terminalReason: string;
    errorCode?: string;
    failureSummary?: string;
    skipAttemptUpdate?: boolean;
  },
): Promise<DurableJob> {
  const { job } = input;
  const now = new Date();

  if (job.state === "RUNNING") {
    assertTransition("RUNNING", "FAILED");
  } else if (job.state !== "FAILED" && job.state !== "DEAD_LETTERED") {
    assertTransition(job.state, "DEAD_LETTERED");
  }

  if (!input.skipAttemptUpdate) {
    await tx.jobAttempt.update({
      where: { id: input.attemptId },
      data: {
        finishedAt: now,
        outcome: "NON_RETRYABLE_FAILURE",
        errorCode: input.errorCode ?? input.terminalReason,
        failureSummary: input.failureSummary?.slice(0, 512),
        leaseExpiresAt: null,
      },
    });
  }

  if (job.state === "RUNNING") {
    const failed = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE "DurableJob"
      SET
        state = 'FAILED',
        "failureCode" = ${input.errorCode ?? input.terminalReason},
        "failureSummary" = ${input.failureSummary?.slice(0, 512) ?? null},
        "updatedAt" = ${now}
      WHERE id = ${job.id}
        AND state = 'RUNNING'
      RETURNING id
    `;
    if (failed.length === 0) {
      throw new SyncControlPlaneError(
        "illegal_job_transition",
        "Lost race failing RUNNING job",
      );
    }
  }

  // F-PR4-14: assert against the live job state, not a vacuous literal pair.
  const preDeadLetter = await tx.durableJob.findUnique({ where: { id: job.id } });
  if (!preDeadLetter) {
    throw new SyncControlPlaneError("job_not_found", "DurableJob missing before dead-letter");
  }
  if (preDeadLetter.state === "DEAD_LETTERED") {
    return preDeadLetter;
  }
  assertTransition(preDeadLetter.state, "DEAD_LETTERED");

  const openExisting = await tx.deadLetter.findFirst({
    where: {
      durableJobId: job.id,
      shopId: job.shopId,
      resolutionState: "OPEN",
    },
  });
  if (!openExisting) {
    await tx.deadLetter.create({
      data: {
        shopId: job.shopId,
        durableJobId: job.id,
        finalAttemptId: input.attemptId,
        terminalReason: input.terminalReason.slice(0, 128),
      },
    });
  }

  const updatedRows = await tx.$queryRaw<DurableJob[]>`
    UPDATE "DurableJob"
    SET
      state = 'DEAD_LETTERED',
      "deadLetteredAt" = ${now},
      "failureCode" = ${input.errorCode ?? input.terminalReason},
      "failureSummary" = ${input.failureSummary?.slice(0, 512) ?? null},
      "leaseOwner" = NULL,
      "leaseExpiresAt" = NULL,
      "updatedAt" = ${now}
    WHERE id = ${job.id}
      AND state = CAST(${preDeadLetter.state} AS "DurableJobState")
    RETURNING *
  `;
  if (updatedRows.length === 0) {
    const current = await tx.durableJob.findUnique({ where: { id: job.id } });
    if (current?.state === "DEAD_LETTERED") return current;
    throw new SyncControlPlaneError(
      "illegal_job_transition",
      "Could not transition to DEAD_LETTERED",
    );
  }

  if (job.webhookDeliveryId) {
    await tx.webhookDelivery.updateMany({
      where: { id: job.webhookDeliveryId, shopId: job.shopId },
      data: {
        state: "FAILED",
        failedAt: now,
        failureCode: input.errorCode ?? input.terminalReason,
        failureSummary: input.failureSummary?.slice(0, 512),
      },
    });
  }

  return updatedRows[0];
}

/**
 * Recover expired RUNNING attempts (F-PR4-04 / NEW-PR4-C02).
 *
 * One malformed attempt must never abort recovery for other jobs/shops.
 * Atomic application jobs:
 *   receipt present → finalize SUCCEEDED without reapplying
 *   receipt absent → prior tenant txn did not commit; retry or dead-letter
 * Unresolvable application identity → dead-letter with application_outcome_uncertain
 * Rebuildable: retry after strategy allows
 * Uncertain / NO_AUTOMATIC_RETRY: dead-letter with application_outcome_uncertain
 */
export async function recoverExpiredRunningAttempts(options?: {
  limit?: number;
  now?: Date;
}): Promise<{
  recovered: number;
  deadLettered: number;
  finalized: number;
  isolatedFailures: number;
}> {
  const prisma = getControlPlanePrisma();
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 100;
  let recovered = 0;
  let deadLettered = 0;
  let finalized = 0;
  let isolatedFailures = 0;

  const expired = await prisma.jobAttempt.findMany({
    where: {
      finishedAt: null,
      leaseExpiresAt: { lt: now },
    },
    take: limit,
    orderBy: { leaseExpiresAt: "asc" },
  });

  for (const attempt of expired) {
    try {
      const outcome = await prisma.$transaction(async (tx) => {
        const job = await lockDurableJob(tx, attempt.durableJobId, attempt.shopId);
        if (!job || job.state !== "RUNNING") {
          await tx.jobAttempt.updateMany({
            where: { id: attempt.id, finishedAt: null },
            data: {
              finishedAt: now,
              outcome: "LEASE_EXPIRED",
              errorCode: "lease_expired",
              failureSummary: "Attempt lease expired after job left RUNNING",
              leaseExpiresAt: null,
            },
          });
          return "noop" as const;
        }

        // Concurrent reaper claim: only one updater wins.
        const closed = await tx.jobAttempt.updateMany({
          where: { id: attempt.id, finishedAt: null },
          data: {
            finishedAt: now,
            outcome: "LEASE_EXPIRED",
            errorCode: "lease_expired",
            failureSummary: "Worker lease expired — attempt abandoned",
            leaseExpiresAt: null,
          },
        });
        if (closed.count === 0) return "noop" as const;

        const strategy =
          job.executionStrategy ?? executionStrategyForJobType(job.jobType);

        if (strategy === "ATOMIC_APPLICATION_RECEIPT") {
          const applicationKey = tryResolveApplicationKey({
            jobType: job.jobType,
            webhookDeliveryId: job.webhookDeliveryId,
            idempotencyKey: job.idempotencyKey,
          });

          if (applicationKey == null) {
            await tx.$executeRaw`
              UPDATE "DurableJob" SET state = 'FAILED', "updatedAt" = ${now}
              WHERE id = ${job.id} AND state = 'RUNNING'
            `;
            await completeAttemptDeadLetterInTx(tx, {
              job: { ...job, state: "FAILED" },
              attemptId: attempt.id,
              terminalReason: APPLICATION_OUTCOME_UNCERTAIN,
              errorCode: APPLICATION_OUTCOME_UNCERTAIN,
              failureSummary:
                "Expired RUNNING webhook attempt lacks webhookDeliveryId — application identity unresolvable",
              skipAttemptUpdate: true,
            });
            await tx.dataIssue.create({
              data: {
                shopId: job.shopId,
                reasonCode: APPLICATION_OUTCOME_UNCERTAIN,
                severity: "ERROR",
                redactedEvidence: {
                  durableJobId: job.id,
                  attemptId: attempt.id,
                  jobType: job.jobType,
                  cause: "webhook_application_key_requires_delivery",
                },
              },
            });
            return "dead_lettered" as const;
          }

          const receiptRows = await tx.$queryRawUnsafe<
            Array<{ has_receipt: boolean }>
          >(
            `SELECT stocky_has_application_receipt($1::text, $2::text) AS has_receipt`,
            job.shopId,
            applicationKey,
          );
          if (receiptRows[0]?.has_receipt === true) {
            const rows = await tx.$queryRaw<DurableJob[]>`
              UPDATE "DurableJob"
              SET
                state = 'SUCCEEDED',
                "completedAt" = ${now},
                "leaseOwner" = NULL,
                "leaseExpiresAt" = NULL,
                "failureCode" = NULL,
                "failureSummary" = NULL,
                "updatedAt" = ${now}
              WHERE id = ${job.id}
                AND state = 'RUNNING'
              RETURNING *
            `;
            if (rows.length === 0) return "noop" as const;
            if (attempt.jobDispatchId) {
              await tx.jobDispatch.updateMany({
                where: { id: attempt.jobDispatchId, shopId: job.shopId },
                data: { state: "COMPLETED", completedAt: now },
              });
            }
            if (job.webhookDeliveryId) {
              await tx.webhookDelivery.updateMany({
                where: { id: job.webhookDeliveryId, shopId: job.shopId },
                data: { state: "COMPLETED", completedAt: now },
              });
            }
            return "finalized" as const;
          }
        }

        if (strategy === "NO_AUTOMATIC_RETRY") {
          await tx.$executeRaw`
            UPDATE "DurableJob" SET state = 'FAILED', "updatedAt" = ${now}
            WHERE id = ${job.id} AND state = 'RUNNING'
          `;
          await completeAttemptDeadLetterInTx(tx, {
            job: { ...job, state: "FAILED" },
            attemptId: attempt.id,
            terminalReason: APPLICATION_OUTCOME_UNCERTAIN,
            errorCode: APPLICATION_OUTCOME_UNCERTAIN,
            failureSummary:
              "Expired RUNNING attempt for non-retryable strategy — outcome uncertain",
            skipAttemptUpdate: true,
          });
          return "dead_lettered" as const;
        }

        if (job.attemptCount >= job.maxAttempts) {
          await tx.$executeRaw`
            UPDATE "DurableJob" SET state = 'FAILED', "updatedAt" = ${now}
            WHERE id = ${job.id} AND state = 'RUNNING'
          `;
          await completeAttemptDeadLetterInTx(tx, {
            job: { ...job, state: "FAILED" },
            attemptId: attempt.id,
            terminalReason: "max_attempts_exceeded",
            errorCode: "max_attempts_exceeded",
            failureSummary: "Max attempts exceeded after lease expiry",
            skipAttemptUpdate: true,
          });
          return "dead_lettered" as const;
        }

        const backoff = DEFAULT_BACKOFF_MS * 2 ** Math.max(0, job.attemptCount - 1);
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          UPDATE "DurableJob"
          SET
            state = 'RETRY_WAIT',
            "nextEligibleAt" = ${new Date(now.getTime() + backoff)},
            "leaseOwner" = NULL,
            "leaseExpiresAt" = NULL,
            "failureCode" = 'lease_expired',
            "failureSummary" = 'Worker lease expired — retry scheduled',
            "updatedAt" = ${now}
          WHERE id = ${job.id}
            AND state = 'RUNNING'
          RETURNING id
        `;
        return rows.length > 0 ? ("recovered" as const) : ("noop" as const);
      });

      if (outcome === "recovered") recovered += 1;
      else if (outcome === "dead_lettered") deadLettered += 1;
      else if (outcome === "finalized") finalized += 1;
    } catch (err) {
      isolatedFailures += 1;
      console.error(
        `recoverExpiredRunningAttempts isolated failure attempt=${attempt.id}:`,
        err instanceof Error ? err.message : err,
      );
      try {
        await prisma.dataIssue.create({
          data: {
            shopId: attempt.shopId,
            reasonCode: "reaper_isolated_failure",
            severity: "ERROR",
            redactedEvidence: {
              attemptId: attempt.id,
              durableJobId: attempt.durableJobId,
              error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
            },
          },
        });
      } catch {
        // Never let health recording abort the batch.
      }
    }
  }

  return { recovered, deadLettered, finalized, isolatedFailures };
}
