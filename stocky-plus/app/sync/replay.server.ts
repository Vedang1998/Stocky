/**
 * Dead-letter replay — new DurableJob + JobReplay lineage; original immutable.
 */
import { randomUUID } from "node:crypto";
import type { DeadLetter, DurableJob, JobReplay, Prisma } from "@prisma/client";
import { getControlPlanePrisma } from "./control-plane-db.server";
import { DURABLE_JOB_AUTHORITY_VERSION } from "./intake.server";
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

    const deadLetter = await tx.deadLetter.findFirst({
      where: { id: input.deadLetterId, shopId: input.shopId },
    });
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

    const originalJob = await tx.durableJob.findFirst({
      where: { id: deadLetter.durableJobId, shopId: input.shopId },
    });
    if (!originalJob) {
      throw new SyncControlPlaneError(
        "job_not_found",
        "Original DurableJob not found",
      );
    }

    const correlationId = randomUUID();
    const replayIdempotency = `replay:${originalJob.id}:${correlationId}`;

    // Copy payload by value — do not mutate original.
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
        state: "PENDING",
        maxAttempts: originalJob.maxAttempts,
        nextEligibleAt: new Date(),
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
