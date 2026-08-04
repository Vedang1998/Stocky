/**
 * Test helpers for legal DurableJob state transitions under the DB trigger.
 */
import type { DurableJobState, PrismaClient } from "@prisma/client";
import { claimAttempt, completeAttemptRetry } from "../lifecycle.server";

/** PENDING → DISPATCH_LEASED → ENQUEUED (F-PR4-05 trigger-safe). */
export async function transitionToEnqueuedForTests(
  prisma: PrismaClient,
  durableJobId: string,
  extra?: { maxAttempts?: number },
): Promise<void> {
  if (extra?.maxAttempts != null) {
    await prisma.durableJob.update({
      where: { id: durableJobId },
      data: { maxAttempts: extra.maxAttempts },
    });
  }
  const step1 = await prisma.$executeRaw`
    UPDATE "DurableJob"
    SET state = 'DISPATCH_LEASED', "updatedAt" = NOW()
    WHERE id = ${durableJobId} AND state = 'PENDING'
  `;
  if (Number(step1) !== 1) {
    const cur = await prisma.durableJob.findUnique({ where: { id: durableJobId } });
    throw new Error(
      `transitionToEnqueued step1 failed id=${durableJobId} found=${cur?.state ?? "missing"}`,
    );
  }
  const step2 = await prisma.$executeRaw`
    UPDATE "DurableJob"
    SET state = 'ENQUEUED', "nextEligibleAt" = NOW(), "updatedAt" = NOW()
    WHERE id = ${durableJobId} AND state = 'DISPATCH_LEASED'
  `;
  if (Number(step2) !== 1) {
    throw new Error(`transitionToEnqueued step2 failed id=${durableJobId}`);
  }
}

/** RETRY_WAIT → DISPATCH_LEASED → ENQUEUED. */
export async function transitionRetryWaitToEnqueuedForTests(
  prisma: PrismaClient,
  durableJobId: string,
): Promise<void> {
  const step1 = await prisma.$executeRaw`
    UPDATE "DurableJob"
    SET state = 'DISPATCH_LEASED', "updatedAt" = NOW()
    WHERE id = ${durableJobId} AND state = 'RETRY_WAIT'
  `;
  if (Number(step1) !== 1) {
    throw new Error(`retry→enqueued step1 failed id=${durableJobId}`);
  }
  const step2 = await prisma.$executeRaw`
    UPDATE "DurableJob"
    SET state = 'ENQUEUED', "nextEligibleAt" = NOW(), "updatedAt" = NOW()
    WHERE id = ${durableJobId} AND state = 'DISPATCH_LEASED'
  `;
  if (Number(step2) !== 1) {
    throw new Error(`retry→enqueued step2 failed id=${durableJobId}`);
  }
}

/**
 * Move a PENDING job to a cancellable target state via legal transitions only.
 */
export async function forceCancellableStateForTests(
  prisma: PrismaClient,
  input: {
    durableJobId: string;
    shopId: string;
    target: Extract<
      DurableJobState,
      "PENDING" | "DISPATCH_LEASED" | "ENQUEUED" | "RUNNING" | "RETRY_WAIT"
    >;
  },
): Promise<void> {
  const { durableJobId, shopId, target } = input;
  if (target === "PENDING") return;

  if (target === "DISPATCH_LEASED") {
    await prisma.$executeRaw`
      UPDATE "DurableJob"
      SET
        state = 'DISPATCH_LEASED',
        "leaseOwner" = 'test-dispatcher',
        "leaseExpiresAt" = NOW() + INTERVAL '60 seconds',
        "updatedAt" = NOW()
      WHERE id = ${durableJobId} AND state = 'PENDING'
    `;
    return;
  }

  await transitionToEnqueuedForTests(prisma, durableJobId);

  if (target === "ENQUEUED") return;

  const { attempt } = await claimAttempt({
    durableJobId,
    shopId,
    workerId: "test-force-state",
    leaseMs: 60_000,
  });

  if (target === "RUNNING") return;

  // RETRY_WAIT
  await completeAttemptRetry({
    durableJobId,
    shopId,
    attemptId: attempt.id,
    workerId: "test-force-state",
    errorCode: "test_force_retry_wait",
    failureSummary: "forced for uninstall fixture",
    backoffMs: 60_000,
  });
}
