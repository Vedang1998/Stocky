/**
 * D-045 NEW-PR4-SC02…SC06 / SC08 reliability corrections.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { ingestAuthenticatedWebhook } from "../intake.server";
import {
  getControlPlanePrisma,
  resetControlPlanePrismaForTests,
} from "../control-plane-db.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import {
  WEBHOOK_QUEUE,
  requireRedisUrl,
  resetQueueClientsForTests,
} from "../../jobs/queue.server";
import {
  dispatchPendingJobs,
  recoverStrandedEnqueuedJobs,
  requireExactlyOneTransitionRow,
  INDETERMINATE_DATA_ISSUE_COOLDOWN_MS,
} from "../dispatcher.server";
import * as dispatcherModule from "../dispatcher.server";
import {
  RUNNABLE_BULLMQ_STATES,
  resolveTestRedisFastFailMs,
  inspectQueueDispatchPresence,
  __setQueueStateClassificationSeamForTests,
} from "../queue-presence.server";
import { renewAttemptHeartbeat } from "../lifecycle.server";
import { SyncControlPlaneError } from "../errors";
import { transitionToEnqueuedForTests } from "./test-state-helpers";

const SHOP = "pr4-final-corr.myshopify.com";

/**
 * Test-local only: intercept the control-plane `$transaction` client so the
 * final FAILED→DEAD_LETTERED `$queryRaw` returns zero rows. Production code
 * never sees this interception.
 */
async function withForcedEmptyDeadLetterTransition<T>(
  run: () => Promise<T>,
): Promise<T> {
  const cp = getControlPlanePrisma();
  const originalTransaction = cp.$transaction.bind(cp);

  // Overload-safe assignment for the disposable test client only.
  (cp as { $transaction: typeof cp.$transaction }).$transaction = ((
    arg: unknown,
    options?: unknown,
  ) => {
    if (typeof arg !== "function") {
      return (
        originalTransaction as (a: unknown, o?: unknown) => Promise<unknown>
      )(arg, options);
    }
    return originalTransaction(
      async (tx: Prisma.TransactionClient) => {
        const proxied = new Proxy(tx, {
          get(target, prop, receiver) {
            if (prop === "$queryRaw") {
              const orig = (
                Reflect.get(target, prop, target) as (
                  strings: TemplateStringsArray,
                  ...values: unknown[]
                ) => Promise<unknown>
              ).bind(target);
              return (
                strings: TemplateStringsArray,
                ...values: unknown[]
              ) => {
                const sql = Array.isArray(strings)
                  ? strings.join("?")
                  : String(strings);
                if (sql.includes("DEAD_LETTERED")) {
                  return Promise.resolve([]);
                }
                return orig(strings, ...values);
              };
            }
            const value = Reflect.get(target, prop, receiver);
            return typeof value === "function"
              ? (value as (...args: unknown[]) => unknown).bind(target)
              : value;
          },
        });
        return (arg as (tx: Prisma.TransactionClient) => Promise<unknown>)(
          proxied as Prisma.TransactionClient,
        );
      },
      options as never,
    );
  }) as typeof cp.$transaction;

  try {
    return await run();
  } finally {
    (cp as { $transaction: typeof cp.$transaction }).$transaction =
      originalTransaction;
  }
}

describe("test:sync-final-correction (D-045)", () => {
  let prisma: PrismaClient;
  let redis: IORedis;

  beforeAll(async () => {
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK = "1";
    process.env.TENANT_JOB_ENVELOPE_SECRET =
      process.env.TENANT_JOB_ENVELOPE_SECRET ??
      "test-only-tenant-job-envelope-secret-32b!!";
    process.env.NODE_ENV = "test";
    resetTenantJobEnvelopeSecretCache();
    await resetControlPlanePrismaForTests();
    prisma = new PrismaClient();
    if (!process.env.REDIS_URL) throw new Error("REDIS_URL required");
    redis = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  });

  afterAll(async () => {
    __setQueueStateClassificationSeamForTests(null);
    await resetControlPlanePrismaForTests();
    await prisma.$disconnect();
    await redis.quit();
  });

  beforeEach(async () => {
    __setQueueStateClassificationSeamForTests(null);
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

  it("NEW-PR4-SC02: test mode honors a bounded Redis timeout", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    process.env.STOCKY_TEST_REDIS_FAST_FAIL_MS = "500";
    expect(resolveTestRedisFastFailMs()).toBe(500);
    process.env.NODE_ENV = prev;
  });

  it("NEW-PR4-SC02: production ignores Redis test timeout", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.STOCKY_TEST_REDIS_FAST_FAIL_MS = "500";
    expect(resolveTestRedisFastFailMs()).toBeNull();
    process.env.NODE_ENV = prev;
  });

  it("NEW-PR4-SC02: development ignores Redis test timeout", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    process.env.STOCKY_TEST_REDIS_FAST_FAIL_MS = "500";
    expect(resolveTestRedisFastFailMs()).toBeNull();
    process.env.NODE_ENV = prev;
  });

  it("NEW-PR4-SC02: successful Redis lookup clears timeout and production cannot be altered", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.STOCKY_TEST_REDIS_FAST_FAIL_MS = "1";
    process.env.STOCKY_TEST_REDIS_FAST_FAIL = "1";
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    await q.add("probe", { ok: true }, { jobId: "sc02-prod-probe" });
    const presence = await inspectQueueDispatchPresence(q, "sc02-prod-probe");
    expect(["RUNNABLE_EXISTING", "MISSING"]).toContain(presence.status);
    expect(resolveTestRedisFastFailMs()).toBeNull();
    await q.close();
    process.env.NODE_ENV = prev;
  });

  it("NEW-PR4-SC02: real Redis outage still returns QUEUE_UNAVAILABLE", async () => {
    const original = requireRedisUrl();
    try {
      process.env.NODE_ENV = "test";
      process.env.STOCKY_TEST_REDIS_FAST_FAIL = "1";
      process.env.STOCKY_TEST_REDIS_FAST_FAIL_MS = "500";
      process.env.REDIS_URL = "redis://127.0.0.1:1";
      await resetQueueClientsForTests();
      const q = new Queue(WEBHOOK_QUEUE, {
        connection: new IORedis("redis://127.0.0.1:1", {
          maxRetriesPerRequest: 1,
          connectTimeout: 200,
          enableOfflineQueue: false,
          retryStrategy: () => null,
        }),
      });
      const presence = await inspectQueueDispatchPresence(q, "any");
      expect(presence.status).toBe("QUEUE_UNAVAILABLE");
      await q.close().catch(() => undefined);
    } finally {
      process.env.REDIS_URL = original;
      await resetQueueClientsForTests();
    }
  });

  it("NEW-PR4-SC03: indeterminate evidence deduplicates within cooldown", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-sc03-dedupe",
      apiVersion: "2026-07",
      payload: {
        id: 301,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    expect((await dispatchPendingJobs({ batchSize: 10 })).enqueued).toBe(1);
    await prisma.durableJob.update({
      where: { id: ingested.job!.id },
      data: { enqueuedAt: new Date(Date.now() - 10 * 60_000) },
    });
    __setQueueStateClassificationSeamForTests(() => ({
      status: "UNKNOWN_STATE",
      queueState: "future-sc03",
    }));

    await recoverStrandedEnqueuedJobs({ olderThanMs: 60_000, limit: 10 });
    await recoverStrandedEnqueuedJobs({ olderThanMs: 60_000, limit: 10 });
    const issues = await prisma.dataIssue.findMany({
      where: {
        shopId: ingested.job!.shopId,
        reasonCode: "unknown_queue_state_stranded",
      },
    });
    expect(issues.length).toBe(1);
    expect(INDETERMINATE_DATA_ISSUE_COOLDOWN_MS).toBeGreaterThan(0);

    const health = await prisma.syncHealth.findUnique({
      where: {
        shopId_syncDomain: {
          shopId: ingested.job!.shopId,
          syncDomain: "dispatch_queue_presence",
        },
      },
    });
    expect(health?.state).toBe("DEGRADED");
  });

  it("NEW-PR4-SC03: concurrent same-reason recovery → one issue", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-sc03-concurrent",
      apiVersion: "2026-07",
      payload: {
        id: 302,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    expect((await dispatchPendingJobs({ batchSize: 10 })).enqueued).toBe(1);
    await prisma.durableJob.update({
      where: { id: ingested.job!.id },
      data: { enqueuedAt: new Date(Date.now() - 10 * 60_000) },
    });
    __setQueueStateClassificationSeamForTests(() => ({
      status: "UNKNOWN_STATE",
      queueState: "future-sc03-c",
    }));
    await Promise.all([
      recoverStrandedEnqueuedJobs({ olderThanMs: 60_000, limit: 10 }),
      recoverStrandedEnqueuedJobs({ olderThanMs: 60_000, limit: 10 }),
    ]);
    expect(
      await prisma.dataIssue.count({
        where: {
          shopId: ingested.job!.shopId,
          reasonCode: "unknown_queue_state_stranded",
        },
      }),
    ).toBe(1);
  });

  it("NEW-PR4-SC04: nullable activeDispatchSequence fails closed", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-sc04-null-seq",
      apiVersion: "2026-07",
      payload: {
        id: 303,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    expect((await dispatchPendingJobs({ batchSize: 10 })).enqueued).toBe(1);
    const jobId = ingested.job!.id;
    await prisma.durableJob.update({
      where: { id: jobId },
      data: {
        enqueuedAt: new Date(Date.now() - 10 * 60_000),
        activeDispatchSequence: null,
      },
    });
    const beforeDispatch = await prisma.jobDispatch.findMany({
      where: { durableJobId: jobId },
    });
    const result = await recoverStrandedEnqueuedJobs({
      olderThanMs: 60_000,
      limit: 10,
    });
    expect(result.indeterminate).toBeGreaterThanOrEqual(1);
    expect(result.recovered).toBe(0);
    expect(result.deadLettered).toBe(0);
    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    expect(durable.state).toBe("ENQUEUED");
    const afterDispatch = await prisma.jobDispatch.findMany({
      where: { durableJobId: jobId },
    });
    expect(afterDispatch.map((d) => d.state)).toEqual(
      beforeDispatch.map((d) => d.state),
    );
  });

  it("NEW-PR4-SC04: heartbeat missing attempt updates zero durable jobs", async () => {
    const result = await renewAttemptHeartbeat({
      attemptId: "missing-attempt-id",
      shopId: "missing-shop",
      workerId: "w-none",
    });
    expect(result).toBeNull();
  });

  it("NEW-PR4-SC04: heartbeat renews only the exact attempt's durable job", async () => {
    const a = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-sc04-hb-a",
      apiVersion: "2026-07",
      payload: {
        id: 304,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    const b = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-sc04-hb-b",
      apiVersion: "2026-07",
      payload: {
        id: 305,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    await transitionToEnqueuedForTests(prisma, a.job!.id);
    await transitionToEnqueuedForTests(prisma, b.job!.id);

    const now = new Date();
    const lease = new Date(now.getTime() + 60_000);
    await prisma.$executeRaw`
      UPDATE "DurableJob" SET state = 'RUNNING', "leaseOwner" = 'w-a',
        "leaseExpiresAt" = ${lease}, "updatedAt" = ${now}
      WHERE id = ${a.job!.id}
    `;
    await prisma.$executeRaw`
      UPDATE "DurableJob" SET state = 'RUNNING', "leaseOwner" = 'w-a',
        "leaseExpiresAt" = ${lease}, "updatedAt" = ${now}
      WHERE id = ${b.job!.id}
    `;
    const attemptA = await prisma.jobAttempt.create({
      data: {
        shopId: a.job!.shopId,
        durableJobId: a.job!.id,
        attemptNumber: 1,
        workerId: "w-a",
        leaseOwner: "w-a",
        leaseExpiresAt: lease,
        startedAt: now,
      },
    });
    await prisma.jobAttempt.create({
      data: {
        shopId: b.job!.shopId,
        durableJobId: b.job!.id,
        attemptNumber: 1,
        workerId: "w-a",
        leaseOwner: "w-a",
        leaseExpiresAt: lease,
        startedAt: now,
      },
    });

    const renewed = await renewAttemptHeartbeat({
      attemptId: attemptA.id,
      shopId: a.job!.shopId,
      workerId: "w-a",
      leaseMs: 120_000,
    });
    expect(renewed).not.toBeNull();

    const jobA = await prisma.durableJob.findUniqueOrThrow({
      where: { id: a.job!.id },
    });
    const jobB = await prisma.durableJob.findUniqueOrThrow({
      where: { id: b.job!.id },
    });
    expect(jobA.leaseExpiresAt!.getTime()).toBeGreaterThan(lease.getTime());
    expect(jobB.leaseExpiresAt!.getTime()).toBe(lease.getTime());

    expect(
      await renewAttemptHeartbeat({
        attemptId: attemptA.id,
        shopId: "wrong-shop",
        workerId: "w-a",
      }),
    ).toBeNull();
    expect(
      await renewAttemptHeartbeat({
        attemptId: attemptA.id,
        shopId: a.job!.shopId,
        workerId: "wrong-worker",
      }),
    ).toBeNull();
  });

  it("NEW-PR4-SC05: requireExactlyOneTransitionRow validates RETURNING rows", () => {
    expect(requireExactlyOneTransitionRow([{ id: "only" }])).toBe("only");
    expect(() => requireExactlyOneTransitionRow([])).toThrow(SyncControlPlaneError);
    expect(() =>
      requireExactlyOneTransitionRow([{ id: "a" }, { id: "b" }]),
    ).toThrow(/FAILED→DEAD_LETTERED/);
  });

  it("NEW-PR4-SC05: terminal transition result required — forced fail rolls back", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-sc05-rollback",
      apiVersion: "2026-07",
      payload: {
        id: 306,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    expect((await dispatchPendingJobs({ batchSize: 10 })).enqueued).toBe(1);
    const jobId = ingested.job!.id;
    await prisma.durableJob.update({
      where: { id: jobId },
      data: {
        enqueuedAt: new Date(Date.now() - 10 * 60_000),
        executionStrategy: "NO_AUTOMATIC_RETRY",
      },
    });
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    const dispatch = await prisma.jobDispatch.findFirstOrThrow({
      where: { durableJobId: jobId },
    });
    const qj = await q.getJob(dispatch.queueJobId);
    if (qj) await qj.remove();
    await q.close();

    // Test-local Prisma interception only — production always runs real SQL.
    const result = await withForcedEmptyDeadLetterTransition(() =>
      recoverStrandedEnqueuedJobs({
        olderThanMs: 60_000,
        limit: 10,
      }),
    );
    expect(result.deadLettered).toBe(0);
    expect(result.isolatedFailures).toBeGreaterThanOrEqual(1);

    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    expect(durable.state).toBe("ENQUEUED");
    expect(durable.state).not.toBe("FAILED");
    expect(
      await prisma.deadLetter.count({ where: { durableJobId: jobId } }),
    ).toBe(0);
  });

  it("NEW-PR4-SC05: normal path returns DEAD_LETTERED and increments counter", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-sc05-ok",
      apiVersion: "2026-07",
      payload: {
        id: 307,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    expect((await dispatchPendingJobs({ batchSize: 10 })).enqueued).toBe(1);
    const jobId = ingested.job!.id;
    await prisma.durableJob.update({
      where: { id: jobId },
      data: {
        enqueuedAt: new Date(Date.now() - 10 * 60_000),
        executionStrategy: "NO_AUTOMATIC_RETRY",
      },
    });
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    const dispatch = await prisma.jobDispatch.findFirstOrThrow({
      where: { durableJobId: jobId },
    });
    const qj = await q.getJob(dispatch.queueJobId);
    if (qj) await qj.remove();
    await q.close();

    const result = await recoverStrandedEnqueuedJobs({
      olderThanMs: 60_000,
      limit: 10,
    });
    expect(result.deadLettered).toBe(1);
    expect(
      (await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } }))
        .state,
    ).toBe("DEAD_LETTERED");
    expect(
      await prisma.deadLetter.count({
        where: { durableJobId: jobId, resolutionState: "OPEN" },
      }),
    ).toBe(1);
  });

  it("NEW-PR4-SC06: BullMQ runnable-state allowlist excludes paused", () => {
    expect(RUNNABLE_BULLMQ_STATES).toEqual([
      "waiting",
      "delayed",
      "active",
      "prioritized",
      "waiting-children",
    ]);
    expect(RUNNABLE_BULLMQ_STATES).not.toContain("paused");
  });

  it("NEW-PR4-SC01: production receipt module exports no mutable test setter", async () => {
    const mod = await import("../application-receipt.server");
    expect(mod).not.toHaveProperty(
      "__setForceMissingWinnerAfterConflictForTests",
    );
    expect(
      Object.keys(mod).filter(
        (k) => k.includes("ForTests") || k.startsWith("__set"),
      ),
    ).toEqual([]);
  });

  it("NEW-PR4-SC05: dispatcher exports no dead-letter transition test setter", () => {
    expect(dispatcherModule).not.toHaveProperty(
      "__setForceDeadLetterTransitionFailForTests",
    );
    expect(
      Object.keys(dispatcherModule).filter(
        (k) =>
          k.includes("ForceDeadLetter") ||
          k.includes("forceDeadLetter") ||
          (k.includes("ForTests") && k.includes("DeadLetter")),
      ),
    ).toEqual([]);

    const source = readFileSync(
      join(process.cwd(), "app/sync/dispatcher.server.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/__setForceDeadLetterTransitionFailForTests/);
    expect(source).not.toMatch(/forceDeadLetterTransitionFailForTests/);
    // Production must always run the real FAILED→DEAD_LETTERED SQL.
    expect(source).toMatch(/state = 'DEAD_LETTERED'/);
    expect(source).not.toMatch(
      /forceDeadLetterTransitionFailForTests\s*\?\s*\[\s*\]/,
    );
  });

  it("NEW-PR4-SC08: stranded recovery budget increments attemptCount once", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-sc08-budget",
      apiVersion: "2026-07",
      payload: {
        id: 308,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    expect((await dispatchPendingJobs({ batchSize: 10 })).enqueued).toBe(1);
    const jobId = ingested.job!.id;
    await prisma.durableJob.update({
      where: { id: jobId },
      data: {
        enqueuedAt: new Date(Date.now() - 10 * 60_000),
        attemptCount: 0,
        maxAttempts: 3,
      },
    });
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    const dispatch = await prisma.jobDispatch.findFirstOrThrow({
      where: { durableJobId: jobId },
    });
    const qj = await q.getJob(dispatch.queueJobId);
    if (qj) await qj.remove();
    await q.close();

    const result = await recoverStrandedEnqueuedJobs({
      olderThanMs: 60_000,
      limit: 10,
    });
    expect(result.recovered).toBe(1);
    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    expect(durable.state).toBe("RETRY_WAIT");
    expect(durable.attemptCount).toBe(1);
  });

  it("NEW-PR4-SC08: indeterminate does not increment attemptCount", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-sc08-indet",
      apiVersion: "2026-07",
      payload: {
        id: 309,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    expect((await dispatchPendingJobs({ batchSize: 10 })).enqueued).toBe(1);
    const jobId = ingested.job!.id;
    await prisma.durableJob.update({
      where: { id: jobId },
      data: {
        enqueuedAt: new Date(Date.now() - 10 * 60_000),
        attemptCount: 1,
      },
    });
    __setQueueStateClassificationSeamForTests(() => ({
      status: "UNKNOWN_STATE",
      queueState: "future-sc08",
    }));
    await recoverStrandedEnqueuedJobs({ olderThanMs: 60_000, limit: 10 });
    expect(
      (await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } }))
        .attemptCount,
    ).toBe(1);
  });

  it("NEW-PR4-SC08: reaching attempt budget dead-letters immediately", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-sc08-limit",
      apiVersion: "2026-07",
      payload: {
        id: 310,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    expect((await dispatchPendingJobs({ batchSize: 10 })).enqueued).toBe(1);
    const jobId = ingested.job!.id;
    await prisma.durableJob.update({
      where: { id: jobId },
      data: {
        enqueuedAt: new Date(Date.now() - 10 * 60_000),
        attemptCount: 2,
        maxAttempts: 3,
      },
    });
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    const dispatch = await prisma.jobDispatch.findFirstOrThrow({
      where: { durableJobId: jobId },
    });
    const qj = await q.getJob(dispatch.queueJobId);
    if (qj) await qj.remove();
    await q.close();

    const result = await recoverStrandedEnqueuedJobs({
      olderThanMs: 60_000,
      limit: 10,
    });
    expect(result.deadLettered).toBe(1);
    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    expect(durable.state).toBe("DEAD_LETTERED");
    expect(durable.failureCode).toBe("max_attempts_exceeded");
  });
});
