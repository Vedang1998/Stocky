/**
 * F-PR4-02 — JobDispatch retry identity and ack-loss recovery.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { ingestAuthenticatedWebhook } from "../intake.server";
import {
  dispatchPendingJobs,
  formatQueueJobId,
} from "../dispatcher.server";
import {
  claimAttempt,
  completeAttemptRetry,
} from "../lifecycle.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import { WEBHOOK_QUEUE } from "../../jobs/queue.server";

const SHOP = "pr4-dispatch.myshopify.com";

describe("test:sync-dispatch-recovery", () => {
  let prisma: PrismaClient;
  let redis: IORedis;

  beforeAll(async () => {
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK = "1";
    process.env.TENANT_JOB_ENVELOPE_SECRET =
      process.env.TENANT_JOB_ENVELOPE_SECRET ??
      "test-only-tenant-job-envelope-secret-32b!!";
    resetTenantJobEnvelopeSecretCache();
    await resetControlPlanePrismaForTests();
    prisma = new PrismaClient();
    if (!process.env.REDIS_URL) throw new Error("REDIS_URL required");
    redis = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
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
        "JobReplay", "DeadLetter", "JobAttempt", "JobDispatch", "WebhookDelivery",
        "DurableJob", "SyncApplicationReceipt"
      CASCADE
    `);
    await prisma.shop.deleteMany({ where: { myshopifyDomain: SHOP } });
    await prisma.shop.create({ data: { myshopifyDomain: SHOP } });
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    await q.obliterate({ force: true }).catch(() => undefined);
    await q.close();
    await resetControlPlanePrismaForTests();
  });

  it("retry while failed BullMQ job retained uses new dispatch sequence (F-PR4-02)", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-dispatch-1",
      apiVersion: "2026-07",
      payload: {
        id: 1,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    const jobId = ingested.job!.id;

    const d1 = await dispatchPendingJobs({ batchSize: 10 });
    expect(d1.enqueued).toBe(1);

    const dispatches1 = await prisma.jobDispatch.findMany({
      where: { durableJobId: jobId },
      orderBy: { dispatchSequence: "asc" },
    });
    expect(dispatches1).toHaveLength(1);
    expect(dispatches1[0].queueJobId).toBe(formatQueueJobId(jobId, 1));
    expect(dispatches1[0].dispatchSequence).toBe(1);

    // Claim + retry to RETRY_WAIT.
    const job = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.state).toBe("ENQUEUED");
    const { attempt } = await claimAttempt({
      durableJobId: jobId,
      shopId: job.shopId,
      workerId: "w1",
      jobDispatchId: dispatches1[0].id,
    });
    await completeAttemptRetry({
      durableJobId: jobId,
      shopId: job.shopId,
      attemptId: attempt.id,
      workerId: "w1",
      errorCode: "simulated",
      failureSummary: "fail for retry",
      backoffMs: 0,
    });

    // Keep the original BullMQ failed/completed job retained (do not remove).
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    const retained = await q.getJob(formatQueueJobId(jobId, 1));
    expect(retained).toBeTruthy();

    // Make eligible immediately.
    await prisma.durableJob.update({
      where: { id: jobId },
      data: { nextEligibleAt: new Date(0) },
    });

    const d2 = await dispatchPendingJobs({ batchSize: 10 });
    expect(d2.enqueued).toBe(1);

    const dispatches2 = await prisma.jobDispatch.findMany({
      where: { durableJobId: jobId },
      orderBy: { dispatchSequence: "asc" },
    });
    expect(dispatches2.length).toBeGreaterThanOrEqual(2);
    expect(dispatches2[1].dispatchSequence).toBe(2);
    expect(dispatches2[1].queueJobId).toBe(formatQueueJobId(jobId, 2));

    const secondJob = await q.getJob(formatQueueJobId(jobId, 2));
    expect(secondJob).toBeTruthy();
    expect(secondJob!.id).not.toBe(retained!.id);

    const waiting = await q.getWaitingCount();
    // At least the new dispatch should be waiting (old may be completed/failed).
    expect(waiting + (await q.getCompletedCount()) + (await q.getFailedCount())).toBeGreaterThanOrEqual(2);

    await q.close();
  });

  it("queue job id encoding is durableJobId:sequence", () => {
    expect(formatQueueJobId("abc", 3)).toBe("abc:3");
  });

  it("ack-loss recovery reuses PENDING_ENQUEUE dispatch sequence", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-dispatch-2",
      apiVersion: "2026-07",
      payload: {
        id: 2,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    const jobId = ingested.job!.id;
    const shopId = ingested.job!.shopId;

    // Manually create PENDING_ENQUEUE dispatch as if enqueue succeeded but ack failed.
    await prisma.durableJob.update({
      where: { id: jobId },
      data: {
        state: "DISPATCH_LEASED",
        leaseOwner: "dispatcher:test",
        leaseExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    await prisma.jobDispatch.create({
      data: {
        shopId,
        durableJobId: jobId,
        dispatchSequence: 1,
        queueName: WEBHOOK_QUEUE,
        queueJobId: formatQueueJobId(jobId, 1),
        state: "PENDING_ENQUEUE",
        payloadDigest: ingested.job!.payloadDigest,
        leaseOwner: "dispatcher:test",
        leaseExpiresAt: new Date(Date.now() + 60_000),
      },
    });

    // Put the job in the queue already.
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    await q.add(
      "orders/create",
      { topic: "orders/create", payloadShop: SHOP, payload: {}, tenant: {} },
      { jobId: formatQueueJobId(jobId, 1) },
    );

    // Expire lease so recover → PENDING, then dispatch again.
    await prisma.durableJob.update({
      where: { id: jobId },
      data: { leaseExpiresAt: new Date(Date.now() - 1000) },
    });

    const result = await dispatchPendingJobs({ batchSize: 10 });
    expect(result.recoveredLeases + result.claimed).toBeGreaterThan(0);

    const dispatches = await prisma.jobDispatch.findMany({
      where: { durableJobId: jobId },
    });
    // Must not have created sequence 2 when sequence 1 was still PENDING_ENQUEUE.
    expect(dispatches.every((d) => d.dispatchSequence === 1)).toBe(true);
    await q.close();
  });
});
