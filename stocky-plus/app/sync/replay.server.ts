/**
 * Dead-letter replay — new DurableJob + JobReplay lineage; original immutable.
 * F-PR4-15: require original DEAD_LETTERED + DeadLetter OPEN; lock both.
 */
import { randomUUID } from "node:crypto";
import type { DeadLetter, DurableJob, JobReplay, Prisma } from "@prisma/client";
import { getControlPlanePrisma } from "./control-plane-db.server";
import { DURABLE_JOB_AUTHORITY_VERSION } from "./intake.server";
import { executionStrategyForJobType } from "./execution-strategy.server";
import { SyncControlPlaneError } from "./errors";

export type ReplayDeadLetterResult = {
  deadLetter: DeadLetter;
  originalJob: DurableJob;
  newJob: DurableJob;
  replay: JobReplay;
};

/**
 * Replay an OPEN dead letter into a new PENDING DurableJob.
 * Never mutates the original job payload.
 * Application key for webhook replays remains the original webhook delivery.
 */
export async function replayDeadLetter(input: {
  deadLetterId: string;
  shopId: string;
  reason: string;
}): Promise<ReplayDeadLetterResult> {
  const prisma = getControlPlanePrisma();

  return prisma.$transaction(async (tx) => {
    const shop = await tx.shop.findUnique({
      where: { id: input.shopId },
      select: { id: true, processingEnabled: true },
    });
    if (!shop) {
      throw new SyncControlPlaneError("shop_missing", "Shop not found");
    }
    if (!shop.processingEnabled) {
      throw new SyncControlPlaneError(
        "replay_denied_disabled_shop",
        "Cannot replay dead letter for disabled shop",
      );
    }

    const deadLetters = await tx.$queryRaw<DeadLetter[]>`
      SELECT * FROM "DeadLetter"
      WHERE id = ${input.deadLetterId} AND "shopId" = ${input.shopId}
      FOR UPDATE
    `;
    const deadLetter = deadLetters[0];
    if (!deadLetter) {
      throw new SyncControlPlaneError(
        "dead_letter_not_found",
        "DeadLetter not found for shop",
      );
    }
    if (deadLetter.resolutionState !== "OPEN") {
      throw new SyncControlPlaneError(
        "dead_letter_not_open",
        `DeadLetter is ${deadLetter.resolutionState}, not OPEN`,
      );
    }

    const originalJobs = await tx.$queryRaw<DurableJob[]>`
      SELECT * FROM "DurableJob"
      WHERE id = ${deadLetter.durableJobId} AND "shopId" = ${input.shopId}
      FOR UPDATE
    `;
    const originalJob = originalJobs[0];
    if (!originalJob) {
      throw new SyncControlPlaneError(
        "job_not_found",
        "Original DurableJob not found",
      );
    }
    if (originalJob.state !== "DEAD_LETTERED") {
      throw new SyncControlPlaneError(
        "replay_requires_dead_lettered",
        `Original DurableJob state is ${originalJob.state}, expected DEAD_LETTERED`,
      );
    }

    const correlationId = randomUUID();
    const replayIdempotency = `replay:${originalJob.id}:${correlationId}`;

    const payloadCopy = structuredClone(
      originalJob.sanitizedPayload,
    ) as Prisma.InputJsonValue;

    const newJob = await tx.durableJob.create({
      data: {
        shopId: originalJob.shopId,
        jobType: originalJob.jobType,
        source: originalJob.source,
        queueName: originalJob.queueName,
        payloadSchemaVersion: originalJob.payloadSchemaVersion,
        sanitizedPayload: payloadCopy,
        payloadDigest: originalJob.payloadDigest,
        idempotencyKey: replayIdempotency,
        correlationId,
        causationId: originalJob.id,
        authorityVersion: DURABLE_JOB_AUTHORITY_VERSION,
        executionStrategy:
          originalJob.executionStrategy ??
          executionStrategyForJobType(originalJob.jobType),
        state: "PENDING",
        maxAttempts: originalJob.maxAttempts,
        nextEligibleAt: new Date(),
        // Preserve webhook delivery link so application key stays stable.
        webhookDeliveryId: originalJob.webhookDeliveryId,
      },
    });

    const replay = await tx.jobReplay.create({
      data: {
        shopId: input.shopId,
        originalJobId: originalJob.id,
        newJobId: newJob.id,
        deadLetterId: deadLetter.id,
        replayReason: input.reason.slice(0, 512),
        correlationId,
        causationId: originalJob.id,
      },
    });

    const updatedDl = await tx.deadLetter.update({
      where: { id: deadLetter.id },
      data: {
        resolutionState: "REPLAYED",
        resolutionReason: input.reason.slice(0, 512),
        resolvedAt: new Date(),
        replayId: replay.id,
      },
    });

    return {
      deadLetter: updatedDl,
      originalJob,
      newJob,
      replay,
    };
  });
}
