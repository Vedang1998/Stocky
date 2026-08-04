/**
 * Durable job attempt lifecycle — claim, complete, retry, dead-letter.
 * Attempts are append-only; at most one active (unfinished) attempt per job.
 */
import type { DurableJob, JobAttempt, Prisma } from "@prisma/client";
import { getControlPlanePrisma } from "./control-plane-db.server";
import { SyncControlPlaneError } from "./errors";
import { assertTransition } from "./state-machine.server";

const DEFAULT_BACKOFF_MS = 1000;

export type ClaimAttemptResult = {
  job: DurableJob;
  attempt: JobAttempt;
};

/**
 * Transition ENQUEUED → RUNNING and append a new JobAttempt.
 */
export async function claimAttempt(input: {
  durableJobId: string;
  shopId: string;
  workerId: string;
}): Promise<ClaimAttemptResult> {
  const prisma = getControlPlanePrisma();

  return prisma.$transaction(async (tx) => {
    const job = await tx.durableJob.findFirst({
      where: { id: input.durableJobId, shopId: input.shopId },
    });
    if (!job) {
      throw new SyncControlPlaneError("job_not_found", "DurableJob not found");
    }

    if (job.state === "CANCELLED") {
      throw new SyncControlPlaneError(
        "illegal_job_transition",
        "Cannot claim cancelled job",
      );
    }

    const active = await tx.jobAttempt.findFirst({
      where: {
        durableJobId: job.id,
        shopId: job.shopId,
        finishedAt: null,
      },
    });
    if (active) {
      throw new SyncControlPlaneError(
        "attempt_conflict",
        "DurableJob already has an active attempt",
      );
    }

    // Concurrent second claim after first transitioned to RUNNING.
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
        startedAt: new Date(),
      },
    });

    const updated = await tx.durableJob.update({
      where: { id: job.id },
      data: {
        state: "RUNNING",
        attemptCount: attemptNumber,
        startedAt: job.startedAt ?? new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });

    return { job: updated, attempt };
  });
}

export async function completeAttemptSuccess(input: {
  durableJobId: string;
  shopId: string;
  attemptId: string;
  resultMetadata?: Prisma.InputJsonValue;
}): Promise<DurableJob> {
  const prisma = getControlPlanePrisma();
  return prisma.$transaction(async (tx) => {
    const job = await tx.durableJob.findFirst({
      where: { id: input.durableJobId, shopId: input.shopId },
    });
    if (!job) {
      throw new SyncControlPlaneError("job_not_found", "DurableJob not found");
    }
    assertTransition(job.state, "SUCCEEDED");

    await tx.jobAttempt.update({
      where: { id: input.attemptId },
      data: {
        finishedAt: new Date(),
        outcome: "SUCCEEDED",
        resultMetadata: input.resultMetadata ?? undefined,
      },
    });

    const updated = await tx.durableJob.update({
      where: { id: job.id },
      data: {
        state: "SUCCEEDED",
        completedAt: new Date(),
      },
    });

    if (job.webhookDeliveryId) {
      await tx.webhookDelivery.updateMany({
        where: { id: job.webhookDeliveryId, shopId: job.shopId },
        data: { state: "COMPLETED", completedAt: new Date() },
      });
    }

    return updated;
  });
}

export async function completeAttemptRetry(input: {
  durableJobId: string;
  shopId: string;
  attemptId: string;
  errorCode?: string;
  failureSummary?: string;
  backoffMs?: number;
  retryClassification?: string;
}): Promise<DurableJob> {
  const prisma = getControlPlanePrisma();
  return prisma.$transaction(async (tx) => {
    const job = await tx.durableJob.findFirst({
      where: { id: input.durableJobId, shopId: input.shopId },
    });
    if (!job) {
      throw new SyncControlPlaneError("job_not_found", "DurableJob not found");
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
    const backoff = input.backoffMs ?? DEFAULT_BACKOFF_MS * 2 ** (job.attemptCount - 1);

    await tx.jobAttempt.update({
      where: { id: input.attemptId },
      data: {
        finishedAt: new Date(),
        outcome: "RETRYABLE_FAILURE",
        errorCode: input.errorCode,
        failureSummary: input.failureSummary?.slice(0, 512),
        backoffMs: backoff,
        retryClassification: input.retryClassification ?? "retryable",
      },
    });

    return tx.durableJob.update({
      where: { id: job.id },
      data: {
        state: "RETRY_WAIT",
        nextEligibleAt: new Date(Date.now() + backoff),
        failureCode: input.errorCode,
        failureSummary: input.failureSummary?.slice(0, 512),
      },
    });
  });
}

export async function completeAttemptFail(input: {
  durableJobId: string;
  shopId: string;
  attemptId: string;
  errorCode: string;
  failureSummary: string;
  deadLetter?: boolean;
}): Promise<DurableJob> {
  const prisma = getControlPlanePrisma();
  return prisma.$transaction(async (tx) => {
    const job = await tx.durableJob.findFirst({
      where: { id: input.durableJobId, shopId: input.shopId },
    });
    if (!job) {
      throw new SyncControlPlaneError("job_not_found", "DurableJob not found");
    }

    const shouldDeadLetter =
      input.deadLetter === true || job.attemptCount >= job.maxAttempts;

    if (shouldDeadLetter) {
      return completeAttemptDeadLetterInTx(tx, {
        job,
        attemptId: input.attemptId,
        terminalReason: input.errorCode,
        errorCode: input.errorCode,
        failureSummary: input.failureSummary,
      });
    }

    assertTransition(job.state, "FAILED");
    await tx.jobAttempt.update({
      where: { id: input.attemptId },
      data: {
        finishedAt: new Date(),
        outcome: "NON_RETRYABLE_FAILURE",
        errorCode: input.errorCode,
        failureSummary: input.failureSummary.slice(0, 512),
      },
    });

    // Brief FAILED then dead-letter in same transaction when non-retryable.
    return completeAttemptDeadLetterInTx(tx, {
      job: { ...job, state: "FAILED" },
      attemptId: input.attemptId,
      terminalReason: input.errorCode,
      errorCode: input.errorCode,
      failureSummary: input.failureSummary,
      skipAttemptUpdate: true,
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
    const job = await tx.durableJob.findFirst({
      where: { id: input.durableJobId, shopId: input.shopId },
    });
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

type Tx = Prisma.TransactionClient;

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

  if (job.state === "RUNNING") {
    assertTransition("RUNNING", "FAILED");
  } else if (job.state !== "FAILED") {
    assertTransition(job.state, "DEAD_LETTERED");
  }

  if (!input.skipAttemptUpdate) {
    await tx.jobAttempt.update({
      where: { id: input.attemptId },
      data: {
        finishedAt: new Date(),
        outcome: "NON_RETRYABLE_FAILURE",
        errorCode: input.errorCode ?? input.terminalReason,
        failureSummary: input.failureSummary?.slice(0, 512),
      },
    });
  }

  if (job.state === "RUNNING") {
    await tx.durableJob.update({
      where: { id: job.id },
      data: {
        state: "FAILED",
        failureCode: input.errorCode ?? input.terminalReason,
        failureSummary: input.failureSummary?.slice(0, 512),
      },
    });
  }

  assertTransition("FAILED", "DEAD_LETTERED");

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

  const updated = await tx.durableJob.update({
    where: { id: job.id },
    data: {
      state: "DEAD_LETTERED",
      deadLetteredAt: new Date(),
      failureCode: input.errorCode ?? input.terminalReason,
      failureSummary: input.failureSummary?.slice(0, 512),
    },
  });

  if (job.webhookDeliveryId) {
    await tx.webhookDelivery.updateMany({
      where: { id: job.webhookDeliveryId, shopId: job.shopId },
      data: {
        state: "FAILED",
        failedAt: new Date(),
        failureCode: input.errorCode ?? input.terminalReason,
        failureSummary: input.failureSummary?.slice(0, 512),
      },
    });
  }

  return updated;
}
