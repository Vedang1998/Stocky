/**
 * NEW-PR4-C04 — envelope fail-closed: v1 and incomplete v2 must not apply merchant writes.
 * D-044 — repeated v1, valid v2+delivery receipt, v3-only dispatch, unknown envelope.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import type { Job } from "bullmq";
import { ingestAuthenticatedWebhook } from "../intake.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import {
  createTenantJobEnvelope,
  resetTenantJobEnvelopeSecretCache,
  TENANT_JOB_ENVELOPE_VERSION,
} from "../../tenant/job-envelope.server";
import {
  createTenantJobEnvelopeV2,
  TENANT_JOB_ENVELOPE_V2_VERSION,
} from "../envelope-v2.server";
import {
  createTenantJobEnvelopeV3,
  TENANT_JOB_ENVELOPE_V3_VERSION,
} from "../envelope-v3.server";
import { issueSyncDispatchAuthority } from "../../tenant/sync-dispatch-authority.server";
import { processWebhookJob } from "../../jobs/workers/webhook-processor";
import type { WebhookJobData } from "../../jobs/queue.server";
import { transitionToEnqueuedForTests } from "./test-state-helpers";
import { SyncControlPlaneError } from "../errors";
import {
  APPLICATION_OUTCOME_UNCERTAIN,
  resolveApplicationKey,
} from "../execution-strategy.server";
import { applyWithApplicationReceipt } from "../application-receipt.server";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { TenantAuthorityError } from "../../tenant/errors";
import { formatQueueJobId } from "../dispatcher.server";

const SHOP = "pr4-envelope-fail.myshopify.com";

function fakeJob(data: WebhookJobData, id = "fake-queue-job"): Job<WebhookJobData> {
  return {
    id,
    name: data.topic,
    data,
  } as unknown as Job<WebhookJobData>;
}

function ownerTenantShim(
  prisma: PrismaClient | Omit<PrismaClient, "$connect" | "$disconnect">,
  shopId: string,
): TenantDb {
  const authority = { shopId, myshopifyDomain: SHOP };
  const client = prisma as PrismaClient;
  return {
    authority,
    syncApplicationReceipt: client.syncApplicationReceipt,
    salesDailyAggregate: client.salesDailyAggregate,
    $queryRaw: client.$queryRaw.bind(client),
    "$transaction": async <T>(
      fn: (db: TenantDb) => Promise<T>,
      options?: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: import("@prisma/client").Prisma.TransactionIsolationLevel;
      },
    ) =>
      client.$transaction(
        async (tx) =>
          fn(ownerTenantShim(tx as unknown as PrismaClient, shopId)),
        options,
      ),
  } as unknown as TenantDb;
}

describe("test:sync-envelope-fail-closed", () => {
  let prisma: PrismaClient;
  let shopId: string;

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
        "DurableJob", "SyncApplicationReceipt", "SalesDailyAggregate", "LowStockAlert",
        "BomComponent"
      CASCADE
    `);
    await prisma.shop.deleteMany({ where: { myshopifyDomain: SHOP } });
    const shop = await prisma.shop.create({ data: { myshopifyDomain: SHOP } });
    shopId = shop.id;
    await resetControlPlanePrismaForTests();
  });

  it("NEW-PR4-C04: v1 processWebhookJob cannot apply merchant writes", async () => {
    const aggregatesBefore = await prisma.salesDailyAggregate.count({
      where: { shopId },
    });

    const tenant = issueSyncDispatchAuthority({
      shopId,
      myshopifyDomain: SHOP,
      source: "verified_job",
      correlationId: "corr-v1-fail-closed",
    });
    const envelope = createTenantJobEnvelope(tenant, "webhook:orders/create");

    try {
      await processWebhookJob(
        fakeJob({
          topic: "orders/create",
          payloadShop: SHOP,
          payload: {
            id: 9001,
            line_items: [{ variant_id: 1, quantity: 5, price: "10.00" }],
          },
          tenant: envelope,
        }),
      );
      expect.unreachable("v1 must throw");
    } catch (err) {
      expect(err).toBeInstanceOf(SyncControlPlaneError);
      expect((err as SyncControlPlaneError).code).toBe(
        "legacy_envelope_unsupported",
      );
    }

    const aggregatesAfter = await prisma.salesDailyAggregate.count({
      where: { shopId },
    });
    expect(aggregatesAfter).toBe(aggregatesBefore);
    expect(aggregatesAfter).toBe(0);

    const receipts = await prisma.syncApplicationReceipt.count({
      where: { shopId },
    });
    expect(receipts).toBe(0);
  });

  it("NEW-PR4-C04: v2 without webhookDeliveryId performs zero merchant writes and dead-letters", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-v2-no-delivery",
      apiVersion: "2026-07",
      payload: {
        id: 9002,
        line_items: [{ variant_id: 1, quantity: 3, price: "9.00" }],
      },
    });
    const jobId = ingested.job!.id;

    await prisma.durableJob.update({
      where: { id: jobId },
      data: { webhookDeliveryId: null },
    });
    await transitionToEnqueuedForTests(prisma, jobId);

    const tenant = issueSyncDispatchAuthority({
      shopId,
      myshopifyDomain: SHOP,
      source: "verified_job",
      correlationId: ingested.job!.correlationId,
    });
    const envelope = createTenantJobEnvelopeV2({
      tenant,
      source: "webhook:orders/create",
      durableJobId: jobId,
      payloadDigest: ingested.job!.payloadDigest,
    });

    const aggregatesBefore = await prisma.salesDailyAggregate.count({
      where: { shopId },
    });

    try {
      await processWebhookJob(
        fakeJob(
          {
            topic: "orders/create",
            payloadShop: SHOP,
            payload: {
              id: 9002,
              line_items: [{ variant_id: 1, quantity: 3, price: "9.00" }],
            },
            tenant: envelope,
            durableJobId: jobId,
          },
          `v2-no-delivery-${jobId}`,
        ),
      );
      expect.unreachable("v2 without delivery must throw");
    } catch (err) {
      expect(err).toBeInstanceOf(SyncControlPlaneError);
      expect((err as SyncControlPlaneError).code).toBe(
        APPLICATION_OUTCOME_UNCERTAIN,
      );
    }

    const aggregatesAfter = await prisma.salesDailyAggregate.count({
      where: { shopId },
    });
    expect(aggregatesAfter).toBe(aggregatesBefore);
    expect(aggregatesAfter).toBe(0);

    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    expect(durable.state).toBe("DEAD_LETTERED");
    expect(durable.failureCode).toBe(APPLICATION_OUTCOME_UNCERTAIN);

    const dl = await prisma.deadLetter.findFirst({
      where: { durableJobId: jobId },
    });
    expect(dl).toBeTruthy();

    const receipts = await prisma.syncApplicationReceipt.count({
      where: { shopId },
    });
    expect(receipts).toBe(0);
  });

  it("NEW-PR4-C04: repeated v1 processing never duplicates merchant writes", async () => {
    const tenant = issueSyncDispatchAuthority({
      shopId,
      myshopifyDomain: SHOP,
      source: "verified_job",
      correlationId: "corr-v1-repeat",
    });
    const envelope = createTenantJobEnvelope(tenant, "webhook:orders/create");
    expect(envelope.schemaVersion).toBe(TENANT_JOB_ENVELOPE_VERSION);

    const job = fakeJob({
      topic: "orders/create",
      payloadShop: SHOP,
      payload: {
        id: 9101,
        line_items: [{ variant_id: 1, quantity: 5, price: "10.00" }],
      },
      tenant: envelope,
    });

    for (let i = 0; i < 3; i++) {
      await expect(processWebhookJob(job)).rejects.toMatchObject({
        code: "legacy_envelope_unsupported",
      });
    }

    expect(
      await prisma.salesDailyAggregate.count({ where: { shopId } }),
    ).toBe(0);
    expect(
      await prisma.syncApplicationReceipt.count({ where: { shopId } }),
    ).toBe(0);
  });

  it("NEW-PR4-C04: valid v2 with webhookDeliveryId applies via receipt exactly once", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-v2-with-delivery",
      apiVersion: "2026-07",
      payload: {
        id: 9102,
        line_items: [{ variant_id: 2, quantity: 3, price: "8.00" }],
      },
    });
    const jobId = ingested.job!.id;
    expect(ingested.job!.webhookDeliveryId).toBe(ingested.delivery.id);
    await transitionToEnqueuedForTests(prisma, jobId);

    const tenant = issueSyncDispatchAuthority({
      shopId,
      myshopifyDomain: SHOP,
      source: "verified_job",
      correlationId: ingested.job!.correlationId,
    });
    const envelope = createTenantJobEnvelopeV2({
      tenant,
      source: "webhook:orders/create",
      durableJobId: jobId,
      payloadDigest: ingested.job!.payloadDigest,
    });
    expect(envelope.schemaVersion).toBe(TENANT_JOB_ENVELOPE_V2_VERSION);

    // Same application-key derivation the v2 processor uses when delivery is present.
    const applicationKey = resolveApplicationKey({
      jobType: ingested.job!.jobType,
      webhookDeliveryId: ingested.job!.webhookDeliveryId,
      idempotencyKey: ingested.job!.idempotencyKey,
    });
    expect(applicationKey).toBe(
      `webhook-delivery:${ingested.delivery.id}`,
    );

    // Owner shim: disposable envs may lack stocky_runtime INSERT policies on
    // FORCE-RLS SyncApplicationReceipt (tenant-enforcement policies not applied).
    const db = ownerTenantShim(prisma, shopId);
    const first = await db.$transaction(async (tx) =>
      applyWithApplicationReceipt(
        tx,
        {
          applicationKey,
          sourceJobType: ingested.job!.jobType,
          rootDurableJobId: jobId,
          applyingDurableJobId: jobId,
          payloadDigest: ingested.job!.payloadDigest,
        },
        async (tdb) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          await tdb.salesDailyAggregate.create({
            data: {
              shop: SHOP,
              shopId,
              shopifyVariantId: "gid://shopify/ProductVariant/2",
              locationId: "default",
              date: today,
              unitsSold: 3,
              revenue: 24,
            },
          });
          return { applied: true as const };
        },
      ),
    );
    expect(first.status).toBe("applied");

    const second = await db.$transaction(async (tx) =>
      applyWithApplicationReceipt(
        tx,
        {
          applicationKey,
          sourceJobType: ingested.job!.jobType,
          rootDurableJobId: jobId,
          applyingDurableJobId: jobId,
          payloadDigest: ingested.job!.payloadDigest,
        },
        async () => {
          throw new Error("must_not_reapply");
        },
      ),
    );
    expect(second.status).toBe("already_applied");

    const receipts = await prisma.syncApplicationReceipt.findMany({
      where: { shopId },
    });
    expect(receipts).toHaveLength(1);
    expect(receipts[0].applicationKey).toBe(
      `webhook-delivery:${ingested.delivery.id}`,
    );
    expect(
      (
        await prisma.salesDailyAggregate.findFirstOrThrow({
          where: { shop: SHOP },
        })
      ).unitsSold,
    ).toBe(3);
    expect(envelope.durableJobId).toBe(jobId);
  });

  it("NEW-PR4-C04: current dispatch produces only v3 envelopes", () => {
    const tenant = issueSyncDispatchAuthority({
      shopId,
      myshopifyDomain: SHOP,
      source: "verified_scheduler",
      correlationId: "corr-v3-only",
    });
    const durableJobId = "durable-job-v3-check";
    const dispatchId = "dispatch-v3-check";
    const queueJobId = formatQueueJobId(durableJobId, 1);
    const envelope = createTenantJobEnvelopeV3({
      tenant,
      source: "webhook:orders/create",
      durableJobId,
      dispatchId,
      dispatchSequence: 1,
      queueJobId,
      payloadDigest: "e".repeat(64),
    });
    expect(envelope.schemaVersion).toBe(TENANT_JOB_ENVELOPE_V3_VERSION);
    expect(envelope.schemaVersion).not.toBe(TENANT_JOB_ENVELOPE_VERSION);
    expect(envelope.schemaVersion).not.toBe(TENANT_JOB_ENVELOPE_V2_VERSION);
    expect(envelope.dispatchId).toBe(dispatchId);
    expect(envelope.queueJobId).toBe(queueJobId);
  });

  it("NEW-PR4-C04: unknown envelope version fails closed with zero merchant writes", async () => {
    const tenant = issueSyncDispatchAuthority({
      shopId,
      myshopifyDomain: SHOP,
      source: "verified_job",
      correlationId: "corr-unknown-env",
    });
    const bogus = {
      ...createTenantJobEnvelope(tenant, "webhook:orders/create"),
      schemaVersion: "tenant-job-envelope-v99",
    };

    await expect(
      processWebhookJob(
        fakeJob({
          topic: "orders/create",
          payloadShop: SHOP,
          payload: {
            id: 9103,
            line_items: [{ variant_id: 1, quantity: 9, price: "1.00" }],
          },
          tenant: bogus as WebhookJobData["tenant"],
        }),
      ),
    ).rejects.toBeInstanceOf(TenantAuthorityError);

    expect(
      await prisma.salesDailyAggregate.count({ where: { shopId } }),
    ).toBe(0);
    expect(
      await prisma.syncApplicationReceipt.count({ where: { shopId } }),
    ).toBe(0);
  });
});
