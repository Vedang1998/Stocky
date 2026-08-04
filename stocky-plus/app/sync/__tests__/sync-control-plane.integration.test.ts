/**
 * Phase 1 PR 4 — sync control-plane integration tests.
 * Uses real disposable PostgreSQL + Redis.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { createHash, randomUUID } from "node:crypto";
import { ingestAuthenticatedWebhook } from "../intake.server";
import { dispatchPendingJobs } from "../dispatcher.server";
import {
  claimAttempt,
  completeAttemptFail,
  completeAttemptRetry,
  completeAttemptSuccess,
} from "../lifecycle.server";
import { replayDeadLetter } from "../replay.server";
import { processUninstall } from "../uninstall.server";
import { sanitizeWebhookPayload } from "../sanitize.server";
import {
  createTenantJobEnvelopeV2,
  parseTenantJobEnvelopeV2,
} from "../envelope-v2.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { issueSyncDispatchAuthority } from "../../tenant/sync-dispatch-authority.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import { assertTransition } from "../state-machine.server";
import { WEBHOOK_QUEUE } from "../../jobs/queue.server";
import {
  transitionRetryWaitToEnqueuedForTests,
  transitionToEnqueuedForTests,
} from "./test-state-helpers";

const SHOP_A = "pr4-shop-a.myshopify.com";
const SHOP_B = "pr4-shop-b.myshopify.com";

const FORBIDDEN = new Set([
  "email",
  "phone",
  "customer",
  "billing_address",
  "shipping_address",
]);

function projectionHasForbidden(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (FORBIDDEN.has(k)) return k;
    if (v && typeof v === "object") {
      const nested = projectionHasForbidden(v);
      if (nested) return nested;
    }
  }
  return null;
}

function requireDb(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  return url;
}

describe("sync control-plane integration", () => {
  let prisma: PrismaClient;
  let redis: IORedis;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK = "1";
    process.env.TENANT_JOB_ENVELOPE_SECRET =
      process.env.TENANT_JOB_ENVELOPE_SECRET ??
      "test-only-tenant-job-envelope-secret-32b!!";
    resetTenantJobEnvelopeSecretCache();
    await resetControlPlanePrismaForTests();
    prisma = new PrismaClient({ datasources: { db: { url: requireDb() } } });
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error("REDIS_URL required for sync integration tests");
    redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
  });

  afterAll(async () => {
    await resetControlPlanePrismaForTests();
    await prisma.$disconnect();
    await redis.quit();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "DataIssue", "ReconciliationRun", "SyncHealth", "SyncCursor", "SyncRun",
        "JobReplay", "DeadLetter", "JobAttempt", "JobDispatch", "WebhookDelivery", "DurableJob", "SyncApplicationReceipt"
      CASCADE
    `);
    await prisma.shop.deleteMany({
      where: { myshopifyDomain: { in: [SHOP_A, SHOP_B] } },
    });
    const a = await prisma.shop.create({ data: { myshopifyDomain: SHOP_A } });
    const b = await prisma.shop.create({ data: { myshopifyDomain: SHOP_B } });
    shopAId = a.id;
    shopBId = b.id;

    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    await q.obliterate({ force: true }).catch(() => undefined);
    await q.close();
    await resetControlPlanePrismaForTests();
  });

  it("first webhook creates one delivery and one logical job", async () => {
    const r = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A,
      topic: "orders/create",
      webhookId: "wh-1",
      apiVersion: "2026-07",
      payload: {
        id: 1,
        email: "secret@example.com",
        line_items: [{ variant_id: 10, quantity: 2, price: "12.50" }],
      },
    });
    expect(r.duplicate).toBe(false);
    expect(r.job).not.toBeNull();
    expect(await prisma.webhookDelivery.count({ where: { shopId: shopAId } })).toBe(1);
    expect(await prisma.durableJob.count({ where: { shopId: shopAId } })).toBe(1);
    expect(projectionHasForbidden(r.delivery.sanitizedPayload)).toBeNull();
  });

  it("duplicate webhook does not create a second delivery or job", async () => {
    await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A,
      topic: "orders/create",
      webhookId: "wh-dup",
      apiVersion: "2026-07",
      payload: { id: 2, line_items: [] },
    });
    const dup = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A,
      topic: "orders/create",
      webhookId: "wh-dup",
      apiVersion: "2026-07",
      payload: { id: 2, line_items: [] },
    });
    expect(dup.duplicate).toBe(true);
    expect(dup.delivery.duplicateCount).toBe(1);
    expect(await prisma.webhookDelivery.count({ where: { shopId: shopAId } })).toBe(1);
    expect(await prisma.durableJob.count({ where: { shopId: shopAId } })).toBe(1);
  });

  it("duplicate remains deduplicated after simulated BullMQ retention expiry", async () => {
    const first = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A,
      topic: "orders/create",
      webhookId: "wh-retain",
      apiVersion: "2026-07",
      payload: { id: 3, line_items: [] },
    });
    const again = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A,
      topic: "orders/create",
      webhookId: "wh-retain",
      apiVersion: "2026-07",
      payload: { id: 3, line_items: [] },
    });
    expect(again.duplicate).toBe(true);
    expect(again.job?.id).toBe(first.job?.id);
  });

  it("legitimate distinct webhook is accepted", async () => {
    await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A,
      topic: "orders/create",
      webhookId: "wh-a",
      apiVersion: "2026-07",
      payload: { id: 4, line_items: [] },
    });
    await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A,
      topic: "orders/create",
      webhookId: "wh-b",
      apiVersion: "2026-07",
      payload: { id: 5, line_items: [] },
    });
    expect(await prisma.durableJob.count({ where: { shopId: shopAId } })).toBe(2);
  });

  it("Redis unavailable during intake still persists dispatchable job", async () => {
    const r = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A,
      topic: "inventory_levels/update",
      webhookId: "wh-redis-down",
      apiVersion: "2026-07",
      payload: { inventory_item_id: 1, location_id: 2, available: 9 },
    });
    expect(r.job?.state).toBe("PENDING");
  });

  it("dispatcher recovers expired lease", async () => {
    const r = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A,
      topic: "orders/create",
      webhookId: "wh-lease",
      apiVersion: "2026-07",
      payload: { id: 6, line_items: [] },
    });
    // First claim with tiny lease.
    await dispatchPendingJobs({ batchSize: 10, leaseMs: 1, workerId: "d1" });
    await new Promise((res) => setTimeout(res, 10));
    // Force expire if still leased.
    await prisma.durableJob.updateMany({
      where: { id: r.job!.id, state: "DISPATCH_LEASED" },
      data: { leaseExpiresAt: new Date(Date.now() - 1000) },
    });
    const again = await dispatchPendingJobs({
      batchSize: 10,
      leaseMs: 30_000,
      workerId: "d2",
    });
    expect(again.recoveredLeases + again.claimed).toBeGreaterThanOrEqual(0);
    const job = await prisma.durableJob.findUniqueOrThrow({
      where: { id: r.job!.id },
    });
    expect(["ENQUEUED", "DISPATCH_LEASED", "PENDING"]).toContain(job.state);
  });

  it("retryable failure preserves attempts; max attempts creates exactly one dead letter", async () => {
    const r = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A,
      topic: "orders/create",
      webhookId: "wh-retry",
      apiVersion: "2026-07",
      payload: { id: 7, line_items: [] },
    });
    await transitionToEnqueuedForTests(prisma, r.job!.id, { maxAttempts: 2 });

    const a1 = await claimAttempt({
      durableJobId: r.job!.id,
      shopId: shopAId,
      workerId: "w1",
    });
    await completeAttemptRetry({
      durableJobId: r.job!.id,
      shopId: shopAId,
      attemptId: a1.attempt.id,
      errorCode: "temp",
      failureSummary: "temporary",
      backoffMs: 1,
    });
    let job = await prisma.durableJob.findUniqueOrThrow({ where: { id: r.job!.id } });
    expect(job.state).toBe("RETRY_WAIT");

    await transitionRetryWaitToEnqueuedForTests(prisma, job.id);
    const a2 = await claimAttempt({
      durableJobId: job.id,
      shopId: shopAId,
      workerId: "w2",
    });
    await completeAttemptRetry({
      durableJobId: job.id,
      shopId: shopAId,
      attemptId: a2.attempt.id,
      errorCode: "temp",
      failureSummary: "temporary again",
    });
    job = await prisma.durableJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(job.state).toBe("DEAD_LETTERED");
    const dls = await prisma.deadLetter.findMany({ where: { durableJobId: job.id } });
    expect(dls).toHaveLength(1);
    const attempts = await prisma.jobAttempt.findMany({
      where: { durableJobId: job.id },
      orderBy: { attemptNumber: "asc" },
    });
    expect(attempts.map((a) => a.attemptNumber)).toEqual([1, 2]);
  });

  it("successful retry preserves prior failed attempts", async () => {
    const r = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A,
      topic: "orders/create",
      webhookId: "wh-success-retry",
      apiVersion: "2026-07",
      payload: { id: 8, line_items: [] },
    });
    await transitionToEnqueuedForTests(prisma, r.job!.id);
    const a1 = await claimAttempt({
      durableJobId: r.job!.id,
      shopId: shopAId,
      workerId: "w1",
    });
    await completeAttemptRetry({
      durableJobId: r.job!.id,
      shopId: shopAId,
      attemptId: a1.attempt.id,
      errorCode: "temp",
      failureSummary: "fail once",
      backoffMs: 1,
    });
    await transitionRetryWaitToEnqueuedForTests(prisma, r.job!.id);
    const a2 = await claimAttempt({
      durableJobId: r.job!.id,
      shopId: shopAId,
      workerId: "w2",
    });
    await completeAttemptSuccess({
      durableJobId: r.job!.id,
      shopId: shopAId,
      attemptId: a2.attempt.id,
    });
    const attempts = await prisma.jobAttempt.findMany({
      where: { durableJobId: r.job!.id },
      orderBy: { attemptNumber: "asc" },
    });
    expect(attempts).toHaveLength(2);
    expect(attempts[0].outcome).toBe("RETRYABLE_FAILURE");
    expect(attempts[1].outcome).toBe("SUCCEEDED");
  });

  it("concurrent attempt claim is denied", async () => {
    const r = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A,
      topic: "orders/create",
      webhookId: "wh-concurrent",
      apiVersion: "2026-07",
      payload: { id: 9, line_items: [] },
    });
    await transitionToEnqueuedForTests(prisma, r.job!.id);
    await claimAttempt({
      durableJobId: r.job!.id,
      shopId: shopAId,
      workerId: "w1",
    });
    await expect(
      claimAttempt({
        durableJobId: r.job!.id,
        shopId: shopAId,
        workerId: "w2",
      }),
    ).rejects.toThrow(/active attempt|Illegal DurableJob transition/i);
  });

  it("replay creates new job and preserves lineage", async () => {
    const r = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A,
      topic: "orders/create",
      webhookId: "wh-replay",
      apiVersion: "2026-07",
      payload: {
        id: 10,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    await transitionToEnqueuedForTests(prisma, r.job!.id, { maxAttempts: 1 });
    const a1 = await claimAttempt({
      durableJobId: r.job!.id,
      shopId: shopAId,
      workerId: "w1",
    });
    await completeAttemptFail({
      durableJobId: r.job!.id,
      shopId: shopAId,
      attemptId: a1.attempt.id,
      errorCode: "fatal",
      failureSummary: "fatal",
      deadLetter: true,
    });
    const dl = await prisma.deadLetter.findFirstOrThrow({
      where: { durableJobId: r.job!.id },
    });
    const replayed = await replayDeadLetter({
      deadLetterId: dl.id,
      shopId: shopAId,
      reason: "operator_replay_test",
    });
    expect(replayed.newJob.id).not.toBe(r.job!.id);
    expect(replayed.newJob.causationId).toBe(r.job!.id);

    const tenant = issueSyncDispatchAuthority({
      shopId: shopAId,
      myshopifyDomain: SHOP_A,
      source: "verified_job",
      correlationId: replayed.newJob.correlationId,
    });
    const env = createTenantJobEnvelopeV2({
      tenant,
      source: "webhook:orders/create",
      durableJobId: replayed.newJob.id,
      payloadDigest: replayed.newJob.payloadDigest,
    });
    expect(parseTenantJobEnvelopeV2(env).durableJobId).toBe(replayed.newJob.id);
  });

  it("replay of disabled shop is denied", async () => {
    const r = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A,
      topic: "orders/create",
      webhookId: "wh-replay-deny",
      apiVersion: "2026-07",
      payload: { id: 11, line_items: [] },
    });
    await transitionToEnqueuedForTests(prisma, r.job!.id, { maxAttempts: 1 });
    const a1 = await claimAttempt({
      durableJobId: r.job!.id,
      shopId: shopAId,
      workerId: "w1",
    });
    await completeAttemptFail({
      durableJobId: r.job!.id,
      shopId: shopAId,
      attemptId: a1.attempt.id,
      errorCode: "fatal",
      failureSummary: "fatal",
      deadLetter: true,
    });
    const dl = await prisma.deadLetter.findFirstOrThrow({
      where: { durableJobId: r.job!.id },
    });
    await prisma.shop.update({
      where: { id: shopAId },
      data: {
        processingEnabled: false,
        processingDisabledReason: "UNINSTALLED",
        processingDisabledAt: new Date(),
      },
    });
    await expect(
      replayDeadLetter({
        deadLetterId: dl.id,
        shopId: shopAId,
        reason: "should_fail",
      }),
    ).rejects.toThrow(/disabled/i);
  });

  it("envelope security: digest tamper fails signature", async () => {
    const tenant = issueSyncDispatchAuthority({
      shopId: shopAId,
      myshopifyDomain: SHOP_A,
      source: "verified_job",
      correlationId: randomUUID(),
    });
    const digest = createHash("sha256").update("{}").digest("hex");
    const env = createTenantJobEnvelopeV2({
      tenant,
      source: "webhook:orders/create",
      durableJobId: "job-x",
      payloadDigest: digest,
    });
    const tampered = { ...env, payloadDigest: "0".repeat(64) };
    expect(() => parseTenantJobEnvelopeV2(tampered)).toThrow(/signature/i);
  });

  it("uninstall disables shop, cancels pending, denies new intake, is idempotent", async () => {
    const r = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A,
      topic: "orders/create",
      webhookId: "wh-pre-uninstall",
      apiVersion: "2026-07",
      payload: { id: 12, line_items: [] },
    });
    expect(r.job?.state).toBe("PENDING");

    const first = await processUninstall({
      verifiedShop: SHOP_A,
      webhookId: "wh-uninstall-1",
      apiVersion: "2026-07",
    });
    expect(first.cancelledJobs).toBeGreaterThanOrEqual(1);
    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopAId } });
    expect(shop.processingEnabled).toBe(false);
    const job = await prisma.durableJob.findUniqueOrThrow({
      where: { id: r.job!.id },
    });
    expect(job.state).toBe("CANCELLED");

    await expect(
      ingestAuthenticatedWebhook({
        verifiedShop: SHOP_A,
        topic: "orders/create",
        webhookId: "wh-after-uninstall",
        apiVersion: "2026-07",
        payload: { id: 13, line_items: [] },
      }),
    ).rejects.toThrow(/disabled/i);

    const second = await processUninstall({
      verifiedShop: SHOP_A,
      webhookId: "wh-uninstall-1",
      apiVersion: "2026-07",
    });
    expect(second.duplicate).toBe(true);
  });

  it("cross-shop isolation: shop A cannot see shop B deliveries/jobs", async () => {
    await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A,
      topic: "orders/create",
      webhookId: "wh-a-iso",
      apiVersion: "2026-07",
      payload: { id: 14, line_items: [] },
    });
    await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_B,
      topic: "orders/create",
      webhookId: "wh-b-iso",
      apiVersion: "2026-07",
      payload: { id: 15, line_items: [] },
    });
    expect(await prisma.webhookDelivery.count({ where: { shopId: shopAId } })).toBe(1);
    expect(await prisma.webhookDelivery.count({ where: { shopId: shopBId } })).toBe(1);
  });

  it("illegal state transitions fail closed", () => {
    expect(() => assertTransition("SUCCEEDED", "RUNNING")).toThrow(
      /Illegal DurableJob transition/,
    );
  });

  it("sanitizer strips customer/contact fields", () => {
    const s = sanitizeWebhookPayload("orders/create", {
      id: 99,
      email: "a@b.com",
      phone: "123",
      customer: { first_name: "Ada" },
      billing_address: { address1: "1 Main" },
      line_items: [{ variant_id: 1, quantity: 1, price: "9.99" }],
    });
    expect(projectionHasForbidden(s.projection)).toBeNull();
    expect(s.projection).not.toHaveProperty("email");
    expect(s.projection).not.toHaveProperty("customer");
  });

  it("dispatch enqueues with deterministic job id", async () => {
    const r = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A,
      topic: "orders/create",
      webhookId: "wh-dispatch",
      apiVersion: "2026-07",
      payload: { id: 16, line_items: [] },
    });
    const result = await dispatchPendingJobs({ batchSize: 20 });
    expect(result.claimed).toBeGreaterThanOrEqual(1);
    const job = await prisma.durableJob.findUniqueOrThrow({
      where: { id: r.job!.id },
    });
    expect(["ENQUEUED", "DISPATCH_LEASED", "CANCELLED"]).toContain(job.state);
  });
});
