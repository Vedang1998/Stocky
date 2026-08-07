/**
 * F-PR4-02 — JobDispatch retry identity and ack-loss recovery.
 * NEW-PR4-C01 — runnable-presence ack gate + stranded ENQUEUED recovery.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Job, Queue, Worker } from "bullmq";
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
import {
  WEBHOOK_QUEUE,
  requireRedisUrl,
  resetQueueClientsForTests,
} from "../../jobs/queue.server";
import {
  classifyQueueState,
  inspectQueueDispatchPresence,
} from "../queue-presence.server";
import { APPLICATION_OUTCOME_UNCERTAIN } from "../execution-strategy.server";
import { DURABLE_JOB_TRANSITION_PAIRS } from "../state-machine.server";

/** Test-local only: force Job.getState() to an unreachable future BullMQ value. */
async function withForcedQueueGetState<T>(
  queueState: string,
  run: () => Promise<T>,
): Promise<T> {
  const spy = vi
    .spyOn(Job.prototype, "getState")
    .mockResolvedValue(queueState as never);
  try {
    return await run();
  } finally {
    spy.mockRestore();
  }
}

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

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "DataIssue", "ReconciliationRun", "SyncHealth", "SyncCursor", "SyncRun",
        "JobReplay", "DeadLetter", "JobAttempt", "JobDispatch", "WebhookDelivery",
        "DurableJob", "DispatchReadyShop", "SyncApplicationReceipt"
      CASCADE
    `);
    await prisma.shop.deleteMany({ where: { myshopifyDomain: SHOP } });
    await prisma.shop.create({ data: { myshopifyDomain: SHOP } });
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    await q.obliterate({ force: true }).catch(() => undefined);
    await q.close();
    await resetControlPlanePrismaForTests();
  });

  afterAll(async () => {
    await resetControlPlanePrismaForTests();
    await prisma.$disconnect();
    await redis.quit();
  });

  it("NEW-CLAUDE-D045-01: classifyQueueState maps future unsupported state to UNKNOWN_STATE", () => {
    expect(classifyQueueState("future-bullmq-state-x")).toEqual({
      status: "UNKNOWN_STATE",
      queueState: "future-bullmq-state-x",
    });
    expect(classifyQueueState("waiting")).toEqual({
      status: "RUNNABLE_EXISTING",
      queueState: "waiting",
    });
    expect(classifyQueueState("failed")).toEqual({
      status: "TERMINAL_EXISTING",
      queueState: "failed",
    });
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
      expect([
        "not_runnable",
        "queue_unavailable",
        "queue_state_unknown",
        "shop_disabled",
      ]).toContain(result.outcome);
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

  // ─── D-044 NEW-PR4-C01 mechanical completion regressions ─────────────────

  async function enqueueStrandedWebhook(webhookId: string): Promise<{
    jobId: string;
    shopId: string;
    dispatch: Awaited<ReturnType<typeof prisma.jobDispatch.findFirstOrThrow>>;
  }> {
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
    const jobId = ingested.job!.id;
    const shopId = ingested.job!.shopId;
    expect((await dispatchPendingJobs({ batchSize: 10 })).enqueued).toBe(1);
    const dispatch = await prisma.jobDispatch.findFirstOrThrow({
      where: { durableJobId: jobId, dispatchSequence: 1 },
    });
    await prisma.durableJob.update({
      where: { id: jobId },
      data: { enqueuedAt: new Date(Date.now() - 10 * 60_000) },
    });
    return { jobId, shopId, dispatch };
  }

  it("NEW-PR4-C01: existing unknown queue state does not create another dispatch sequence", async () => {
    const { jobId, shopId, dispatch } = await enqueueStrandedWebhook("wh-c01-unk-seq");
    await resetToPendingWithPendingEnqueue(prisma, jobId, dispatch.id);

    await prisma.$executeRaw`
      UPDATE "DurableJob"
      SET
        state = 'DISPATCH_LEASED',
        "leaseOwner" = 'dispatcher:unk-seq',
        "leaseExpiresAt" = NOW() + INTERVAL '60 seconds',
        "updatedAt" = NOW()
      WHERE id = ${jobId} AND state = 'PENDING'
    `;

    const claimed = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
    const result = await withForcedQueueGetState("future-bullmq-state-x", () =>
      enqueueWithDispatch(
        {
          id: claimed.id,
          shopId,
          jobType: claimed.jobType,
          source: claimed.source,
          queueName: claimed.queueName,
          payloadSchemaVersion: claimed.payloadSchemaVersion,
          sanitizedPayload: claimed.sanitizedPayload,
          payloadDigest: claimed.payloadDigest,
          correlationId: claimed.correlationId,
          causationId: claimed.causationId,
          state: claimed.state,
          executionStrategy: claimed.executionStrategy,
          activeDispatchSequence: claimed.activeDispatchSequence,
        },
        { ...dispatch, state: "PENDING_ENQUEUE" },
        { workerId: "dispatcher:unk-seq" },
      ),
    );

    expect(result.outcome).toBe("queue_state_unknown");
    if (result.outcome === "queue_state_unknown") {
      expect(result.dispatch.dispatchSequence).toBe(1);
      expect(result.queueState).toBe("future-bullmq-state-x");
    }

    const all = await prisma.jobDispatch.findMany({
      where: { durableJobId: jobId },
      orderBy: { dispatchSequence: "asc" },
    });
    expect(all).toHaveLength(1);
    expect(all[0].dispatchSequence).toBe(1);
    expect(all[0].state).toBe("PENDING_ENQUEUE");
  });

  it("NEW-PR4-C01: existing unknown queue state is not marked FAILED or SUPERSEDED", async () => {
    const { jobId, shopId, dispatch } = await enqueueStrandedWebhook("wh-c01-unk-mark");
    await resetToPendingWithPendingEnqueue(prisma, jobId, dispatch.id);
    await prisma.$executeRaw`
      UPDATE "DurableJob"
      SET state = 'DISPATCH_LEASED', "leaseOwner" = 'dispatcher:unk-mark',
          "leaseExpiresAt" = NOW() + INTERVAL '60 seconds', "updatedAt" = NOW()
      WHERE id = ${jobId} AND state = 'PENDING'
    `;
    const claimed = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
    const result = await withForcedQueueGetState("future-bullmq-state-y", () =>
      enqueueWithDispatch(
        {
          id: claimed.id,
          shopId,
          jobType: claimed.jobType,
          source: claimed.source,
          queueName: claimed.queueName,
          payloadSchemaVersion: claimed.payloadSchemaVersion,
          sanitizedPayload: claimed.sanitizedPayload,
          payloadDigest: claimed.payloadDigest,
          correlationId: claimed.correlationId,
          causationId: claimed.causationId,
          state: claimed.state,
          executionStrategy: claimed.executionStrategy,
          activeDispatchSequence: claimed.activeDispatchSequence,
        },
        { ...dispatch, state: "PENDING_ENQUEUE" },
        { workerId: "dispatcher:unk-mark" },
      ),
    );
    expect(result.outcome).toBe("queue_state_unknown");
    const d = await prisma.jobDispatch.findUniqueOrThrow({ where: { id: dispatch.id } });
    expect(d.state).toBe("PENDING_ENQUEUE");
    expect(d.state).not.toBe("FAILED");
    expect(d.state).not.toBe("SUPERSEDED");
  });

  it("NEW-PR4-C01: unknown queue state does not acknowledge the durable job", async () => {
    const { jobId } = await enqueueStrandedWebhook("wh-c01-unk-ack");
    const dispatch = await prisma.jobDispatch.findFirstOrThrow({
      where: { durableJobId: jobId, dispatchSequence: 1 },
    });
    await resetToPendingWithPendingEnqueue(prisma, jobId, dispatch.id);

    const before = await prisma.jobDispatch.count({ where: { durableJobId: jobId } });
    const result = await withForcedQueueGetState("future-bullmq-state-z", () =>
      dispatchPendingJobs({ batchSize: 10 }),
    );
    expect(result.enqueued).toBe(0);

    const durable = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(durable.state).not.toBe("ENQUEUED");
    expect(["DISPATCH_LEASED", "PENDING"]).toContain(durable.state);

    const after = await prisma.jobDispatch.count({ where: { durableJobId: jobId } });
    expect(after).toBe(before);
  });

  it("NEW-PR4-C01: unknown post-add state preserves the existing dispatch as uncertain", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-c01-post-add-unk",
      apiVersion: "2026-07",
      payload: {
        id: 201,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    const jobId = ingested.job!.id;
    const shopId = ingested.job!.shopId;

    await prisma.$executeRaw`
      UPDATE "DurableJob"
      SET state = 'DISPATCH_LEASED', "leaseOwner" = 'dispatcher:post-add',
          "leaseExpiresAt" = NOW() + INTERVAL '60 seconds', "updatedAt" = NOW()
      WHERE id = ${jobId} AND state = 'PENDING'
    `;
    const queueJobId = formatQueueJobId(jobId, 1);
    const dispatch = await prisma.jobDispatch.create({
      data: {
        shopId,
        durableJobId: jobId,
        dispatchSequence: 1,
        queueName: WEBHOOK_QUEUE,
        queueJobId,
        state: "PENDING_ENQUEUE",
        payloadDigest: ingested.job!.payloadDigest,
        leaseOwner: "dispatcher:post-add",
        leaseExpiresAt: new Date(Date.now() + 60_000),
      },
    });

    // Ensure no pre-existing Redis job so path is MISSING → add → unknown getState.
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    const existing = await q.getJob(queueJobId);
    if (existing) await existing.remove();

    const claimed = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
    // After add, classifyExistingQueueJob calls getState — force an unreachable future state.
    const result = await withForcedQueueGetState("future-post-add-state", () =>
      enqueueWithDispatch(
        {
          id: claimed.id,
          shopId,
          jobType: claimed.jobType,
          source: claimed.source,
          queueName: claimed.queueName,
          payloadSchemaVersion: claimed.payloadSchemaVersion,
          sanitizedPayload: claimed.sanitizedPayload,
          payloadDigest: claimed.payloadDigest,
          correlationId: claimed.correlationId,
          causationId: claimed.causationId,
          state: claimed.state,
          executionStrategy: claimed.executionStrategy,
          activeDispatchSequence: claimed.activeDispatchSequence,
        },
        dispatch,
        { workerId: "dispatcher:post-add" },
      ),
    );

    expect(result.outcome).toBe("queue_state_unknown");
    if (result.outcome === "queue_state_unknown") {
      expect(result.dispatch.dispatchSequence).toBe(1);
    }
    const d = await prisma.jobDispatch.findUniqueOrThrow({ where: { id: dispatch.id } });
    expect(d.state).toBe("PENDING_ENQUEUE");
    expect(d.dispatchSequence).toBe(1);
    const all = await prisma.jobDispatch.findMany({ where: { durableJobId: jobId } });
    expect(all).toHaveLength(1);
    await q.close();
  });

  it("NEW-PR4-C01: dispatcher queue lookup failure does not acknowledge or allocate another sequence", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-c01-lookup-fail",
      apiVersion: "2026-07",
      payload: {
        id: 202,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    const jobId = ingested.job!.id;
    const originalRedis = requireRedisUrl();

    await prisma.$executeRaw`
      UPDATE "DurableJob"
      SET state = 'DISPATCH_LEASED', "leaseOwner" = 'dispatcher:outage',
          "leaseExpiresAt" = NOW() + INTERVAL '60 seconds', "updatedAt" = NOW()
      WHERE id = ${jobId} AND state = 'PENDING'
    `;
    await prisma.jobDispatch.create({
      data: {
        shopId: ingested.job!.shopId,
        durableJobId: jobId,
        dispatchSequence: 1,
        queueName: WEBHOOK_QUEUE,
        queueJobId: formatQueueJobId(jobId, 1),
        state: "PENDING_ENQUEUE",
        payloadDigest: ingested.job!.payloadDigest,
        leaseOwner: "dispatcher:outage",
        leaseExpiresAt: new Date(Date.now() + 60_000),
      },
    });

    try {
      await resetQueueClientsForTests();
      process.env.STOCKY_TEST_REDIS_FAST_FAIL = "1";
      process.env.STOCKY_TEST_REDIS_FAST_FAIL_MS = "500";
      process.env.REDIS_URL = "redis://127.0.0.1:1";
      await resetQueueClientsForTests();

      const claimed = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
      const dispatch = await prisma.jobDispatch.findFirstOrThrow({
        where: { durableJobId: jobId },
      });
      const result = await enqueueWithDispatch(
        {
          id: claimed.id,
          shopId: claimed.shopId,
          jobType: claimed.jobType,
          source: claimed.source,
          queueName: claimed.queueName,
          payloadSchemaVersion: claimed.payloadSchemaVersion,
          sanitizedPayload: claimed.sanitizedPayload,
          payloadDigest: claimed.payloadDigest,
          correlationId: claimed.correlationId,
          causationId: claimed.causationId,
          state: claimed.state,
          executionStrategy: claimed.executionStrategy,
          activeDispatchSequence: claimed.activeDispatchSequence,
        },
        dispatch,
        { workerId: "dispatcher:outage" },
      );
      expect(result.outcome).toBe("queue_unavailable");
      expect(result.dispatch.dispatchSequence).toBe(1);

      const durable = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
      expect(durable.state).toBe("DISPATCH_LEASED");
      const all = await prisma.jobDispatch.findMany({ where: { durableJobId: jobId } });
      expect(all).toHaveLength(1);
      expect(all[0].state).toBe("PENDING_ENQUEUE");
    } finally {
      delete process.env.STOCKY_TEST_REDIS_FAST_FAIL;
      delete process.env.STOCKY_TEST_REDIS_FAST_FAIL_MS;
      process.env.REDIS_URL = originalRedis;
      await resetQueueClientsForTests();
    }
  });

  it("NEW-PR4-C01: stranded reaper queue lookup failure leaves the job and dispatch unchanged", async () => {
    const { jobId, dispatch } = await enqueueStrandedWebhook("wh-c01-strand-outage");
    const originalRedis = requireRedisUrl();
    const beforeJob = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
    const beforeDispatch = await prisma.jobDispatch.findUniqueOrThrow({
      where: { id: dispatch.id },
    });

    try {
      await resetQueueClientsForTests();
      process.env.STOCKY_TEST_REDIS_FAST_FAIL = "1";
      process.env.STOCKY_TEST_REDIS_FAST_FAIL_MS = "500";
      process.env.REDIS_URL = "redis://127.0.0.1:1";
      await resetQueueClientsForTests();

      const result = await recoverStrandedEnqueuedJobs({
        olderThanMs: 60_000,
        limit: 10,
      });
      expect(result.indeterminate).toBeGreaterThanOrEqual(1);
      expect(result.recovered).toBe(0);
      expect(result.deadLettered).toBe(0);

      const afterJob = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
      const afterDispatch = await prisma.jobDispatch.findUniqueOrThrow({
        where: { id: dispatch.id },
      });
      expect(afterJob.state).toBe(beforeJob.state);
      expect(afterJob.state).toBe("ENQUEUED");
      expect(afterDispatch.state).toBe(beforeDispatch.state);
      expect(afterDispatch.dispatchSequence).toBe(1);
    } finally {
      delete process.env.STOCKY_TEST_REDIS_FAST_FAIL;
      delete process.env.STOCKY_TEST_REDIS_FAST_FAIL_MS;
      process.env.REDIS_URL = originalRedis;
      await resetQueueClientsForTests();
    }
  });

  it("NEW-PR4-C01: queue failure for Shop A does not block Shop B", async () => {
    const shopB = "pr4-dispatch-b.myshopify.com";
    await prisma.shop.deleteMany({ where: { myshopifyDomain: shopB } });
    await prisma.shop.create({ data: { myshopifyDomain: shopB } });

    const a = await enqueueStrandedWebhook("wh-c01-shop-a");
    const ingestedB = await ingestAuthenticatedWebhook({
      verifiedShop: shopB,
      topic: "orders/create",
      webhookId: "wh-c01-shop-b",
      apiVersion: "2026-07",
      payload: {
        id: 203,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    const jobB = ingestedB.job!.id;
    expect((await dispatchPendingJobs({ batchSize: 10 })).enqueued).toBeGreaterThanOrEqual(1);
    await prisma.durableJob.update({
      where: { id: jobB },
      data: { enqueuedAt: new Date(Date.now() - 10 * 60_000) },
    });
    const dispatchB = await prisma.jobDispatch.findFirstOrThrow({
      where: { durableJobId: jobB, dispatchSequence: 1 },
    });
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    const qjB = await q.getJob(dispatchB.queueJobId);
    if (qjB) await qjB.remove();
    await q.close();

    // Shop A: leave Redis job present → UNKNOWN via getState spy.
    // Shop B: confirmed missing → RETRY_WAIT (getState not called when Job missing).
    const result = await withForcedQueueGetState("future-shop-a", () =>
      recoverStrandedEnqueuedJobs({
        olderThanMs: 60_000,
        limit: 20,
      }),
    );
    expect(result.indeterminate).toBeGreaterThanOrEqual(1);
    expect(result.recovered).toBeGreaterThanOrEqual(1);

    const jobAAfter = await prisma.durableJob.findUniqueOrThrow({ where: { id: a.jobId } });
    const jobBAfter = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobB } });
    expect(jobAAfter.state).toBe("ENQUEUED");
    expect(jobBAfter.state).toBe("RETRY_WAIT");
  });

  it("NEW-PR4-C01: unknown state in the stranded reaper leaves the job unchanged", async () => {
    const { jobId, dispatch } = await enqueueStrandedWebhook("wh-c01-strand-unk");
    const beforeAttempts = (
      await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } })
    ).attemptCount;
    const result = await withForcedQueueGetState("future-stranded", () =>
      recoverStrandedEnqueuedJobs({
        olderThanMs: 60_000,
        limit: 10,
      }),
    );
    expect(result.indeterminate).toBeGreaterThanOrEqual(1);
    expect(result.recovered).toBe(0);
    expect(result.deadLettered).toBe(0);

    const durable = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
    const d = await prisma.jobDispatch.findUniqueOrThrow({ where: { id: dispatch.id } });
    expect(durable.state).toBe("ENQUEUED");
    expect(durable.attemptCount).toBe(beforeAttempts);
    expect(d.state).toBe("ENQUEUED");
    expect(d.dispatchSequence).toBe(1);
  });

  it("NEW-PR4-C01: confirmed missing queue job below limits transitions to RETRY_WAIT", async () => {
    const { jobId, dispatch } = await enqueueStrandedWebhook("wh-c01-missing-retry");
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    const qj = await q.getJob(dispatch.queueJobId);
    if (qj) await qj.remove();
    await q.close();

    const result = await recoverStrandedEnqueuedJobs({
      olderThanMs: 60_000,
      limit: 10,
    });
    expect(result.recovered).toBeGreaterThanOrEqual(1);
    expect(result.deadLettered).toBe(0);

    const durable = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(durable.state).toBe("RETRY_WAIT");
    const d = await prisma.jobDispatch.findUniqueOrThrow({ where: { id: dispatch.id } });
    expect(d.state).toBe("FAILED");
  });

  it("NEW-PR4-C01: confirmed terminal queue job below limits transitions to RETRY_WAIT", async () => {
    const { jobId, dispatch } = await enqueueStrandedWebhook("wh-c01-term-retry");
    await forceQueueJobTerminal(redis, dispatch.queueJobId, "failed");

    const result = await recoverStrandedEnqueuedJobs({
      olderThanMs: 60_000,
      limit: 10,
    });
    expect(result.recovered).toBeGreaterThanOrEqual(1);
    expect(result.deadLettered).toBe(0);

    const durable = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(durable.state).toBe("RETRY_WAIT");
    const d = await prisma.jobDispatch.findUniqueOrThrow({ where: { id: dispatch.id } });
    expect(d.state).toBe("SUPERSEDED");
  });

  it("NEW-PR4-C01: NO_AUTOMATIC_RETRY stranded job dead-letters with application_outcome_uncertain", async () => {
    const { jobId, dispatch } = await enqueueStrandedWebhook("wh-c01-no-retry");
    await prisma.durableJob.update({
      where: { id: jobId },
      data: { executionStrategy: "NO_AUTOMATIC_RETRY", attemptCount: 2 },
    });
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    const qj = await q.getJob(dispatch.queueJobId);
    if (qj) await qj.remove();
    await q.close();

    const result = await recoverStrandedEnqueuedJobs({
      olderThanMs: 60_000,
      limit: 10,
    });
    expect(result.deadLettered).toBeGreaterThanOrEqual(1);
    expect(result.recovered).toBe(0);

    const durable = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(durable.state).toBe("DEAD_LETTERED");
    expect(durable.failureCode).toBe(APPLICATION_OUTCOME_UNCERTAIN);
    // NEW-CLAUDE-D045-04: consumed opportunity persisted on dead-letter path.
    expect(durable.attemptCount).toBe(3);

    const dls = await prisma.deadLetter.findMany({ where: { durableJobId: jobId } });
    expect(dls).toHaveLength(1);
    expect(dls[0].resolutionState).toBe("OPEN");
    expect(dls[0].finalAttemptId).toBeNull();
    expect(dls[0].terminalReason).toBe(APPLICATION_OUTCOME_UNCERTAIN);

    // Never redispatched from DEAD_LETTERED
    const again = await dispatchPendingJobs({ batchSize: 10 });
    expect(again.enqueued).toBe(0);
    const after = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(after.state).toBe("DEAD_LETTERED");
  });

  it("NEW-PR4-C01: max-attempt stranded job dead-letters with max_attempts_exceeded", async () => {
    const { jobId, dispatch } = await enqueueStrandedWebhook("wh-c01-max-att");
    await prisma.durableJob.update({
      where: { id: jobId },
      data: { attemptCount: 2, maxAttempts: 3 },
    });
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    const qj = await q.getJob(dispatch.queueJobId);
    if (qj) await qj.remove();
    await q.close();

    const result = await recoverStrandedEnqueuedJobs({
      olderThanMs: 60_000,
      limit: 10,
    });
    expect(result.deadLettered).toBe(1);
    expect(result.recovered).toBe(0);

    const durable = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(durable.state).toBe("DEAD_LETTERED");
    expect(durable.failureCode).toBe("max_attempts_exceeded");
    // NEW-CLAUDE-D045-04: budget-exhausted dead-letter persists maxAttempts.
    expect(durable.attemptCount).toBe(3);

    const dls = await prisma.deadLetter.findMany({ where: { durableJobId: jobId } });
    expect(dls).toHaveLength(1);
    expect(dls[0].finalAttemptId).toBeNull();
    expect(dls[0].terminalReason).toBe("max_attempts_exceeded");
    expect(dls[0].resolutionState).toBe("OPEN");
  });

  it("NEW-CLAUDE-D045-04: concurrent reapers consume attempt opportunity once on dead-letter", async () => {
    const { jobId, dispatch } = await enqueueStrandedWebhook("wh-d045-04-concurrent");
    await prisma.durableJob.update({
      where: { id: jobId },
      data: { executionStrategy: "NO_AUTOMATIC_RETRY", attemptCount: 4 },
    });
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    const qj = await q.getJob(dispatch.queueJobId);
    if (qj) await qj.remove();
    await q.close();

    const [r1, r2] = await Promise.all([
      recoverStrandedEnqueuedJobs({ olderThanMs: 60_000, limit: 10 }),
      recoverStrandedEnqueuedJobs({ olderThanMs: 60_000, limit: 10 }),
    ]);
    expect(r1.deadLettered + r2.deadLettered).toBe(1);

    const durable = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(durable.state).toBe("DEAD_LETTERED");
    expect(durable.attemptCount).toBe(5);
    expect(
      await prisma.deadLetter.count({
        where: { durableJobId: jobId, resolutionState: "OPEN" },
      }),
    ).toBe(1);
  });

  it("NEW-PR4-C01: dead letter allows finalAttemptId NULL and exactly one OPEN", async () => {
    const { jobId, dispatch } = await enqueueStrandedWebhook("wh-c01-dl-null");
    await prisma.durableJob.update({
      where: { id: jobId },
      data: { executionStrategy: "NO_AUTOMATIC_RETRY" },
    });
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    const qj = await q.getJob(dispatch.queueJobId);
    if (qj) await qj.remove();
    await q.close();

    await recoverStrandedEnqueuedJobs({ olderThanMs: 60_000, limit: 10 });
    // Concurrent second pass must preserve exactly one OPEN DL
    const second = await recoverStrandedEnqueuedJobs({ olderThanMs: 60_000, limit: 10 });
    expect(second.deadLettered).toBe(0);

    const open = await prisma.deadLetter.findMany({
      where: { durableJobId: jobId, resolutionState: "OPEN" },
    });
    expect(open).toHaveLength(1);
    expect(open[0].finalAttemptId).toBeNull();
  });

  it("NEW-PR4-C01: deadLettered return count increments", async () => {
    const { jobId, dispatch } = await enqueueStrandedWebhook("wh-c01-dl-count");
    await prisma.durableJob.update({
      where: { id: jobId },
      data: { executionStrategy: "NO_AUTOMATIC_RETRY" },
    });
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    const qj = await q.getJob(dispatch.queueJobId);
    if (qj) await qj.remove();
    await q.close();

    const result = await recoverStrandedEnqueuedJobs({
      olderThanMs: 60_000,
      limit: 10,
    });
    expect(result.deadLettered).toBe(1);
  });

  it("NEW-PR4-C01: concurrent stranded reapers produce one legal outcome", async () => {
    const { jobId, dispatch } = await enqueueStrandedWebhook("wh-c01-concurrent");
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    const qj = await q.getJob(dispatch.queueJobId);
    if (qj) await qj.remove();
    await q.close();

    const [r1, r2] = await Promise.all([
      recoverStrandedEnqueuedJobs({ olderThanMs: 60_000, limit: 10 }),
      recoverStrandedEnqueuedJobs({ olderThanMs: 60_000, limit: 10 }),
    ]);
    expect(r1.recovered + r2.recovered).toBe(1);
    expect(r1.deadLettered + r2.deadLettered).toBe(0);

    const durable = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(durable.state).toBe("RETRY_WAIT");
    const openDl = await prisma.deadLetter.count({
      where: { durableJobId: jobId, resolutionState: "OPEN" },
    });
    expect(openDl).toBe(0);
  });

  it("NEW-PR4-C01: Redis outage cannot create duplicate dispatches", async () => {
    const { jobId, dispatch } = await enqueueStrandedWebhook("wh-c01-outage-dup");
    await resetToPendingWithPendingEnqueue(prisma, jobId, dispatch.id);
    const originalRedis = requireRedisUrl();
    const before = await prisma.jobDispatch.count({ where: { durableJobId: jobId } });

    try {
      await resetQueueClientsForTests();
      process.env.STOCKY_TEST_REDIS_FAST_FAIL = "1";
      process.env.STOCKY_TEST_REDIS_FAST_FAIL_MS = "500";
      process.env.REDIS_URL = "redis://127.0.0.1:1";
      await resetQueueClientsForTests();

      const result = await dispatchPendingJobs({ batchSize: 10 });
      expect(result.enqueued).toBe(0);

      const after = await prisma.jobDispatch.count({ where: { durableJobId: jobId } });
      expect(after).toBe(before);
      const sequences = await prisma.jobDispatch.findMany({
        where: { durableJobId: jobId },
        select: { dispatchSequence: true, state: true },
      });
      expect(sequences.every((s) => s.dispatchSequence === 1)).toBe(true);
    } finally {
      delete process.env.STOCKY_TEST_REDIS_FAST_FAIL;
      delete process.env.STOCKY_TEST_REDIS_FAST_FAIL_MS;
      process.env.REDIS_URL = originalRedis;
      await resetQueueClientsForTests();
    }
  });

  it("NEW-PR4-C01: one indeterminate candidate does not block other candidates", async () => {
    const a = await enqueueStrandedWebhook("wh-c01-indeterminate-a");
    const b = await enqueueStrandedWebhook("wh-c01-indeterminate-b");

    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    const qjB = await q.getJob(b.dispatch.queueJobId);
    if (qjB) await qjB.remove();
    await q.close();

    // B is MISSING — getState spy only applies when a Job object exists.
    // So A (still in Redis as waiting) → UNKNOWN; B (removed) → MISSING → recover.
    const result = await withForcedQueueGetState("future-block-test", () =>
      recoverStrandedEnqueuedJobs({
        olderThanMs: 60_000,
        limit: 20,
      }),
    );
    expect(result.indeterminate).toBeGreaterThanOrEqual(1);
    expect(result.recovered).toBeGreaterThanOrEqual(1);

    const jobA = await prisma.durableJob.findUniqueOrThrow({ where: { id: a.jobId } });
    const jobB = await prisma.durableJob.findUniqueOrThrow({ where: { id: b.jobId } });
    expect(jobA.state).toBe("ENQUEUED");
    expect(jobB.state).toBe("RETRY_WAIT");
  });

  it("NEW-PR4-C01: database and application transition graphs agree", async () => {
    const pairs = new Set(
      DURABLE_JOB_TRANSITION_PAIRS.map((p) => `${p.from}->${p.to}`),
    );
    expect(pairs.has("ENQUEUED->RETRY_WAIT")).toBe(true);
    expect(pairs.has("ENQUEUED->FAILED")).toBe(true);
    expect(pairs.has("FAILED->DEAD_LETTERED")).toBe(true);

    // Prove DB trigger allows ENQUEUED → FAILED → DEAD_LETTERED.
    const shop = await prisma.shop.findFirstOrThrow({
      where: { myshopifyDomain: SHOP },
    });
    const job = await prisma.durableJob.create({
      data: {
        shopId: shop.id,
        jobType: "webhook:orders/create",
        source: "webhook:orders/create",
        queueName: WEBHOOK_QUEUE,
        payloadSchemaVersion: "test",
        sanitizedPayload: {},
        payloadDigest: "digest-transition-agree",
        idempotencyKey: `transition-agree-${Date.now()}`,
        correlationId: `corr-transition-${Date.now()}`,
        authorityVersion: "v1",
        state: "PENDING",
        executionStrategy: "NO_AUTOMATIC_RETRY",
      },
    });
    await prisma.$executeRaw`
      UPDATE "DurableJob" SET state = 'DISPATCH_LEASED', "updatedAt" = NOW()
      WHERE id = ${job.id} AND state = 'PENDING'
    `;
    await prisma.$executeRaw`
      UPDATE "DurableJob" SET state = 'ENQUEUED', "enqueuedAt" = NOW(), "updatedAt" = NOW()
      WHERE id = ${job.id} AND state = 'DISPATCH_LEASED'
    `;
    await prisma.$executeRaw`
      UPDATE "DurableJob" SET state = 'FAILED', "updatedAt" = NOW()
      WHERE id = ${job.id} AND state = 'ENQUEUED'
    `;
    await prisma.$executeRaw`
      UPDATE "DurableJob" SET state = 'DEAD_LETTERED', "deadLetteredAt" = NOW(), "updatedAt" = NOW()
      WHERE id = ${job.id} AND state = 'FAILED'
    `;
    const final = await prisma.durableJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(final.state).toBe("DEAD_LETTERED");

    // SQL function body must mention ENQUEUED→FAILED.
    const defs = await prisma.$queryRaw<Array<{ def: string }>>`
      SELECT pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'stocky_durable_job_transition_guard'
    `;
    expect(defs.length).toBeGreaterThanOrEqual(1);
    expect(defs[0].def).toMatch(/ENQUEUED['"]?\s*,\s*['"]FAILED/);
  });
});
