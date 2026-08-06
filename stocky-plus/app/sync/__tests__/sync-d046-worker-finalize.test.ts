/**
 * NEW-CLAUDE-D045-02 / D-046 — genuine v2/v3 processWebhookJob catch/finalization evidence.
 *
 * Drives the real worker catch branches (not finalizeApplicationAfterRollback alone).
 * Test-local mocking of applyWithApplicationReceipt is used solely to throw documented
 * post-rollback error codes; no production hook is added.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import type { Job } from "bullmq";
import { ingestAuthenticatedWebhook } from "../intake.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { resetPrismaSingletonForTests } from "../../db.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import {
  createTenantJobEnvelopeV2,
  TENANT_JOB_ENVELOPE_V2_VERSION,
} from "../envelope-v2.server";
import {
  createTenantJobEnvelopeV3,
  TENANT_JOB_ENVELOPE_V3_VERSION,
} from "../envelope-v3.server";
import { issueSyncDispatchAuthority } from "../../tenant/sync-dispatch-authority.server";
import type { WebhookJobData } from "../../jobs/queue.server";
import { transitionToEnqueuedForTests } from "./test-state-helpers";
import { formatQueueJobId } from "../dispatcher.server";
import {
  APPLICATION_ALREADY_APPLIED,
  APPLICATION_DIGEST_CONFLICT,
  APPLICATION_OUTCOME_UNCERTAIN,
  resolveApplicationKey,
} from "../execution-strategy.server";
import { SyncControlPlaneError } from "../errors";

const { applyMock, originalApply } = vi.hoisted(() => {
  const applyMock = vi.fn();
  return {
    applyMock,
    // Filled in by the mock factory with the real implementation.
    originalApply: { current: null as null | ((...args: never[]) => Promise<unknown>) },
  };
});

vi.mock("../application-receipt.server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../application-receipt.server")>();
  originalApply.current = actual.applyWithApplicationReceipt as (
    ...args: never[]
  ) => Promise<unknown>;
  applyMock.mockImplementation((...args: never[]) =>
    (originalApply.current as (...a: never[]) => Promise<unknown>)(...args),
  );
  return {
    ...actual,
    applyWithApplicationReceipt: (...args: unknown[]) =>
      applyMock(...(args as never[])),
  };
});

const { processWebhookJob } = await import(
  "../../jobs/workers/webhook-processor"
);

const SHOP = "pr4-d046-worker.myshopify.com";

function fakeJob(
  data: WebhookJobData,
  id: string,
): Job<WebhookJobData> {
  return {
    id,
    name: data.topic,
    data,
  } as unknown as Job<WebhookJobData>;
}

describe("test:sync-d046-worker-finalize (NEW-CLAUDE-D045-02)", () => {
  let prisma: PrismaClient;
  let shopId: string;
  const isolationObservations: Array<Prisma.TransactionIsolationLevel | undefined> =
    [];
  let transactionSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeAll(async () => {
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK = "1";
    process.env.TENANT_JOB_ENVELOPE_SECRET =
      process.env.TENANT_JOB_ENVELOPE_SECRET ??
      "test-only-tenant-job-envelope-secret-32b!!";
    resetTenantJobEnvelopeSecretCache();
    await resetControlPlanePrismaForTests();
    // Runtime TenantDb (createTenantDb) uses the verified runtime singleton.
    await resetPrismaSingletonForTests();
    prisma = new PrismaClient();

    const original = PrismaClient.prototype.$transaction;
    transactionSpy = vi
      .spyOn(PrismaClient.prototype, "$transaction")
      .mockImplementation(function (
        this: PrismaClient,
        arg: unknown,
        options?: {
          isolationLevel?: Prisma.TransactionIsolationLevel;
          maxWait?: number;
          timeout?: number;
        },
      ) {
        if (typeof arg === "function" && options?.isolationLevel != null) {
          isolationObservations.push(options.isolationLevel);
        }
        return (
          original as (
            this: PrismaClient,
            a: unknown,
            o?: unknown,
          ) => Promise<unknown>
        ).call(this, arg, options);
      });
  });

  afterAll(async () => {
    transactionSpy?.mockRestore();
    await resetControlPlanePrismaForTests();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    isolationObservations.length = 0;
    applyMock.mockReset();
    applyMock.mockImplementation((...args: never[]) => {
      if (!originalApply.current) {
        throw new Error("original applyWithApplicationReceipt not captured");
      }
      return originalApply.current(...args);
    });
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "DataIssue", "ReconciliationRun", "SyncHealth", "SyncCursor", "SyncRun",
        "JobReplay", "DeadLetter", "JobAttempt", "JobDispatch", "WebhookDelivery",
        "DurableJob", "SyncApplicationReceipt", "SalesDailyAggregate", "LowStockAlert",
        "BomComponent"
      CASCADE
    `);
    await prisma.shop.deleteMany({ where: { myshopifyDomain: SHOP } });
    const shop = await prisma.shop.create({ data: { myshopifyDomain: SHOP } });
    shopId = shop.id;
    await resetControlPlanePrismaForTests();
  });

  async function ingestAndPrepare(webhookId: string) {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId,
      apiVersion: "2026-07",
      payload: {
        id: Number(webhookId.replace(/\D/g, "").slice(-6) || "1"),
        line_items: [{ variant_id: 42, quantity: 2, price: "10.00" }],
      },
    });
    const job = ingested.job!;
    await transitionToEnqueuedForTests(prisma, job.id);
    const dispatch = await prisma.jobDispatch.create({
      data: {
        shopId: job.shopId,
        durableJobId: job.id,
        dispatchSequence: 1,
        queueName: "stocky-webhooks",
        queueJobId: formatQueueJobId(job.id, 1),
        state: "ENQUEUED",
        payloadDigest: job.payloadDigest,
        enqueuedAt: new Date(),
      },
    });
    await prisma.durableJob.update({
      where: { id: job.id },
      data: { activeDispatchSequence: 1 },
    });
    return { job, dispatch, delivery: ingested.delivery };
  }

  function buildV3Job(
    job: Awaited<ReturnType<typeof ingestAndPrepare>>["job"],
    dispatch: Awaited<ReturnType<typeof ingestAndPrepare>>["dispatch"],
  ) {
    const tenant = issueSyncDispatchAuthority({
      shopId: job.shopId,
      myshopifyDomain: SHOP,
      source: "verified_scheduler",
      correlationId: job.correlationId,
    });
    const envelope = createTenantJobEnvelopeV3({
      tenant,
      source: "webhook:orders/create",
      durableJobId: job.id,
      dispatchId: dispatch.id,
      dispatchSequence: dispatch.dispatchSequence,
      queueJobId: dispatch.queueJobId,
      payloadDigest: job.payloadDigest,
    });
    expect(envelope.schemaVersion).toBe(TENANT_JOB_ENVELOPE_V3_VERSION);
    return fakeJob(
      {
        topic: "orders/create",
        payloadShop: SHOP,
        payload: (job.sanitizedPayload as Record<string, unknown>) ?? {},
        tenant: envelope,
        durableJobId: job.id,
        dispatchId: dispatch.id,
        dispatchSequence: dispatch.dispatchSequence,
        queueJobId: dispatch.queueJobId,
      },
      dispatch.queueJobId,
    );
  }

  function buildV2Job(
    job: Awaited<ReturnType<typeof ingestAndPrepare>>["job"],
  ) {
    const tenant = issueSyncDispatchAuthority({
      shopId: job.shopId,
      myshopifyDomain: SHOP,
      source: "verified_job",
      correlationId: job.correlationId,
    });
    const envelope = createTenantJobEnvelopeV2({
      tenant,
      source: "webhook:orders/create",
      durableJobId: job.id,
      payloadDigest: job.payloadDigest,
    });
    expect(envelope.schemaVersion).toBe(TENANT_JOB_ENVELOPE_V2_VERSION);
    return fakeJob(
      {
        topic: "orders/create",
        payloadShop: SHOP,
        payload: (job.sanitizedPayload as Record<string, unknown>) ?? {},
        tenant: envelope,
        durableJobId: job.id,
      },
      `v2-${job.id}`,
    );
  }

  async function seedReceipt(
    job: Awaited<ReturnType<typeof ingestAndPrepare>>["job"],
    digest: string,
  ) {
    const applicationKey = resolveApplicationKey({
      jobType: job.jobType,
      webhookDeliveryId: job.webhookDeliveryId,
      idempotencyKey: job.idempotencyKey,
    });
    await prisma.syncApplicationReceipt.create({
      data: {
        shopId: job.shopId,
        applicationKey,
        sourceJobType: job.jobType,
        rootDurableJobId: job.id,
        firstApplyingDurableJobId: job.id,
        payloadDigest: digest,
        applicationSchemaVersion: "sync-application-receipt-v1",
      },
    });
    return applicationKey;
  }

  it("NEW-CLAUDE-D045-02: v3 worker verified-after-rollback", async () => {
    const { job, dispatch } = await ingestAndPrepare("wh-d046-v3-ok");
    await seedReceipt(job, job.payloadDigest);
    const aggregatesBefore = await prisma.salesDailyAggregate.count({
      where: { shopId },
    });

    applyMock.mockImplementation(async () => {
      throw new SyncControlPlaneError(
        APPLICATION_ALREADY_APPLIED,
        "simulated race loser after rollback",
      );
    });

    await processWebhookJob(buildV3Job(job, dispatch));

    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(durable.state).toBe("SUCCEEDED");
    const attempt = await prisma.jobAttempt.findFirstOrThrow({
      where: { durableJobId: job.id },
      orderBy: { startedAt: "desc" },
    });
    expect(attempt.resultMetadata).toMatchObject({
      applicationStatus: "already_applied_verified_after_rollback",
    });
    expect(
      await prisma.salesDailyAggregate.count({ where: { shopId } }),
    ).toBe(aggregatesBefore);
    expect(
      await prisma.deadLetter.count({ where: { durableJobId: job.id } }),
    ).toBe(0);
    expect(isolationObservations).toContain(
      Prisma.TransactionIsolationLevel.RepeatableRead,
    );
  });

  it("NEW-CLAUDE-D045-02: v2 worker verified-after-rollback", async () => {
    const { job } = await ingestAndPrepare("wh-d046-v2-ok");
    await seedReceipt(job, job.payloadDigest);
    const aggregatesBefore = await prisma.salesDailyAggregate.count({
      where: { shopId },
    });

    applyMock.mockImplementation(async () => {
      throw new SyncControlPlaneError(
        APPLICATION_ALREADY_APPLIED,
        "simulated race loser after rollback",
      );
    });

    await processWebhookJob(buildV2Job(job));

    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(durable.state).toBe("SUCCEEDED");
    const attempt = await prisma.jobAttempt.findFirstOrThrow({
      where: { durableJobId: job.id },
      orderBy: { startedAt: "desc" },
    });
    expect(attempt.resultMetadata).toMatchObject({
      applicationStatus: "already_applied_verified_after_rollback",
    });
    expect(
      await prisma.salesDailyAggregate.count({ where: { shopId } }),
    ).toBe(aggregatesBefore);
    expect(
      await prisma.deadLetter.count({ where: { durableJobId: job.id } }),
    ).toBe(0);
  });

  it("NEW-CLAUDE-D045-02: worker digest-conflict dead-letter (v3)", async () => {
    const { job, dispatch } = await ingestAndPrepare("wh-d046-v3-digest");
    await seedReceipt(job, "d".repeat(64));
    const aggregatesBefore = await prisma.salesDailyAggregate.count({
      where: { shopId },
    });

    // Real apply path throws DIGEST_CONFLICT on mismatched existing receipt.
    await processWebhookJob(buildV3Job(job, dispatch));

    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(durable.state).toBe("DEAD_LETTERED");
    expect(durable.failureCode).toBe(APPLICATION_DIGEST_CONFLICT);
    expect(
      await prisma.salesDailyAggregate.count({ where: { shopId } }),
    ).toBe(aggregatesBefore);
    expect(
      await prisma.deadLetter.count({
        where: { durableJobId: job.id, resolutionState: "OPEN" },
      }),
    ).toBe(1);
  });

  it("NEW-CLAUDE-D045-02: worker digest-conflict dead-letter (v2)", async () => {
    const { job } = await ingestAndPrepare("wh-d046-v2-digest");
    await seedReceipt(job, "e".repeat(64));
    const aggregatesBefore = await prisma.salesDailyAggregate.count({
      where: { shopId },
    });

    await processWebhookJob(buildV2Job(job));

    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(durable.state).toBe("DEAD_LETTERED");
    expect(durable.failureCode).toBe(APPLICATION_DIGEST_CONFLICT);
    expect(
      await prisma.salesDailyAggregate.count({ where: { shopId } }),
    ).toBe(aggregatesBefore);
  });

  it("NEW-CLAUDE-D045-02: worker uncertain-outcome dead-letter (v3)", async () => {
    const { job, dispatch } = await ingestAndPrepare("wh-d046-v3-miss");
    const aggregatesBefore = await prisma.salesDailyAggregate.count({
      where: { shopId },
    });

    applyMock.mockImplementation(async () => {
      throw new SyncControlPlaneError(
        APPLICATION_ALREADY_APPLIED,
        "ALREADY_APPLIED without durable receipt",
      );
    });

    await processWebhookJob(buildV3Job(job, dispatch));

    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(durable.state).toBe("DEAD_LETTERED");
    expect(durable.failureCode).toBe(APPLICATION_OUTCOME_UNCERTAIN);
    expect(
      await prisma.salesDailyAggregate.count({ where: { shopId } }),
    ).toBe(aggregatesBefore);
    expect(
      await prisma.syncApplicationReceipt.count({ where: { shopId } }),
    ).toBe(0);
  });

  it("NEW-CLAUDE-D045-02: worker uncertain-outcome dead-letter (v2)", async () => {
    const { job } = await ingestAndPrepare("wh-d046-v2-miss");

    applyMock.mockImplementation(async () => {
      throw new SyncControlPlaneError(
        APPLICATION_ALREADY_APPLIED,
        "ALREADY_APPLIED without durable receipt",
      );
    });

    await processWebhookJob(buildV2Job(job));

    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(durable.state).toBe("DEAD_LETTERED");
    expect(durable.failureCode).toBe(APPLICATION_OUTCOME_UNCERTAIN);
  });

  it("NEW-CLAUDE-D045-02: RepeatableRead transaction option", async () => {
    const { job, dispatch } = await ingestAndPrepare("wh-d046-rr");
    await seedReceipt(job, job.payloadDigest);
    applyMock.mockImplementation(async () => {
      throw new SyncControlPlaneError(
        APPLICATION_ALREADY_APPLIED,
        "force verification transaction",
      );
    });

    await processWebhookJob(buildV3Job(job, dispatch));

    expect(isolationObservations).toContain(
      Prisma.TransactionIsolationLevel.RepeatableRead,
    );
    expect(
      (await prisma.durableJob.findUniqueOrThrow({ where: { id: job.id } }))
        .state,
    ).toBe("SUCCEEDED");
  });
});
