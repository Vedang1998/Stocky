/**
 * F-PR4-01 — exactly-once merchant application via SyncApplicationReceipt.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { ingestAuthenticatedWebhook } from "../intake.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { applyWithApplicationReceipt } from "../application-receipt.server";
import { resolveApplicationKey } from "../execution-strategy.server";
import { createTenantDb } from "../../tenant/tenant-db.server";
import { issueSyncDispatchAuthority } from "../../tenant/sync-dispatch-authority.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import {
  claimAttempt,
  completeAttemptRetry,
  completeAttemptSuccess,
} from "../lifecycle.server";
import { SyncControlPlaneError } from "../errors";

const SHOP = "pr4-exactly-once.myshopify.com";

describe("test:sync-exactly-once", () => {
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

  it("retry after partial sales application does not duplicate units (F-PR4-01)", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-eo-1",
      apiVersion: "2026-07",
      payload: {
        id: 101,
        line_items: [
          { variant_id: 1, quantity: 2, price: "10.00" },
          { variant_id: 2, quantity: 3, price: "5.00" },
        ],
      },
    });
    expect(ingested.job).toBeTruthy();
    const job = ingested.job!;

    // Simulate ENQUEUED then claim.
    await prisma.durableJob.update({
      where: { id: job.id },
      data: { state: "ENQUEUED" },
    });

    const tenant = issueSyncDispatchAuthority({
      shopId,
      myshopifyDomain: SHOP,
      source: "verified_job",
      correlationId: randomUUID(),
    });
    const db = createTenantDb(tenant);
    const applicationKey = resolveApplicationKey({
      jobType: job.jobType,
      webhookDeliveryId: ingested.delivery.id,
      idempotencyKey: job.idempotencyKey,
    });

    // First attempt: apply fully inside receipt transaction.
    const { attempt } = await claimAttempt({
      durableJobId: job.id,
      shopId,
      workerId: "w1",
    });

    await db.$transaction(async (tx) => {
      await applyWithApplicationReceipt(
        tx,
        {
          applicationKey,
          sourceJobType: job.jobType,
          rootDurableJobId: job.id,
          applyingDurableJobId: job.id,
          payloadDigest: job.payloadDigest,
        },
        async (tdb) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          await tdb.salesDailyAggregate.upsert({
            where: {
              shop_shopifyVariantId_locationId_date: {
                shop: SHOP,
                shopifyVariantId: "gid://shopify/ProductVariant/1",
                locationId: "default",
                date: today,
              },
            },
            create: {
              shop: SHOP,
              shopifyVariantId: "gid://shopify/ProductVariant/1",
              locationId: "default",
              date: today,
              unitsSold: 2,
              revenue: 20,
            },
            update: { unitsSold: { increment: 2 }, revenue: { increment: 20 } },
          });
          await tdb.salesDailyAggregate.upsert({
            where: {
              shop_shopifyVariantId_locationId_date: {
                shop: SHOP,
                shopifyVariantId: "gid://shopify/ProductVariant/2",
                locationId: "default",
                date: today,
              },
            },
            create: {
              shop: SHOP,
              shopifyVariantId: "gid://shopify/ProductVariant/2",
              locationId: "default",
              date: today,
              unitsSold: 3,
              revenue: 15,
            },
            update: { unitsSold: { increment: 3 }, revenue: { increment: 15 } },
          });
          return true;
        },
      );
    });

    // Crash before control-plane success — then retry.
    await completeAttemptRetry({
      durableJobId: job.id,
      shopId,
      attemptId: attempt.id,
      workerId: "w1",
      errorCode: "simulated_crash",
      failureSummary: "crash after tenant commit",
    });

    await prisma.durableJob.update({
      where: { id: job.id },
      data: { state: "ENQUEUED", nextEligibleAt: new Date() },
    });

    const { attempt: attempt2 } = await claimAttempt({
      durableJobId: job.id,
      shopId,
      workerId: "w2",
    });

    const second = await db.$transaction(async (tx) => {
      return applyWithApplicationReceipt(
        tx,
        {
          applicationKey,
          sourceJobType: job.jobType,
          rootDurableJobId: job.id,
          applyingDurableJobId: job.id,
          payloadDigest: job.payloadDigest,
        },
        async (tdb) => {
          // Must NOT run — if it does, units would double.
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          await tdb.salesDailyAggregate.updateMany({
            where: { shop: SHOP },
            data: { unitsSold: { increment: 999 } },
          });
          return true;
        },
      );
    });

    expect(second.status).toBe("already_applied");
    await completeAttemptSuccess({
      durableJobId: job.id,
      shopId,
      attemptId: attempt2.id,
      workerId: "w2",
    });

    const aggregates = await prisma.salesDailyAggregate.findMany({
      where: { shop: SHOP },
    });
    const byVariant = Object.fromEntries(
      aggregates.map((a) => [a.shopifyVariantId, a.unitsSold]),
    );
    expect(byVariant["gid://shopify/ProductVariant/1"]).toBe(2);
    expect(byVariant["gid://shopify/ProductVariant/2"]).toBe(3);

    const receipts = await prisma.syncApplicationReceipt.findMany({
      where: { shopId },
    });
    expect(receipts).toHaveLength(1);
    expect(receipts[0].applicationKey).toBe(`webhook-delivery:${ingested.delivery.id}`);
  });

  it("digest conflict fails closed", async () => {
    const tenant = issueSyncDispatchAuthority({
      shopId,
      myshopifyDomain: SHOP,
      source: "verified_job",
      correlationId: randomUUID(),
    });
    const db = createTenantDb(tenant);
    const key = "webhook-delivery:test-conflict";

    await db.$transaction(async (tx) => {
      await applyWithApplicationReceipt(
        tx,
        {
          applicationKey: key,
          sourceJobType: "webhook:orders/create",
          rootDurableJobId: "root-1",
          applyingDurableJobId: "job-1",
          payloadDigest: "a".repeat(64),
        },
        async () => true,
      );
    });

    await expect(
      db.$transaction(async (tx) => {
        await applyWithApplicationReceipt(
          tx,
          {
            applicationKey: key,
            sourceJobType: "webhook:orders/create",
            rootDurableJobId: "root-1",
            applyingDurableJobId: "job-2",
            payloadDigest: "b".repeat(64),
          },
          async () => true,
        );
      }),
    ).rejects.toBeInstanceOf(SyncControlPlaneError);
  });

  it("application key derives from webhook delivery not replay job id", () => {
    const key = resolveApplicationKey({
      jobType: "webhook:orders/create",
      webhookDeliveryId: "delivery-abc",
      idempotencyKey: "replay:job-xyz:corr",
    });
    expect(key).toBe("webhook-delivery:delivery-abc");
    expect(key).not.toContain("replay");
  });
});
