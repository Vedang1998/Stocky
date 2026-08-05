/**
 * NEW-PR4-C04 — envelope fail-closed: v1 and incomplete v2 must not apply merchant writes.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import type { Job } from "bullmq";
import { ingestAuthenticatedWebhook } from "../intake.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import {
  createTenantJobEnvelope,
  resetTenantJobEnvelopeSecretCache,
} from "../../tenant/job-envelope.server";
import { createTenantJobEnvelopeV2 } from "../envelope-v2.server";
import { issueSyncDispatchAuthority } from "../../tenant/sync-dispatch-authority.server";
import { processWebhookJob } from "../../jobs/workers/webhook-processor";
import type { WebhookJobData } from "../../jobs/queue.server";
import { transitionToEnqueuedForTests } from "./test-state-helpers";
import { SyncControlPlaneError } from "../errors";
import { APPLICATION_OUTCOME_UNCERTAIN } from "../execution-strategy.server";

const SHOP = "pr4-envelope-fail.myshopify.com";

function fakeJob(data: WebhookJobData, id = "fake-queue-job"): Job<WebhookJobData> {
  return {
    id,
    name: data.topic,
    data,
  } as unknown as Job<WebhookJobData>;
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
});
