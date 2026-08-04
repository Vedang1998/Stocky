/**
 * F-PR4-01 — exactly-once merchant application via SyncApplicationReceipt.
 *
 * Uses an owner Prisma shim for TenantDb in disposable environments where
 * stocky_runtime + full RLS may not yet be provisioned. Production workers
 * still use createTenantDb under the restricted runtime role.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ingestAuthenticatedWebhook } from "../intake.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { applyWithApplicationReceipt } from "../application-receipt.server";
import { resolveApplicationKey } from "../execution-strategy.server";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import {
  claimAttempt,
  completeAttemptRetry,
  completeAttemptSuccess,
} from "../lifecycle.server";
import { SyncControlPlaneError } from "../errors";
import {
  transitionRetryWaitToEnqueuedForTests,
  transitionToEnqueuedForTests,
} from "./test-state-helpers";

const SHOP = "pr4-exactly-once.myshopify.com";

function ownerTenantShim(
  prisma: PrismaClient | Omit<PrismaClient, "$connect" | "$disconnect">,
  shopId: string,
): TenantDb {
  const authority = {
    shopId,
    myshopifyDomain: SHOP,
  };
  return {
    authority,
    syncApplicationReceipt: prisma.syncApplicationReceipt,
    salesDailyAggregate: prisma.salesDailyAggregate,
    bomComponent: prisma.bomComponent,
    lowStockAlert: prisma.lowStockAlert,
    $transaction: async <T>(fn: (db: TenantDb) => Promise<T>) => {
      return (prisma as PrismaClient).$transaction(async (tx) =>
        fn(ownerTenantShim(tx as unknown as PrismaClient, shopId)),
      );
    },
  } as unknown as TenantDb;
}

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

    await transitionToEnqueuedForTests(prisma, job.id);

    const db = ownerTenantShim(prisma, shopId);
    const applicationKey = resolveApplicationKey({
      jobType: job.jobType,
      webhookDeliveryId: ingested.delivery.id,
      idempotencyKey: job.idempotencyKey,
    });

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

    await completeAttemptRetry({
      durableJobId: job.id,
      shopId,
      attemptId: attempt.id,
      workerId: "w1",
      errorCode: "simulated_crash",
      failureSummary: "crash after tenant commit",
    });

    await transitionRetryWaitToEnqueuedForTests(prisma, job.id);

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
    expect(receipts[0].applicationKey).toBe(
      `webhook-delivery:${ingested.delivery.id}`,
    );
  });

  it("digest conflict fails closed", async () => {
    const db = ownerTenantShim(prisma, shopId);
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
    expect(key).not.toContain("job-xyz");
  });

  it("crash before tenant commit leaves no receipt and no sales", async () => {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-eo-crash",
      apiVersion: "2026-07",
      payload: {
        id: 202,
        line_items: [{ variant_id: 9, quantity: 4, price: "1.00" }],
      },
    });
    const job = ingested.job!;
    await transitionToEnqueuedForTests(prisma, job.id);
    const db = ownerTenantShim(prisma, shopId);
    const applicationKey = resolveApplicationKey({
      jobType: job.jobType,
      webhookDeliveryId: ingested.delivery.id,
      idempotencyKey: job.idempotencyKey,
    });
    await claimAttempt({
      durableJobId: job.id,
      shopId,
      workerId: "w-crash",
    });

    await expect(
      db.$transaction(async (tx) => {
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
            await tdb.salesDailyAggregate.create({
              data: {
                shop: SHOP,
                shopifyVariantId: "gid://shopify/ProductVariant/9",
                locationId: "default",
                date: today,
                unitsSold: 4,
                revenue: 4,
              },
            });
            throw new Error("simulated_process_kill");
          },
        );
      }),
    ).rejects.toThrow(/simulated_process_kill/);

    expect(
      await prisma.syncApplicationReceipt.count({ where: { shopId } }),
    ).toBe(0);
    expect(await prisma.salesDailyAggregate.count({ where: { shop: SHOP } })).toBe(
      0,
    );
  });
});
