/**
 * Independent privacy coordinator. Not a DurableJob strategy.
 * Survives Shop deletion. Bounded claim/lease/retry with per-worker fencing.
 */
import { randomUUID } from "node:crypto";
import { getControlPlanePrisma } from "../sync/control-plane-db.server";
import { processPrivacyRequest } from "./execute.server";
import { isPrivacyPauseEnabled } from "./pause.server";

const LEASE_MS = 60 * 60 * 1000;
const CLAIMABLE = ["RECEIVED", "ENUMERATING", "APPLYING", "INCOMPLETE", "FULFILLING"];
const CLAIM_SCAN_LIMIT = 32;
export const MAX_PRIVACY_ATTEMPT_EPOCHS = 5;

export async function claimNextPrivacyAttempt(worker = "privacy-coordinator"): Promise<{
  requestId: string;
  attemptId: string;
} | null> {
  if (isPrivacyPauseEnabled()) return null;
  const prisma = getControlPlanePrisma();
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + LEASE_MS);

  return prisma.$transaction(async (tx) => {
    const skipped = new Set<string>();
    for (let i = 0; i < CLAIM_SCAN_LIMIT; i++) {
      const foreignLeases = await tx.privacyAttempt.findMany({
        where: {
          state: "RUNNING",
          leaseUntil: { gt: now },
          NOT: { worker },
        },
        select: { privacyRequestId: true },
      });
      const blocked = [
        ...skipped,
        ...foreignLeases.map((row) => row.privacyRequestId),
      ];
      const request = await tx.privacyRequest.findFirst({
        where: {
          state: { in: CLAIMABLE },
          pauseHonored: false,
          ...(blocked.length > 0 ? { id: { notIn: blocked } } : {}),
          OR: [{ activeAttemptId: null }, { deadlineAt: { gt: now } }],
        },
        orderBy: { receivedAt: "asc" },
      });
      if (!request) return null;

      const last = await tx.privacyAttempt.findFirst({
        where: { privacyRequestId: request.id },
        orderBy: { epoch: "desc" },
      });
      if (last && last.epoch >= MAX_PRIVACY_ATTEMPT_EPOCHS) {
        skipped.add(request.id);
        continue;
      }
      if (last && last.state === "RUNNING" && last.leaseUntil && last.leaseUntil > now) {
        if (last.worker !== worker) {
          skipped.add(request.id);
          continue;
        }
        return { requestId: request.id, attemptId: last.id };
      }
      const attemptId = randomUUID();
      const epoch = (last?.epoch ?? 0) + 1;
      if (epoch > MAX_PRIVACY_ATTEMPT_EPOCHS) {
        skipped.add(request.id);
        continue;
      }
      if (last && last.state === "RUNNING" && last.leaseUntil && last.leaseUntil <= now) {
        await tx.$executeRaw`SELECT stocky_privacy_claim_attempt(${request.id}, ${last.id}, ${attemptId})`;
        return { requestId: request.id, attemptId };
      }
      await tx.privacyAttempt.create({
        data: {
          id: attemptId,
          privacyRequestId: request.id,
          epoch,
          state: "RUNNING",
          leaseUntil,
          worker,
        },
      });
      await tx.privacyRequest.update({
        where: { id: request.id },
        data: { activeAttemptId: attemptId, state: "APPLYING" },
      });
      return { requestId: request.id, attemptId };
    }
    return null;
  });
}

export async function runPrivacyCoordinatorOnce(): Promise<{
  processed: number;
  results: Array<{ requestId: string; state: string; incomplete: boolean }>;
}> {
  const claimed = await claimNextPrivacyAttempt();
  if (!claimed) {
    return { processed: 0, results: [] };
  }
  const result = await processPrivacyRequest(claimed.requestId, claimed.attemptId);
  const prisma = getControlPlanePrisma();
  await prisma.privacyAttempt.update({
    where: { id: claimed.attemptId },
    data: { state: result.incomplete ? "FAILED" : "SUCCEEDED" },
  });
  await prisma.privacyCoordinatorEvent.create({
    data: {
      privacyRequestId: claimed.requestId,
      kind: result.incomplete ? "processor_incomplete" : "processor_succeeded",
      detail: result.detail,
    },
  });
  return {
    processed: 1,
    results: [
      {
        requestId: result.requestId,
        state: result.state,
        incomplete: result.incomplete,
      },
    ],
  };
}

export async function startPrivacyCoordinatorLoop(intervalMs = 5000): Promise<void> {
  setInterval(() => {
    void runPrivacyCoordinatorOnce().catch((err) => {
      console.warn("privacy coordinator error:", err);
    });
  }, intervalMs);
}
