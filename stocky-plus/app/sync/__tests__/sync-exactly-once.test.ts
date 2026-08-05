/**
 * F-PR4-01 / D-044 NEW-PR4-C03 — exactly-once merchant application via SyncApplicationReceipt.
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
import {
  APPLICATION_ALREADY_APPLIED,
  executionStrategyForJobType,
  resolveApplicationKey,
} from "../execution-strategy.server";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import {
  claimAttempt,
  completeAttemptRetry,
  completeAttemptSuccess,
} from "../lifecycle.server";
import { SyncControlPlaneError } from "../errors";
import { runAbcAnalysis } from "../../services/forecasting.server";
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
  const client = prisma as PrismaClient;
  return {
    authority,
    syncApplicationReceipt: client.syncApplicationReceipt,
    salesDailyAggregate: client.salesDailyAggregate,
    bomComponent: client.bomComponent,
    lowStockAlert: client.lowStockAlert,
    variantAbcClass: client.variantAbcClass,
    shopifyVariantCache: client.shopifyVariantCache,
    inventorySnapshot: client.inventorySnapshot,
    // D-044: receipt insert uses tagged $queryRaw (ON CONFLICT DO NOTHING).
    $queryRaw: client.$queryRaw.bind(client),
    $transaction: async <T>(
      fn: (db: TenantDb) => Promise<T>,
      options?: { maxWait?: number; timeout?: number },
    ) => {
      return client.$transaction(
        async (tx) => fn(ownerTenantShim(tx as unknown as PrismaClient, shopId)),
        options,
      );
    },
  } as unknown as TenantDb;
}

function todayUtc(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function ingestOrderCreate(
  webhookId: string,
  lineItems: Array<{ variant_id: number; quantity: number; price: string }>,
  orderId = 101,
) {
  return ingestAuthenticatedWebhook({
    verifiedShop: SHOP,
    topic: "orders/create",
    webhookId,
    apiVersion: "2026-07",
    payload: { id: orderId, line_items: lineItems },
  });
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
        "BomComponent", "VariantAbcClass", "ShopifyVariantCache", "InventorySnapshot"
      CASCADE
    `);
    await prisma.shop.deleteMany({ where: { myshopifyDomain: SHOP } });
    const shop = await prisma.shop.create({ data: { myshopifyDomain: SHOP } });
    shopId = shop.id;
    await resetControlPlanePrismaForTests();
  });

  it("retry after partial sales application does not duplicate units (F-PR4-01)", async () => {
    const ingested = await ingestOrderCreate("wh-eo-1", [
      { variant_id: 1, quantity: 2, price: "10.00" },
      { variant_id: 2, quantity: 3, price: "5.00" },
    ]);
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
          const today = todayUtc();
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
              shopId,
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
              shopId,
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
          const today = todayUtc();
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
    const ingested = await ingestOrderCreate(
      "wh-eo-crash",
      [{ variant_id: 9, quantity: 4, price: "1.00" }],
      202,
    );
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
            const today = todayUtc();
            await tdb.salesDailyAggregate.create({
              data: {
                shop: SHOP,
                shopId,
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

  it("NEW-PR4-C03: crash after first merchant write (partial) then retry → exact units once", async () => {
    const ingested = await ingestOrderCreate("wh-eo-partial", [
      { variant_id: 11, quantity: 5, price: "2.00" },
      { variant_id: 12, quantity: 7, price: "3.00" },
    ]);
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
      workerId: "w-partial-1",
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
            const today = todayUtc();
            await tdb.salesDailyAggregate.create({
              data: {
                shop: SHOP,
                shopId,
                shopifyVariantId: "gid://shopify/ProductVariant/11",
                locationId: "default",
                date: today,
                unitsSold: 5,
                revenue: 10,
              },
            });
            // Crash after first write, before second write and before receipt.
            throw new Error("crash_after_first_merchant_write");
          },
        );
      }),
    ).rejects.toThrow(/crash_after_first_merchant_write/);

    expect(await prisma.salesDailyAggregate.count({ where: { shop: SHOP } })).toBe(
      0,
    );
    expect(
      await prisma.syncApplicationReceipt.count({ where: { shopId } }),
    ).toBe(0);

    await completeAttemptRetry({
      durableJobId: job.id,
      shopId,
      attemptId: attempt.id,
      workerId: "w-partial-1",
      errorCode: "crash_after_first_merchant_write",
      failureSummary: "partial apply aborted",
    });
    await transitionRetryWaitToEnqueuedForTests(prisma, job.id);

    const { attempt: attempt2 } = await claimAttempt({
      durableJobId: job.id,
      shopId,
      workerId: "w-partial-2",
    });

    const applied = await db.$transaction(async (tx) => {
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
          const today = todayUtc();
          await tdb.salesDailyAggregate.create({
            data: {
              shop: SHOP,
              shopId,
              shopifyVariantId: "gid://shopify/ProductVariant/11",
              locationId: "default",
              date: today,
              unitsSold: 5,
              revenue: 10,
            },
          });
          await tdb.salesDailyAggregate.create({
            data: {
              shop: SHOP,
              shopId,
              shopifyVariantId: "gid://shopify/ProductVariant/12",
              locationId: "default",
              date: today,
              unitsSold: 7,
              revenue: 21,
            },
          });
          return true;
        },
      );
    });
    expect(applied.status).toBe("applied");
    await completeAttemptSuccess({
      durableJobId: job.id,
      shopId,
      attemptId: attempt2.id,
      workerId: "w-partial-2",
    });

    const byVariant = Object.fromEntries(
      (
        await prisma.salesDailyAggregate.findMany({ where: { shop: SHOP } })
      ).map((a) => [a.shopifyVariantId, a.unitsSold]),
    );
    expect(byVariant["gid://shopify/ProductVariant/11"]).toBe(5);
    expect(byVariant["gid://shopify/ProductVariant/12"]).toBe(7);
    expect(
      await prisma.syncApplicationReceipt.count({ where: { shopId } }),
    ).toBe(1);
  });

  it("NEW-PR4-C03: crash after all merchant writes before receipt insert (throw in apply)", async () => {
    const ingested = await ingestOrderCreate("wh-eo-pre-receipt", [
      { variant_id: 21, quantity: 3, price: "4.00" },
    ]);
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
      workerId: "w-pre-receipt",
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
            const today = todayUtc();
            await tdb.salesDailyAggregate.create({
              data: {
                shop: SHOP,
                shopId,
                shopifyVariantId: "gid://shopify/ProductVariant/21",
                locationId: "default",
                date: today,
                unitsSold: 3,
                revenue: 12,
              },
            });
            // Receipt insert is after apply returns — throwing here prevents receipt.
            throw new Error("crash_before_receipt_insert");
          },
        );
      }),
    ).rejects.toThrow(/crash_before_receipt_insert/);

    expect(
      await prisma.syncApplicationReceipt.count({ where: { shopId } }),
    ).toBe(0);
    expect(await prisma.salesDailyAggregate.count({ where: { shop: SHOP } })).toBe(
      0,
    );
  });

  it("NEW-PR4-C03: crash after receipt insertion but before commit rolls back all", async () => {
    const ingested = await ingestOrderCreate("wh-eo-post-receipt", [
      { variant_id: 31, quantity: 8, price: "1.50" },
    ]);
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
      workerId: "w-post-receipt",
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
            const today = todayUtc();
            await tdb.salesDailyAggregate.create({
              data: {
                shop: SHOP,
                shopId,
                shopifyVariantId: "gid://shopify/ProductVariant/31",
                locationId: "default",
                date: today,
                unitsSold: 8,
                revenue: 12,
              },
            });
            return true;
          },
        );
        // Receipt inserted inside applyWithApplicationReceipt; throw before tx commits.
        throw new Error("crash_after_receipt_before_commit");
      }),
    ).rejects.toThrow(/crash_after_receipt_before_commit/);

    expect(
      await prisma.syncApplicationReceipt.count({ where: { shopId } }),
    ).toBe(0);
    expect(await prisma.salesDailyAggregate.count({ where: { shop: SHOP } })).toBe(
      0,
    );
  });

  it("NEW-PR4-C03: crash after tenant commit before CP completion → retry already_applied + CP success", async () => {
    const ingested = await ingestOrderCreate("wh-eo-cp-retry", [
      { variant_id: 41, quantity: 6, price: "9.00" },
    ]);
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
      workerId: "w-cp-1",
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
          const today = todayUtc();
          await tdb.salesDailyAggregate.create({
            data: {
              shop: SHOP,
              shopId,
              shopifyVariantId: "gid://shopify/ProductVariant/41",
              locationId: "default",
              date: today,
              unitsSold: 6,
              revenue: 54,
            },
          });
          return true;
        },
      );
    });
    // Tenant commit succeeded; CP completion crashes → retry path.
    await completeAttemptRetry({
      durableJobId: job.id,
      shopId,
      attemptId: attempt.id,
      workerId: "w-cp-1",
      errorCode: "crash_before_cp_success",
      failureSummary: "tenant applied; CP incomplete",
    });
    await transitionRetryWaitToEnqueuedForTests(prisma, job.id);

    const { attempt: attempt2 } = await claimAttempt({
      durableJobId: job.id,
      shopId,
      workerId: "w-cp-2",
    });
    const second = await db.$transaction(async (tx) =>
      applyWithApplicationReceipt(
        tx,
        {
          applicationKey,
          sourceJobType: job.jobType,
          rootDurableJobId: job.id,
          applyingDurableJobId: job.id,
          payloadDigest: job.payloadDigest,
        },
        async (tdb) => {
          await tdb.salesDailyAggregate.updateMany({
            where: { shop: SHOP },
            data: { unitsSold: { increment: 100 } },
          });
          return true;
        },
      ),
    );
    expect(second.status).toBe("already_applied");
    const succeeded = await completeAttemptSuccess({
      durableJobId: job.id,
      shopId,
      attemptId: attempt2.id,
      workerId: "w-cp-2",
    });
    expect(succeeded.state).toBe("SUCCEEDED");
    expect(
      (
        await prisma.salesDailyAggregate.findFirstOrThrow({
          where: { shop: SHOP },
        })
      ).unitsSold,
    ).toBe(6);
  });

  it("NEW-PR4-C03: duplicate delivery (same webhook ID) — one job/receipt path", async () => {
    const payload = {
      id: 501,
      line_items: [{ variant_id: 51, quantity: 2, price: "5.00" }],
    };
    const first = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-eo-dup",
      apiVersion: "2026-07",
      payload,
    });
    const second = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-eo-dup",
      apiVersion: "2026-07",
      payload,
    });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.job?.id ?? first.job!.id).toBe(first.job!.id);

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { shopId, shopifyWebhookId: "wh-eo-dup" },
    });
    expect(deliveries).toHaveLength(1);

    const jobs = await prisma.durableJob.findMany({
      where: { shopId, webhookDeliveryId: first.delivery.id },
    });
    expect(jobs).toHaveLength(1);

    await transitionToEnqueuedForTests(prisma, first.job!.id);
    const db = ownerTenantShim(prisma, shopId);
    const applicationKey = resolveApplicationKey({
      jobType: first.job!.jobType,
      webhookDeliveryId: first.delivery.id,
      idempotencyKey: first.job!.idempotencyKey,
    });
    await claimAttempt({
      durableJobId: first.job!.id,
      shopId,
      workerId: "w-dup",
    });
    await db.$transaction(async (tx) => {
      await applyWithApplicationReceipt(
        tx,
        {
          applicationKey,
          sourceJobType: first.job!.jobType,
          rootDurableJobId: first.job!.id,
          applyingDurableJobId: first.job!.id,
          payloadDigest: first.job!.payloadDigest,
        },
        async (tdb) => {
          const today = todayUtc();
          await tdb.salesDailyAggregate.create({
            data: {
              shop: SHOP,
              shopId,
              shopifyVariantId: "gid://shopify/ProductVariant/51",
              locationId: "default",
              date: today,
              unitsSold: 2,
              revenue: 10,
            },
          });
          return true;
        },
      );
    });
    // Replay apply via same delivery key — already_applied, no second receipt.
    const replay = await db.$transaction(async (tx) =>
      applyWithApplicationReceipt(
        tx,
        {
          applicationKey,
          sourceJobType: first.job!.jobType,
          rootDurableJobId: first.job!.id,
          applyingDurableJobId: first.job!.id,
          payloadDigest: first.job!.payloadDigest,
        },
        async () => {
          throw new Error("must_not_run");
        },
      ),
    );
    expect(replay.status).toBe("already_applied");
    expect(
      await prisma.syncApplicationReceipt.count({ where: { shopId } }),
    ).toBe(1);
    expect(
      (
        await prisma.salesDailyAggregate.findFirstOrThrow({
          where: { shop: SHOP },
        })
      ).unitsSold,
    ).toBe(2);
  });

  it("NEW-PR4-C03: concurrent workers racing applyWithApplicationReceipt — exact once, no 25P02", async () => {
    const applicationKey = "webhook-delivery:concurrent-race-key";
    const digest = "c".repeat(64);
    const prismaA = new PrismaClient();
    const prismaB = new PrismaClient();
    const dbA = ownerTenantShim(prismaA, shopId);
    const dbB = ownerTenantShim(prismaB, shopId);

    let arrived = 0;
    let releaseBarrier!: () => void;
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });

    async function race(
      db: TenantDb,
      variantId: string,
      applyingId: string,
    ) {
      return db.$transaction(
        async (tx) => {
          return applyWithApplicationReceipt(
            tx,
            {
              applicationKey,
              sourceJobType: "webhook:orders/create",
              rootDurableJobId: "root-concurrent",
              applyingDurableJobId: applyingId,
              payloadDigest: digest,
            },
            async (tdb) => {
              const today = todayUtc();
              // Distinct rows so both pass merchant writes before receipt race
              // (same-row upsert + barrier would deadlock on row locks).
              await tdb.salesDailyAggregate.create({
                data: {
                  shop: SHOP,
                  shopId,
                  shopifyVariantId: variantId,
                  locationId: "default",
                  date: today,
                  unitsSold: 4,
                  revenue: 40,
                },
              });
              arrived += 1;
              if (arrived >= 2) releaseBarrier();
              await barrier;
              return true;
            },
          );
        },
        { maxWait: 15_000, timeout: 20_000 },
      );
    }

    const results = await Promise.allSettled([
      race(dbA, "gid://shopify/ProductVariant/61", "job-concurrent-a"),
      race(dbB, "gid://shopify/ProductVariant/62", "job-concurrent-b"),
    ]);

    await prismaA.$disconnect();
    await prismaB.$disconnect();

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length + rejected.length).toBe(2);

    const statuses = fulfilled.map(
      (r) => (r as PromiseFulfilledResult<{ status: string }>).value.status,
    );
    const rejectCodes = rejected.map((r) => {
      const err = (r as PromiseRejectedResult).reason;
      if (err instanceof SyncControlPlaneError) return err.code;
      return String(err?.message ?? err);
    });

    for (const code of rejectCodes) {
      expect(code).toBe(APPLICATION_ALREADY_APPLIED);
      expect(String(code)).not.toMatch(/25P02|current transaction is aborted/i);
    }
    for (const s of statuses) {
      expect(["applied", "already_applied"]).toContain(s);
    }
    expect(statuses.filter((s) => s === "applied").length).toBe(1);
    expect(rejected.length).toBe(1);

    const agg = await prisma.salesDailyAggregate.findMany({
      where: { shop: SHOP },
    });
    // Loser rolls back — only winner's distinct variant remains.
    expect(agg).toHaveLength(1);
    expect(agg[0].unitsSold).toBe(4);
    expect(
      await prisma.syncApplicationReceipt.count({ where: { shopId } }),
    ).toBe(1);
  });

  it("NEW-PR4-C03: concurrent receipt insertion — loser rolls back merchant writes (F-PR4-01 residual)", async () => {
    const applicationKey = "webhook-delivery:concurrent-rollback-key";
    const digest = "d".repeat(64);
    const prismaA = new PrismaClient();
    const prismaB = new PrismaClient();
    const dbA = ownerTenantShim(prismaA, shopId);
    const dbB = ownerTenantShim(prismaB, shopId);

    let phase1Done = 0;
    let release!: () => void;
    const bothWrote = new Promise<void>((r) => {
      release = r;
    });

    async function raceApply(
      db: TenantDb,
      variantSuffix: string,
      applyingId: string,
    ) {
      return db.$transaction(
        async (tx) => {
          return applyWithApplicationReceipt(
            tx,
            {
              applicationKey,
              sourceJobType: "webhook:orders/create",
              rootDurableJobId: "root-roll",
              applyingDurableJobId: applyingId,
              payloadDigest: digest,
            },
            async (tdb) => {
              const today = todayUtc();
              // Distinct rows so both writes succeed before receipt race.
              await tdb.salesDailyAggregate.create({
                data: {
                  shop: SHOP,
                  shopId,
                  shopifyVariantId: `gid://shopify/ProductVariant/${variantSuffix}`,
                  locationId: "default",
                  date: today,
                  unitsSold: 10,
                  revenue: 100,
                },
              });
              phase1Done += 1;
              if (phase1Done >= 2) release();
              await bothWrote;
              return true;
            },
          );
        },
        { maxWait: 15_000, timeout: 20_000 },
      );
    }

    const settled = await Promise.allSettled([
      raceApply(dbA, "71", "job-a"),
      raceApply(dbB, "72", "job-b"),
    ]);
    await prismaA.$disconnect();
    await prismaB.$disconnect();

    const applied = settled.filter(
      (r) =>
        r.status === "fulfilled" &&
        (r.value as { status: string }).status === "applied",
    );
    const lost = settled.filter(
      (r) =>
        r.status === "rejected" &&
        (r.reason as SyncControlPlaneError)?.code === APPLICATION_ALREADY_APPLIED,
    );
    expect(applied).toHaveLength(1);
    expect(lost).toHaveLength(1);

    for (const r of lost) {
      const msg = String((r as PromiseRejectedResult).reason);
      expect(msg).not.toMatch(/25P02|current transaction is aborted/i);
    }

    const rows = await prisma.salesDailyAggregate.findMany({
      where: { shop: SHOP },
    });
    // Loser rolled back its distinct variant row — only winner's write remains.
    expect(rows).toHaveLength(1);
    expect(rows[0].unitsSold).toBe(10);
    expect(
      await prisma.syncApplicationReceipt.count({ where: { shopId } }),
    ).toBe(1);
  });

  it("NEW-PR4-C03: order cancellation effect exactly once", async () => {
    const today = todayUtc();
    await prisma.salesDailyAggregate.create({
      data: {
        shop: SHOP,
        shopId,
        shopifyVariantId: "gid://shopify/ProductVariant/81",
        locationId: "default",
        date: today,
        unitsSold: 10,
        revenue: 100,
      },
    });

    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/cancelled",
      webhookId: "wh-eo-cancel",
      apiVersion: "2026-07",
      payload: {
        id: 801,
        line_items: [{ variant_id: 81, quantity: 3, price: "10.00" }],
      },
    });
    const job = ingested.job!;
    expect(executionStrategyForJobType(job.jobType)).toBe(
      "ATOMIC_APPLICATION_RECEIPT",
    );
    await transitionToEnqueuedForTests(prisma, job.id);
    const db = ownerTenantShim(prisma, shopId);
    const applicationKey = resolveApplicationKey({
      jobType: job.jobType,
      webhookDeliveryId: ingested.delivery.id,
      idempotencyKey: job.idempotencyKey,
    });

    const applyCancel = async (tdb: TenantDb) => {
      const existing = await tdb.salesDailyAggregate.findUnique({
        where: {
          shop_shopifyVariantId_locationId_date: {
            shop: SHOP,
            shopifyVariantId: "gid://shopify/ProductVariant/81",
            locationId: "default",
            date: today,
          },
        },
      });
      expect(existing).toBeTruthy();
      await tdb.salesDailyAggregate.update({
        where: { id: existing!.id },
        data: {
          unitsSold: Math.max(0, existing!.unitsSold - 3),
          revenue: Math.max(0, Number(existing!.revenue) - 30),
        },
      });
      return true;
    };

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
        applyCancel,
      );
    });
    const again = await db.$transaction(async (tx) =>
      applyWithApplicationReceipt(
        tx,
        {
          applicationKey,
          sourceJobType: job.jobType,
          rootDurableJobId: job.id,
          applyingDurableJobId: job.id,
          payloadDigest: job.payloadDigest,
        },
        applyCancel,
      ),
    );
    expect(again.status).toBe("already_applied");
    expect(
      (
        await prisma.salesDailyAggregate.findFirstOrThrow({
          where: { shop: SHOP },
        })
      ).unitsSold,
    ).toBe(7);
    expect(
      await prisma.syncApplicationReceipt.count({ where: { shopId } }),
    ).toBe(1);
  });

  it("NEW-PR4-C03: refund effect exactly once", async () => {
    const today = todayUtc();
    await prisma.salesDailyAggregate.create({
      data: {
        shop: SHOP,
        shopId,
        shopifyVariantId: "gid://shopify/ProductVariant/91",
        locationId: "default",
        date: today,
        unitsSold: 20,
        revenue: 200,
      },
    });

    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "refunds/create",
      webhookId: "wh-eo-refund",
      apiVersion: "2026-07",
      payload: {
        id: 901,
        refund_line_items: [
          {
            quantity: 4,
            line_item: { variant_id: 91, quantity: 4, price: "10.00" },
          },
        ],
      },
    });
    const job = ingested.job!;
    expect(executionStrategyForJobType(job.jobType)).toBe(
      "ATOMIC_APPLICATION_RECEIPT",
    );
    await transitionToEnqueuedForTests(prisma, job.id);
    const db = ownerTenantShim(prisma, shopId);
    const applicationKey = resolveApplicationKey({
      jobType: job.jobType,
      webhookDeliveryId: ingested.delivery.id,
      idempotencyKey: job.idempotencyKey,
    });

    const applyRefund = async (tdb: TenantDb) => {
      const existing = await tdb.salesDailyAggregate.findUnique({
        where: {
          shop_shopifyVariantId_locationId_date: {
            shop: SHOP,
            shopifyVariantId: "gid://shopify/ProductVariant/91",
            locationId: "default",
            date: today,
          },
        },
      });
      await tdb.salesDailyAggregate.update({
        where: { id: existing!.id },
        data: {
          unitsSold: Math.max(0, existing!.unitsSold - 4),
          revenue: Math.max(0, Number(existing!.revenue) - 40),
        },
      });
      return true;
    };

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
        applyRefund,
      );
    });
    const again = await db.$transaction(async (tx) =>
      applyWithApplicationReceipt(
        tx,
        {
          applicationKey,
          sourceJobType: job.jobType,
          rootDurableJobId: job.id,
          applyingDurableJobId: job.id,
          payloadDigest: job.payloadDigest,
        },
        applyRefund,
      ),
    );
    expect(again.status).toBe("already_applied");
    expect(
      (
        await prisma.salesDailyAggregate.findFirstOrThrow({
          where: { shop: SHOP },
        })
      ).unitsSold,
    ).toBe(16);
  });

  it("NEW-PR4-C03: inventory/BOM/low-stock side effects exactly once", async () => {
    await prisma.bomComponent.create({
      data: {
        shop: SHOP,
        shopId,
        bundleVariantId: "gid://shopify/ProductVariant/100",
        componentVariantId: "gid://shopify/ProductVariant/101",
        quantity: 2,
      },
    });

    const ingested = await ingestOrderCreate(
      "wh-eo-bom",
      [{ variant_id: 100, quantity: 3, price: "50.00" }],
      1001,
    );
    const job = ingested.job!;
    await transitionToEnqueuedForTests(prisma, job.id);
    const db = ownerTenantShim(prisma, shopId);
    const applicationKey = resolveApplicationKey({
      jobType: job.jobType,
      webhookDeliveryId: ingested.delivery.id,
      idempotencyKey: job.idempotencyKey,
    });

    const applyBomAndAlert = async (tdb: TenantDb) => {
      const today = todayUtc();
      await tdb.salesDailyAggregate.create({
        data: {
          shop: SHOP,
          shopId,
          shopifyVariantId: "gid://shopify/ProductVariant/100",
          locationId: "default",
          date: today,
          unitsSold: 3,
          revenue: 150,
        },
      });
      const comps = await tdb.bomComponent.findMany({
        where: { bundleVariantId: "gid://shopify/ProductVariant/100" },
      });
      expect(comps).toHaveLength(1);
      await tdb.salesDailyAggregate.create({
        data: {
          shop: SHOP,
          shopId,
          shopifyVariantId: comps[0].componentVariantId,
          locationId: "default",
          date: today,
          unitsSold: Number(comps[0].quantity) * 3,
          revenue: 0,
        },
      });
      await tdb.lowStockAlert.create({
        data: {
          shop: SHOP,
          shopId,
          shopifyVariantId: "gid://shopify/ProductVariant/100",
          locationId: "default",
          reorderPoint: 10,
          currentStock: 2,
        },
      });
      return true;
    };

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
        applyBomAndAlert,
      );
    });
    const again = await db.$transaction(async (tx) =>
      applyWithApplicationReceipt(
        tx,
        {
          applicationKey,
          sourceJobType: job.jobType,
          rootDurableJobId: job.id,
          applyingDurableJobId: job.id,
          payloadDigest: job.payloadDigest,
        },
        applyBomAndAlert,
      ),
    );
    expect(again.status).toBe("already_applied");

    const sales = await prisma.salesDailyAggregate.findMany({
      where: { shop: SHOP },
    });
    expect(sales).toHaveLength(2);
    const component = sales.find(
      (s) => s.shopifyVariantId === "gid://shopify/ProductVariant/101",
    );
    expect(component?.unitsSold).toBe(6);
    expect(await prisma.lowStockAlert.count({ where: { shop: SHOP } })).toBe(1);
    expect(
      await prisma.syncApplicationReceipt.count({ where: { shopId } }),
    ).toBe(1);
  });

  it("NEW-PR4-C03: catalog sync repeated execution is REBUILDABLE_IDEMPOTENT", async () => {
    expect(executionStrategyForJobType("catalog-sync")).toBe(
      "REBUILDABLE_IDEMPOTENT",
    );
    const db = ownerTenantShim(prisma, shopId);

    const upsertCache = async () => {
      await db.shopifyVariantCache.upsert({
        where: {
          shop_shopifyVariantId: {
            shop: SHOP,
            shopifyVariantId: "gid://shopify/ProductVariant/200",
          },
        },
        create: {
          shop: SHOP,
          shopId,
          shopifyVariantId: "gid://shopify/ProductVariant/200",
          title: "Catalog Widget",
          sku: "W-1",
        },
        update: { title: "Catalog Widget", sku: "W-1" },
      });
    };

    await upsertCache();
    await upsertCache();
    const rows = await prisma.shopifyVariantCache.findMany({
      where: { shop: SHOP },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Catalog Widget");
  });

  it("NEW-PR4-C03: ABC repeated execution is REBUILDABLE_IDEMPOTENT", async () => {
    expect(executionStrategyForJobType("abc-analysis-shop")).toBe(
      "REBUILDABLE_IDEMPOTENT",
    );
    const today = todayUtc();
    await prisma.salesDailyAggregate.createMany({
      data: [
        {
          shop: SHOP,
          shopId,
          shopifyVariantId: "gid://shopify/ProductVariant/301",
          locationId: "default",
          date: today,
          unitsSold: 100,
          revenue: 1000,
        },
        {
          shop: SHOP,
          shopId,
          shopifyVariantId: "gid://shopify/ProductVariant/302",
          locationId: "default",
          date: today,
          unitsSold: 10,
          revenue: 50,
        },
      ],
    });

    const db = ownerTenantShim(prisma, shopId);
    await runAbcAnalysis(db, "REVENUE");
    const first = await prisma.variantAbcClass.findMany({
      where: { shop: SHOP, metric: "REVENUE" },
      orderBy: { shopifyVariantId: "asc" },
    });
    expect(first.length).toBeGreaterThanOrEqual(2);

    await runAbcAnalysis(db, "REVENUE");
    const second = await prisma.variantAbcClass.findMany({
      where: { shop: SHOP, metric: "REVENUE" },
      orderBy: { shopifyVariantId: "asc" },
    });
    expect(second).toHaveLength(first.length);
    expect(second.map((r) => [r.shopifyVariantId, r.abcClass])).toEqual(
      first.map((r) => [r.shopifyVariantId, r.abcClass]),
    );
  });

  it("NEW-PR4-C03: unknown job type fails closed (NO_AUTOMATIC_RETRY)", () => {
    expect(executionStrategyForJobType("totally-unknown-job")).toBe(
      "NO_AUTOMATIC_RETRY",
    );
    expect(executionStrategyForJobType("webhook:mystery/topic")).toBe(
      "NO_AUTOMATIC_RETRY",
    );
  });

  it("NEW-PR4-C03: application key stable across retry and replay", async () => {
    const ingested = await ingestOrderCreate("wh-eo-key-stable", [
      { variant_id: 401, quantity: 1, price: "1.00" },
    ]);
    const job = ingested.job!;
    const key1 = resolveApplicationKey({
      jobType: job.jobType,
      webhookDeliveryId: ingested.delivery.id,
      idempotencyKey: job.idempotencyKey,
    });
    const key2 = resolveApplicationKey({
      jobType: job.jobType,
      webhookDeliveryId: ingested.delivery.id,
      idempotencyKey: `replay:${job.id}:corr`,
    });
    const key3 = resolveApplicationKey({
      jobType: job.jobType,
      webhookDeliveryId: ingested.delivery.id,
      idempotencyKey: job.idempotencyKey,
      rootApplicationKey: key1,
    });
    expect(key1).toBe(`webhook-delivery:${ingested.delivery.id}`);
    expect(key2).toBe(key1);
    expect(key3).toBe(key1);
    expect(key1).not.toContain(job.id);
  });

  it("NEW-PR4-C03: stale worker completion after another worker succeeded", async () => {
    const ingested = await ingestOrderCreate("wh-eo-stale", [
      { variant_id: 501, quantity: 1, price: "1.00" },
    ]);
    const job = ingested.job!;
    await transitionToEnqueuedForTests(prisma, job.id);
    const db = ownerTenantShim(prisma, shopId);
    const applicationKey = resolveApplicationKey({
      jobType: job.jobType,
      webhookDeliveryId: ingested.delivery.id,
      idempotencyKey: job.idempotencyKey,
    });

    const { attempt: a1 } = await claimAttempt({
      durableJobId: job.id,
      shopId,
      workerId: "w-stale-1",
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
        async () => true,
      );
    });
    await completeAttemptSuccess({
      durableJobId: job.id,
      shopId,
      attemptId: a1.id,
      workerId: "w-stale-1",
    });

    await expect(
      completeAttemptSuccess({
        durableJobId: job.id,
        shopId,
        attemptId: a1.id,
        workerId: "w-stale-1",
      }),
    ).rejects.toBeInstanceOf(SyncControlPlaneError);

    await expect(
      completeAttemptSuccess({
        durableJobId: job.id,
        shopId,
        attemptId: a1.id,
        workerId: "w-stale-intruder",
      }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(
        /illegal_job_transition|attempt_conflict|stale_worker_completion/,
      ),
    });

    expect(
      (await prisma.durableJob.findUniqueOrThrow({ where: { id: job.id } }))
        .state,
    ).toBe("SUCCEEDED");
    expect(
      await prisma.syncApplicationReceipt.count({ where: { shopId } }),
    ).toBe(1);
  });
});
