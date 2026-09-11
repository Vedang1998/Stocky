/**
 * PR6-C canonical order/refund applicator — disposable PostgreSQL races.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import {
  applyOrderFacts,
  applyOrderFactsWithRetry,
  ORDER_APPLY_PHYSICAL_DELETE_OPERATIONS,
  denyOrderFactPhysicalDelete,
} from "../../../app/lib/order-facts/apply";
import {
  OrderApplyBatchExceedsCapacityError,
  OrderApplyClientShopDeniedError,
  OrderApplyPhysicalDeleteError,
  OrderApplyProcessingDisabledError,
} from "../../../app/lib/order-facts/apply/errors";
import type { OrderApplyDb } from "../../../app/lib/order-facts/apply/sql";
import type {
  DirectOrderObservation,
  FullSyncOrderObservation,
  OrderLineSnapshot,
  OrderSnapshot,
  RefundSnapshot,
  SaleSnapshot,
} from "../../../app/lib/order-facts/apply/types";
import { DIAGNOSTIC } from "../../../app/lib/order-facts/apply/types";
import { encodeRevivalConfirmation } from "../../../app/lib/order-facts/apply/existence";
import { allocateCatalogObservationGeneration } from "../../../app/lib/catalog-facts/observation-generation";
import { deriveOrderLockKey } from "../../../app/lib/order-facts/lock-key";
import { getRuntimeClient } from "../connection";
import { ENFORCEMENT_CONTEXT_VERSION } from "../manifest";
import { resetSchemaAndApplyEnforcement } from "./helpers";

function bag(amount: string, currency = "USD") {
  return {
    shopAmount: amount,
    shopCurrencyCode: currency,
    presentmentAmount: amount,
    presentmentCurrencyCode: currency,
  };
}

function asQueryRaw(client: Client): OrderApplyDb {
  return {
    async $queryRaw(strings, ...values) {
      let text = "";
      const params: unknown[] = [];
      strings.forEach((part, i) => {
        text += part;
        if (i < values.length) {
          params.push(values[i]);
          text += `$${params.length}`;
        }
      });
      const result = await client.query(text, params);
      return result.rows;
    },
  };
}

async function setTenant(client: Client, shopId: string): Promise<void> {
  await client.query(`SELECT set_config('stocky.current_shop_id', $1, true)`, [
    shopId,
  ]);
  await client.query(
    `SELECT set_config('stocky.tenant_context_version', $1, true)`,
    [ENFORCEMENT_CONTEXT_VERSION],
  );
}

async function insertObservation(
  client: Client,
  args: {
    id: string;
    shopId: string;
    resourceKind: "Order" | "Refund";
    shopifyGid: string;
    requestGen: bigint;
    leaseMs?: number;
    scopes?: string[];
  },
): Promise<void> {
  await client.query(
    `INSERT INTO "OrderFactObservationInFlight" (
       id, "shopId", "resourceKind", "shopifyGid",
       "observationRequestGen", "leaseDurationMs", "leaseExpiresAt",
       "lifecycleState", "accessScopeSnapshot", "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3::"OrderResourceKind", $4,
       $5, $6, TIMESTAMPTZ '1970-01-01',
       'ACTIVE', $7::text[], CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
     )`,
    [
      args.id,
      args.shopId,
      args.resourceKind,
      args.shopifyGid,
      args.requestGen.toString(),
      args.leaseMs ?? 60_000,
      args.scopes ?? ["read_orders"],
    ],
  );
}

function line(gid: string, overrides: Partial<OrderLineSnapshot> = {}): OrderLineSnapshot {
  return {
    shopifyGid: gid,
    quantity: 3,
    currentQuantity: 3,
    refundableQuantity: 3,
    unfulfilledQuantity: 3,
    isGiftCard: false,
    title: "Widget",
    variantTitle: null,
    vendor: null,
    sku: "SKU-1",
    name: "Widget",
    variantGidAtSale: "gid://shopify/ProductVariant/1",
    productGidAtSale: "gid://shopify/Product/1",
    currentVariantGid: "gid://shopify/ProductVariant/1",
    currentProductGid: "gid://shopify/Product/1",
    shopifyLegacyResourceId: null,
    originalTotalSet: bag("30.00"),
    originalUnitPriceSet: bag("10.00"),
    discountedTotalSet: bag("30.00"),
    totalDiscountSet: bag("0.00"),
    ...overrides,
  };
}

function sale(overrides: Partial<SaleSnapshot> & { shopifyGid: string }): SaleSnapshot {
  return {
    quantity: 3,
    lineType: "PRODUCT",
    actionType: "ORDER",
    saleTypename: "ProductSale",
    shopifyLineItemGid: "gid://shopify/LineItem/1",
    totalAmount: bag("30.00"),
    ...overrides,
  };
}

function orderSnapshot(
  gid: string,
  overrides: Partial<OrderSnapshot> = {},
): OrderSnapshot {
  const lineGid = overrides.lines?.[0]?.shopifyGid ?? `${gid}/Line/1`;
  const defaultLine = line(lineGid);
  return {
    shopifyGid: gid,
    name: "#1001",
    shopifyCreatedAt: new Date("2026-08-01T00:00:00.000Z"),
    shopifyUpdatedAt: new Date("2026-08-10T00:00:00.000Z"),
    processedAt: new Date("2026-08-01T00:00:00.000Z"),
    processedAtShopify: "2026-08-01T00:00:00Z",
    cancelledAt: null,
    cancelReason: null,
    closed: false,
    closedAt: null,
    edited: false,
    test: false,
    confirmed: true,
    shopCurrencyCode: "USD",
    presentmentCurrencyCode: "USD",
    taxesIncluded: true,
    displayFinancialStatus: "PAID",
    displayFulfillmentStatus: "UNFULFILLED",
    sourceName: "web",
    retailLocationGid: null,
    currentSubtotalLineItemsQuantity: 3,
    subtotalLineItemsQuantity: 3,
    shopifyLegacyResourceId: "1001",
    originalTotalPriceSet: bag("30.00"),
    currentTotalPriceSet: bag("30.00"),
    currentSubtotalPriceSet: bag("30.00"),
    currentTotalDiscountsSet: bag("0.00"),
    currentTotalTaxSet: bag("0.00"),
    totalRefundedSet: bag("0.00"),
    netPaymentSet: bag("30.00"),
    lines: [defaultLine],
    linesComplete: true,
    agreements: [
      {
        shopifyGid: `${gid}/Agreement/1`,
        happenedAt: new Date("2026-08-01T00:00:00.000Z"),
        agreementTypename: "OrderAgreement",
        reason: "ORDER",
        refundGid: null,
        salesComplete: true,
        sales: [
          sale({
            shopifyGid: `${gid}/Sale/1`,
            shopifyLineItemGid: defaultLine.shopifyGid,
          }),
        ],
      },
    ],
    agreementsComplete: true,
    ...overrides,
  };
}

function refundSnapshot(
  gid: string,
  orderGid: string,
  overrides: Partial<RefundSnapshot> = {},
): RefundSnapshot {
  return {
    shopifyGid: gid,
    shopifyOrderGid: orderGid,
    shopifyCreatedAt: new Date("2026-08-11T00:00:00.000Z"),
    shopifyUpdatedAt: new Date("2026-08-11T00:00:00.000Z"),
    processedAt: new Date("2026-08-11T00:00:00.000Z"),
    processedAtShopify: "2026-08-11T00:00:00Z",
    shopifyLegacyResourceId: null,
    totalRefundedSet: bag("10.00"),
    shippingLines: [],
    lines: [
      {
        shopifyGid: null,
        shopifyLineItemGid: `${orderGid}/Line/1`,
        refundLineOrdinal: 0,
        quantity: 1,
        restockType: null,
        restocked: null,
        restockLocationGid: null,
        subtotalSet: bag("10.00"),
        totalTaxSet: bag("0.00"),
        priceSet: bag("10.00"),
      },
    ],
    linesComplete: true,
    adjustments: [],
    adjustmentsComplete: true,
    transactions: [
      {
        shopifyGid: `${gid}/Txn/1`,
        status: "SUCCESS",
        kind: "REFUND",
        shopifyCreatedAt: new Date("2026-08-11T00:00:00.000Z"),
        processedAt: new Date("2026-08-11T00:00:00.000Z"),
        amountSet: bag("10.00"),
      },
    ],
    transactionsComplete: true,
    ...overrides,
  };
}

function liveOrder(
  shopId: string,
  token: string,
  snapshot: OrderSnapshot,
  requestGen: bigint,
  responseGen: bigint,
  extras: Partial<DirectOrderObservation> = {},
): DirectOrderObservation {
  return {
    observationKind: "direct",
    observationToken: token,
    observationRequestGen: requestGen,
    observationResponseGen: responseGen,
    identity: {
      shopId,
      resourceKind: "Order",
      shopifyGid: snapshot.shopifyGid,
    },
    existenceKind: "LIVE_REFETCH",
    existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
    sourceKind: "INCREMENTAL_REFETCH",
    accessScopeSnapshot: ["read_orders"],
    snapshotComplete: true,
    order: snapshot,
    shopifyCreatedAt: snapshot.shopifyCreatedAt,
    processedAt: snapshot.processedAt,
    queryCompleted: true,
    queryReturnedNull: false,
    ...extras,
  };
}

function refundObservation(
  shopId: string,
  token: string,
  refund: RefundSnapshot,
  requestGen: bigint,
  responseGen: bigint,
): DirectOrderObservation {
  return {
    observationKind: "direct",
    observationToken: token,
    observationRequestGen: requestGen,
    observationResponseGen: responseGen,
    identity: {
      shopId,
      resourceKind: "Refund",
      shopifyGid: refund.shopifyGid,
    },
    existenceKind: "LIVE_REFETCH",
    existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
    sourceKind: "INCREMENTAL_REFETCH",
    accessScopeSnapshot: ["read_orders"],
    snapshotComplete: true,
    refund,
  };
}

describe("PR6-C canonical applicator PostgreSQL", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    const shopA = await prisma.shop.create({
      data: { myshopifyDomain: "pr6-c-a.myshopify.com" },
    });
    const shopB = await prisma.shop.create({
      data: { myshopifyDomain: "pr6-c-b.myshopify.com" },
    });
    shopAId = shopA.id;
    shopBId = shopB.id;
  }, 600_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function withTenant<T>(
    fn: (client: Client, db: OrderApplyDb) => Promise<T>,
    shopId = shopAId,
  ): Promise<T> {
    const client = await getRuntimeClient();
    try {
      await client.query("BEGIN");
      await setTenant(client, shopId);
      const result = await fn(client, asQueryRaw(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      await client.end();
    }
  }

  it("exposes no physical-delete operation", () => {
    expect(ORDER_APPLY_PHYSICAL_DELETE_OPERATIONS).toEqual([]);
    expect(() => denyOrderFactPhysicalDelete()).toThrow(
      OrderApplyPhysicalDeleteError,
    );
  });

  it("T01 first LIVE order upserts order+line with exact decimals", async () => {
    const gid = "gid://shopify/Order/t01";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t01",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const snapshot = orderSnapshot(gid, {
        originalTotalPriceSet: bag("19.99"),
        currentTotalPriceSet: bag("19.99"),
        currentSubtotalPriceSet: bag("19.99"),
        netPaymentSet: bag("19.99"),
      });
      const result = await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-t01", snapshot, req, resp)],
      });
      expect(result.results[0]?.outcome).toBe("applied");
      const order = await client.query(
        `SELECT name, "existenceState", "originalTotalShopAmount"::text AS amt
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(order.rows[0].existenceState).toBe("LIVE");
      expect(order.rows[0].amt).toMatch(/19\.99/);
      const lines = await client.query(
        `SELECT quantity FROM "ShopifyOrderLineFact" WHERE "shopifyOrderGid" = $1`,
        [gid],
      );
      expect(lines.rowCount).toBe(1);
      expect(lines.rows[0].quantity).toBe(3);
    });
  });

  it("T03 client shop header cannot set tenant", async () => {
    await withTenant(async (_client, db) => {
      await expect(
        applyOrderFacts(db, {
          shopId: shopAId,
          claimedClientShopId: shopBId,
          observations: [],
        }),
      ).rejects.toBeInstanceOf(OrderApplyClientShopDeniedError);
    });
  });

  it("T04 duplicate delivery receipt short-circuits", async () => {
    const gid = "gid://shopify/Order/t04";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t04a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const snapshot = orderSnapshot(gid);
      const receipt = {
        applicationKey: "t04-delivery",
        sourceJobType: "webhook:orders/create",
        rootDurableJobId: "job-t04",
        applyingDurableJobId: "job-t04",
        payloadDigest: "abc123digestabc123digestabc123digestabc123digestabc123xx",
      };
      const first = await applyOrderFacts(db, {
        shopId: shopAId,
        receipt,
        observations: [liveOrder(shopAId, "obs-t04a", snapshot, req, resp)],
      });
      expect(first.receiptStatus).toBe("applied");
      const second = await applyOrderFacts(db, {
        shopId: shopAId,
        receipt,
        observations: [liveOrder(shopAId, "obs-t04a", snapshot, req, resp)],
      });
      expect(second.receiptStatus).toBe("already_applied");
      const receipts = await client.query(
        `SELECT count(*)::int AS n FROM "SyncApplicationReceipt" WHERE "applicationKey" = $1`,
        ["t04-delivery"],
      );
      expect(receipts.rows[0].n).toBe(1);
    });
  });

  it("T09 stale order snapshot writes no children (T44)", async () => {
    const gid = "gid://shopify/Order/t09";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t09a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req1,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      const newer = orderSnapshot(gid, {
        shopifyUpdatedAt: new Date("2026-08-20T00:00:00.000Z"),
        name: "#NEW",
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-t09a", newer, req1, resp1)],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t09b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      const stale = orderSnapshot(gid, {
        shopifyUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
        name: "#STALE",
        lines: [
          line(`${gid}/Line/stale`, { title: "should-not-write", quantity: 99 }),
        ],
      });
      const result = await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-t09b", stale, req2, resp2)],
      });
      expect(result.results[0]?.childrenApplied).toBe(false);
      const order = await client.query(
        `SELECT name FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(order.rows[0].name).toBe("#NEW");
      const staleLine = await client.query(
        `SELECT 1 FROM "ShopifyOrderLineFact" WHERE title = 'should-not-write'`,
      );
      expect(staleLine.rowCount).toBe(0);
    });
  });

  it("T45 equal updatedAt repairs drifted children", async () => {
    const gid = "gid://shopify/Order/t45";
    const updatedAt = new Date("2026-08-10T00:00:00.000Z");
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t45a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req1,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t45a",
            orderSnapshot(gid, { shopifyUpdatedAt: updatedAt }),
            req1,
            resp1,
          ),
        ],
      });
      await client.query(
        `UPDATE "ShopifyOrderLineFact" SET quantity = 1 WHERE "shopifyOrderGid" = $1`,
        [gid],
      );
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t45b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t45b",
            orderSnapshot(gid, { shopifyUpdatedAt: updatedAt }),
            req2,
            resp2,
          ),
        ],
      });
      const lineRow = await client.query(
        `SELECT quantity FROM "ShopifyOrderLineFact" WHERE "shopifyOrderGid" = $1`,
        [gid],
      );
      expect(lineRow.rows[0].quantity).toBe(3);
    });
  });

  it("T11 retains variantGidAtSale when later catalog identity is null", async () => {
    const gid = "gid://shopify/Order/t11";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t11a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req1,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-t11a", orderSnapshot(gid), req1, resp1)],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t11b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      const next = orderSnapshot(gid, {
        shopifyUpdatedAt: new Date("2026-08-21T00:00:00.000Z"),
        lines: [
          line(`${gid}/Line/1`, {
            variantGidAtSale: null,
            currentVariantGid: null,
          }),
        ],
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-t11b", next, req2, resp2)],
      });
      const row = await client.query(
        `SELECT "variantGidAtSale", "currentVariantGid"
           FROM "ShopifyOrderLineFact" WHERE "shopifyOrderGid" = $1`,
        [gid],
      );
      expect(row.rows[0].variantGidAtSale).toBe(
        "gid://shopify/ProductVariant/1",
      );
      expect(row.rows[0].currentVariantGid).toBeNull();
    });
  });

  it("T14 two tenants can store the same Shopify order id", async () => {
    const gid = "gid://shopify/Order/shared-rest-id";
    for (const [shopId, token] of [
      [shopAId, "obs-t14a"],
      [shopBId, "obs-t14b"],
    ] as const) {
      await withTenant(async (client, db) => {
        const req = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: token,
          shopId,
          resourceKind: "Order",
          shopifyGid: gid,
          requestGen: req,
        });
        const resp = await allocateCatalogObservationGeneration(db);
        await applyOrderFacts(db, {
          shopId,
          observations: [
            liveOrder(shopId, token, orderSnapshot(gid), req, resp),
          ],
        });
      }, shopId);
    }
    const count = await prisma.shopifyOrderFact.count({
      where: { shopifyGid: gid },
    });
    expect(count).toBe(2);
  });

  it("T15 persists sub-cent 1.234567", async () => {
    const gid = "gid://shopify/Order/t15";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t15",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const snapshot = orderSnapshot(gid, {
        originalTotalPriceSet: bag("1.234567"),
        currentTotalPriceSet: bag("1.234567"),
        currentSubtotalPriceSet: bag("1.234567"),
        netPaymentSet: bag("1.234567"),
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-t15", snapshot, req, resp)],
      });
      const row = await client.query(
        `SELECT "originalTotalShopAmount"::text AS amt
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(String(row.rows[0].amt)).toContain("1.234567");
    });
  });

  it("T35 advisory lock is held before first insert", async () => {
    const gid = "gid://shopify/Order/t35";
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      const db = asQueryRaw(runtime);
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(runtime, {
        id: "obs-t35",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const key = deriveOrderLockKey({
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(shopAId, "obs-t35", orderSnapshot(gid), req, resp),
        ],
      });
      const locks = await runtime.query(
        `SELECT 1 FROM pg_locks
          WHERE locktype = 'advisory' AND classid = $1 AND objid = $2
            AND pid = pg_backend_pid()`,
        [key.key1, key.key2],
      );
      expect(locks.rowCount).toBeGreaterThan(0);
      await runtime.query("COMMIT");
    } catch (error) {
      await runtime.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      await runtime.end();
    }
  });

  it("T41 aged-out null does not tombstone", async () => {
    const gid = "gid://shopify/Order/t41";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t41a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req1,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      const old = orderSnapshot(gid, {
        processedAt: new Date("2026-01-01T00:00:00.000Z"),
        processedAtShopify: "2026-01-01T00:00:00Z",
        shopifyCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-t41a", old, req1, resp1)],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t41b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-t41b",
            observationRequestGen: req2,
            observationResponseGen: resp2,
            identity: { shopId: shopAId, resourceKind: "Order", shopifyGid: gid },
            existenceKind: "ABSENT_CONFIRMED_QUERY",
            existenceObservedAt: new Date("2026-09-11T00:00:00.000Z"),
            sourceKind: "INCREMENTAL_REFETCH",
            accessScopeSnapshot: ["read_orders"],
            lastConfirmedAccessScopes: ["read_orders"],
            snapshotComplete: true,
            queryCompleted: true,
            queryReturnedNull: true,
            processedAt: new Date("2026-01-01T00:00:00.000Z"),
            shopifyCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
      });
      const row = await client.query(
        `SELECT "existenceState", "existenceKind", "deletedAt"
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].deletedAt).toBeNull();
      expect(row.rows[0].existenceKind).toBe("INACCESSIBLE_HISTORY_WINDOW");
      expect(row.rows[0].existenceState).toBe("LIVE");
      const window = await client.query(
        `SELECT "historyWindowState", "attributeFreshnessState"
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(window.rows[0].historyWindowState).toBe(
        "ORDER_HISTORY_WINDOW_TRUNCATED",
      );
      expect(window.rows[0].attributeFreshnessState).toBe("DEGRADED");
    });
  });

  it("T42 in-window null tombstones with CONFIRMED_QUERY", async () => {
    const gid = "gid://shopify/Order/t42";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t42a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req1,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(shopAId, "obs-t42a", orderSnapshot(gid), req1, resp1),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t42b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-t42b",
            observationRequestGen: req2,
            observationResponseGen: resp2,
            identity: { shopId: shopAId, resourceKind: "Order", shopifyGid: gid },
            existenceKind: "ABSENT_CONFIRMED_QUERY",
            existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
            sourceKind: "INCREMENTAL_REFETCH",
            accessScopeSnapshot: ["read_orders"],
            lastConfirmedAccessScopes: ["read_orders"],
            snapshotComplete: true,
            queryCompleted: true,
            queryReturnedNull: true,
          },
        ],
      });
      const row = await client.query(
        `SELECT "existenceState", "existenceKind", "deletedAt", "deletionSource"
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].existenceState).toBe("ABSENT");
      expect(row.rows[0].existenceKind).toBe("ABSENT_CONFIRMED_QUERY");
      expect(row.rows[0].deletedAt).not.toBeNull();
      expect(row.rows[0].deletionSource).toBe("CONFIRMED_QUERY");
    });
  });

  it("T43 unverified delete retains the row with WEBHOOK deletedAt", async () => {
    const gid = "gid://shopify/Order/t43";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t43a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req1,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(shopAId, "obs-t43a", orderSnapshot(gid), req1, resp1),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t43b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-t43b",
            observationRequestGen: req2,
            observationResponseGen: resp2,
            identity: { shopId: shopAId, resourceKind: "Order", shopifyGid: gid },
            existenceKind: "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
            existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
            sourceKind: "DELETE_WEBHOOK",
            accessScopeSnapshot: ["read_orders"],
            snapshotComplete: true,
          },
        ],
      });
      const row = await client.query(
        `SELECT "existenceState", "existenceKind", "deletedAt", "deletionSource"
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].existenceKind).toBe(
        "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
      );
      expect(row.rows[0].deletionSource).toBe("WEBHOOK");
      expect(row.rows[0].deletedAt).not.toBeNull();
      const retained = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderLineFact" WHERE "shopifyOrderGid" = $1`,
        [gid],
      );
      expect(retained.rows[0].n).toBe(1);
    });
  });

  it("T46 null refund-line id ingest is idempotent via ordinal identity", async () => {
    const orderGid = "gid://shopify/Order/t46";
    const refundGid = "gid://shopify/Refund/t46";
    await withTenant(async (client, db) => {
      const reqO = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t46o",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: orderGid,
        requestGen: reqO,
      });
      const respO = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t46o",
            orderSnapshot(orderGid),
            reqO,
            respO,
          ),
        ],
      });
      for (const token of ["obs-t46r1", "obs-t46r2"] as const) {
        const req = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: token,
          shopId: shopAId,
          resourceKind: "Refund",
          shopifyGid: refundGid,
          requestGen: req,
        });
        const resp = await allocateCatalogObservationGeneration(db);
        await applyOrderFacts(db, {
          shopId: shopAId,
          observations: [
            {
              observationKind: "direct",
              observationToken: token,
              observationRequestGen: req,
              observationResponseGen: resp,
              identity: {
                shopId: shopAId,
                resourceKind: "Refund",
                shopifyGid: refundGid,
              },
              existenceKind: "LIVE_REFETCH",
              existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
              sourceKind: "INCREMENTAL_REFETCH",
              accessScopeSnapshot: ["read_orders"],
              snapshotComplete: true,
              refund: refundSnapshot(refundGid, orderGid, {
                lines: [
                  {
                    shopifyGid: null,
                    shopifyLineItemGid: `${orderGid}/Line/1`,
                    refundLineOrdinal: 0,
                    quantity: 1,
                    restockType: null,
                    restocked: null,
                    restockLocationGid: null,
                    subtotalSet: bag("10.00"),
                    totalTaxSet: bag("0.00"),
                    priceSet: bag("10.00"),
                  },
                ],
              }),
            },
          ],
        });
      }
      const lines = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderRefundLineFact"
          WHERE "shopifyRefundGid" = $1`,
        [refundGid],
      );
      expect(lines.rows[0].n).toBe(1);
    });
  });

  it("T47 reversal sale stores -1 and refunded_units 1", async () => {
    const gid = "gid://shopify/Order/t47";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t47",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const snapshot = orderSnapshot(gid, {
        lines: [line(`${gid}/Line/1`, { quantity: 3, currentQuantity: 2 })],
        agreements: [
          {
            shopifyGid: `${gid}/Agreement/1`,
            happenedAt: new Date("2026-08-01T00:00:00.000Z"),
            agreementTypename: "OrderAgreement",
            reason: "ORDER",
            refundGid: null,
            salesComplete: true,
            sales: [
              sale({
                shopifyGid: `${gid}/Sale/order`,
                quantity: 3,
                shopifyLineItemGid: `${gid}/Line/1`,
              }),
            ],
          },
          {
            shopifyGid: `${gid}/Agreement/ret`,
            happenedAt: new Date("2026-08-11T00:00:00.000Z"),
            agreementTypename: "RefundAgreement",
            reason: "REFUND",
            refundGid: `${gid}/Refund/1`,
            salesComplete: true,
            sales: [
              sale({
                shopifyGid: `${gid}/Sale/ret`,
                quantity: -1,
                actionType: "RETURN",
                shopifyLineItemGid: `${gid}/Line/1`,
                totalAmount: bag("-10.00"),
              }),
            ],
          },
        ],
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-t47", snapshot, req, resp)],
      });
      const saleRow = await client.query(
        `SELECT quantity, "actionType" FROM "ShopifyOrderAgreementSaleFact"
          WHERE "shopifyGid" = $1`,
        [`${gid}/Sale/ret`],
      );
      expect(saleRow.rows[0].quantity).toBe(-1);
      expect(saleRow.rows[0].actionType).toBe("RETURN");
      const orderRow = await client.query(
        `SELECT "unitDiagnosticState" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(orderRow.rows[0].unitDiagnosticState).toBeNull();
    });
  });

  it("T48 one invalid required MoneyBag rejects the whole snapshot", async () => {
    const gid = "gid://shopify/Order/t48";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t48",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const snapshot = orderSnapshot(gid, {
        originalTotalPriceSet: {
          shopAmount: "not-a-decimal",
          shopCurrencyCode: "USD",
          presentmentAmount: "10.00",
          presentmentCurrencyCode: "USD",
        },
      });
      const result = await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-t48", snapshot, req, resp)],
      });
      expect(result.results[0]?.outcome).toBe("rejected");
      const rows = await client.query(
        `SELECT 1 FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBe(0);
    });
  });

  it("T49 unbalanced refund persists Shopify fields plus diagnostic", async () => {
    const orderGid = "gid://shopify/Order/t49";
    const refundGid = "gid://shopify/Refund/t49";
    await withTenant(async (client, db) => {
      const reqO = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t49o",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: orderGid,
        requestGen: reqO,
      });
      const respO = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t49o",
            orderSnapshot(orderGid),
            reqO,
            respO,
          ),
        ],
      });
      const reqR = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t49r",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: reqR,
      });
      const respR = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-t49r",
            observationRequestGen: reqR,
            observationResponseGen: respR,
            identity: {
              shopId: shopAId,
              resourceKind: "Refund",
              shopifyGid: refundGid,
            },
            existenceKind: "LIVE_REFETCH",
            existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
            sourceKind: "INCREMENTAL_REFETCH",
            accessScopeSnapshot: ["read_orders"],
            snapshotComplete: true,
            refund: refundSnapshot(refundGid, orderGid, {
              totalRefundedSet: bag("99.00"),
            }),
          },
        ],
      });
      const row = await client.query(
        `SELECT "moneyDiagnosticState", "totalRefundedShopAmount"::text AS amt
           FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(row.rows[0].moneyDiagnosticState).toBe("REFUND_MONEY_UNBALANCED");
      expect(String(row.rows[0].amt)).toContain("99");
    });
  });

  it("T50 scope downgrade voids absence", async () => {
    const gid = "gid://shopify/Order/t50";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t50a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req1,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(shopAId, "obs-t50a", orderSnapshot(gid), req1, resp1, {
            accessScopeSnapshot: ["read_orders", "read_all_orders"],
          }),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t50b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-t50b",
            observationRequestGen: req2,
            observationResponseGen: resp2,
            identity: { shopId: shopAId, resourceKind: "Order", shopifyGid: gid },
            existenceKind: "ABSENT_CONFIRMED_QUERY",
            existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
            sourceKind: "INCREMENTAL_REFETCH",
            accessScopeSnapshot: ["read_orders"],
            lastConfirmedAccessScopes: ["read_orders", "read_all_orders"],
            snapshotComplete: true,
            queryCompleted: true,
            queryReturnedNull: true,
          },
        ],
      });
      const row = await client.query(
        `SELECT "existenceState", "existenceKind", "existenceDiagnosticState"
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].existenceState).toBe("LIVE");
      expect(row.rows[0].existenceKind).not.toBe("ABSENT_CONFIRMED_QUERY");
      expect(row.rows[0].existenceDiagnosticState).toBe(
        DIAGNOSTIC.SCOPE_DOWNGRADE,
      );
    });
  });

  it("T36 PENDING refund transaction is stored from the snapshot", async () => {
    const orderGid = "gid://shopify/Order/t36";
    const refundGid = "gid://shopify/Refund/t36";
    await withTenant(async (client, db) => {
      const reqO = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t36o",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: orderGid,
        requestGen: reqO,
      });
      const respO = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t36o",
            orderSnapshot(orderGid),
            reqO,
            respO,
          ),
        ],
      });
      const reqR = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t36r",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: reqR,
      });
      const respR = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-t36r",
            observationRequestGen: reqR,
            observationResponseGen: respR,
            identity: {
              shopId: shopAId,
              resourceKind: "Refund",
              shopifyGid: refundGid,
            },
            existenceKind: "LIVE_REFETCH",
            existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
            sourceKind: "INCREMENTAL_REFETCH",
            accessScopeSnapshot: ["read_orders"],
            snapshotComplete: true,
            refund: refundSnapshot(refundGid, orderGid, {
              transactions: [
                {
                  shopifyGid: `${refundGid}/Txn/pending`,
                  status: "PENDING",
                  kind: "REFUND",
                  shopifyCreatedAt: new Date("2026-08-11T00:00:00.000Z"),
                  processedAt: null,
                  amountSet: bag("10.00"),
                },
              ],
            }),
          },
        ],
      });
      const txn = await client.query(
        `SELECT status FROM "ShopifyOrderRefundTransactionFact" WHERE "shopifyGid" = $1`,
        [`${refundGid}/Txn/pending`],
      );
      expect(txn.rows[0].status).toBe("PENDING");
    });
  });

  it("T57 incomplete nested walk persists SNAPSHOT_PAGINATION_INCOMPLETE and writes no facts", async () => {
    const gid = "gid://shopify/Order/t57";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t57",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const result = await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t57",
            orderSnapshot(gid, { linesComplete: false }),
            req,
            resp,
            { snapshotComplete: false },
          ),
        ],
      });
      expect(result.results[0]?.outcome).toBe("incomplete");
      const facts = await client.query(
        `SELECT 1 FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(facts.rowCount).toBe(0);
      const obs = await client.query(
        `SELECT "terminalOutcome", "lifecycleState"
           FROM "OrderFactObservationInFlight" WHERE id = 'obs-t57'`,
      );
      expect(obs.rows[0].terminalOutcome).toBe("SNAPSHOT_PAGINATION_INCOMPLETE");
      expect(obs.rows[0].lifecycleState).toBe("COMPLETED");
    });
  });

  it("T05 duplicate refund GID is idempotent", async () => {
    const orderGid = "gid://shopify/Order/t05";
    const refundGid = "gid://shopify/Refund/t05";
    await withTenant(async (client, db) => {
      const reqO = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t05o",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: orderGid,
        requestGen: reqO,
      });
      const respO = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t05o",
            orderSnapshot(orderGid),
            reqO,
            respO,
          ),
        ],
      });
      for (const token of ["obs-t05r1", "obs-t05r2"] as const) {
        const req = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: token,
          shopId: shopAId,
          resourceKind: "Refund",
          shopifyGid: refundGid,
          requestGen: req,
        });
        const resp = await allocateCatalogObservationGeneration(db);
        await applyOrderFacts(db, {
          shopId: shopAId,
          observations: [
            {
              observationKind: "direct",
              observationToken: token,
              observationRequestGen: req,
              observationResponseGen: resp,
              identity: {
                shopId: shopAId,
                resourceKind: "Refund",
                shopifyGid: refundGid,
              },
              existenceKind: "LIVE_REFETCH",
              existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
              sourceKind: "INCREMENTAL_REFETCH",
              accessScopeSnapshot: ["read_orders"],
              snapshotComplete: true,
              refund: refundSnapshot(refundGid, orderGid),
            },
          ],
        });
      }
      const count = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(count.rows[0].n).toBe(1);
    });
  });

  it("T58 mixed ORDER+RETURN on one agreement does not set UNIT_SALE_SIGN_INCONSISTENT", async () => {
    const gid = "gid://shopify/Order/t58";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t58",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const snapshot = orderSnapshot(gid, {
        lines: [line(`${gid}/Line/1`, { quantity: 3, currentQuantity: 3 })],
        agreements: [
          {
            shopifyGid: `${gid}/Agreement/mix`,
            happenedAt: new Date("2026-08-02T00:00:00.000Z"),
            agreementTypename: "OrderEditAgreement",
            reason: "ORDER_EDIT",
            refundGid: null,
            salesComplete: true,
            sales: [
              sale({
                shopifyGid: `${gid}/Sale/plus`,
                quantity: 1,
                actionType: "ORDER",
                shopifyLineItemGid: `${gid}/Line/1`,
              }),
              sale({
                shopifyGid: `${gid}/Sale/minus`,
                quantity: -1,
                actionType: "RETURN",
                shopifyLineItemGid: `${gid}/Line/1`,
                totalAmount: bag("-10.00"),
              }),
            ],
          },
        ],
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-t58", snapshot, req, resp)],
      });
      const row = await client.query(
        `SELECT "unitDiagnosticState" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].unitDiagnosticState).not.toBe(
        "UNIT_SALE_SIGN_INCONSISTENT",
      );
    });
  });

  it("T38 raw SQL shopId reassignment is denied", async () => {
    const gid = "gid://shopify/Order/t38";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t38",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(shopAId, "obs-t38", orderSnapshot(gid), req, resp),
        ],
      });
      await expect(
        client.query(
          `UPDATE "ShopifyOrderFact" SET "shopId" = $1 WHERE "shopifyGid" = $2`,
          [shopBId, gid],
        ),
      ).rejects.toThrow();
    });
  });

  it("T23 retry helper restarts a fresh transaction after unique conflict", async () => {
    let attempts = 0;
    const gid = "gid://shopify/Order/t23";
    await expect(
      applyOrderFactsWithRetry(
        async (fn) => {
          attempts += 1;
          const client = await getRuntimeClient();
          try {
            await client.query("BEGIN");
            await setTenant(client, shopAId);
            if (attempts === 1) {
              const err = new Error("unique") as Error & { code: string };
              err.code = "order_apply_unique_conflict";
              throw err;
            }
            const db = asQueryRaw(client);
            const result = await fn(db);
            await client.query("COMMIT");
            return result;
          } catch (error) {
            await client.query("ROLLBACK").catch(() => undefined);
            throw error;
          } finally {
            await client.end();
          }
        },
        { shopId: shopAId, observations: [] },
      ),
    ).resolves.toMatchObject({ results: [] });
    expect(attempts).toBe(2);
    expect(gid).toBeTruthy();
  });

  it("capacity guard rejects oversized identity batches", async () => {
    await withTenant(async (_client, db) => {
      await expect(
        applyOrderFacts(db, {
          shopId: shopAId,
          requestedCanonicalIdentitiesPerTransaction: 1,
          observations: [
            liveOrder(
              shopAId,
              "obs-cap",
              orderSnapshot("gid://shopify/Order/cap1"),
              1n,
              2n,
            ),
            liveOrder(
              shopAId,
              "obs-cap2",
              orderSnapshot("gid://shopify/Order/cap2"),
              3n,
              4n,
            ),
          ],
        }),
      ).rejects.toBeInstanceOf(OrderApplyBatchExceedsCapacityError);
    });
  });

  it("does not physically delete canonical facts on ordinary apply", async () => {
    const gid = "gid://shopify/Order/t-del";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-del",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(shopAId, "obs-del", orderSnapshot(gid), req, resp),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-del2",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-del2",
            observationRequestGen: req2,
            observationResponseGen: resp2,
            identity: { shopId: shopAId, resourceKind: "Order", shopifyGid: gid },
            existenceKind: "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
            existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
            sourceKind: "DELETE_WEBHOOK",
            accessScopeSnapshot: ["read_orders"],
            snapshotComplete: true,
          },
        ],
      });
      const rows = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rows[0].n).toBe(1);
    });
  });

  it("T10 newer refetch after a first snapshot applies", async () => {
    const gid = "gid://shopify/Order/t10";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t10a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req1,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t10a",
            orderSnapshot(gid, {
              shopifyUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
              name: "#OLD",
            }),
            req1,
            resp1,
          ),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t10b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t10b",
            orderSnapshot(gid, {
              shopifyUpdatedAt: new Date("2026-08-20T00:00:00.000Z"),
              name: "#NEW",
            }),
            req2,
            resp2,
          ),
        ],
      });
      const row = await client.query(
        `SELECT name FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].name).toBe("#NEW");
    });
  });

  it("T12 historical variantGidAtSale is not replaced by a later SKU-matched GID", async () => {
    const gid = "gid://shopify/Order/t12";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t12a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req1,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-t12a", orderSnapshot(gid), req1, resp1)],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t12b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t12b",
            orderSnapshot(gid, {
              lines: [
                line(`${gid}/Line/1`, {
                  sku: "SKU-1",
                  variantGidAtSale: "gid://shopify/ProductVariant/recreated",
                  currentVariantGid: "gid://shopify/ProductVariant/recreated",
                }),
              ],
            }),
            req2,
            resp2,
          ),
        ],
      });
      const row = await client.query(
        `SELECT "variantGidAtSale", "currentVariantGid"
           FROM "ShopifyOrderLineFact" WHERE "shopifyOrderGid" = $1`,
        [gid],
      );
      expect(row.rows[0].variantGidAtSale).toBe(
        "gid://shopify/ProductVariant/1",
      );
      expect(row.rows[0].currentVariantGid).toBe(
        "gid://shopify/ProductVariant/recreated",
      );
    });
  });

  it("T13 cancelled snapshot before a later create-like refetch does not require a create state machine", async () => {
    const gid = "gid://shopify/Order/t13";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t13a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req1,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t13a",
            orderSnapshot(gid, {
              shopifyUpdatedAt: new Date("2026-08-02T00:00:00.000Z"),
              cancelledAt: new Date("2026-08-02T00:00:00.000Z"),
              cancelReason: "CUSTOMER",
            }),
            req1,
            resp1,
          ),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t13b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t13b",
            orderSnapshot(gid, {
              shopifyUpdatedAt: new Date("2026-08-10T00:00:00.000Z"),
              cancelledAt: null,
              cancelReason: null,
            }),
            req2,
            resp2,
          ),
        ],
      });
      const row = await client.query(
        `SELECT "cancelledAt", "cancelReason" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].cancelledAt).toBeNull();
    });
  });

  it("T16 zero-price line quantity 2 is kept", async () => {
    const gid = "gid://shopify/Order/t16";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t16",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t16",
            orderSnapshot(gid, {
              originalTotalPriceSet: bag("0.00"),
              currentTotalPriceSet: bag("0.00"),
              currentSubtotalPriceSet: bag("0.00"),
              netPaymentSet: bag("0.00"),
              lines: [
                line(`${gid}/Line/1`, {
                  quantity: 2,
                  currentQuantity: 2,
                  originalTotalSet: bag("0.00"),
                  originalUnitPriceSet: bag("0.00"),
                  discountedTotalSet: bag("0.00"),
                }),
              ],
            }),
            req,
            resp,
          ),
        ],
      });
      const row = await client.query(
        `SELECT quantity, "originalTotalShopAmount"::text AS amt
           FROM "ShopifyOrderLineFact" WHERE "shopifyOrderGid" = $1`,
        [gid],
      );
      expect(row.rows[0].quantity).toBe(2);
      expect(String(row.rows[0].amt)).toMatch(/0/);
    });
  });

  it("T17 persists test=true", async () => {
    const gid = "gid://shopify/Order/t17";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t17",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t17",
            orderSnapshot(gid, { test: true }),
            req,
            resp,
          ),
        ],
      });
      const row = await client.query(
        `SELECT test, "orderTest" FROM "ShopifyOrderFact" o
           JOIN "ShopifyOrderLineFact" l ON l."shopifyOrderGid" = o."shopifyGid"
          WHERE o."shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].test).toBe(true);
      expect(row.rows[0].orderTest).toBe(true);
    });
  });

  it("T18 persists a gift-card line without dropping it", async () => {
    const gid = "gid://shopify/Order/t18";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t18",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t18",
            orderSnapshot(gid, {
              lines: [line(`${gid}/Line/1`, { isGiftCard: true })],
            }),
            req,
            resp,
          ),
        ],
      });
      const row = await client.query(
        `SELECT "isGiftCard" FROM "ShopifyOrderLineFact" WHERE "shopifyOrderGid" = $1`,
        [gid],
      );
      expect(row.rows[0].isGiftCard).toBe(true);
    });
  });

  it("T27 stores presentment EUR beside shop USD with no FX conversion", async () => {
    const gid = "gid://shopify/Order/t27";
    const dual = {
      shopAmount: "20.00",
      shopCurrencyCode: "USD",
      presentmentAmount: "18.50",
      presentmentCurrencyCode: "EUR",
    };
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t27",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t27",
            orderSnapshot(gid, {
              shopCurrencyCode: "USD",
              presentmentCurrencyCode: "EUR",
              originalTotalPriceSet: dual,
              currentTotalPriceSet: dual,
              currentSubtotalPriceSet: dual,
              currentTotalDiscountsSet: {
                shopAmount: "0.00",
                shopCurrencyCode: "USD",
                presentmentAmount: "0.00",
                presentmentCurrencyCode: "EUR",
              },
              currentTotalTaxSet: {
                shopAmount: "0.00",
                shopCurrencyCode: "USD",
                presentmentAmount: "0.00",
                presentmentCurrencyCode: "EUR",
              },
              totalRefundedSet: {
                shopAmount: "0.00",
                shopCurrencyCode: "USD",
                presentmentAmount: "0.00",
                presentmentCurrencyCode: "EUR",
              },
              netPaymentSet: dual,
              lines: [
                line(`${gid}/Line/1`, {
                  originalTotalSet: dual,
                  originalUnitPriceSet: dual,
                  discountedTotalSet: dual,
                  totalDiscountSet: {
                    shopAmount: "0.00",
                    shopCurrencyCode: "USD",
                    presentmentAmount: "0.00",
                    presentmentCurrencyCode: "EUR",
                  },
                }),
              ],
            }),
            req,
            resp,
          ),
        ],
      });
      const row = await client.query(
        `SELECT "originalTotalShopAmount"::text AS shop,
                "originalTotalPresentmentAmount"::text AS presentment,
                "originalTotalPresentmentCurrencyCode" AS ccy
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(String(row.rows[0].shop)).toMatch(/20/);
      expect(String(row.rows[0].presentment)).toMatch(/18\.5/);
      expect(row.rows[0].ccy).toBe("EUR");
    });
  });

  it("T25 overlapping LIVE vs ABSENT records conflict and does not last-writer-wins tombstone", async () => {
    const gid = "gid://shopify/Order/t25";
    await withTenant(async (client, db) => {
      const g1 = await allocateCatalogObservationGeneration(db);
      const g2 = await allocateCatalogObservationGeneration(db);
      const g3 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t25a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: g1,
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-t25a", orderSnapshot(gid), g1, g3)],
      });
      const g4 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t25b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: g2,
      });
      const result = await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-t25b",
            observationRequestGen: g2,
            observationResponseGen: g4,
            identity: { shopId: shopAId, resourceKind: "Order", shopifyGid: gid },
            existenceKind: "ABSENT_CONFIRMED_QUERY",
            existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
            sourceKind: "INCREMENTAL_REFETCH",
            accessScopeSnapshot: ["read_orders"],
            lastConfirmedAccessScopes: ["read_orders"],
            snapshotComplete: true,
            queryCompleted: true,
            queryReturnedNull: true,
          },
        ],
      });
      expect(result.results[0]?.outcome).toBe("conflict");
      const row = await client.query(
        `SELECT "existenceState", "existenceKind" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].existenceState).toBe("LIVE");
      expect(row.rows[0].existenceKind).toBe("LIVE_REFETCH");
    });
  });

  it("T54 injected contradictory identity sets LINE_UNIT_IDENTITY_INCONSISTENT", async () => {
    const gid = "gid://shopify/Order/t54";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t54",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t54",
            orderSnapshot(gid, {
              lines: [line(`${gid}/Line/1`, { quantity: 5, currentQuantity: 3 })],
              agreements: [
                {
                  shopifyGid: `${gid}/Agreement/ret`,
                  happenedAt: new Date("2026-08-11T00:00:00.000Z"),
                  agreementTypename: "RefundAgreement",
                  reason: "RETURN",
                  refundGid: null,
                  salesComplete: true,
                  sales: [
                    sale({
                      shopifyGid: `${gid}/Sale/ret`,
                      quantity: -3,
                      actionType: "RETURN",
                      shopifyLineItemGid: `${gid}/Line/1`,
                      totalAmount: bag("-10.00"),
                    }),
                  ],
                },
              ],
            }),
            req,
            resp,
          ),
        ],
      });
      const row = await client.query(
        `SELECT "unitDiagnosticState" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].unitDiagnosticState).toBe(
        "LINE_UNIT_IDENTITY_INCONSISTENT",
      );
    });
  });

  it("T55 stores RETURN quantity -2 and does not emit a sign diagnostic", async () => {
    const gid = "gid://shopify/Order/t55";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t55",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t55",
            orderSnapshot(gid, {
              lines: [line(`${gid}/Line/1`, { quantity: 2, currentQuantity: 0 })],
              agreements: [
                {
                  shopifyGid: `${gid}/Agreement/ret`,
                  happenedAt: new Date("2026-08-11T00:00:00.000Z"),
                  agreementTypename: "RefundAgreement",
                  reason: "RETURN",
                  refundGid: null,
                  salesComplete: true,
                  sales: [
                    sale({
                      shopifyGid: `${gid}/Sale/ret`,
                      quantity: -2,
                      actionType: "RETURN",
                      shopifyLineItemGid: `${gid}/Line/1`,
                      totalAmount: bag("-20.70"),
                    }),
                  ],
                },
              ],
            }),
            req,
            resp,
          ),
        ],
      });
      const saleRow = await client.query(
        `SELECT quantity FROM "ShopifyOrderAgreementSaleFact" WHERE "shopifyGid" = $1`,
        [`${gid}/Sale/ret`],
      );
      expect(saleRow.rows[0].quantity).toBe(-2);
      const orderRow = await client.query(
        `SELECT "unitDiagnosticState" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(orderRow.rows[0].unitDiagnosticState).toBeNull();
    });
  });

  it("T06 two RETURN sales accumulate refunded units without double-counting refund lines", async () => {
    const gid = "gid://shopify/Order/t06";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t06",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t06",
            orderSnapshot(gid, {
              lines: [line(`${gid}/Line/1`, { quantity: 3, currentQuantity: 1 })],
              agreements: [
                {
                  shopifyGid: `${gid}/Agreement/r1`,
                  happenedAt: new Date("2026-08-11T00:00:00.000Z"),
                  agreementTypename: "RefundAgreement",
                  reason: "REFUND",
                  refundGid: `${gid}/Refund/1`,
                  salesComplete: true,
                  sales: [
                    sale({
                      shopifyGid: `${gid}/Sale/r1`,
                      quantity: -1,
                      actionType: "RETURN",
                      shopifyLineItemGid: `${gid}/Line/1`,
                      totalAmount: bag("-10.00"),
                    }),
                  ],
                },
                {
                  shopifyGid: `${gid}/Agreement/r2`,
                  happenedAt: new Date("2026-08-12T00:00:00.000Z"),
                  agreementTypename: "RefundAgreement",
                  reason: "REFUND",
                  refundGid: `${gid}/Refund/2`,
                  salesComplete: true,
                  sales: [
                    sale({
                      shopifyGid: `${gid}/Sale/r2`,
                      quantity: -1,
                      actionType: "RETURN",
                      shopifyLineItemGid: `${gid}/Line/1`,
                      totalAmount: bag("-10.00"),
                    }),
                  ],
                },
              ],
            }),
            req,
            resp,
          ),
        ],
      });
      const sales = await client.query(
        `SELECT quantity FROM "ShopifyOrderAgreementSaleFact"
          WHERE "shopifyOrderGid" = $1 AND "actionType" = 'RETURN'`,
        [gid],
      );
      expect(sales.rowCount).toBe(2);
      const diag = await client.query(
        `SELECT "unitDiagnosticState" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(diag.rows[0].unitDiagnosticState).toBeNull();
    });
  });

  it("T08 cancel then refund persists both without coercing a double subtract", async () => {
    const gid = "gid://shopify/Order/t08";
    const refundGid = "gid://shopify/Refund/t08";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t08o",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t08o",
            orderSnapshot(gid, {
              cancelledAt: new Date("2026-08-12T00:00:00.000Z"),
              cancelReason: "CUSTOMER",
            }),
            req,
            resp,
          ),
        ],
      });
      const reqR = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t08r",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: reqR,
      });
      const respR = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          refundObservation(
            shopAId,
            "obs-t08r",
            refundSnapshot(refundGid, gid),
            reqR,
            respR,
          ),
        ],
      });
      const order = await client.query(
        `SELECT "cancelledAt" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(order.rows[0].cancelledAt).not.toBeNull();
      const refund = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(refund.rows[0].n).toBe(1);
    });
  });

  it("applies a complete refund snapshot without a local Order row", async () => {
    const orderGid = "gid://shopify/Order/orphan";
    const refundGid = "gid://shopify/Refund/orphan";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-orphan-r",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          refundObservation(
            shopAId,
            "obs-orphan-r",
            refundSnapshot(refundGid, orderGid),
            req,
            resp,
          ),
        ],
      });
      const orders = await client.query(
        `SELECT 1 FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [orderGid],
      );
      expect(orders.rowCount).toBe(0);
      const refund = await client.query(
        `SELECT "shopifyOrderGid" FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(refund.rows[0].shopifyOrderGid).toBe(orderGid);
    });
  });

  it("does not apply nested refunds from a stale order; an independent newer refund still applies", async () => {
    const gid = "gid://shopify/Order/clock-refund";
    const refundGid = "gid://shopify/Refund/clock-refund";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-cr-a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req1,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-cr-a",
            orderSnapshot(gid, {
              shopifyUpdatedAt: new Date("2026-08-20T00:00:00.000Z"),
              name: "#LIVE",
            }),
            req1,
            resp1,
          ),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-cr-b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-cr-b",
            orderSnapshot(gid, {
              shopifyUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
              name: "#STALE",
            }),
            req2,
            resp2,
            {
              nestedRefunds: [
                refundSnapshot(refundGid, gid, {
                  shopifyUpdatedAt: new Date("2026-08-21T00:00:00.000Z"),
                }),
              ],
            },
          ),
        ],
      });
      const order = await client.query(
        `SELECT name FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(order.rows[0].name).toBe("#LIVE");
      const refund = await client.query(
        `SELECT 1 FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(refund.rowCount).toBe(1);
    });
  });

  it("terminal revival requires two independent non-overlapping LIVE confirmations", async () => {
    const gid = "gid://shopify/Order/revival";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rev-a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req1,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      const created = new Date("2026-08-01T00:00:00.000Z");
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-rev-a",
            orderSnapshot(gid, { shopifyCreatedAt: created, name: "#ORIG" }),
            req1,
            resp1,
          ),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rev-b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-rev-b",
            observationRequestGen: req2,
            observationResponseGen: resp2,
            identity: { shopId: shopAId, resourceKind: "Order", shopifyGid: gid },
            existenceKind: "ABSENT_CONFIRMED_QUERY",
            existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
            sourceKind: "INCREMENTAL_REFETCH",
            accessScopeSnapshot: ["read_orders"],
            lastConfirmedAccessScopes: ["read_orders"],
            snapshotComplete: true,
            queryCompleted: true,
            queryReturnedNull: true,
          },
        ],
      });
      const req3 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rev-c",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req3,
      });
      const resp3 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-rev-c",
            orderSnapshot(gid, {
              shopifyCreatedAt: created,
              name: "#FIRST",
            }),
            req3,
            resp3,
          ),
        ],
      });
      const mid = await client.query(
        `SELECT "existenceState", "existenceKind", "existenceDiagnosticState", name
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(mid.rows[0].existenceState).toBe("ABSENT");
      expect(mid.rows[0].existenceKind).toBe("ABSENT_CONFIRMED_QUERY");
      expect(mid.rows[0].existenceDiagnosticState).toBe(
        encodeRevivalConfirmation({ requestGen: req3, responseGen: resp3 }),
      );
      expect(mid.rows[0].name).toBe("#ORIG");
      const req4 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rev-d",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req4,
      });
      const resp4 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-rev-d",
            orderSnapshot(gid, {
              shopifyCreatedAt: created,
              name: "#REVIVED",
            }),
            req4,
            resp4,
          ),
        ],
      });
      const fin = await client.query(
        `SELECT "existenceState", "existenceKind", name, "deletedAt"
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(fin.rows[0].existenceState).toBe("LIVE");
      expect(fin.rows[0].existenceKind).toBe("LIVE_REFETCH");
      expect(fin.rows[0].name).toBe("#REVIVED");
      expect(fin.rows[0].deletedAt).toBeNull();
    });
  });

  it("T56 two complete refund snapshots both persist", async () => {
    const orderGid = "gid://shopify/Order/t56";
    await withTenant(async (client, db) => {
      const reqO = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t56o",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: orderGid,
        requestGen: reqO,
      });
      const respO = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(shopAId, "obs-t56o", orderSnapshot(orderGid), reqO, respO),
        ],
      });
      for (const suffix of ["a", "b"] as const) {
        const refundGid = `gid://shopify/Refund/t56${suffix}`;
        const req = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: `obs-t56${suffix}`,
          shopId: shopAId,
          resourceKind: "Refund",
          shopifyGid: refundGid,
          requestGen: req,
        });
        const resp = await allocateCatalogObservationGeneration(db);
        await applyOrderFacts(db, {
          shopId: shopAId,
          observations: [
            refundObservation(
              shopAId,
              `obs-t56${suffix}`,
              refundSnapshot(refundGid, orderGid),
              req,
              resp,
            ),
          ],
        });
      }
      const count = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderRefundFact"
          WHERE "shopifyOrderGid" = $1`,
        [orderGid],
      );
      expect(count.rows[0].n).toBe(2);
    });
  });

  it("full-sync omission nominates in-window LIVE facts as CANDIDATE and does not tombstone", async () => {
    const gid = "gid://shopify/Order/nom";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-nom-a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-nom-a", orderSnapshot(gid), req, resp)],
      });
      const fence = await allocateCatalogObservationGeneration(db);
      const observation: FullSyncOrderObservation = {
        observationKind: "full_sync",
        fenceGeneration: fence,
        epochId: "epoch-nom",
        identity: { shopId: shopAId, resourceKind: "Order", shopifyGid: gid },
        existenceKind: "LIVE_FULL_SYNC_PRESENT",
        existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
        sourceKind: "FULL_SYNC",
        accessScopeSnapshot: ["read_orders"],
        snapshotComplete: true,
        order: orderSnapshot(gid),
        nominateAbsence: true,
      };
      await applyOrderFacts(db, { shopId: shopAId, observations: [observation] });
      const row = await client.query(
        `SELECT "existenceState", "absenceNominationState"
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].existenceState).toBe("LIVE");
      expect(row.rows[0].absenceNominationState).toBe("CANDIDATE");
    });
  });

  it("fails closed when Shop processingEnabled is false", async () => {
    const gid = "gid://shopify/Order/kill";
    await prisma.shop.update({
      where: { id: shopAId },
      data: { processingEnabled: false },
    });
    try {
      await withTenant(async (client, db) => {
        const req = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: "obs-kill",
          shopId: shopAId,
          resourceKind: "Order",
          shopifyGid: gid,
          requestGen: req,
        });
        const resp = await allocateCatalogObservationGeneration(db);
        await expect(
          applyOrderFacts(db, {
            shopId: shopAId,
            observations: [liveOrder(shopAId, "obs-kill", orderSnapshot(gid), req, resp)],
          }),
        ).rejects.toBeInstanceOf(OrderApplyProcessingDisabledError);
      });
    } finally {
      await prisma.shop.update({
        where: { id: shopAId },
        data: { processingEnabled: true },
      });
    }
  });

  it("T07 edit agreement then refund persists both and keeps one unit ledger", async () => {
    const gid = "gid://shopify/Order/t07";
    const refundGid = "gid://shopify/Refund/t07";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t07o",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t07o",
            orderSnapshot(gid, {
              edited: true,
              lines: [line(`${gid}/Line/1`, { quantity: 5, currentQuantity: 4 })],
              agreements: [
                {
                  shopifyGid: `${gid}/Agreement/order`,
                  happenedAt: new Date("2026-08-01T00:00:00.000Z"),
                  agreementTypename: "OrderAgreement",
                  reason: "ORDER",
                  refundGid: null,
                  salesComplete: true,
                  sales: [
                    sale({
                      shopifyGid: `${gid}/Sale/order`,
                      quantity: 5,
                      shopifyLineItemGid: `${gid}/Line/1`,
                    }),
                  ],
                },
                {
                  shopifyGid: `${gid}/Agreement/edit`,
                  happenedAt: new Date("2026-08-08T00:00:00.000Z"),
                  agreementTypename: "OrderEditAgreement",
                  reason: "ORDER_EDIT",
                  refundGid: null,
                  salesComplete: true,
                  sales: [
                    sale({
                      shopifyGid: `${gid}/Sale/edit`,
                      quantity: -1,
                      actionType: "RETURN",
                      shopifyLineItemGid: `${gid}/Line/1`,
                      totalAmount: bag("-10.00"),
                    }),
                  ],
                },
              ],
            }),
            req,
            resp,
          ),
        ],
      });
      const reqR = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t07r",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: reqR,
      });
      const respR = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          refundObservation(
            shopAId,
            "obs-t07r",
            refundSnapshot(refundGid, gid),
            reqR,
            respR,
          ),
        ],
      });
      const agreements = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderAgreementFact" WHERE "shopifyOrderGid" = $1`,
        [gid],
      );
      expect(agreements.rows[0].n).toBe(2);
      const refunds = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(refunds.rows[0].n).toBe(1);
      const sales = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderAgreementSaleFact" WHERE "shopifyOrderGid" = $1`,
        [gid],
      );
      expect(sales.rows[0].n).toBe(2);
    });
  });

  it("T31 an earlier ACTIVE fence blocks a later overlapping direct apply", async () => {
    const gid = "gid://shopify/Order/t31";
    await withTenant(async (client, db) => {
      const blockerReq = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t31-block",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: blockerReq,
      });
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t31",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const result = await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-t31", orderSnapshot(gid), req, resp)],
      });
      expect(result.results[0]?.outcome).toBe("blocked");
      const rows = await client.query(
        `SELECT 1 FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBe(0);
    });
  });

  it("T34 aged-out LIVE facts are excluded from full-sync absence nomination", async () => {
    const gid = "gid://shopify/Order/t34";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t34a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-t34a",
            orderSnapshot(gid, {
              processedAt: new Date("2026-01-01T00:00:00.000Z"),
              processedAtShopify: "2026-01-01T00:00:00Z",
              shopifyCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
            }),
            req,
            resp,
          ),
        ],
      });
      const fence = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "full_sync",
            fenceGeneration: fence,
            epochId: "epoch-t34",
            identity: { shopId: shopAId, resourceKind: "Order", shopifyGid: gid },
            existenceKind: "LIVE_FULL_SYNC_PRESENT",
            existenceObservedAt: new Date("2026-09-11T00:00:00.000Z"),
            sourceKind: "FULL_SYNC",
            accessScopeSnapshot: ["read_orders"],
            snapshotComplete: true,
            order: orderSnapshot(gid),
            nominateAbsence: true,
          },
        ],
      });
      const row = await client.query(
        `SELECT "existenceState", "absenceNominationState", "deletedAt"
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].existenceState).toBe("LIVE");
      expect(row.rows[0].deletedAt).toBeNull();
      expect(row.rows[0].absenceNominationState).toBe("NONE");
    });
  });

  it("first-insert ABSENT_CONFIRMED_QUERY writes no order row", async () => {
    const gid = "gid://shopify/Order/absent-first";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-absent-first",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const result = await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-absent-first",
            observationRequestGen: req,
            observationResponseGen: resp,
            identity: { shopId: shopAId, resourceKind: "Order", shopifyGid: gid },
            existenceKind: "ABSENT_CONFIRMED_QUERY",
            existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
            sourceKind: "INCREMENTAL_REFETCH",
            accessScopeSnapshot: ["read_orders"],
            lastConfirmedAccessScopes: ["read_orders"],
            snapshotComplete: true,
            queryCompleted: true,
            queryReturnedNull: true,
            processedAt: new Date("2026-08-01T00:00:00.000Z"),
          },
        ],
      });
      expect(result.results[0]?.existenceMutated).toBe(false);
      const rows = await client.query(
        `SELECT 1 FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBe(0);
    });
  });

  it("T48 invalid line money bag writes no order row", async () => {
    const gid = "gid://shopify/Order/t48-line";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-t48-line",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const snapshot = orderSnapshot(gid, {
        lines: [
          line(`${gid}/Line/1`, {
            originalTotalSet: {
              shopAmount: "bad",
              shopCurrencyCode: "USD",
              presentmentAmount: "10.00",
              presentmentCurrencyCode: "USD",
            },
          }),
        ],
      });
      const result = await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-t48-line", snapshot, req, resp)],
      });
      expect(result.results[0]?.outcome).toBe("rejected");
      const rows = await client.query(
        `SELECT 1 FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBe(0);
    });
  });
});
