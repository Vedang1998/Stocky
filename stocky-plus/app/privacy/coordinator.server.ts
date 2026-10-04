/**
 * Independent privacy coordinator. Not a DurableJob strategy.
 * Survives Shop deletion. Bounded claim/lease/retry.
 */
import { randomUUID } from "node:crypto";
import { getControlPlanePrisma } from "../sync/control-plane-db.server";
import { processPrivacyRequest } from "./execute.server";
import { isPrivacyPauseEnabled } from "./pause.server";

const LEASE_MS = 60 * 60 * 1000;
const CLAIMABLE = ["RECEIVED", "ENUMERATING", "APPLYING", "INCOMPLETE", "FULFILLING"];

export async function claimNextPrivacyAttempt(worker = "privacy-coordinator"): Promise<{
  requestId: string;
  attemptId: string;
} | null> {
  if (isPrivacyPauseEnabled()) return null;
  const prisma = getControlPlanePrisma();
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + LEASE_MS);

  return prisma.$transaction(async (tx) => {
    const request = await tx.privacyRequest.findFirst({
      where: {
        state: { in: CLAIMABLE },
        pauseHonored: false,
        OR: [{ activeAttemptId: null }, { deadlineAt: { gt: now } }],
      },
      orderBy: { receivedAt: "asc" },
    });
    if (!request) return null;

    const last = await tx.privacyAttempt.findFirst({
      where: { privacyRequestId: request.id },
      orderBy: { epoch: "desc" },
    });
    const attemptId = randomUUID();
    const epoch = (last?.epoch ?? 0) + 1;
    if (last && last.state === "RUNNING" && last.leaseUntil && last.leaseUntil > now) {
      return { requestId: request.id, attemptId: last.id };
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
