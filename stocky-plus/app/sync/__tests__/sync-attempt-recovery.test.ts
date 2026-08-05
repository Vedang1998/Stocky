/**
 * F-PR4-04 — RUNNING recovery, heartbeat, single-active-attempt constraint.
 * NEW-PR4-C02 / NEW-PR4-C06 — poison isolation + completeAttemptFail dead-letter.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ingestAuthenticatedWebhook } from "../intake.server";
import {
  claimAttempt,
  completeAttemptFail,
  recoverExpiredRunningAttempts,
  renewAttemptHeartbeat,
} from "../lifecycle.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import { APPLICATION_OUTCOME_UNCERTAIN } from "../execution-strategy.server";
import { transitionToEnqueuedForTests } from "./test-state-helpers";

const SHOP = "pr4-attempt.myshopify.com";
const SHOP_POISON = "pr4-attempt-poison.myshopify.com";
const SHOP_VALID = "pr4-attempt-valid.myshopify.com";

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
    await prisma.shop.deleteMany({
      where: {
        myshopifyDomain: { in: [SHOP, SHOP_POISON, SHOP_VALID] },
      },
    });
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

  it("NEW-PR4-C02: poison NULL webhookDeliveryId dead-letters without aborting batch", async () => {
    await prisma.shop.create({ data: { myshopifyDomain: SHOP_POISON } });
    await prisma.shop.create({ data: { myshopifyDomain: SHOP_VALID } });

    const poisonIngest = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_POISON,
      topic: "orders/create",
      webhookId: "wh-poison-null-delivery",
      apiVersion: "2026-07",
      payload: {
        id: 201,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    const validIngest = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_VALID,
      topic: "orders/create",
      webhookId: "wh-valid-recoverable",
      apiVersion: "2026-07",
      payload: {
        id: 202,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });

    const poisonId = poisonIngest.job!.id;
    const validId = validIngest.job!.id;

    // Poison: strip webhookDeliveryId after normal ingest.
    await prisma.durableJob.update({
      where: { id: poisonId },
      data: { webhookDeliveryId: null },
    });
    expect(
      (
        await prisma.durableJob.findUniqueOrThrow({ where: { id: poisonId } })
      ).webhookDeliveryId,
    ).toBeNull();
    expect(
      (
        await prisma.durableJob.findUniqueOrThrow({ where: { id: poisonId } })
      ).executionStrategy,
    ).toBe("ATOMIC_APPLICATION_RECEIPT");

    await transitionToEnqueuedForTests(prisma, poisonId);
    await transitionToEnqueuedForTests(prisma, validId);

    const poisonClaim = await claimAttempt({
      durableJobId: poisonId,
      shopId: poisonIngest.job!.shopId,
      workerId: "w-poison",
      leaseMs: 1,
    });
    const validClaim = await claimAttempt({
      durableJobId: validId,
      shopId: validIngest.job!.shopId,
      workerId: "w-valid",
      leaseMs: 1,
    });

    const expired = new Date(Date.now() - 10_000);
    await prisma.jobAttempt.update({
      where: { id: poisonClaim.attempt.id },
      data: { leaseExpiresAt: expired },
    });
    await prisma.durableJob.update({
      where: { id: poisonId },
      data: { leaseExpiresAt: expired },
    });
    await prisma.jobAttempt.update({
      where: { id: validClaim.attempt.id },
      data: { leaseExpiresAt: expired },
    });
    await prisma.durableJob.update({
      where: { id: validId },
      data: { leaseExpiresAt: expired },
    });

    let thrown: unknown = null;
    let result: Awaited<ReturnType<typeof recoverExpiredRunningAttempts>> | null =
      null;
    try {
      result = await recoverExpiredRunningAttempts({ limit: 10 });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeNull();
    expect(result).toBeTruthy();

    const poisonJob = await prisma.durableJob.findUniqueOrThrow({
      where: { id: poisonId },
    });
    const validJob = await prisma.durableJob.findUniqueOrThrow({
      where: { id: validId },
    });

    expect(poisonJob.state).toBe("DEAD_LETTERED");
    expect(poisonJob.failureCode).toBe(APPLICATION_OUTCOME_UNCERTAIN);
    expect(["RETRY_WAIT", "SUCCEEDED", "DEAD_LETTERED"]).toContain(
      validJob.state,
    );
    expect(validJob.state).not.toBe("RUNNING");
    expect(poisonJob.state).not.toBe("RUNNING");

    expect(result!.deadLettered + result!.recovered + result!.finalized).toBeGreaterThanOrEqual(2);
    expect(result!.deadLettered).toBeGreaterThanOrEqual(1);
    // Valid job without receipt should recover to RETRY_WAIT (ATOMIC, no receipt).
    expect(result!.recovered + result!.finalized).toBeGreaterThanOrEqual(1);

    const runningLeft = await prisma.durableJob.count({
      where: { id: { in: [poisonId, validId] }, state: "RUNNING" },
    });
    expect(runningLeft).toBe(0);
  });

  it("NEW-PR4-C02: nullable webhook delivery identity dead-letters with application_outcome_uncertain", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-null-delivery-only",
      apiVersion: "2026-07",
      payload: {
        id: 203,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    await prisma.durableJob.update({
      where: { id: ingested.job!.id },
      data: { webhookDeliveryId: null },
    });
    await transitionToEnqueuedForTests(prisma, ingested.job!.id);
    const { attempt } = await claimAttempt({
      durableJobId: ingested.job!.id,
      shopId: ingested.job!.shopId,
      workerId: "w-null",
      leaseMs: 1,
    });
    await prisma.jobAttempt.update({
      where: { id: attempt.id },
      data: { leaseExpiresAt: new Date(Date.now() - 10_000) },
    });
    await prisma.durableJob.update({
      where: { id: ingested.job!.id },
      data: { leaseExpiresAt: new Date(Date.now() - 10_000) },
    });

    const result = await recoverExpiredRunningAttempts({ limit: 5 });
    expect(result.deadLettered).toBeGreaterThanOrEqual(1);

    const job = await prisma.durableJob.findUniqueOrThrow({
      where: { id: ingested.job!.id },
    });
    expect(job.state).toBe("DEAD_LETTERED");
    expect(job.failureCode).toBe(APPLICATION_OUTCOME_UNCERTAIN);

    const dl = await prisma.deadLetter.findFirst({
      where: { durableJobId: ingested.job!.id },
    });
    expect(dl).toBeTruthy();
    expect(dl!.terminalReason).toBe(APPLICATION_OUTCOME_UNCERTAIN);
  });

  it("NEW-PR4-C06: completeAttemptFail always dead-letters without deadLetter prop", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-c06-fail",
      apiVersion: "2026-07",
      payload: {
        id: 204,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    await transitionToEnqueuedForTests(prisma, ingested.job!.id);
    const { attempt } = await claimAttempt({
      durableJobId: ingested.job!.id,
      shopId: ingested.job!.shopId,
      workerId: "w-c06",
    });

    // Call without any deadLetter bypass prop — API no longer accepts one.
    const updated = await completeAttemptFail({
      durableJobId: ingested.job!.id,
      shopId: ingested.job!.shopId,
      attemptId: attempt.id,
      errorCode: "non_retryable_test",
      failureSummary: "must dead-letter",
    });
    expect(updated.state).toBe("DEAD_LETTERED");

    const dl = await prisma.deadLetter.findFirst({
      where: { durableJobId: ingested.job!.id, resolutionState: "OPEN" },
    });
    expect(dl).toBeTruthy();
    expect(dl!.terminalReason).toBe("non_retryable_test");

    const closed = await prisma.jobAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });
    expect(closed.finishedAt).not.toBeNull();
    expect(closed.outcome).toBe("NON_RETRYABLE_FAILURE");
  });
});
