/**
 * F-PR4-02 — JobDispatch retry identity and ack-loss recovery.
 * NEW-PR4-C01 — runnable-presence ack gate + stranded ENQUEUED recovery.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { ingestAuthenticatedWebhook } from "../intake.server";
import {
  dispatchPendingJobs,
  enqueueWithDispatch,
  formatQueueJobId,
  recoverStrandedEnqueuedJobs,
} from "../dispatcher.server";
import {
  claimAttempt,
  completeAttemptRetry,
} from "../lifecycle.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import { WEBHOOK_QUEUE } from "../../jobs/queue.server";
import { inspectQueueDispatchPresence } from "../queue-presence.server";

const SHOP = "pr4-dispatch.myshopify.com";

async function countRunnableQueueJobs(q: Queue): Promise<number> {
  const [waiting, delayed, active, prioritized] = await Promise.all([
    q.getWaitingCount(),
    q.getDelayedCount(),
    q.getActiveCount(),
    q.getPrioritizedCount(),
  ]);
  return waiting + delayed + active + prioritized;
}

/** Force a deterministic queue job into a retained terminal BullMQ state. */
async function forceQueueJobTerminal(
  redis: IORedis,
  queueJobId: string,
  mode: "failed" | "completed",
): Promise<void> {
  const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
  try {
    const existing = await q.getJob(queueJobId);
    if (!existing) {
      throw new Error(`forceQueueJobTerminal: missing job ${queueJobId}`);
    }
    const name = existing.name;
    const data = existing.data;
    // Re-add under the same deterministic id with attempts:1 so one worker
    // outcome reaches a retained terminal state (queue defaults retry 3x).
    await existing.remove();
    await q.add(name, data, {
      jobId: queueJobId,
      attempts: 1,
      removeOnFail: false,
      removeOnComplete: false,
    });
  } finally {
    await q.close();
  }

  const worker = new Worker(
    WEBHOOK_QUEUE,
    async () => {
      if (mode === "failed") throw new Error("NEW-PR4-C01 simulated terminal");
      return { ok: true };
    },
    {
      connection: redis.duplicate(),
      autorun: true,
    },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timeout forcing ${mode} for ${queueJobId}`)),
        15_000,
      );
      const onDone = async (job: { id?: string; getState?: () => Promise<string> } | undefined) => {
        if (String(job?.id) !== queueJobId) return;
        const state = job?.getState ? await job.getState() : mode;
        if (state !== mode) return;
        clearTimeout(timer);
        resolve();
      };
      if (mode === "failed") worker.on("failed", onDone);
      else worker.on("completed", onDone);
    });
  } finally {
    await worker.close();
  }
}

/**
 * Return an ENQUEUED durable job to PENDING with JobDispatch seq 1 as
 * PENDING_ENQUEUE still pointing at the (possibly terminal) queue job id.
 */
async function resetToPendingWithPendingEnqueue(
  prisma: PrismaClient,
  jobId: string,
  dispatchId: string,
): Promise<void> {
  // Legal path: ENQUEUED → RETRY_WAIT → DISPATCH_LEASED → PENDING
  await prisma.$executeRaw`
    UPDATE "DurableJob"
    SET state = 'RETRY_WAIT', "nextEligibleAt" = NOW(), "updatedAt" = NOW()
    WHERE id = ${jobId} AND state = 'ENQUEUED'
  `;
  await prisma.$executeRaw`
    UPDATE "DurableJob"
    SET
      state = 'DISPATCH_LEASED',
      "leaseOwner" = 'dispatcher:test-reset',
      "leaseExpiresAt" = NOW() + INTERVAL '60 seconds',
      "updatedAt" = NOW()
    WHERE id = ${jobId} AND state = 'RETRY_WAIT'
  `;
  await prisma.$executeRaw`
    UPDATE "DurableJob"
    SET
      state = 'PENDING',
      "leaseOwner" = NULL,
      "leaseExpiresAt" = NULL,
      "nextEligibleAt" = NOW(),
      "updatedAt" = NOW()
    WHERE id = ${jobId} AND state = 'DISPATCH_LEASED'
  `;
  await prisma.jobDispatch.update({
    where: { id: dispatchId },
    data: {
      state: "PENDING_ENQUEUE",
      enqueuedAt: null,
      completedAt: null,
      leaseOwner: "dispatcher:test-reset",
      leaseExpiresAt: new Date(Date.now() + 60_000),
    },
  });
}

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

  it("queue job id encoding is durableJobId__d{sequence}", () => {
    expect(formatQueueJobId("abc", 3)).toBe("abc__d3");
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

  it("NEW-PR4-C01: retained FAILED queue job must not leave durable ENQUEUED with 0 runnable", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-c01-failed",
      apiVersion: "2026-07",
      payload: {
        id: 101,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    const jobId = ingested.job!.id;

    const d1 = await dispatchPendingJobs({ batchSize: 10 });
    expect(d1.enqueued).toBe(1);

    const dispatch1 = await prisma.jobDispatch.findFirstOrThrow({
      where: { durableJobId: jobId, dispatchSequence: 1 },
    });
    expect(dispatch1.queueJobId).toBe(formatQueueJobId(jobId, 1));

    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    const beforeFail = await q.getJob(dispatch1.queueJobId);
    expect(beforeFail).toBeTruthy();
    expect(await beforeFail!.getState()).toBe("waiting");

    await forceQueueJobTerminal(redis, dispatch1.queueJobId, "failed");
    const failedJob = await q.getJob(dispatch1.queueJobId);
    expect(failedJob).toBeTruthy();
    expect(await failedJob!.getState()).toBe("failed");

    // Simulate ack-loss / retry path that would re-ack seq 1 against retained failed.
    await resetToPendingWithPendingEnqueue(prisma, jobId, dispatch1.id);

    const d2 = await dispatchPendingJobs({ batchSize: 10 });
    void d2;

    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    const runnable = await countRunnableQueueJobs(q);

    // CRITICAL regression invariant (NEW-PR4-C01):
    // durable state = ENQUEUED ⇒ runnable queue jobs >= 1
    if (durable.state === "ENQUEUED") {
      expect(runnable).toBeGreaterThanOrEqual(1);
      const active = await prisma.jobDispatch.findFirst({
        where: {
          durableJobId: jobId,
          dispatchSequence: durable.activeDispatchSequence ?? undefined,
          state: "ENQUEUED",
        },
      });
      expect(active).toBeTruthy();
      const presence = await inspectQueueDispatchPresence(
        q,
        active!.queueJobId,
      );
      expect(["RUNNABLE_EXISTING", "RUNNABLE_CREATED"]).toContain(
        presence.status,
      );
      // Correction path: new sequence supersedes retained failed seq 1.
      expect(active!.dispatchSequence).toBeGreaterThan(1);
    } else {
      // Retained failed exists: ack must not produce ENQUEUED with zero runnable.
      expect(String(durable.state) === "ENQUEUED" && runnable === 0).toBe(false);
    }

    await q.close();
  });

  it("NEW-PR4-C01: retained completed deterministic queue job supersedes or refuses empty ENQUEUED", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-c01-completed",
      apiVersion: "2026-07",
      payload: {
        id: 102,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    const jobId = ingested.job!.id;

    expect((await dispatchPendingJobs({ batchSize: 10 })).enqueued).toBe(1);
    const dispatch1 = await prisma.jobDispatch.findFirstOrThrow({
      where: { durableJobId: jobId, dispatchSequence: 1 },
    });

    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    await forceQueueJobTerminal(redis, dispatch1.queueJobId, "completed");
    expect(await (await q.getJob(dispatch1.queueJobId))!.getState()).toBe(
      "completed",
    );

    await resetToPendingWithPendingEnqueue(prisma, jobId, dispatch1.id);
    await dispatchPendingJobs({ batchSize: 10 });

    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    const runnable = await countRunnableQueueJobs(q);
    if (durable.state === "ENQUEUED") {
      expect(runnable).toBeGreaterThanOrEqual(1);
      expect(durable.activeDispatchSequence).toBeGreaterThan(1);
    } else {
      expect(durable.state).not.toBe("ENQUEUED");
    }
    await q.close();
  });

  it("NEW-PR4-C01: acknowledgement denied without runnable job (enqueueWithDispatch)", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-c01-ack-deny",
      apiVersion: "2026-07",
      payload: {
        id: 103,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    const jobId = ingested.job!.id;
    const shopId = ingested.job!.shopId;

    expect((await dispatchPendingJobs({ batchSize: 10 })).enqueued).toBe(1);
    const dispatch1 = await prisma.jobDispatch.findFirstOrThrow({
      where: { durableJobId: jobId, dispatchSequence: 1 },
    });

    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    await forceQueueJobTerminal(redis, dispatch1.queueJobId, "failed");

    // Put durable in DISPATCH_LEASED with PENDING_ENQUEUE pointing at failed id.
    await prisma.$executeRaw`
      UPDATE "DurableJob"
      SET state = 'RETRY_WAIT', "nextEligibleAt" = NOW(), "updatedAt" = NOW()
      WHERE id = ${jobId} AND state = 'ENQUEUED'
    `;
    await prisma.$executeRaw`
      UPDATE "DurableJob"
      SET
        state = 'DISPATCH_LEASED',
        "leaseOwner" = 'dispatcher:ack-deny',
        "leaseExpiresAt" = NOW() + INTERVAL '60 seconds',
        "updatedAt" = NOW()
      WHERE id = ${jobId} AND state = 'RETRY_WAIT'
    `;
    await prisma.jobDispatch.update({
      where: { id: dispatch1.id },
      data: {
        state: "PENDING_ENQUEUE",
        enqueuedAt: null,
        completedAt: null,
        leaseOwner: "dispatcher:ack-deny",
        leaseExpiresAt: new Date(Date.now() + 60_000),
      },
    });

    const claimedRow = await prisma.durableJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    const result = await enqueueWithDispatch(
      {
        id: claimedRow.id,
        shopId: claimedRow.shopId,
        jobType: claimedRow.jobType,
        source: claimedRow.source,
        queueName: claimedRow.queueName,
        payloadSchemaVersion: claimedRow.payloadSchemaVersion,
        sanitizedPayload: claimedRow.sanitizedPayload,
        payloadDigest: claimedRow.payloadDigest,
        correlationId: claimedRow.correlationId,
        causationId: claimedRow.causationId,
        state: claimedRow.state,
        executionStrategy: claimedRow.executionStrategy,
        activeDispatchSequence: claimedRow.activeDispatchSequence,
      },
      { ...dispatch1, state: "PENDING_ENQUEUE" },
      { workerId: "dispatcher:ack-deny" },
    );

    // Must never treat retained failed getJob() object as runnable for seq 1.
    if (result.outcome === "runnable") {
      expect(result.dispatch.dispatchSequence).toBeGreaterThan(1);
      const presence = await inspectQueueDispatchPresence(
        q,
        result.dispatch.queueJobId,
      );
      expect(["RUNNABLE_EXISTING", "RUNNABLE_CREATED"]).toContain(
        presence.status,
      );
    } else {
      expect(["not_runnable", "queue_unavailable", "shop_disabled"]).toContain(
        result.outcome,
      );
    }

    // Durable must not already be ENQUEUED from enqueueWithDispatch alone
    // (ack is a separate step); ensure seq-1 failed is not runnable.
    const seq1Presence = await inspectQueueDispatchPresence(
      q,
      formatQueueJobId(jobId, 1),
    );
    expect(seq1Presence.status).toBe("TERMINAL_EXISTING");

    const still = await prisma.durableJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    // Without ackEnqueued, state remains DISPATCH_LEASED (or PENDING if shop disabled).
    expect(["DISPATCH_LEASED", "PENDING"]).toContain(still.state);
    void shopId;
    await q.close();
  });

  it("NEW-PR4-C01: stranded ENQUEUED recovery via recoverStrandedEnqueuedJobs", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-c01-stranded",
      apiVersion: "2026-07",
      payload: {
        id: 104,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    const jobId = ingested.job!.id;
    expect((await dispatchPendingJobs({ batchSize: 10 })).enqueued).toBe(1);

    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    const dispatch1 = await prisma.jobDispatch.findFirstOrThrow({
      where: { durableJobId: jobId, dispatchSequence: 1 },
    });
    // Remove runnable queue job so ENQUEUED is stranded.
    const qj = await q.getJob(dispatch1.queueJobId);
    if (qj) await qj.remove();

    await prisma.durableJob.update({
      where: { id: jobId },
      data: { enqueuedAt: new Date(Date.now() - 10 * 60_000) },
    });

    const result = await recoverStrandedEnqueuedJobs({
      olderThanMs: 60_000,
      limit: 10,
    });
    expect(result.recovered).toBeGreaterThanOrEqual(1);

    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    expect(durable.state).toBe("RETRY_WAIT");
    expect(durable.failureCode).toBe("stranded_enqueued");
    await q.close();
  });

  it("NEW-PR4-C01: shop disabled before enqueue does not ack ENQUEUED", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-c01-disabled",
      apiVersion: "2026-07",
      payload: {
        id: 105,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    const jobId = ingested.job!.id;
    const shopId = ingested.job!.shopId;

    await prisma.shop.update({
      where: { id: shopId },
      data: {
        processingEnabled: false,
        processingDisabledReason: "MANUAL",
        processingDisabledAt: new Date(),
      },
    });

    const result = await dispatchPendingJobs({ batchSize: 10 });
    expect(result.shopDisabled).toBeGreaterThanOrEqual(1);
    expect(result.enqueued).toBe(0);

    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    expect(durable.state).not.toBe("ENQUEUED");
    expect(["PENDING", "CANCELLED"]).toContain(durable.state);
  });

  it("NEW-PR4-C01: waiting/delayed/active existing jobs are acknowledged", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-c01-waiting",
      apiVersion: "2026-07",
      payload: {
        id: 106,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    const jobId = ingested.job!.id;
    const shopId = ingested.job!.shopId;

    // Pre-place a waiting queue job under seq 1 (ack-loss with runnable present).
    await prisma.$executeRaw`
      UPDATE "DurableJob"
      SET
        state = 'DISPATCH_LEASED',
        "leaseOwner" = 'dispatcher:waiting-ack',
        "leaseExpiresAt" = NOW() + INTERVAL '60 seconds',
        "updatedAt" = NOW()
      WHERE id = ${jobId} AND state = 'PENDING'
    `;

    const queueJobId = formatQueueJobId(jobId, 1);
    await prisma.jobDispatch.create({
      data: {
        shopId,
        durableJobId: jobId,
        dispatchSequence: 1,
        queueName: WEBHOOK_QUEUE,
        queueJobId,
        state: "PENDING_ENQUEUE",
        payloadDigest: ingested.job!.payloadDigest,
        leaseOwner: "dispatcher:waiting-ack",
        leaseExpiresAt: new Date(Date.now() + 60_000),
      },
    });

    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    await q.add(
      "orders/create",
      {
        topic: "orders/create",
        payloadShop: SHOP,
        payload: {},
        tenant: {} as never,
      },
      { jobId: queueJobId },
    );
    expect(await (await q.getJob(queueJobId))!.getState()).toBe("waiting");

    // Expire lease → PENDING, then dispatch should acknowledge existing waiting job.
    await prisma.durableJob.update({
      where: { id: jobId },
      data: { leaseExpiresAt: new Date(Date.now() - 1000) },
    });

    const result = await dispatchPendingJobs({ batchSize: 10 });
    expect(result.enqueued).toBeGreaterThanOrEqual(1);

    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    expect(durable.state).toBe("ENQUEUED");
    expect(await countRunnableQueueJobs(q)).toBeGreaterThanOrEqual(1);

    const dispatches = await prisma.jobDispatch.findMany({
      where: { durableJobId: jobId },
    });
    expect(dispatches.every((d) => d.dispatchSequence === 1)).toBe(true);
    expect(dispatches.some((d) => d.state === "ENQUEUED")).toBe(true);
    await q.close();
  });
});
