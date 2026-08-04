/**
 * F-PR4-04 — RUNNING recovery, heartbeat, single-active-attempt constraint.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ingestAuthenticatedWebhook } from "../intake.server";
import {
  claimAttempt,
  recoverExpiredRunningAttempts,
  renewAttemptHeartbeat,
} from "../lifecycle.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import { transitionToEnqueuedForTests } from "./test-state-helpers";

const SHOP = "pr4-attempt.myshopify.com";

describe("test:sync-attempt-recovery", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK = "1";
    process.env.TENANT_JOB_ENVELOPE_SECRET =
      process.env.TENANT_JOB_ENVELOPE_SECRET ??
      "test-only-tenant-job-envelope-secret-32b!!";
    resetTenantJobEnvelopeSecretCache();
    await resetControlPlanePrismaForTests();
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await resetControlPlanePrismaForTests();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "DataIssue", "ReconciliationRun", "SyncHealth", "SyncCursor", "SyncRun",
        "JobReplay", "DeadLetter", "JobAttempt", "JobDispatch", "WebhookDelivery",
        "DurableJob", "SyncApplicationReceipt"
      CASCADE
    `);
    await prisma.shop.deleteMany({ where: { myshopifyDomain: SHOP } });
    await prisma.shop.create({ data: { myshopifyDomain: SHOP } });
    await resetControlPlanePrismaForTests();
  });

  it("database rejects two active attempts (partial unique)", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-attempt-1",
      apiVersion: "2026-07",
      payload: {
        id: 1,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    await transitionToEnqueuedForTests(prisma, ingested.job!.id);
    await claimAttempt({
      durableJobId: ingested.job!.id,
      shopId: ingested.job!.shopId,
      workerId: "w1",
    });

    await expect(
      prisma.jobAttempt.create({
        data: {
          shopId: ingested.job!.shopId,
          durableJobId: ingested.job!.id,
          attemptNumber: 99,
          workerId: "w2",
        },
      }),
    ).rejects.toThrow();
  });

  it("expired RUNNING attempt recovers to RETRY_WAIT", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-attempt-2",
      apiVersion: "2026-07",
      payload: {
        id: 2,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    await transitionToEnqueuedForTests(prisma, ingested.job!.id);
    const { attempt } = await claimAttempt({
      durableJobId: ingested.job!.id,
      shopId: ingested.job!.shopId,
      workerId: "w1",
      leaseMs: 1,
    });

    // Force expiry.
    await prisma.jobAttempt.update({
      where: { id: attempt.id },
      data: { leaseExpiresAt: new Date(Date.now() - 10_000) },
    });
    await prisma.durableJob.update({
      where: { id: ingested.job!.id },
      data: { leaseExpiresAt: new Date(Date.now() - 10_000) },
    });

    const result = await recoverExpiredRunningAttempts({ limit: 10 });
    expect(result.recovered + result.deadLettered).toBeGreaterThanOrEqual(1);

    const job = await prisma.durableJob.findUniqueOrThrow({
      where: { id: ingested.job!.id },
    });
    expect(["RETRY_WAIT", "DEAD_LETTERED"]).toContain(job.state);

    const closed = await prisma.jobAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });
    expect(closed.finishedAt).not.toBeNull();
    expect(closed.outcome).toBe("LEASE_EXPIRED");
  });

  it("heartbeat renewal extends lease", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-attempt-3",
      apiVersion: "2026-07",
      payload: {
        id: 3,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    await transitionToEnqueuedForTests(prisma, ingested.job!.id);
    const { attempt } = await claimAttempt({
      durableJobId: ingested.job!.id,
      shopId: ingested.job!.shopId,
      workerId: "w1",
      leaseMs: 60_000,
    });
    const before = attempt.leaseExpiresAt!;
    await new Promise((r) => setTimeout(r, 20));
    const renewed = await renewAttemptHeartbeat({
      attemptId: attempt.id,
      shopId: ingested.job!.shopId,
      workerId: "w1",
      leaseMs: 60_000,
    });
    expect(renewed).toBeTruthy();
    expect(renewed!.leaseExpiresAt!.getTime()).toBeGreaterThan(before.getTime());
  });
});
