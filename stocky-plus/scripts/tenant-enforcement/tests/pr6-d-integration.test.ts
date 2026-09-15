/**
 * PR6-D complete integration — merged B → production D mapper → C → PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  ORDER_FACTS_BULK_A_ORDERS_LINES,
  ORDER_FACTS_BULK_C_AGREEMENTS_SALES_ILLEGAL,
} from "../../../app/lib/order-facts/admin-read";
import {
  assertQuerySchemaValid,
  loadGeneratedAdmin202607Schema,
} from "../../../app/lib/order-facts/admin-read/bulk-query-schema";
import { evaluateBulkOperationRules } from "../../../app/lib/order-facts/admin-read/bulk-operation-rules";
import { processOrderFactsWebhookJob } from "../../../app/lib/order-facts/sync/webhook";
import { runOrderFactsImportStep } from "../../../app/lib/order-facts/sync/import";
import { runOrderFactsReconcileStep } from "../../../app/lib/order-facts/sync/reconcile";
import { evaluateOrderFactsBulkAGates } from "../../../app/lib/order-facts/sync/bulk";
import { ORDER_FACTS_WINDOW_LISTING_QUERY } from "../../../app/lib/order-facts/sync/window-listing";
import {
  OrderFactsIdentityError,
  OrderFactsSchemaDispatchError,
} from "../../../app/lib/order-facts/sync/errors";
import { ingestAuthenticatedWebhook } from "../../../app/sync/intake.server";
import { sanitizeWebhookPayload } from "../../../app/sync/sanitize.server";
import { SyncControlPlaneError } from "../../../app/sync/errors";
import { resetControlPlanePrismaForTests } from "../../../app/sync/control-plane-db.server";
import { persistOrderFactsCursor } from "../../../app/lib/order-facts/sync/control-plane";
import {
  APPLICATION_DIGEST_CONFLICT,
} from "../../../app/sync/execution-strategy.server";
import {
  AHEAD_UPDATED_ISO,
  BEHIND_UPDATED_ISO,
  D_NOW,
  IN_WINDOW_ISO,
  OUT_OF_WINDOW_ISO,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
  countForShop,
  createOrderFactsAdmin,
  digest64,
  inWindowHeader,
  jsonlLines,
  legacyRunner,
  queryForShop,
  setupPr6DDatabase,
  standardStore,
  webhookWork,
  withTxnHost,
  lineNode,
  refundNode,
  agreementNode,
  saleNode,
} from "./pr6-d-pg-harness";
import { moneyBag } from "../../../app/lib/order-facts/admin-read/__tests__/fixtures";

describe("PR6-D complete webhook/import/reconciliation integration", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    ({ prisma, shopAId, shopBId } = await setupPr6DDatabase());
  }, 600_000);

  afterAll(async () => {
    await resetControlPlanePrismaForTests();
    await prisma?.$disconnect();
  });

  async function factCount(shopId: string, gid: string): Promise<number> {
    return countForShop(
      shopId,
      `SELECT count(*)::int AS n FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
      [gid],
    );
  }

  async function lineCount(shopId: string, gid: string): Promise<number> {
    return countForShop(
      shopId,
      `SELECT count(*)::int AS n FROM "ShopifyOrderLineFact" WHERE "shopifyOrderGid" = $1`,
      [gid],
    );
  }

  it("validates Bulk A with both B gates and the D window listing against Admin 2026-07 schema", () => {
    const { schema } = loadGeneratedAdmin202607Schema();
    assertQuerySchemaValid(schema, ORDER_FACTS_BULK_A_ORDERS_LINES, "ORDER_FACTS_BULK_A");
    const rules = evaluateBulkOperationRules(schema, ORDER_FACTS_BULK_A_ORDERS_LINES);
    expect(rules.eligible).toBe(true);
    const gates = evaluateOrderFactsBulkAGates(ORDER_FACTS_BULK_A_ORDERS_LINES);
    expect(gates.schemaGatePassed).toBe(true);
    expect(gates.bulkRuleGatePassed).toBe(true);
    assertQuerySchemaValid(
      schema,
      ORDER_FACTS_WINDOW_LISTING_QUERY,
      "OrderFactsWindowListing",
    );
    const bulkC = evaluateBulkOperationRules(
      schema,
      ORDER_FACTS_BULK_C_AGREEMENTS_SALES_ILLEGAL,
    );
    expect(bulkC.eligible).toBe(false);
  });

  it("applies all six topics through merged B → D mapper → C", async () => {
    const topics = [
      {
        topic: "orders/create" as const,
        gid: "gid://shopify/Order/d-create",
        projection: {
          id: 101,
          admin_graphql_api_id: "gid://shopify/Order/d-create",
          line_items: [{ variant_id: 1, quantity: 1, price: "9.00" }],
        },
      },
      {
        topic: "orders/cancelled" as const,
        gid: "gid://shopify/Order/d-cancel",
        projection: {
          id: 102,
          admin_graphql_api_id: "gid://shopify/Order/d-cancel",
          cancelled_at: IN_WINDOW_ISO,
        },
      },
      {
        topic: "orders/edited" as const,
        gid: "gid://shopify/Order/d-edit",
        projection: {
          order_edit: { id: 1, order_id: "d-edit", committed_at: IN_WINDOW_ISO },
        },
      },
      {
        topic: "order_transactions/create" as const,
        gid: "gid://shopify/Order/d-txn",
        projection: { id: 9, order_id: "d-txn", status: "success" },
      },
    ];
    for (const item of topics) {
      const admin = createOrderFactsAdmin({
        stores: { [item.gid]: standardStore(item.gid) },
      });
      const result = await withTxnHost(shopAId, (db) =>
        processOrderFactsWebhookJob({
          db,
          admin,
          shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
          work: webhookWork({
            shopId: shopAId,
            topic: item.topic,
            projection: item.projection,
          }),
          runLegacy: legacyRunner(shopAId),
        }),
      );
      expect(result.status).toBe("applied");
      expect(await factCount(shopAId, item.gid)).toBe(1);
    }
  });

  it("applies refunds/create via RefundFactById and independent refund clock", async () => {
    const orderGid = "gid://shopify/Order/d-refund-parent";
    const refundGid = "gid://shopify/Refund/d-refund";
    const stores = {
      [orderGid]: {
        ...standardStore(orderGid),
        refunds: [
          {
            ...refundNode(1, []),
            id: refundGid,
            processedAt: "2026-01-12T00:00:00Z",
            updatedAt: "2026-01-12T00:00:00Z",
            createdAt: "2026-01-12T00:00:00Z",
            order: { id: orderGid },
            refundLineItems: [
              {
                id: `${refundGid}/Line/1`,
                quantity: 1,
                restockType: "NO_RESTOCK",
                restocked: false,
                location: null,
                lineItem: { id: `${orderGid}/LineItem/1` },
                subtotalSet: moneyBag("1.00"),
                totalTaxSet: moneyBag("0.00"),
                priceSet: moneyBag("1.00"),
              },
            ],
          },
        ],
      },
    };
    const refundAdmin = createOrderFactsAdmin({ stores });
    await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: refundAdmin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/create",
          projection: {
            id: 201,
            admin_graphql_api_id: orderGid,
            line_items: [{ variant_id: 1, quantity: 1, price: "9.00" }],
          },
        }),
        runLegacy: legacyRunner(shopAId),
      }),
    );
    const refundResult = await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: refundAdmin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "refunds/create",
          projection: {
            id: 1,
            admin_graphql_api_id: refundGid,
            order_id: "d-refund-parent",
          },
        }),
        runLegacy: legacyRunner(shopAId),
      }),
    );
    expect(refundResult.status).toBe("applied");
    const order = await queryForShop<{ processedAt: Date }>(
      shopAId,
      `SELECT "processedAt" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
      [orderGid],
    );
    const refund = await queryForShop<{ processedAt: Date }>(
      shopAId,
      `SELECT "processedAt" FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
      [refundGid],
    );
    expect(order[0]?.processedAt.toISOString()).toContain("2026-01-10");
    expect(refund[0]?.processedAt.toISOString()).toContain("2026-01-12");
  });

  async function applyLive(
    gid: string,
    extra?: Parameters<typeof standardStore>[1],
  ) {
    await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: createOrderFactsAdmin({
          stores: { [gid]: standardStore(gid, extra) },
        }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/create",
          projection: {
            id: Number(gid.replace(/\D/g, "").slice(-6) || "1"),
            admin_graphql_api_id: gid,
          },
        }),
        runLegacy: legacyRunner(shopAId),
      }),
    );
  }

  it("applies unverified orders/delete as retained ABSENT + WEBHOOK deletion", async () => {
    const gid = "gid://shopify/Order/d-delete";
    await applyLive(gid);
    const result = await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: createOrderFactsAdmin({
          stores: { [gid]: { ...standardStore(gid), nullOrder: true } },
        }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/delete",
          projection: { id: "d-delete" },
        }),
      }),
    );
    expect(result.status).toBe("applied");
    const rows = await queryForShop<{
      existenceState: string;
      existenceKind: string;
      deletedAt: Date | null;
      deletionSource: string | null;
    }>(
      shopAId,
      `SELECT "existenceState", "existenceKind", "deletedAt", "deletionSource"
       FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
      [gid],
    );
    expect(rows[0]?.existenceState).toBe("ABSENT");
    expect(rows[0]?.existenceKind).toBe("ABSENT_SIGNALLED_DELETE_UNVERIFIED");
    expect(rows[0]?.deletedAt).not.toBeNull();
    expect(rows[0]?.deletionSource).toBe("WEBHOOK");
    expect(await lineCount(shopAId, gid)).toBe(1);
  });

  it("keeps frozen v1 orders/create executable after new-topic code (T51)", async () => {
    const gid = "gid://shopify/Order/d-t51";
    const result = await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: createOrderFactsAdmin({ stores: { [gid]: standardStore(gid) } }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/create",
          payloadSchemaVersion: "webhook-projection-orders-create-v1",
          projection: {
            id: 51,
            admin_graphql_api_id: gid,
            line_items: [{ variant_id: 7, quantity: 2, price: "3.00" }],
          },
        }),
        runLegacy: legacyRunner(shopAId),
      }),
    );
    expect(result.status).toBe("applied");
    expect(await factCount(shopAId, gid)).toBe(1);
    expect(
      await countForShop(
        shopAId,
        `SELECT count(*)::int AS n FROM "SalesDailyAggregate" WHERE "shopId" = $1`,
        [shopAId],
      ),
    ).toBeGreaterThan(0);
  });

  it("does not rerun pre-D receipted legacy; catch-up uses rebuildable import", async () => {
    const gid = "gid://shopify/Order/d-pred";
    const applicationKey = `webhook-delivery:pred-${randomUUID()}`;
    const digest = digest64("pre-d-legacy-only");
    await prisma.syncApplicationReceipt.create({
      data: {
        shopId: shopAId,
        applicationKey,
        sourceJobType: "webhook:orders/create",
        rootDurableJobId: randomUUID(),
        firstApplyingDurableJobId: randomUUID(),
        payloadDigest: digest,
        applicationSchemaVersion: "sync-application-receipt-v1",
      },
    });
    const aggregatesBefore = await prisma.salesDailyAggregate.count({
      where: { shopId: shopAId },
    });
    const result = await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: createOrderFactsAdmin({ stores: { [gid]: standardStore(gid) } }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/create",
          applicationKey,
          payloadDigest: digest,
          projection: {
            id: 77,
            admin_graphql_api_id: gid,
            line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
          },
        }),
        runLegacy: legacyRunner(shopAId),
      }),
    );
    expect(result.status).toBe("already_applied");
    expect(await factCount(shopAId, gid)).toBe(0);
    expect(
      await prisma.salesDailyAggregate.count({ where: { shopId: shopAId } }),
    ).toBe(aggregatesBefore);
    const importResult = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin: createOrderFactsAdmin({ stores: { [gid]: standardStore(gid) } }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: `import-pred-${gid}`,
        correlationId: `import-pred-${gid}`,
        jsonlSource: jsonlLines([{ id: gid }]),
        pollBulkOperation: false,
      }),
    );
    expect(importResult.status).toBe("SUCCEEDED");
    expect(await factCount(shopAId, gid)).toBe(1);
    const receipt = await prisma.syncApplicationReceipt.findFirstOrThrow({
      where: { shopId: shopAId, applicationKey },
    });
    expect(receipt.payloadDigest).toBe(digest);
  });

  it("replays the same webhook application key without duplicating facts", async () => {
    const gid = "gid://shopify/Order/d-replay";
    const applicationKey = `webhook-delivery:replay-${gid}`;
    const digest = digest64("replay");
    const work = webhookWork({
      shopId: shopAId,
      topic: "orders/create",
      applicationKey,
      payloadDigest: digest,
      projection: { id: 88, admin_graphql_api_id: gid },
    });
    const admin = createOrderFactsAdmin({ stores: { [gid]: standardStore(gid) } });
    const first = await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work,
        runLegacy: legacyRunner(shopAId),
      }),
    );
    const second = await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work,
        runLegacy: legacyRunner(shopAId),
      }),
    );
    expect(first.status).toBe("applied");
    expect(second.status).toBe("already_applied");
    expect(await factCount(shopAId, gid)).toBe(1);
  });

  it("fails closed on missing identity, pending transactions, and delivery-id reuse", async () => {
    await expect(
      withTxnHost(shopAId, (db) =>
        processOrderFactsWebhookJob({
          db,
          admin: createOrderFactsAdmin({ stores: {} }),
          shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
          work: webhookWork({
            shopId: shopAId,
            topic: "orders/delete",
            projection: {},
          }),
        }),
      ),
    ).rejects.toBeInstanceOf(OrderFactsIdentityError);

    await expect(
      withTxnHost(shopAId, (db) =>
        processOrderFactsWebhookJob({
          db,
          admin: createOrderFactsAdmin({ stores: {} }),
          shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
          work: webhookWork({
            shopId: shopAId,
            topic: "order_transactions/create",
            projection: { id: 1, order_id: 2, status: "pending" },
          }),
        }),
      ),
    ).rejects.toBeInstanceOf(OrderFactsIdentityError);

    await expect(
      withTxnHost(shopAId, (db) =>
        processOrderFactsWebhookJob({
          db,
          admin: createOrderFactsAdmin({ stores: {} }),
          shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
          work: webhookWork({
            shopId: shopAId,
            topic: "orders/create",
            applicationKey: "webhook-delivery:gid://shopify/Order/1",
            projection: { admin_graphql_api_id: "gid://shopify/Order/1" },
          }),
        }),
      ),
    ).rejects.toBeInstanceOf(OrderFactsIdentityError);

    await expect(
      withTxnHost(shopAId, (db) =>
        processOrderFactsWebhookJob({
          db,
          admin: createOrderFactsAdmin({ stores: {} }),
          shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
          work: webhookWork({
            shopId: shopAId,
            topic: "orders/create",
            payloadSchemaVersion: "webhook-projection-orders-create-v2",
            projection: { id: 1, admin_graphql_api_id: "gid://shopify/Order/1" },
          }),
        }),
      ),
    ).rejects.toBeInstanceOf(OrderFactsSchemaDispatchError);
  });

  it("preserves money strings, mixed presentment, gift-card, test, custom, and at-sale identity", async () => {
    const gid = "gid://shopify/Order/d-money";
    const store = standardStore(gid, {
      header: inWindowHeader({
        id: gid,
        test: true,
        presentmentCurrencyCode: "CAD",
        originalTotalPriceSet: moneyBag("0.00", "USD", "0.00", "CAD"),
        currentTotalPriceSet: moneyBag("0.00", "USD", "0.00", "CAD"),
      }),
      lines: [
        lineNode(1, {
          id: `${gid}/LineItem/1`,
          sku: "KEEP-SKU",
          isGiftCard: true,
          originalTotalSet: moneyBag("0.00", "USD", "0.00", "CAD"),
          originalUnitPriceSet: moneyBag("0.00", "USD", "0.00", "CAD"),
          discountedTotalSetWithCodeDiscounts: moneyBag(
            "0.00",
            "USD",
            "0.00",
            "CAD",
          ),
          variant: {
            id: "gid://shopify/ProductVariant/at-sale",
            legacyResourceId: "9",
            sku: "KEEP-SKU",
            title: "Default",
          },
          product: {
            id: "gid://shopify/Product/at-sale",
            legacyResourceId: "9",
            title: "Custom",
            handle: "custom",
          },
        }),
        lineNode(2, {
          id: `${gid}/LineItem/2`,
          sku: "CUSTOM",
          variant: null,
          product: null,
          originalTotalSet: moneyBag("-3.50", "USD", "-4.20", "CAD"),
          originalUnitPriceSet: moneyBag("-3.50", "USD", "-4.20", "CAD"),
          discountedTotalSetWithCodeDiscounts: moneyBag(
            "-3.50",
            "USD",
            "-4.20",
            "CAD",
          ),
        }),
      ],
    });
    await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: createOrderFactsAdmin({ stores: { [gid]: store } }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/create",
          projection: { id: 301, admin_graphql_api_id: gid },
        }),
      }),
    );
    const lines = await queryForShop<{
      sku: string | null;
      isGiftCard: boolean;
      variantGidAtSale: string | null;
      originalTotalShopAmount: string;
      originalTotalPresentmentAmount: string;
    }>(
      shopAId,
      `SELECT l.sku, l."isGiftCard", l."variantGidAtSale",
              l."originalTotalShopAmount"::text, l."originalTotalPresentmentAmount"::text
       FROM "ShopifyOrderLineFact" l
       WHERE l."shopifyOrderGid" = $1
       ORDER BY l.sku`,
      [gid],
    );
    const gift = lines.find((row) => row.sku === "KEEP-SKU");
    const custom = lines.find((row) => row.sku === "CUSTOM");
    expect(gift?.isGiftCard).toBe(true);
    expect(gift?.variantGidAtSale).toBe("gid://shopify/ProductVariant/at-sale");
    expect(custom?.variantGidAtSale).toBeNull();
    expect(custom?.originalTotalShopAmount).toContain("-3.5");
    const order = await queryForShop<{ test: boolean }>(
      shopAId,
      `SELECT test FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
      [gid],
    );
    expect(order[0]?.test).toBe(true);
    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopAId } });
    expect(shop.ianaTimezone).toBe("America/New_York");
    expect(shop.currencyCode).toBe("USD");
  });

  it("blocks missing with-code discount authority and unknown refund parents", async () => {
    const missingDiscount = "gid://shopify/Order/d-disc";
    const blocked = await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: createOrderFactsAdmin({
          stores: {
            [missingDiscount]: standardStore(missingDiscount, {
              lines: [
                lineNode(1, {
                  id: `${missingDiscount}/LineItem/1`,
                  discountedTotalSetWithCodeDiscounts: null,
                }),
              ],
            }),
          },
        }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/create",
          projection: { id: 9, admin_graphql_api_id: missingDiscount },
        }),
      }),
    );
    expect(blocked.status).toBe("blocked");
    expect(blocked.reason).toBe("MALFORMED_MONEY");
    expect(await factCount(shopAId, missingDiscount)).toBe(0);

    const orphanRefund = "gid://shopify/Refund/orphan";
    await expect(
      withTxnHost(shopAId, (db) =>
        processOrderFactsWebhookJob({
          db,
          admin: createOrderFactsAdmin({
            stores: {
              ["gid://shopify/Order/unused"]: {
                ...standardStore("gid://shopify/Order/unused"),
                refunds: [
                  {
                    ...refundNode(9, []),
                    id: orphanRefund,
                    order: null,
                  },
                ],
              },
            },
          }),
          shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
          work: webhookWork({
            shopId: shopAId,
            topic: "refunds/create",
            projection: { id: 9, admin_graphql_api_id: orphanRefund },
          }),
        }),
      ),
    ).resolves.toMatchObject({ status: "blocked" });
  });

  it("repairs equal-version children and persists observation leases from the trigger", async () => {
    const gid = "gid://shopify/Order/d-t45";
    const first = standardStore(gid);
    await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: createOrderFactsAdmin({ stores: { [gid]: first } }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/create",
          projection: { id: 45, admin_graphql_api_id: gid },
        }),
      }),
    );
    const repaired = standardStore(gid, {
      lines: [
        lineNode(1, { id: `${gid}/LineItem/1`, sku: "KEEP-SKU" }),
        lineNode(2, { id: `${gid}/LineItem/2`, sku: "REPAIR" }),
      ],
    });
    await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: createOrderFactsAdmin({ stores: { [gid]: repaired } }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/edited",
          projection: { order_edit: { id: 2, order_id: "d-t45" } },
        }),
      }),
    );
    expect(await lineCount(shopAId, gid)).toBe(2);
    const leases = await queryForShop<{ leaseExpiresAt: Date }>(
      shopAId,
      `SELECT "leaseExpiresAt" FROM "OrderFactObservationInFlight"
       WHERE "shopifyGid" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [gid],
    );
    expect(leases[0]?.leaseExpiresAt.getTime()).toBeGreaterThan(
      Date.parse("1971-01-01T00:00:00Z"),
    );
  });

  it("denies destructive absence on scope downgrade and preserves confirmed tombstones", async () => {
    const gid = "gid://shopify/Order/d-scope";
    await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: createOrderFactsAdmin({
          stores: { [gid]: standardStore(gid) },
          scopes: ["read_orders"],
        }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/create",
          projection: { id: 60, admin_graphql_api_id: gid },
        }),
      }),
    );
    const denied = await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: createOrderFactsAdmin({
          stores: { [gid]: { ...standardStore(gid), nullOrder: true } },
          scopes: [],
        }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/edited",
          projection: { order_edit: { id: 3, order_id: "d-scope" } },
        }),
      }),
    );
    expect(denied.status).toBe("blocked");
    const live = await queryForShop<{ existenceState: string }>(
      shopAId,
      `SELECT "existenceState" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
      [gid],
    );
    expect(live[0]?.existenceState).toBe("LIVE");

    const tombstone = "gid://shopify/Order/d-tomb";
    await applyLive(tombstone);
    const gone = createOrderFactsAdmin({
      stores: { [tombstone]: { ...standardStore(tombstone), nullOrder: true } },
      scopes: ["read_orders"],
    });
    const confirmed = await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: gone,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/edited",
          projection: { order_edit: { id: 4, order_id: "d-tomb" } },
        }),
      }),
    );
    expect(confirmed.status).toBe("applied");
    const confirmedRow = await queryForShop<{ existenceKind: string }>(
      shopAId,
      `SELECT "existenceKind" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
      [tombstone],
    );
    expect(confirmedRow[0]?.existenceKind).toBe("ABSENT_CONFIRMED_QUERY");
    const preserved = await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: createOrderFactsAdmin({
          stores: {
            [tombstone]: { ...standardStore(tombstone), nullOrder: true },
          },
        }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/edited",
          projection: { order_edit: { id: 5, order_id: "d-tomb" } },
        }),
      }),
    );
    expect(preserved.status).toBe("noop");
  });

  it("marks out-of-window null_observed as inaccessible and does not heal it via quarantine listing", async () => {
    const gid = "gid://shopify/Order/d-window";
    await applyLive(gid, {
      header: inWindowHeader({
        id: gid,
        createdAt: OUT_OF_WINDOW_ISO,
        processedAt: OUT_OF_WINDOW_ISO,
        updatedAt: OUT_OF_WINDOW_ISO,
      }),
    });
    const result = await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: createOrderFactsAdmin({
          stores: {
            [gid]: {
              header: inWindowHeader({
                id: gid,
                createdAt: OUT_OF_WINDOW_ISO,
                processedAt: OUT_OF_WINDOW_ISO,
                updatedAt: OUT_OF_WINDOW_ISO,
              }),
              lines: [],
              agreements: [],
              refunds: [],
              nullOrder: true,
            },
          },
        }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/edited",
          projection: { order_edit: { id: 8, order_id: "d-window" } },
          receivedAt: D_NOW,
        }),
      }),
    );
    expect(result.status).toBe("applied");
    const rows = await queryForShop<{ existenceKind: string }>(
      shopAId,
      `SELECT "existenceKind" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
      [gid],
    );
    expect(rows[0]?.existenceKind).toBe("INACCESSIBLE_HISTORY_WINDOW");
  });

  it("maps digest conflict and rolls back injected commit loss", async () => {
    const gid = "gid://shopify/Order/d-digest";
    const applicationKey = `webhook-delivery:digest-${gid}`;
    await prisma.syncApplicationReceipt.create({
      data: {
        shopId: shopAId,
        applicationKey,
        sourceJobType: "webhook:orders/create",
        rootDurableJobId: randomUUID(),
        firstApplyingDurableJobId: randomUUID(),
        payloadDigest: digest64("other-digest"),
        applicationSchemaVersion: "sync-application-receipt-v1",
      },
    });
    await expect(
      withTxnHost(shopAId, (db) =>
        processOrderFactsWebhookJob({
          db,
          admin: createOrderFactsAdmin({ stores: { [gid]: standardStore(gid) } }),
          shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
          work: webhookWork({
            shopId: shopAId,
            topic: "orders/create",
            applicationKey,
            payloadDigest: digest64("this-digest"),
            projection: { id: 1, admin_graphql_api_id: gid },
          }),
        }),
      ),
    ).rejects.toMatchObject({ code: APPLICATION_DIGEST_CONFLICT });

    const lostGid = "gid://shopify/Order/d-lost";
    await expect(
      withTxnHost(
        shopAId,
        (db) =>
          processOrderFactsWebhookJob({
            db,
            admin: createOrderFactsAdmin({
              stores: { [lostGid]: standardStore(lostGid) },
            }),
            shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
            work: webhookWork({
              shopId: shopAId,
              topic: "orders/create",
              projection: { id: 2, admin_graphql_api_id: lostGid },
            }),
          }),
        { loseAppliedCommit: true },
      ),
    ).rejects.toThrow(/injected_commit_loss/);
    expect(await factCount(shopAId, lostGid)).toBe(0);
  });

  it("quarantines 300-line orders/create, coalesces reconcile, and recovers in-window lines including behind the watermark", async () => {
    expect(() =>
      sanitizeWebhookPayload("orders/create", {
        id: 3001,
        line_items: Array.from({ length: 300 }, (_, i) => ({
          variant_id: i + 1,
          quantity: 1,
          price: "1.00",
        })),
      }),
    ).toThrow(SyncControlPlaneError);

    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A_DOMAIN,
      topic: "orders/create",
      webhookId: "wh-300-line",
      apiVersion: "2026-07",
      payload: {
        id: 3001,
        line_items: Array.from({ length: 300 }, (_, i) => ({
          variant_id: i + 1,
          quantity: 1,
          price: "1.00",
        })),
      },
    });
    expect(ingested.job).toBeNull();
    expect(ingested.quarantined).toBe(true);
    expect(ingested.delivery.payloadSchemaVersion).toBe(
      "quarantine-projection-bounds-v1",
    );
    const coalesce = await prisma.durableJob.findFirst({
      where: { shopId: shopAId, jobType: "order-facts-reconcile" },
    });
    expect(coalesce).not.toBeNull();

    const behindGid = "gid://shopify/Order/d-300-behind";
    const aheadGid = "gid://shopify/Order/d-300-ahead";
    const outGid = "gid://shopify/Order/d-300-out";
    const behindStore = {
      header: inWindowHeader({
        id: behindGid,
        updatedAt: BEHIND_UPDATED_ISO,
        currentSubtotalLineItemsQuantity: 300,
        subtotalLineItemsQuantity: 300,
      }),
      lines: Array.from({ length: 300 }, (_, i) =>
        lineNode(i + 1, { id: `${behindGid}/LineItem/${i + 1}` }),
      ),
      agreements: [
        agreementNode(1, [
          saleNode(1, { lineItem: { id: `${behindGid}/LineItem/1` } }),
        ]),
      ],
      refunds: [],
    };
    const aheadStore = {
      header: inWindowHeader({
        id: aheadGid,
        updatedAt: AHEAD_UPDATED_ISO,
        currentSubtotalLineItemsQuantity: 300,
        subtotalLineItemsQuantity: 300,
      }),
      lines: Array.from({ length: 300 }, (_, i) =>
        lineNode(i + 1, { id: `${aheadGid}/LineItem/${i + 1}` }),
      ),
      agreements: [
        agreementNode(1, [
          saleNode(1, { lineItem: { id: `${aheadGid}/LineItem/1` } }),
        ]),
      ],
      refunds: [],
    };
    await persistOrderFactsCursor({
      shopId: shopAId,
      domain: "order_facts_incremental",
      cursorValue: "2026-01-12T00:00:00Z",
    });
    const heapBefore = process.memoryUsage().heapUsed;
    const admin = createOrderFactsAdmin({
      stores: { [behindGid]: behindStore, [aheadGid]: aheadStore },
      listed: [
        {
          id: behindGid,
          updatedAt: BEHIND_UPDATED_ISO,
          processedAt: IN_WINDOW_ISO,
          createdAt: IN_WINDOW_ISO,
          cancelledAt: null,
        },
        {
          id: aheadGid,
          updatedAt: AHEAD_UPDATED_ISO,
          processedAt: IN_WINDOW_ISO,
          createdAt: IN_WINDOW_ISO,
          cancelledAt: null,
        },
      ],
      filterListedByQuery: true,
    });
    const boundsIssue = await prisma.dataIssue.findFirst({
      where: { shopId: shopAId, reasonCode: "projection_bounds_exceeded" },
    });
    const recovered = await withTxnHost(shopAId, (db) =>
      runOrderFactsReconcileStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: coalesce!.id,
        correlationId: coalesce!.correlationId,
        mode: "quarantine_recovery",
        now: D_NOW,
        resolvingIssueId: boundsIssue?.id,
      }),
    );
    expect(recovered.status).toBe("SUCCEEDED");
    expect(recovered.coverage.behindWatermarkExamined).toBeGreaterThan(0);
    expect(await lineCount(shopAId, behindGid)).toBe(300);
    expect(await lineCount(shopAId, aheadGid)).toBe(300);
    expect(await factCount(shopAId, outGid)).toBe(0);
    const orderQueries = admin.calls.filter((call) => call.name === "OrderFactById")
      .length;
    expect(orderQueries).toBeGreaterThanOrEqual(6);
    expect(orderQueries).toBeLessThan(40);
    const heapAfter = process.memoryUsage().heapUsed;
    const heapDelta = heapAfter - heapBefore;
    expect(heapDelta).toBeLessThan(200 * 1024 * 1024);
    console.info(
      JSON.stringify({
        pr6dQuarantineRecovery: {
          orderFactByIdQueries: orderQueries,
          heapDeltaBytes: heapDelta,
        },
      }),
    );
  });

  it("does not treat sample drift as coverage and heals a missed in-window order via sweep", async () => {
    const missed = "gid://shopify/Order/d-missed";
    const sample = await withTxnHost(shopAId, (db) =>
      runOrderFactsReconcileStep({
        db,
        admin: createOrderFactsAdmin({
          stores: { [missed]: standardStore(missed) },
          listed: [
            {
              id: missed,
              updatedAt: AHEAD_UPDATED_ISO,
              processedAt: IN_WINDOW_ISO,
              createdAt: IN_WINDOW_ISO,
              cancelledAt: null,
            },
          ],
        }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: `sample-${missed}`,
        correlationId: `sample-${missed}`,
        mode: "sample",
        now: D_NOW,
      }),
    );
    expect(sample.status).toBe("SUCCEEDED");
    expect(sample.coverage.watermarkPersisted).toBe(false);
    const sampleIssue = await prisma.dataIssue.findFirst({
      where: { shopId: shopAId, reasonCode: "order_facts_sample_not_coverage" },
    });
    expect(sampleIssue).not.toBeNull();
    const healthAfterSample = await prisma.syncHealth.findFirst({
      where: { shopId: shopAId, syncDomain: "order_facts" },
    });
    expect(healthAfterSample?.state).not.toBe("HEALTHY");

    const sweep = await withTxnHost(shopAId, (db) =>
      runOrderFactsReconcileStep({
        db,
        admin: createOrderFactsAdmin({
          stores: { [missed]: standardStore(missed) },
          listed: [
            {
              id: missed,
              updatedAt: AHEAD_UPDATED_ISO,
              processedAt: IN_WINDOW_ISO,
              createdAt: IN_WINDOW_ISO,
              cancelledAt: null,
            },
          ],
        }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: `sweep-${missed}`,
        correlationId: `sweep-${missed}`,
        mode: "window_sweep",
        now: D_NOW,
        resolvingIssueId: sampleIssue?.id,
      }),
    );
    expect(sweep.status).toBe("SUCCEEDED");
    expect(await factCount(shopAId, missed)).toBe(1);
  });

  it("imports JSONL by nominating Order GIDs then B-refetch/C-apply, and fail-closes truncated JSONL", async () => {
    const gid = "gid://shopify/Order/d-jsonl";
    const ok = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin: createOrderFactsAdmin({ stores: { [gid]: standardStore(gid) } }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: `jsonl-${gid}`,
        correlationId: `jsonl-${gid}`,
        jsonlSource: jsonlLines([
          { id: `${gid}/LineItem/1`, __parentId: gid },
          { id: gid },
        ]),
        pollBulkOperation: false,
      }),
    );
    expect(ok.status).toBe("SUCCEEDED");
    expect(await factCount(shopAId, gid)).toBe(1);

    const partial = await withTxnHost(shopAId, async (db) =>
      runOrderFactsImportStep({
        db,
        admin: createOrderFactsAdmin({ stores: {} }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "jsonl-trunc",
        correlationId: "jsonl-trunc",
        jsonlSource: (async function* () {
          yield '{"id":"gid://shopify/Order/trunc"';
        })(),
        pollBulkOperation: false,
      }),
    );
    expect(partial.status).toBe("PARTIAL_FAILURE");
  });

  it("fails closed on bulk userErrors, operation-id mismatch, and does not double-submit after a fenced retry", async () => {
    const userErrors = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin: createOrderFactsAdmin({
          stores: {},
          bulk: { userErrors: [{ message: "throttled" }] },
        }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "bulk-user-errors",
        correlationId: "bulk-user-errors",
        pollBulkOperation: true,
      }),
    ).catch((error: unknown) => error);
    expect(userErrors).toBeInstanceOf(Error);

    await expect(
      withTxnHost(shopAId, (db) =>
        runOrderFactsImportStep({
          db,
          admin: createOrderFactsAdmin({
            stores: {},
            bulk: {
              id: "gid://shopify/BulkOperation/d-ok",
              mismatchPolledId: "gid://shopify/BulkOperation/other",
              status: "COMPLETED",
            },
          }),
          shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
          shopId: shopAId,
          durableJobId: "bulk-mismatch",
          correlationId: "bulk-mismatch",
          pollBulkOperation: true,
        }),
      ),
    ).rejects.toThrow(/does not match/i);

    const submitAdmin = createOrderFactsAdmin({
      stores: {
        ["gid://shopify/Order/d-fence"]: standardStore(
          "gid://shopify/Order/d-fence",
        ),
      },
      bulk: {
        id: "gid://shopify/BulkOperation/d-fence",
        status: "CREATED",
        pollStatus: (() => {
          let polls = 0;
          return () => {
            polls += 1;
            return polls === 1 ? "CREATED" : "COMPLETED";
          };
        })(),
        url: "https://example.invalid/fence.jsonl",
      },
    });
    const first = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin: submitAdmin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "bulk-fence",
        correlationId: "bulk-fence",
        pollBulkOperation: true,
        fetchJsonl: async () =>
          jsonlLines([{ id: "gid://shopify/Order/d-fence" }]),
      }),
    );
    expect(first.status).toBe("CONTINUE");
    const mutations = submitAdmin.calls.filter(
      (call) => call.name === "CatalogFactBulkOperationRunQuery",
    );
    expect(mutations).toHaveLength(1);
    const second = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin: submitAdmin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "bulk-fence",
        correlationId: "bulk-fence",
        pollBulkOperation: true,
        fetchJsonl: async () =>
          jsonlLines([{ id: "gid://shopify/Order/d-fence" }]),
      }),
    );
    expect(second.status).toBe("SUCCEEDED");
    expect(
      submitAdmin.calls.filter(
        (call) => call.name === "CatalogFactBulkOperationRunQuery",
      ),
    ).toHaveLength(1);
  });

  it("does not leak Shop A facts into Shop B and refuses processing-disabled shops", async () => {
    const gid = "gid://shopify/Order/d-tenant";
    await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: createOrderFactsAdmin({ stores: { [gid]: standardStore(gid) } }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/create",
          projection: { id: 1, admin_graphql_api_id: gid },
        }),
      }),
    );
    expect(await factCount(shopBId, gid)).toBe(0);
    expect(await factCount(shopAId, gid)).toBe(1);

    await prisma.shop.update({
      where: { id: shopAId },
      data: { processingEnabled: false },
    });
    await expect(
      withTxnHost(shopAId, (db) =>
        runOrderFactsImportStep({
          db,
          admin: createOrderFactsAdmin({ stores: {} }),
          shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
          shopId: shopAId,
          durableJobId: "disabled",
          correlationId: "disabled",
          jsonlSource: jsonlLines([]),
          pollBulkOperation: false,
        }),
      ),
    ).rejects.toThrow(/shop_processing_disabled/);
    await prisma.shop.update({
      where: { id: shopAId },
      data: { processingEnabled: true },
    });
  });

  it("records incomplete pagination without a success receipt", async () => {
    const gid = "gid://shopify/Order/d-incomplete";
    const admin = createOrderFactsAdmin({
      stores: {
        [gid]: {
          header: inWindowHeader({ id: gid }),
          lines: [lineNode(1, { id: `${gid}/LineItem/1` })],
          agreements: [],
          refunds: [],
        },
      },
    });
    const originalGraphql = admin.graphql.bind(admin);
    let orderPages = 0;
    admin.graphql = async (query, options) => {
      const name = /(?:query|mutation)\s+([A-Za-z0-9_]+)/.exec(query)?.[1];
      if (name === "OrderFactById") {
        orderPages += 1;
        if (orderPages > 1) {
          return {
            json: async () => ({
              data: { order: null },
              errors: [{ message: "pagination drift" }],
            }),
          };
        }
        const json = await (await originalGraphql(query, options)).json();
        const data = json as {
          data?: { order?: { lineItems?: { pageInfo?: { hasNextPage?: boolean } } } };
        };
        if (data.data?.order?.lineItems?.pageInfo) {
          data.data.order.lineItems.pageInfo.hasNextPage = true;
        }
        return { json: async () => json };
      }
      return originalGraphql(query, options);
    };
    const result = await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/create",
          projection: { id: 1, admin_graphql_api_id: gid },
        }),
      }),
    );
    expect(result.status).toBe("incomplete");
    expect(await factCount(shopAId, gid)).toBe(0);
    expect(
      await prisma.syncApplicationReceipt.count({
        where: { shopId: shopAId, applicationKey: { contains: "d-incomplete" } },
      }),
    ).toBe(0);
  });

  it("requires two non-overlapping LIVE confirmations to revive a confirmed tombstone", async () => {
    const gid = "gid://shopify/Order/d-revive";
    await applyLive(gid);
    const gone = createOrderFactsAdmin({
      stores: { [gid]: { ...standardStore(gid), nullOrder: true } },
    });
    const tombstoned = await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: gone,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/edited",
          projection: { order_edit: { id: 1, order_id: "d-revive" } },
        }),
      }),
    );
    expect(tombstoned.status).toBe("applied");
    const firstLive = await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: createOrderFactsAdmin({ stores: { [gid]: standardStore(gid) } }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/edited",
          projection: { order_edit: { id: 2, order_id: "d-revive" } },
        }),
      }),
    );
    expect(firstLive.status).toBe("applied");
    expect(firstLive.reason).toBe("terminal_first_confirmation");
    const afterFirst = await queryForShop<{ existenceState: string }>(
      shopAId,
      `SELECT "existenceState" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
      [gid],
    );
    expect(afterFirst[0]?.existenceState).toBe("ABSENT");
    const secondLive = await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: createOrderFactsAdmin({ stores: { [gid]: standardStore(gid) } }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/edited",
          projection: { order_edit: { id: 3, order_id: "d-revive" } },
        }),
      }),
    );
    expect(secondLive.status).toBe("applied");
    const revived = await queryForShop<{ existenceState: string }>(
      shopAId,
      `SELECT "existenceState" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
      [gid],
    );
    expect(revived[0]?.existenceState).toBe("LIVE");
  });

  it("fails closed on required shop/presentment currency mismatch", async () => {
    const gid = "gid://shopify/Order/d-currency";
    const result = await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin: createOrderFactsAdmin({
          stores: {
            [gid]: standardStore(gid, {
              header: inWindowHeader({
                id: gid,
                currencyCode: "USD",
                originalTotalPriceSet: moneyBag("10.00", "EUR"),
                currentTotalPriceSet: moneyBag("10.00", "EUR"),
              }),
            }),
          },
        }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/create",
          projection: { id: 1, admin_graphql_api_id: gid },
        }),
      }),
    );
    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("MONEY_CURRENCY_MISMATCH");
    expect(await factCount(shopAId, gid)).toBe(0);
    expect(
      await prisma.syncApplicationReceipt.count({
        where: { shopId: shopAId, applicationKey: { contains: "d-currency" } },
      }),
    ).toBe(0);
  });
});
