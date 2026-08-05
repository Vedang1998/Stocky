/**
 * F-PR4-04 — RUNNING recovery, heartbeat, single-active-attempt constraint.
 * NEW-PR4-C02 / NEW-PR4-C06 — poison isolation + completeAttemptFail dead-letter.
 * D-044 NEW-PR4-C03 residual — concurrent reaper, receipt finalize, strategy paths.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ingestAuthenticatedWebhook } from "../intake.server";
import {
  claimAttempt,
  completeAttemptFail,
  completeAttemptSuccess,
  recoverExpiredRunningAttempts,
  renewAttemptHeartbeat,
} from "../lifecycle.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import {
  APPLICATION_OUTCOME_UNCERTAIN,
  resolveApplicationKey,
  webhookApplicationKey,
} from "../execution-strategy.server";
import { SyncControlPlaneError } from "../errors";
import { transitionToEnqueuedForTests } from "./test-state-helpers";

const SHOP = "pr4-attempt.myshopify.com";
const SHOP_POISON = "pr4-attempt-poison.myshopify.com";
const SHOP_VALID = "pr4-attempt-valid.myshopify.com";
const SHOP_B = "pr4-attempt-shop-b.myshopify.com";

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
        myshopifyDomain: { in: [SHOP, SHOP_POISON, SHOP_VALID, SHOP_B] },
      },
    });
    await prisma.shop.create({ data: { myshopifyDomain: SHOP } });
    await resetControlPlanePrismaForTests();
  });

  async function expireRunningAttempt(
    durableJobId: string,
    attemptId: string,
  ): Promise<void> {
    const expired = new Date(Date.now() - 10_000);
    await prisma.jobAttempt.update({
      where: { id: attemptId },
      data: { leaseExpiresAt: expired },
    });
    await prisma.durableJob.update({
      where: { id: durableJobId },
      data: { leaseExpiresAt: expired },
    });
  }

  async function ingestAndClaim(webhookId: string, workerId: string) {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId,
      apiVersion: "2026-07",
      payload: {
        id: Number(webhookId.replace(/\D/g, "").slice(-6) || "1"),
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    await transitionToEnqueuedForTests(prisma, ingested.job!.id);
    const claim = await claimAttempt({
      durableJobId: ingested.job!.id,
      shopId: ingested.job!.shopId,
      workerId,
      leaseMs: 1,
    });
    return { ingested, ...claim };
  }

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

  it("NEW-PR4-C03: concurrent reapers cannot recover same unfinished attempt twice", async () => {
    const { ingested, attempt } = await ingestAndClaim(
      "wh-reaper-race",
      "w-reaper-race",
    );
    await expireRunningAttempt(ingested.job!.id, attempt.id);

    const [a, b] = await Promise.all([
      recoverExpiredRunningAttempts({ limit: 10 }),
      recoverExpiredRunningAttempts({ limit: 10 }),
    ]);

    const totalRecovered =
      a.recovered + a.deadLettered + a.finalized;
    const totalB = b.recovered + b.deadLettered + b.finalized;
    // Exactly one reaper meaningfully transitions the attempt/job.
    expect(totalRecovered + totalB).toBeGreaterThanOrEqual(1);
    expect(Math.min(totalRecovered, totalB)).toBe(0);

    const job = await prisma.durableJob.findUniqueOrThrow({
      where: { id: ingested.job!.id },
    });
    expect(job.state).not.toBe("RUNNING");
    const closed = await prisma.jobAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });
    expect(closed.finishedAt).not.toBeNull();
  });

  it("NEW-PR4-C03: stale worker completion after reaper is rejected", async () => {
    const { ingested, attempt } = await ingestAndClaim(
      "wh-stale-after-reaper",
      "w-stale-reaper",
    );
    await expireRunningAttempt(ingested.job!.id, attempt.id);

    const result = await recoverExpiredRunningAttempts({ limit: 5 });
    expect(result.recovered + result.deadLettered + result.finalized).toBeGreaterThanOrEqual(
      1,
    );

    await expect(
      completeAttemptSuccess({
        durableJobId: ingested.job!.id,
        shopId: ingested.job!.shopId,
        attemptId: attempt.id,
        workerId: "w-stale-reaper",
      }),
    ).rejects.toBeInstanceOf(SyncControlPlaneError);
  });

  it("NEW-PR4-C03: receipt exists → reaper finalizes success", async () => {
    const { ingested, attempt } = await ingestAndClaim(
      "wh-receipt-finalize",
      "w-receipt-fin",
    );
    const applicationKey = resolveApplicationKey({
      jobType: ingested.job!.jobType,
      webhookDeliveryId: ingested.delivery.id,
      idempotencyKey: ingested.job!.idempotencyKey,
    });
    await prisma.syncApplicationReceipt.create({
      data: {
        shopId: ingested.job!.shopId,
        applicationKey,
        sourceJobType: ingested.job!.jobType,
        rootDurableJobId: ingested.job!.id,
        firstApplyingDurableJobId: ingested.job!.id,
        payloadDigest: ingested.job!.payloadDigest,
        applicationSchemaVersion: "sync-application-receipt-v1",
        resultMetadata: { outcome: "applied" },
      },
    });
    await expireRunningAttempt(ingested.job!.id, attempt.id);

    const result = await recoverExpiredRunningAttempts({ limit: 5 });
    expect(result.finalized).toBeGreaterThanOrEqual(1);

    const job = await prisma.durableJob.findUniqueOrThrow({
      where: { id: ingested.job!.id },
    });
    expect(job.state).toBe("SUCCEEDED");
  });

  it("NEW-PR4-C03: receipt absent → safe retry (RETRY_WAIT)", async () => {
    const { ingested, attempt } = await ingestAndClaim(
      "wh-no-receipt-retry",
      "w-no-receipt",
    );
    expect(
      await prisma.syncApplicationReceipt.count({
        where: { shopId: ingested.job!.shopId },
      }),
    ).toBe(0);
    await expireRunningAttempt(ingested.job!.id, attempt.id);

    const result = await recoverExpiredRunningAttempts({ limit: 5 });
    expect(result.recovered).toBeGreaterThanOrEqual(1);

    const job = await prisma.durableJob.findUniqueOrThrow({
      where: { id: ingested.job!.id },
    });
    expect(job.state).toBe("RETRY_WAIT");
    expect(job.failureCode).toBe("lease_expired");
  });

  it("NEW-PR4-C03: uncertain strategy (NO_AUTOMATIC_RETRY) → dead-letter", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-uncertain-strategy",
      apiVersion: "2026-07",
      payload: {
        id: 8801,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    await prisma.durableJob.update({
      where: { id: ingested.job!.id },
      data: {
        executionStrategy: "NO_AUTOMATIC_RETRY",
        jobType: "webhook:unsupported/custom",
      },
    });
    await transitionToEnqueuedForTests(prisma, ingested.job!.id);
    const { attempt } = await claimAttempt({
      durableJobId: ingested.job!.id,
      shopId: ingested.job!.shopId,
      workerId: "w-uncertain",
      leaseMs: 1,
    });
    await expireRunningAttempt(ingested.job!.id, attempt.id);

    const result = await recoverExpiredRunningAttempts({ limit: 5 });
    expect(result.deadLettered).toBeGreaterThanOrEqual(1);

    const job = await prisma.durableJob.findUniqueOrThrow({
      where: { id: ingested.job!.id },
    });
    expect(job.state).toBe("DEAD_LETTERED");
    expect(job.failureCode).toBe(APPLICATION_OUTCOME_UNCERTAIN);
  });

  it("NEW-PR4-C03: max attempts → dead-letter on lease expiry", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-max-attempts",
      apiVersion: "2026-07",
      payload: {
        id: 8802,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    await transitionToEnqueuedForTests(prisma, ingested.job!.id, {
      maxAttempts: 1,
    });
    // claimAttempt increments attemptCount to 1 (>= maxAttempts).
    const { attempt } = await claimAttempt({
      durableJobId: ingested.job!.id,
      shopId: ingested.job!.shopId,
      workerId: "w-max",
      leaseMs: 1,
    });
    const afterClaim = await prisma.durableJob.findUniqueOrThrow({
      where: { id: ingested.job!.id },
    });
    expect(afterClaim.attemptCount).toBeGreaterThanOrEqual(afterClaim.maxAttempts);

    await expireRunningAttempt(ingested.job!.id, attempt.id);
    const result = await recoverExpiredRunningAttempts({ limit: 5 });
    expect(result.deadLettered).toBeGreaterThanOrEqual(1);

    const job = await prisma.durableJob.findUniqueOrThrow({
      where: { id: ingested.job!.id },
    });
    expect(job.state).toBe("DEAD_LETTERED");
    expect(job.failureCode).toBe("max_attempts_exceeded");
  });

  it("NEW-PR4-C03: heartbeat renewed before recovery — not recovered", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-heartbeat-alive",
      apiVersion: "2026-07",
      payload: {
        id: 8803,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    await transitionToEnqueuedForTests(prisma, ingested.job!.id);
    const { attempt } = await claimAttempt({
      durableJobId: ingested.job!.id,
      shopId: ingested.job!.shopId,
      workerId: "w-hb-alive",
      leaseMs: 60_000,
    });

    const renewed = await renewAttemptHeartbeat({
      attemptId: attempt.id,
      shopId: ingested.job!.shopId,
      workerId: "w-hb-alive",
      leaseMs: 120_000,
    });
    expect(renewed).toBeTruthy();
    expect(renewed!.leaseExpiresAt!.getTime()).toBeGreaterThan(Date.now());

    const result = await recoverExpiredRunningAttempts({
      limit: 10,
      now: new Date(),
    });
    expect(result.recovered + result.deadLettered + result.finalized).toBe(0);

    const job = await prisma.durableJob.findUniqueOrThrow({
      where: { id: ingested.job!.id },
    });
    expect(job.state).toBe("RUNNING");
    const open = await prisma.jobAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });
    expect(open.finishedAt).toBeNull();
  });

  it("NEW-PR4-C03: poison row Shop A does not block Shop B recovery", async () => {
    await prisma.shop.create({ data: { myshopifyDomain: SHOP_POISON } });
    await prisma.shop.create({ data: { myshopifyDomain: SHOP_B } });

    const poisonIngest = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_POISON,
      topic: "orders/create",
      webhookId: "wh-poison-a-block",
      apiVersion: "2026-07",
      payload: {
        id: 9101,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    const shopBIngest = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_B,
      topic: "orders/create",
      webhookId: "wh-shop-b-ok",
      apiVersion: "2026-07",
      payload: {
        id: 9102,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });

    await prisma.durableJob.update({
      where: { id: poisonIngest.job!.id },
      data: { webhookDeliveryId: null },
    });

    await transitionToEnqueuedForTests(prisma, poisonIngest.job!.id);
    await transitionToEnqueuedForTests(prisma, shopBIngest.job!.id);

    const poisonClaim = await claimAttempt({
      durableJobId: poisonIngest.job!.id,
      shopId: poisonIngest.job!.shopId,
      workerId: "w-poison-a",
      leaseMs: 1,
    });
    const shopBClaim = await claimAttempt({
      durableJobId: shopBIngest.job!.id,
      shopId: shopBIngest.job!.shopId,
      workerId: "w-shop-b",
      leaseMs: 1,
    });

    await expireRunningAttempt(poisonIngest.job!.id, poisonClaim.attempt.id);
    await expireRunningAttempt(shopBIngest.job!.id, shopBClaim.attempt.id);

    const result = await recoverExpiredRunningAttempts({ limit: 10 });
    expect(result.isolatedFailures).toBe(0);

    const poisonJob = await prisma.durableJob.findUniqueOrThrow({
      where: { id: poisonIngest.job!.id },
    });
    const shopBJob = await prisma.durableJob.findUniqueOrThrow({
      where: { id: shopBIngest.job!.id },
    });
    expect(poisonJob.state).toBe("DEAD_LETTERED");
    expect(poisonJob.failureCode).toBe(APPLICATION_OUTCOME_UNCERTAIN);
    expect(["RETRY_WAIT", "SUCCEEDED", "DEAD_LETTERED"]).toContain(
      shopBJob.state,
    );
    expect(shopBJob.state).not.toBe("RUNNING");
    expect(result.deadLettered).toBeGreaterThanOrEqual(1);
    expect(result.recovered + result.finalized).toBeGreaterThanOrEqual(1);
  });

  it("NEW-PR4-C03: no unfinished attempt remains without recoverable durable state", async () => {
    const { ingested, attempt } = await ingestAndClaim(
      "wh-no-orphan-attempt",
      "w-orphan",
    );
    await expireRunningAttempt(ingested.job!.id, attempt.id);
    await recoverExpiredRunningAttempts({ limit: 5 });

    const openAttempts = await prisma.jobAttempt.findMany({
      where: { durableJobId: ingested.job!.id, finishedAt: null },
    });
    expect(openAttempts).toHaveLength(0);

    const job = await prisma.durableJob.findUniqueOrThrow({
      where: { id: ingested.job!.id },
    });
    expect(["RETRY_WAIT", "SUCCEEDED", "DEAD_LETTERED"]).toContain(job.state);
    expect(job.state).not.toBe("RUNNING");
  });

  it("NEW-PR4-C03: malformed application identity isolation (null delivery)", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-malformed-identity",
      apiVersion: "2026-07",
      payload: {
        id: 9200,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    await prisma.durableJob.update({
      where: { id: ingested.job!.id },
      data: { webhookDeliveryId: null },
    });
    expect(
      resolveApplicationKey({
        jobType: ingested.job!.jobType,
        webhookDeliveryId: ingested.delivery.id,
        idempotencyKey: ingested.job!.idempotencyKey,
      }),
    ).toBe(webhookApplicationKey(ingested.delivery.id));

    await transitionToEnqueuedForTests(prisma, ingested.job!.id);
    const { attempt } = await claimAttempt({
      durableJobId: ingested.job!.id,
      shopId: ingested.job!.shopId,
      workerId: "w-malformed",
      leaseMs: 1,
    });
    await expireRunningAttempt(ingested.job!.id, attempt.id);

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
    expect(dl?.terminalReason).toBe(APPLICATION_OUTCOME_UNCERTAIN);

    const issue = await prisma.dataIssue.findFirst({
      where: {
        shopId: ingested.job!.shopId,
        reasonCode: APPLICATION_OUTCOME_UNCERTAIN,
      },
    });
    expect(issue).toBeTruthy();
  });
});
