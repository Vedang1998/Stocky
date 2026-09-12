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
  OrderApplyAccessScopeMismatchError,
  OrderApplyBatchExceedsCapacityError,
  OrderApplyClientShopDeniedError,
  OrderApplyPhysicalDeleteError,
  OrderApplyProcessingDisabledError,
  OrderApplyReceiptDigestConflictError,
  OrderApplyReceiptNotCertifiableError,
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
  extras: Partial<DirectOrderObservation> = {},
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
    ...extras,
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

  async function seedLiveRefund(
    client: Client,
    db: OrderApplyDb,
    orderGid: string,
    refund: RefundSnapshot,
    tokenPrefix: string,
  ): Promise<void> {
    const reqO = await allocateCatalogObservationGeneration(db);
    await insertObservation(client, {
      id: `${tokenPrefix}-o`,
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
          `${tokenPrefix}-o`,
          orderSnapshot(orderGid),
          reqO,
          respO,
          { nestedRefunds: [refund] },
        ),
      ],
    });
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
    const seenByA = await withTenant(async (client) => {
      const row = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      return row.rows[0].n as number;
    }, shopAId);
    const seenByB = await withTenant(async (client) => {
      const row = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      return row.rows[0].n as number;
    }, shopBId);
    expect(seenByA).toBe(1);
    expect(seenByB).toBe(1);
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
        scopes: ["read_orders", "read_all_orders"],
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
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-kill",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      await prisma.shop.update({
        where: { id: shopAId },
        data: { processingEnabled: false },
      });
      try {
        const resp = await allocateCatalogObservationGeneration(db);
        await expect(
          applyOrderFacts(db, {
            shopId: shopAId,
            observations: [liveOrder(shopAId, "obs-kill", orderSnapshot(gid), req, resp)],
          }),
        ).rejects.toBeInstanceOf(OrderApplyProcessingDisabledError);
        const rows = await client.query(
          `SELECT 1 FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
          [gid],
        );
        expect(rows.rowCount).toBe(0);
      } finally {
        await prisma.shop.update({
          where: { id: shopAId },
          data: { processingEnabled: true },
        });
      }
    });
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

  it("F-01 confirmed-absent Refund is tombstoned on ShopifyOrderRefundFact", async () => {
    const orderGid = "gid://shopify/Order/f01-tombstone";
    const refundGid = "gid://shopify/Refund/f01-tombstone";
    await withTenant(async (client, db) => {
      await seedLiveRefund(
        client,
        db,
        orderGid,
        refundSnapshot(refundGid, orderGid),
        "obs-f01t",
      );
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f01t-r",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const result = await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          refundObservation(
            shopAId,
            "obs-f01t-r",
            refundSnapshot(refundGid, orderGid),
            req,
            resp,
            {
              existenceKind: "ABSENT_CONFIRMED_QUERY",
              queryCompleted: true,
              queryReturnedNull: true,
              lastConfirmedAccessScopes: ["read_orders"],
              refund: undefined,
            },
          ),
        ],
      });
      expect(result.results[0]?.existenceMutated).toBe(true);
      const row = await client.query(
        `SELECT "existenceState", "existenceKind", "deletedAt", "deletionSource"
           FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(row.rows[0].existenceState).toBe("ABSENT");
      expect(row.rows[0].existenceKind).toBe("ABSENT_CONFIRMED_QUERY");
      expect(row.rows[0].deletedAt).not.toBeNull();
      expect(row.rows[0].deletionSource).toBe("CONFIRMED_QUERY");
    });
  });

  it("F-01 first-insert ABSENT Refund writes no row", async () => {
    const refundGid = "gid://shopify/Refund/f01-absent-first";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f01af",
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
            "obs-f01af",
            refundSnapshot(refundGid, "gid://shopify/Order/f01-absent-first"),
            req,
            resp,
            {
              existenceKind: "ABSENT_CONFIRMED_QUERY",
              queryCompleted: true,
              queryReturnedNull: true,
              refund: undefined,
            },
          ),
        ],
      });
      const rows = await client.query(
        `SELECT 1 FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(rows.rowCount).toBe(0);
    });
  });

  it("F-01 unverified delete tombstones a Refund with WEBHOOK source", async () => {
    const orderGid = "gid://shopify/Order/f01-unverified";
    const refundGid = "gid://shopify/Refund/f01-unverified";
    await withTenant(async (client, db) => {
      await seedLiveRefund(
        client,
        db,
        orderGid,
        refundSnapshot(refundGid, orderGid),
        "obs-f01u",
      );
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f01u-r",
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
            "obs-f01u-r",
            refundSnapshot(refundGid, orderGid),
            req,
            resp,
            {
              existenceKind: "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
              refund: undefined,
            },
          ),
        ],
      });
      const row = await client.query(
        `SELECT "existenceState", "existenceKind", "deletionSource", "deletedAt"
           FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(row.rows[0].existenceState).toBe("ABSENT");
      expect(row.rows[0].existenceKind).toBe(
        "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
      );
      expect(row.rows[0].deletionSource).toBe("WEBHOOK");
      expect(row.rows[0].deletedAt).not.toBeNull();
    });
  });

  it("F-01 Refund inaccessible diagnostics land on the refund row", async () => {
    const orderGid = "gid://shopify/Order/f01-inacc";
    const refundGid = "gid://shopify/Refund/f01-inacc";
    await withTenant(async (client, db) => {
      await seedLiveRefund(
        client,
        db,
        orderGid,
        refundSnapshot(refundGid, orderGid),
        "obs-f01i",
      );
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f01i-r",
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
            "obs-f01i-r",
            refundSnapshot(refundGid, orderGid),
            req,
            resp,
            {
              existenceKind: "INACCESSIBLE_HISTORY_WINDOW",
              refund: undefined,
            },
          ),
        ],
      });
      const row = await client.query(
        `SELECT "existenceState", "existenceKind", "existenceDiagnosticState",
                "historyWindowState", "deletedAt"
           FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(row.rows[0].existenceState).toBe("LIVE");
      expect(row.rows[0].existenceKind).toBe("INACCESSIBLE_HISTORY_WINDOW");
      expect(row.rows[0].existenceDiagnosticState).toBe(
        DIAGNOSTIC.EXISTENCE_UNVERIFIABLE,
      );
      expect(row.rows[0].historyWindowState).toBe(DIAGNOSTIC.WINDOW_TRUNCATED);
      expect(row.rows[0].deletedAt).toBeNull();
    });
  });

  it("F-01 first LIVE after Refund tombstone does not revive (bypass)", async () => {
    const orderGid = "gid://shopify/Order/f01-revival";
    const refundGid = "gid://shopify/Refund/f01-revival";
    await withTenant(async (client, db) => {
      await seedLiveRefund(
        client,
        db,
        orderGid,
        refundSnapshot(refundGid, orderGid),
        "obs-f01v",
      );
      const reqAbs = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f01v-abs",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: reqAbs,
      });
      const respAbs = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          refundObservation(
            shopAId,
            "obs-f01v-abs",
            refundSnapshot(refundGid, orderGid),
            reqAbs,
            respAbs,
            {
              existenceKind: "ABSENT_CONFIRMED_QUERY",
              queryCompleted: true,
              queryReturnedNull: true,
              lastConfirmedAccessScopes: ["read_orders"],
              refund: undefined,
            },
          ),
        ],
      });
      const reqLive = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f01v-live",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: reqLive,
      });
      const respLive = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          refundObservation(
            shopAId,
            "obs-f01v-live",
            refundSnapshot(refundGid, orderGid),
            reqLive,
            respLive,
          ),
        ],
      });
      const row = await client.query(
        `SELECT "existenceState", "existenceKind" FROM "ShopifyOrderRefundFact"
          WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(row.rows[0].existenceState).toBe("ABSENT");
      expect(row.rows[0].existenceKind).toBe("ABSENT_CONFIRMED_QUERY");
    });
  });

  it("F-02 later LIVE advances the stored interval so delayed ABSENT cannot tombstone", async () => {
    const gid = "gid://shopify/Order/f02-advance";
    await withTenant(async (client, db) => {
      const g1 = await allocateCatalogObservationGeneration(db);
      const g2 = await allocateCatalogObservationGeneration(db);
      const g5 = await allocateCatalogObservationGeneration(db);
      const g6 = await allocateCatalogObservationGeneration(db);
      const g9 = await allocateCatalogObservationGeneration(db);
      const g10 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f02a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: g1,
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-f02a", orderSnapshot(gid), g1, g2)],
      });
      await insertObservation(client, {
        id: "obs-f02b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: g9,
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(shopAId, "obs-f02b", orderSnapshot(gid), g9, g10),
        ],
      });
      const afterLive = await client.query(
        `SELECT "existenceRequestGen"::text AS req, "existenceResponseGen"::text AS resp
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(afterLive.rows[0].req).toBe(g9.toString());
      expect(afterLive.rows[0].resp).toBe(g10.toString());
      await insertObservation(client, {
        id: "obs-f02c",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: g5,
      });
      const absent = await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-f02c",
            observationRequestGen: g5,
            observationResponseGen: g6,
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
      expect(absent.results[0]?.outcome).not.toBe("applied");
      const row = await client.query(
        `SELECT "existenceState", "existenceKind", "existenceRequestGen"::text AS req
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].existenceState).toBe("LIVE");
      expect(row.rows[0].existenceKind).toBe("LIVE_REFETCH");
      expect(row.rows[0].req).toBe(g9.toString());
    });
  });

  it("F-02 older LIVE does not rewind a newer stored interval", async () => {
    const gid = "gid://shopify/Order/f02-norewind";
    await withTenant(async (client, db) => {
      const g1 = await allocateCatalogObservationGeneration(db);
      const g2 = await allocateCatalogObservationGeneration(db);
      const g9 = await allocateCatalogObservationGeneration(db);
      const g10 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f02n-a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: g9,
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(shopAId, "obs-f02n-a", orderSnapshot(gid), g9, g10),
        ],
      });
      await insertObservation(client, {
        id: "obs-f02n-b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: g1,
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(shopAId, "obs-f02n-b", orderSnapshot(gid), g1, g2),
        ],
      });
      const row = await client.query(
        `SELECT "existenceRequestGen"::text AS req, "existenceResponseGen"::text AS resp
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].req).toBe(g9.toString());
      expect(row.rows[0].resp).toBe(g10.toString());
    });
  });

  it("F-03 active blocker on Refund writes no subtree and reports blocked", async () => {
    const refundGid = "gid://shopify/Refund/f03-block";
    const orderGid = "gid://shopify/Order/f03-block";
    await withTenant(async (client, db) => {
      const blockerReq = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f03-block",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: blockerReq,
      });
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f03",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const result = await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          refundObservation(
            shopAId,
            "obs-f03",
            refundSnapshot(refundGid, orderGid),
            req,
            resp,
          ),
        ],
      });
      expect(result.results[0]?.outcome).toBe("blocked");
      const rows = await client.query(
        `SELECT 1 FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(rows.rowCount).toBe(0);
    });
  });

  it("F-03 Order active blocker writes no nested refund subtree", async () => {
    const gid = "gid://shopify/Order/f03-nested";
    const refundGid = "gid://shopify/Refund/f03-nested";
    await withTenant(async (client, db) => {
      const blockerReq = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f03n-block",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: blockerReq,
      });
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f03n",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const result = await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(shopAId, "obs-f03n", orderSnapshot(gid), req, resp, {
            nestedRefunds: [refundSnapshot(refundGid, gid)],
          }),
        ],
      });
      expect(result.results[0]?.outcome).toBe("blocked");
      const orders = await client.query(
        `SELECT 1 FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      const refunds = await client.query(
        `SELECT 1 FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(orders.rowCount).toBe(0);
      expect(refunds.rowCount).toBe(0);
    });
  });

  it("F-04 rejected money apply does not insert a receipt; corrected retry applies", async () => {
    const gid = "gid://shopify/Order/f04-receipt";
    const receipt = {
      applicationKey: "f04-delivery",
      sourceJobType: "webhook:orders/create",
      rootDurableJobId: "job-f04",
      applyingDurableJobId: "job-f04",
      payloadDigest: "f04digestf04digestf04digestf04digestf04digestf04digestxxxx",
    };
    await expect(
      withTenant(async (client, db) => {
        const reqBad = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: "obs-f04-bad",
          shopId: shopAId,
          resourceKind: "Order",
          shopifyGid: gid,
          requestGen: reqBad,
        });
        const respBad = await allocateCatalogObservationGeneration(db);
        const bad = orderSnapshot(gid, {
          netPaymentSet: {
            shopAmount: "not-a-number",
            shopCurrencyCode: "USD",
            presentmentAmount: "30.00",
            presentmentCurrencyCode: "USD",
          },
        });
        await applyOrderFacts(db, {
          shopId: shopAId,
          receipt,
          observations: [liveOrder(shopAId, "obs-f04-bad", bad, reqBad, respBad)],
        });
      }),
    ).rejects.toBeInstanceOf(OrderApplyReceiptNotCertifiableError);
    await withTenant(async (client, db) => {
      const afterReject = await client.query(
        `SELECT count(*)::int AS n FROM "SyncApplicationReceipt" WHERE "applicationKey" = $1`,
        ["f04-delivery"],
      );
      expect(afterReject.rows[0].n).toBe(0);
      const leftover = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(leftover.rows[0].n).toBe(0);
      const reqGood = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f04-good",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: reqGood,
      });
      const respGood = await allocateCatalogObservationGeneration(db);
      const applied = await applyOrderFacts(db, {
        shopId: shopAId,
        receipt,
        observations: [
          liveOrder(shopAId, "obs-f04-good", orderSnapshot(gid), reqGood, respGood),
        ],
      });
      expect(applied.results[0]?.outcome).toBe("applied");
      expect(applied.receiptStatus).toBe("applied");
      const receipts = await client.query(
        `SELECT count(*)::int AS n FROM "SyncApplicationReceipt" WHERE "applicationKey" = $1`,
        ["f04-delivery"],
      );
      expect(receipts.rows[0].n).toBe(1);
      const orders = await client.query(
        `SELECT 1 FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(orders.rowCount).toBe(1);
    });
  });

  it("F-04 incomplete snapshot does not insert a receipt", async () => {
    const gid = "gid://shopify/Order/f04-incomplete";
    await expect(
      withTenant(async (client, db) => {
        const req = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: "obs-f04i",
          shopId: shopAId,
          resourceKind: "Order",
          shopifyGid: gid,
          requestGen: req,
        });
        const resp = await allocateCatalogObservationGeneration(db);
        await applyOrderFacts(db, {
          shopId: shopAId,
          receipt: {
            applicationKey: "f04-incomplete",
            sourceJobType: "webhook:orders/create",
            rootDurableJobId: "job-f04i",
            applyingDurableJobId: "job-f04i",
            payloadDigest: "f04idigestf04idigestf04idigestf04idigestf04idigestxxxxxx",
          },
          observations: [
            liveOrder(
              shopAId,
              "obs-f04i",
              orderSnapshot(gid, { linesComplete: false }),
              req,
              resp,
            ),
          ],
        });
      }),
    ).rejects.toBeInstanceOf(OrderApplyReceiptNotCertifiableError);
    await withTenant(async (client) => {
      const receipts = await client.query(
        `SELECT count(*)::int AS n FROM "SyncApplicationReceipt" WHERE "applicationKey" = $1`,
        ["f04-incomplete"],
      );
      expect(receipts.rows[0].n).toBe(0);
      const orders = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(orders.rows[0].n).toBe(0);
    });
  });

  it("F-05 empty lastConfirmedAccessScopes still uses persisted read_all_orders floor", async () => {
    const gid = "gid://shopify/Order/f05-floor";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f05a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req1,
        scopes: ["read_orders", "read_all_orders"],
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(shopAId, "obs-f05a", orderSnapshot(gid), req1, resp1, {
            accessScopeSnapshot: ["read_orders", "read_all_orders"],
          }),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f05b",
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
            observationToken: "obs-f05b",
            observationRequestGen: req2,
            observationResponseGen: resp2,
            identity: { shopId: shopAId, resourceKind: "Order", shopifyGid: gid },
            existenceKind: "ABSENT_CONFIRMED_QUERY",
            existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
            sourceKind: "INCREMENTAL_REFETCH",
            accessScopeSnapshot: ["read_orders"],
            lastConfirmedAccessScopes: [],
            snapshotComplete: true,
            queryCompleted: true,
            queryReturnedNull: true,
          },
        ],
      });
      const row = await client.query(
        `SELECT "existenceState", "existenceDiagnosticState"
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].existenceState).toBe("LIVE");
      expect(row.rows[0].existenceDiagnosticState).toBe(
        DIAGNOSTIC.SCOPE_DOWNGRADE,
      );
    });
  });

  it("F-06 complete newer snapshot marks omitted order children ABSENT without deleting them", async () => {
    const gid = "gid://shopify/Order/f06-lines";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f06a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req1,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      const twoLines = orderSnapshot(gid, {
        shopifyUpdatedAt: new Date("2026-08-10T00:00:00.000Z"),
        lines: [line(`${gid}/Line/1`), line(`${gid}/Line/2`)],
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
                shopifyLineItemGid: `${gid}/Line/1`,
              }),
              sale({
                shopifyGid: `${gid}/Sale/2`,
                shopifyLineItemGid: `${gid}/Line/2`,
              }),
            ],
          },
        ],
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-f06a", twoLines, req1, resp1)],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f06b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      const oneLine = orderSnapshot(gid, {
        shopifyUpdatedAt: new Date("2026-08-20T00:00:00.000Z"),
        lines: [line(`${gid}/Line/1`)],
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
                shopifyLineItemGid: `${gid}/Line/1`,
              }),
            ],
          },
        ],
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-f06b", oneLine, req2, resp2)],
      });
      const lines = await client.query(
        `SELECT "shopifyGid", "existenceState" FROM "ShopifyOrderLineFact"
          WHERE "shopifyOrderGid" = $1 ORDER BY "shopifyGid"`,
        [gid],
      );
      expect(lines.rowCount).toBe(2);
      expect(
        lines.rows.find((row) => row.shopifyGid === `${gid}/Line/1`)
          ?.existenceState,
      ).toBe("LIVE");
      expect(
        lines.rows.find((row) => row.shopifyGid === `${gid}/Line/2`)
          ?.existenceState,
      ).toBe("ABSENT");
      const sales = await client.query(
        `SELECT "shopifyGid", "existenceState" FROM "ShopifyOrderAgreementSaleFact"
          WHERE "shopifyOrderGid" = $1 ORDER BY "shopifyGid"`,
        [gid],
      );
      expect(sales.rowCount).toBe(2);
      expect(
        sales.rows.find((row) => row.shopifyGid === `${gid}/Sale/2`)
          ?.existenceState,
      ).toBe("ABSENT");
    });
  });

  it("F-06 omitted child reappears LIVE and stale snapshot does not mark absence", async () => {
    const gid = "gid://shopify/Order/f06-revive";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f06r-a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req1,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      const twoLines = orderSnapshot(gid, {
        shopifyUpdatedAt: new Date("2026-08-10T00:00:00.000Z"),
        lines: [line(`${gid}/Line/1`), line(`${gid}/Line/2`)],
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-f06r-a", twoLines, req1, resp1)],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f06r-b",
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
            "obs-f06r-b",
            orderSnapshot(gid, {
              shopifyUpdatedAt: new Date("2026-08-20T00:00:00.000Z"),
              lines: [line(`${gid}/Line/1`)],
            }),
            req2,
            resp2,
          ),
        ],
      });
      const reqStale = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f06r-stale",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: reqStale,
      });
      const respStale = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-f06r-stale",
            orderSnapshot(gid, {
              shopifyUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
              lines: [line(`${gid}/Line/1`)],
            }),
            reqStale,
            respStale,
          ),
        ],
      });
      const afterStale = await client.query(
        `SELECT "existenceState" FROM "ShopifyOrderLineFact"
          WHERE "shopifyGid" = $1`,
        [`${gid}/Line/2`],
      );
      expect(afterStale.rows[0].existenceState).toBe("ABSENT");
      const req3 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f06r-c",
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
            "obs-f06r-c",
            orderSnapshot(gid, {
              shopifyUpdatedAt: new Date("2026-08-21T00:00:00.000Z"),
              lines: [line(`${gid}/Line/1`), line(`${gid}/Line/2`)],
            }),
            req3,
            resp3,
          ),
        ],
      });
      const lines = await client.query(
        `SELECT "shopifyGid", "existenceState" FROM "ShopifyOrderLineFact"
          WHERE "shopifyOrderGid" = $1`,
        [gid],
      );
      expect(lines.rowCount).toBe(2);
      expect(
        lines.rows.every((row) => row.existenceState === "LIVE"),
      ).toBe(true);
    });
  });

  it("F-06 omitted refund children are ABSENT and LIVE children match parent money", async () => {
    const orderGid = "gid://shopify/Order/f06-refund";
    const refundGid = "gid://shopify/Refund/f06-refund";
    await withTenant(async (client, db) => {
      const twoLineRefund = refundSnapshot(refundGid, orderGid, {
        shopifyUpdatedAt: new Date("2026-08-11T00:00:00.000Z"),
        totalRefundedSet: bag("20.00"),
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
          {
            shopifyGid: null,
            shopifyLineItemGid: `${orderGid}/Line/2`,
            refundLineOrdinal: 1,
            quantity: 1,
            restockType: null,
            restocked: null,
            restockLocationGid: null,
            subtotalSet: bag("10.00"),
            totalTaxSet: bag("0.00"),
            priceSet: bag("10.00"),
          },
        ],
        adjustments: [
          {
            shopifyGid: `${refundGid}/Adj/1`,
            reason: "SHIPPING_REFUND",
            amountSet: bag("0.00"),
            taxAmountSet: bag("0.00"),
          },
        ],
        transactions: [
          {
            shopifyGid: `${refundGid}/Txn/1`,
            status: "SUCCESS",
            kind: "REFUND",
            shopifyCreatedAt: new Date("2026-08-11T00:00:00.000Z"),
            processedAt: new Date("2026-08-11T00:00:00.000Z"),
            amountSet: bag("20.00"),
          },
          {
            shopifyGid: `${refundGid}/Txn/2`,
            status: "SUCCESS",
            kind: "REFUND",
            shopifyCreatedAt: new Date("2026-08-11T00:00:00.000Z"),
            processedAt: new Date("2026-08-11T00:00:00.000Z"),
            amountSet: bag("0.00"),
          },
        ],
      });
      await seedLiveRefund(client, db, orderGid, twoLineRefund, "obs-f06rf");
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f06rf-r",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const oneLine = refundSnapshot(refundGid, orderGid, {
        shopifyUpdatedAt: new Date("2026-08-21T00:00:00.000Z"),
        totalRefundedSet: bag("10.00"),
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
        adjustments: [],
        transactions: [
          {
            shopifyGid: `${refundGid}/Txn/1`,
            status: "SUCCESS",
            kind: "REFUND",
            shopifyCreatedAt: new Date("2026-08-11T00:00:00.000Z"),
            processedAt: new Date("2026-08-11T00:00:00.000Z"),
            amountSet: bag("10.00"),
          },
        ],
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          refundObservation(shopAId, "obs-f06rf-r", oneLine, req, resp),
        ],
      });
      const parent = await client.query(
        `SELECT "totalRefundedShopAmount"::text AS amt, "moneyDiagnosticState"
           FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(parent.rows[0].amt).toMatch(/10/);
      const lines = await client.query(
        `SELECT "refundLineOrdinal", "existenceState", "subtotalShopAmount"::text AS amt
           FROM "ShopifyOrderRefundLineFact" WHERE "shopifyRefundGid" = $1
           ORDER BY "refundLineOrdinal"`,
        [refundGid],
      );
      expect(lines.rowCount).toBe(2);
      expect(lines.rows[0].existenceState).toBe("LIVE");
      expect(lines.rows[1].existenceState).toBe("ABSENT");
      const liveSum = await client.query(
        `SELECT coalesce(sum("subtotalShopAmount"), 0)::text AS amt
           FROM "ShopifyOrderRefundLineFact"
          WHERE "shopifyRefundGid" = $1 AND "existenceState" = 'LIVE'`,
        [refundGid],
      );
      expect(liveSum.rows[0].amt).toMatch(/10/);
      const adj = await client.query(
        `SELECT "existenceState" FROM "ShopifyOrderAdjustmentFact"
          WHERE "shopifyGid" = $1`,
        [`${refundGid}/Adj/1`],
      );
      expect(adj.rows[0].existenceState).toBe("ABSENT");
      const txn = await client.query(
        `SELECT "shopifyGid", "existenceState" FROM "ShopifyOrderRefundTransactionFact"
          WHERE "shopifyRefundGid" = $1 ORDER BY "shopifyGid"`,
        [refundGid],
      );
      expect(
        txn.rows.find((row) => row.shopifyGid === `${refundGid}/Txn/2`)
          ?.existenceState,
      ).toBe("ABSENT");
      expect(
        txn.rows.find((row) => row.shopifyGid === `${refundGid}/Txn/1`)
          ?.existenceState,
      ).toBe("LIVE");
    });
  });

  it("F-06 omitted nested refund from an order snapshot stays LIVE", async () => {
    const gid = "gid://shopify/Order/f06-nested";
    const refundGid = "gid://shopify/Refund/f06-nested";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f06n-a",
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
            "obs-f06n-a",
            orderSnapshot(gid, {
              shopifyUpdatedAt: new Date("2026-08-10T00:00:00.000Z"),
            }),
            req1,
            resp1,
            { nestedRefunds: [refundSnapshot(refundGid, gid)] },
          ),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f06n-b",
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
            "obs-f06n-b",
            orderSnapshot(gid, {
              shopifyUpdatedAt: new Date("2026-08-20T00:00:00.000Z"),
            }),
            req2,
            resp2,
          ),
        ],
      });
      const refund = await client.query(
        `SELECT "existenceState" FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(refund.rows[0].existenceState).toBe("LIVE");
    });
  });

  it("F-07 fabricated read_all_orders against durable read_orders fails closed", async () => {
    const gid = "gid://shopify/Order/f07-mismatch";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f07",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
        scopes: ["read_orders"],
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await expect(
        applyOrderFacts(db, {
          shopId: shopAId,
          observations: [
            liveOrder(shopAId, "obs-f07", orderSnapshot(gid), req, resp, {
              accessScopeSnapshot: ["read_orders", "read_all_orders"],
            }),
          ],
        }),
      ).rejects.toBeInstanceOf(OrderApplyAccessScopeMismatchError);
      const rows = await client.query(
        `SELECT 1 FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBe(0);
    });
  });

  it("F-07 matching durable scopes still apply", async () => {
    const gid = "gid://shopify/Order/f07-match";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f07m",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
        scopes: ["read_orders", "read_all_orders"],
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const result = await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(shopAId, "obs-f07m", orderSnapshot(gid), req, resp, {
            accessScopeSnapshot: ["read_all_orders", "read_orders"],
          }),
        ],
      });
      expect(result.results[0]?.outcome).toBe("applied");
      const row = await client.query(
        `SELECT "accessScopeSnapshot" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].accessScopeSnapshot).toEqual(
        expect.arrayContaining(["read_orders", "read_all_orders"]),
      );
    });
  });

  it("F-08 empty observation batch reports receiptStatus none and inserts nothing", async () => {
    await withTenant(async (client, db) => {
      const withReceipt = await applyOrderFacts(db, {
        shopId: shopAId,
        receipt: {
          applicationKey: "f08-empty",
          sourceJobType: "webhook:orders/create",
          rootDurableJobId: "job-f08",
          applyingDurableJobId: "job-f08",
          payloadDigest: "f08digestf08digestf08digestf08digestf08digestf08digestxxxx",
        },
        observations: [],
      });
      expect(withReceipt.receiptStatus).toBe("none");
      const none = await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [],
      });
      expect(none.receiptStatus).toBe("none");
      const receipts = await client.query(
        `SELECT count(*)::int AS n FROM "SyncApplicationReceipt" WHERE "applicationKey" = $1`,
        ["f08-empty"],
      );
      expect(receipts.rows[0].n).toBe(0);
    });
  });

  it("F-02 Refund LIVE interval advances so delayed ABSENT cannot tombstone", async () => {
    const orderGid = "gid://shopify/Order/f02-refund";
    const refundGid = "gid://shopify/Refund/f02-refund";
    await withTenant(async (client, db) => {
      const g1 = await allocateCatalogObservationGeneration(db);
      const g2 = await allocateCatalogObservationGeneration(db);
      const g5 = await allocateCatalogObservationGeneration(db);
      const g6 = await allocateCatalogObservationGeneration(db);
      const g9 = await allocateCatalogObservationGeneration(db);
      const g10 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f02r-a",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: g1,
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          refundObservation(
            shopAId,
            "obs-f02r-a",
            refundSnapshot(refundGid, orderGid),
            g1,
            g2,
          ),
        ],
      });
      await insertObservation(client, {
        id: "obs-f02r-b",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: g9,
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          refundObservation(
            shopAId,
            "obs-f02r-b",
            refundSnapshot(refundGid, orderGid),
            g9,
            g10,
          ),
        ],
      });
      const afterLive = await client.query(
        `SELECT "existenceRequestGen"::text AS req, "existenceResponseGen"::text AS resp,
                "existenceState"
           FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(afterLive.rows[0].existenceState).toBe("LIVE");
      expect(afterLive.rows[0].req).toBe(g9.toString());
      expect(afterLive.rows[0].resp).toBe(g10.toString());
      await insertObservation(client, {
        id: "obs-f02r-c",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: g5,
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          refundObservation(
            shopAId,
            "obs-f02r-c",
            refundSnapshot(refundGid, orderGid),
            g5,
            g6,
            {
              existenceKind: "ABSENT_CONFIRMED_QUERY",
              queryCompleted: true,
              queryReturnedNull: true,
              lastConfirmedAccessScopes: ["read_orders"],
              refund: undefined,
            },
          ),
        ],
      });
      const row = await client.query(
        `SELECT "existenceState", "existenceKind", "existenceRequestGen"::text AS req
           FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(row.rows[0].existenceState).toBe("LIVE");
      expect(row.rows[0].existenceKind).toBe("LIVE_REFETCH");
      expect(row.rows[0].req).toBe(g9.toString());
    });
  });

  it("F-03 valid Order with blocked Refund writes the order and not the refund subtree", async () => {
    const gid = "gid://shopify/Order/f03-valid-order";
    const refundGid = "gid://shopify/Refund/f03-valid-order";
    await withTenant(async (client, db) => {
      const blockerReq = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f03vo-block",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: blockerReq,
      });
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f03vo",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const result = await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(shopAId, "obs-f03vo", orderSnapshot(gid), req, resp, {
            nestedRefunds: [refundSnapshot(refundGid, gid)],
          }),
        ],
      });
      expect(result.results[0]?.outcome).toBe("applied");
      const orders = await client.query(
        `SELECT 1 FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      const refunds = await client.query(
        `SELECT 1 FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(orders.rowCount).toBe(1);
      expect(refunds.rowCount).toBe(0);
    });
  });

  it("F-04 mixed batch rolls back the successful subset and writes no receipt", async () => {
    const goodGid = "gid://shopify/Order/f04-mixed-good";
    const badGid = "gid://shopify/Order/f04-mixed-bad";
    await expect(
      withTenant(async (client, db) => {
        const reqGood = await allocateCatalogObservationGeneration(db);
        const reqBad = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: "obs-f04m-good",
          shopId: shopAId,
          resourceKind: "Order",
          shopifyGid: goodGid,
          requestGen: reqGood,
        });
        await insertObservation(client, {
          id: "obs-f04m-bad",
          shopId: shopAId,
          resourceKind: "Order",
          shopifyGid: badGid,
          requestGen: reqBad,
        });
        const respGood = await allocateCatalogObservationGeneration(db);
        const respBad = await allocateCatalogObservationGeneration(db);
        await applyOrderFacts(db, {
          shopId: shopAId,
          receipt: {
            applicationKey: "f04-mixed",
            sourceJobType: "webhook:orders/create",
            rootDurableJobId: "job-f04m",
            applyingDurableJobId: "job-f04m",
            payloadDigest: "f04mixeddigestf04mixeddigestf04mixeddigestf04mixedxxxx",
          },
          observations: [
            liveOrder(shopAId, "obs-f04m-good", orderSnapshot(goodGid), reqGood, respGood),
            liveOrder(
              shopAId,
              "obs-f04m-bad",
              orderSnapshot(badGid, { linesComplete: false }),
              reqBad,
              respBad,
            ),
          ],
        });
      }),
    ).rejects.toBeInstanceOf(OrderApplyReceiptNotCertifiableError);
    await withTenant(async (client) => {
      const receipts = await client.query(
        `SELECT count(*)::int AS n FROM "SyncApplicationReceipt" WHERE "applicationKey" = $1`,
        ["f04-mixed"],
      );
      expect(receipts.rows[0].n).toBe(0);
      const orders = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact"
          WHERE "shopifyGid" IN ($1, $2)`,
        [goodGid, badGid],
      );
      expect(orders.rows[0].n).toBe(0);
    });
  });

  it("F-04 empty already-receipted batch returns already_applied", async () => {
    const gid = "gid://shopify/Order/f04-empty-applied";
    const receipt = {
      applicationKey: "f04-empty-applied",
      sourceJobType: "webhook:orders/create",
      rootDurableJobId: "job-f04ea",
      applyingDurableJobId: "job-f04ea",
      payloadDigest: "f04eadigestf04eadigestf04eadigestf04eadigestf04eadigestxx",
    };
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f04ea",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        receipt,
        observations: [liveOrder(shopAId, "obs-f04ea", orderSnapshot(gid), req, resp)],
      });
    });
    await withTenant(async (client, db) => {
      const again = await applyOrderFacts(db, {
        shopId: shopAId,
        receipt,
        observations: [],
      });
      expect(again.receiptStatus).toBe("already_applied");
      const receipts = await client.query(
        `SELECT count(*)::int AS n FROM "SyncApplicationReceipt" WHERE "applicationKey" = $1`,
        ["f04-empty-applied"],
      );
      expect(receipts.rows[0].n).toBe(1);
    });
  });

  it("F-04 digest conflict fails closed without a second receipt", async () => {
    const gid = "gid://shopify/Order/f04-digest";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f04d-a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        receipt: {
          applicationKey: "f04-digest",
          sourceJobType: "webhook:orders/create",
          rootDurableJobId: "job-f04d",
          applyingDurableJobId: "job-f04d",
          payloadDigest: "f04digestaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        observations: [liveOrder(shopAId, "obs-f04d-a", orderSnapshot(gid), req, resp)],
      });
    });
    await expect(
      withTenant(async (client, db) => {
        const req2 = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: "obs-f04d-b",
          shopId: shopAId,
          resourceKind: "Order",
          shopifyGid: `${gid}-b`,
          requestGen: req2,
        });
        const resp2 = await allocateCatalogObservationGeneration(db);
        await applyOrderFacts(db, {
          shopId: shopAId,
          receipt: {
            applicationKey: "f04-digest",
            sourceJobType: "webhook:orders/create",
            rootDurableJobId: "job-f04d2",
            applyingDurableJobId: "job-f04d2",
            payloadDigest: "f04digestbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          },
          observations: [
            liveOrder(
              shopAId,
              "obs-f04d-b",
              orderSnapshot(`${gid}-b`),
              req2,
              resp2,
            ),
          ],
        });
      }),
    ).rejects.toBeInstanceOf(OrderApplyReceiptDigestConflictError);
    await withTenant(async (client) => {
      const receipts = await client.query(
        `SELECT count(*)::int AS n, count(distinct "payloadDigest")::int AS digests
           FROM "SyncApplicationReceipt" WHERE "applicationKey" = $1`,
        ["f04-digest"],
      );
      expect(receipts.rows[0].n).toBe(1);
      expect(receipts.rows[0].digests).toBe(1);
      const extra = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [`${gid}-b`],
      );
      expect(extra.rows[0].n).toBe(0);
    });
  });

  it("F-06 1-to-0 replacement marks the last line ABSENT without DELETE", async () => {
    const gid = "gid://shopify/Order/f06-one-to-zero";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f061a",
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
            "obs-f061a",
            orderSnapshot(gid, {
              shopifyUpdatedAt: new Date("2026-08-10T00:00:00.000Z"),
              lines: [line(`${gid}/Line/1`)],
              agreements: [],
            }),
            req1,
            resp1,
          ),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f061b",
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
            "obs-f061b",
            orderSnapshot(gid, {
              shopifyUpdatedAt: new Date("2026-08-20T00:00:00.000Z"),
              lines: [],
              agreements: [],
              currentSubtotalLineItemsQuantity: 0,
              subtotalLineItemsQuantity: 0,
            }),
            req2,
            resp2,
          ),
        ],
      });
      const lines = await client.query(
        `SELECT "existenceState", "existenceKind", "deletionSource"
           FROM "ShopifyOrderLineFact" WHERE "shopifyOrderGid" = $1`,
        [gid],
      );
      expect(lines.rowCount).toBe(1);
      expect(lines.rows[0].existenceState).toBe("ABSENT");
      expect(lines.rows[0].existenceKind).toBe("ABSENT_CONFIRMED_QUERY");
      expect(lines.rows[0].deletionSource).toBe("CONFIRMED_QUERY");
    });
  });

  it("F-01 nested LIVE does not restore a tombstoned Refund on first confirmation", async () => {
    const orderGid = "gid://shopify/Order/f01-nested-tombstone";
    const refundGid = "gid://shopify/Refund/f01-nested-tombstone";
    await withTenant(async (client, db) => {
      await seedLiveRefund(
        client,
        db,
        orderGid,
        refundSnapshot(refundGid, orderGid, { totalRefundedSet: bag("10.00") }),
        "obs-f01nt",
      );
      const reqAbs = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f01nt-abs",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: reqAbs,
      });
      const respAbs = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          refundObservation(
            shopAId,
            "obs-f01nt-abs",
            refundSnapshot(refundGid, orderGid),
            reqAbs,
            respAbs,
            {
              existenceKind: "ABSENT_CONFIRMED_QUERY",
              queryCompleted: true,
              queryReturnedNull: true,
              lastConfirmedAccessScopes: ["read_orders"],
              refund: undefined,
            },
          ),
        ],
      });
      const reqN = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f01nt-n",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: orderGid,
        requestGen: reqN,
      });
      const respN = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-f01nt-n",
            orderSnapshot(orderGid, {
              shopifyUpdatedAt: new Date("2026-08-25T00:00:00.000Z"),
            }),
            reqN,
            respN,
            {
              nestedRefunds: [
                refundSnapshot(refundGid, orderGid, {
                  shopifyUpdatedAt: new Date("2026-08-26T00:00:00.000Z"),
                  totalRefundedSet: bag("99.00"),
                }),
              ],
            },
          ),
        ],
      });
      const refund = await client.query(
        `SELECT "existenceState", "existenceKind",
                "totalRefundedShopAmount"::text AS amount,
                "existenceDiagnosticState"
           FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(refund.rows[0].existenceState).toBe("ABSENT");
      expect(refund.rows[0].existenceKind).toBe("ABSENT_CONFIRMED_QUERY");
      expect(refund.rows[0].amount).toBe("10.000000");
      expect(String(refund.rows[0].existenceDiagnosticState)).toContain(
        "TERMINAL_IDENTITY_REVIVAL_CONFLICT",
      );
    });
  });

  it("F-05 inaccessible observation does not erase last-valid LIVE scopes", async () => {
    const gid = "gid://shopify/Order/f05-inacc-keep";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f05k-a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req1,
        scopes: ["read_orders", "read_all_orders"],
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(shopAId, "obs-f05k-a", orderSnapshot(gid), req1, resp1, {
            accessScopeSnapshot: ["read_orders", "read_all_orders"],
          }),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f05k-b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req2,
        scopes: ["read_orders"],
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-f05k-b",
            observationRequestGen: req2,
            observationResponseGen: resp2,
            identity: { shopId: shopAId, resourceKind: "Order", shopifyGid: gid },
            existenceKind: "INACCESSIBLE_HISTORY_WINDOW",
            existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
            sourceKind: "INCREMENTAL_REFETCH",
            accessScopeSnapshot: ["read_orders"],
            snapshotComplete: true,
            queryCompleted: true,
            queryReturnedNull: false,
          },
        ],
      });
      const row = await client.query(
        `SELECT "accessScopeSnapshot", "existenceKind"
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].existenceKind).toBe("INACCESSIBLE_HISTORY_WINDOW");
      expect(row.rows[0].accessScopeSnapshot).toEqual(
        expect.arrayContaining(["read_orders", "read_all_orders"]),
      );
    });
  });

  it("F-04 lease-invalid apply does not insert a success receipt", async () => {
    const gid = "gid://shopify/Order/f04-lease";
    await expect(
      withTenant(async (client, db) => {
        const req = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: "obs-f04-lease",
          shopId: shopAId,
          resourceKind: "Order",
          shopifyGid: gid,
          requestGen: req,
          leaseMs: 1,
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
        const resp = await allocateCatalogObservationGeneration(db);
        await applyOrderFacts(db, {
          shopId: shopAId,
          receipt: {
            applicationKey: "f04-lease",
            sourceJobType: "webhook:orders/create",
            rootDurableJobId: "job-f04-lease",
            applyingDurableJobId: "job-f04-lease",
            payloadDigest:
              "f04leasedigestf04leasedigestf04leasedigestf04leasedigestxx",
          },
          observations: [
            liveOrder(
              shopAId,
              "obs-f04-lease",
              orderSnapshot(gid),
              req,
              resp,
            ),
          ],
        });
      }),
    ).rejects.toBeInstanceOf(OrderApplyReceiptNotCertifiableError);
    await withTenant(async (client) => {
      const receipts = await client.query(
        `SELECT count(*)::int AS n FROM "SyncApplicationReceipt" WHERE "applicationKey" = $1`,
        ["f04-lease"],
      );
      expect(receipts.rows[0].n).toBe(0);
      const orders = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(orders.rows[0].n).toBe(0);
    });
  });

  it("F-04 blocked apply does not insert a success receipt", async () => {
    const gid = "gid://shopify/Order/f04-blocked";
    await expect(
      withTenant(async (client, db) => {
        const blockerReq = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: "obs-f04-block",
          shopId: shopAId,
          resourceKind: "Order",
          shopifyGid: gid,
          requestGen: blockerReq,
        });
        const req = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: "obs-f04-blocked",
          shopId: shopAId,
          resourceKind: "Order",
          shopifyGid: gid,
          requestGen: req,
        });
        const resp = await allocateCatalogObservationGeneration(db);
        await applyOrderFacts(db, {
          shopId: shopAId,
          receipt: {
            applicationKey: "f04-blocked",
            sourceJobType: "webhook:orders/create",
            rootDurableJobId: "job-f04-blocked",
            applyingDurableJobId: "job-f04-blocked",
            payloadDigest:
              "f04blockeddigestf04blockeddigestf04blockeddigestf04blockedxx",
          },
          observations: [
            liveOrder(
              shopAId,
              "obs-f04-blocked",
              orderSnapshot(gid),
              req,
              resp,
            ),
          ],
        });
      }),
    ).rejects.toBeInstanceOf(OrderApplyReceiptNotCertifiableError);
    await withTenant(async (client) => {
      const receipts = await client.query(
        `SELECT count(*)::int AS n FROM "SyncApplicationReceipt" WHERE "applicationKey" = $1`,
        ["f04-blocked"],
      );
      expect(receipts.rows[0].n).toBe(0);
      const orders = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(orders.rows[0].n).toBe(0);
    });
  });

  it("F-04 overlapping conflict does not insert a success receipt", async () => {
    const gid = "gid://shopify/Order/f04-conflict";
    let overlapReq = 0n;
    await withTenant(async (client, db) => {
      const g1 = await allocateCatalogObservationGeneration(db);
      overlapReq = await allocateCatalogObservationGeneration(db);
      const g3 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f04c-a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: g1,
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [liveOrder(shopAId, "obs-f04c-a", orderSnapshot(gid), g1, g3)],
      });
    });
    await expect(
      withTenant(async (client, db) => {
        const g4 = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: "obs-f04c-b",
          shopId: shopAId,
          resourceKind: "Order",
          shopifyGid: gid,
          requestGen: overlapReq,
        });
        await applyOrderFacts(db, {
          shopId: shopAId,
          receipt: {
            applicationKey: "f04-conflict",
            sourceJobType: "webhook:orders/create",
            rootDurableJobId: "job-f04-conflict",
            applyingDurableJobId: "job-f04-conflict",
            payloadDigest:
              "f04conflictdigestf04conflictdigestf04conflictdigestf04conflictx",
          },
          observations: [
            {
              observationKind: "direct",
              observationToken: "obs-f04c-b",
              observationRequestGen: overlapReq,
              observationResponseGen: g4,
              identity: {
                shopId: shopAId,
                resourceKind: "Order",
                shopifyGid: gid,
              },
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
      }),
    ).rejects.toBeInstanceOf(OrderApplyReceiptNotCertifiableError);
    await withTenant(async (client) => {
      const receipts = await client.query(
        `SELECT count(*)::int AS n FROM "SyncApplicationReceipt" WHERE "applicationKey" = $1`,
        ["f04-conflict"],
      );
      expect(receipts.rows[0].n).toBe(0);
      const order = await client.query(
        `SELECT "existenceState" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(order.rows[0].existenceState).toBe("LIVE");
    });
  });

  it("F-04 proven overlap_agree no-op may certify a success receipt", async () => {
    const gid = "gid://shopify/Order/f04-noop";
    let overlapReq = 0n;
    await withTenant(async (client, db) => {
      const g1 = await allocateCatalogObservationGeneration(db);
      overlapReq = await allocateCatalogObservationGeneration(db);
      const g3 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f04n-a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: g1,
      });
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-f04n-a",
            orderSnapshot(gid, {
              shopifyUpdatedAt: new Date("2026-08-20T00:00:00.000Z"),
              name: "#LIVE",
            }),
            g1,
            g3,
          ),
        ],
      });
    });
    await withTenant(async (client, db) => {
      const g4 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f04n-b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: overlapReq,
      });
      const result = await applyOrderFacts(db, {
        shopId: shopAId,
        receipt: {
          applicationKey: "f04-noop",
          sourceJobType: "webhook:orders/create",
          rootDurableJobId: "job-f04-noop",
          applyingDurableJobId: "job-f04-noop",
          payloadDigest:
            "f04noopdigestf04noopdigestf04noopdigestf04noopdigestf04noopxxxx",
        },
        observations: [
          liveOrder(
            shopAId,
            "obs-f04n-b",
            orderSnapshot(gid, {
              shopifyUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
              name: "#STALE",
            }),
            overlapReq,
            g4,
          ),
        ],
      });
      expect(result.results[0]?.outcome).toBe("noop");
      expect(result.results[0]?.reason).toBe("overlap_agree");
      expect(result.receiptStatus).toBe("applied");
      const receipts = await client.query(
        `SELECT count(*)::int AS n, "resultMetadata"::text AS meta
           FROM "SyncApplicationReceipt" WHERE "applicationKey" = $1
           GROUP BY "resultMetadata"`,
        ["f04-noop"],
      );
      expect(receipts.rows[0].n).toBe(1);
      expect(String(receipts.rows[0].meta)).toContain("overlap_agree");
    });
  });

  it("F-06 1-to-0 remaining child kinds retain ABSENT rows and omit no physical DELETE", async () => {
    await withTenant(async (client, db) => {
      const orderGid = "gid://shopify/Order/f06-1to0-rest";
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f06z-a",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: orderGid,
        requestGen: req1,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-f06z-a",
            orderSnapshot(orderGid, {
              shopifyUpdatedAt: new Date("2026-08-10T00:00:00.000Z"),
            }),
            req1,
            resp1,
          ),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f06z-b",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: orderGid,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-f06z-b",
            orderSnapshot(orderGid, {
              shopifyUpdatedAt: new Date("2026-08-20T00:00:00.000Z"),
              agreements: [],
            }),
            req2,
            resp2,
          ),
        ],
      });
      const agreements = await client.query(
        `SELECT "existenceState" FROM "ShopifyOrderAgreementFact"
          WHERE "shopifyOrderGid" = $1`,
        [orderGid],
      );
      expect(agreements.rowCount).toBe(1);
      expect(agreements.rows[0].existenceState).toBe("ABSENT");
      const sales = await client.query(
        `SELECT "existenceState" FROM "ShopifyOrderAgreementSaleFact"
          WHERE "shopifyOrderGid" = $1`,
        [orderGid],
      );
      expect(sales.rowCount).toBe(1);
      expect(sales.rows[0].existenceState).toBe("ABSENT");

      const refundGid = "gid://shopify/Refund/f06-1to0-rest";
      const firstRefund = refundSnapshot(refundGid, orderGid, {
        shopifyUpdatedAt: new Date("2026-08-11T00:00:00.000Z"),
        adjustments: [
          {
            shopifyGid: `${refundGid}/Adj/1`,
            reason: "SHIPPING_REFUND",
            amountSet: bag("0.00"),
            taxAmountSet: bag("0.00"),
          },
        ],
      });
      const reqR1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f06z-r1",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: reqR1,
      });
      const respR1 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          refundObservation(shopAId, "obs-f06z-r1", firstRefund, reqR1, respR1),
        ],
      });
      const reqR2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f06z-r2",
        shopId: shopAId,
        resourceKind: "Refund",
        shopifyGid: refundGid,
        requestGen: reqR2,
      });
      const respR2 = await allocateCatalogObservationGeneration(db);
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations: [
          refundObservation(
            shopAId,
            "obs-f06z-r2",
            refundSnapshot(refundGid, orderGid, {
              shopifyUpdatedAt: new Date("2026-08-21T00:00:00.000Z"),
              totalRefundedSet: bag("0.00"),
              lines: [],
              adjustments: [],
              transactions: [],
            }),
            reqR2,
            respR2,
          ),
        ],
      });
      const refundLines = await client.query(
        `SELECT "existenceState" FROM "ShopifyOrderRefundLineFact"
          WHERE "shopifyRefundGid" = $1`,
        [refundGid],
      );
      expect(refundLines.rowCount).toBe(1);
      expect(refundLines.rows[0].existenceState).toBe("ABSENT");
      const adjs = await client.query(
        `SELECT "existenceState" FROM "ShopifyOrderAdjustmentFact"
          WHERE "shopifyRefundGid" = $1`,
        [refundGid],
      );
      expect(adjs.rowCount).toBe(1);
      expect(adjs.rows[0].existenceState).toBe("ABSENT");
      const txns = await client.query(
        `SELECT "existenceState" FROM "ShopifyOrderRefundTransactionFact"
          WHERE "shopifyRefundGid" = $1`,
        [refundGid],
      );
      expect(txns.rowCount).toBe(1);
      expect(txns.rows[0].existenceState).toBe("ABSENT");
    });
  });

  it("F-06 a present zero-quantity line is not treated as omitted", async () => {
    const gid = "gid://shopify/Order/f06-zero-qty";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f06q-a",
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
            "obs-f06q-a",
            orderSnapshot(gid, {
              shopifyUpdatedAt: new Date("2026-08-10T00:00:00.000Z"),
              lines: [line(`${gid}/Line/1`), line(`${gid}/Line/2`)],
            }),
            req1,
            resp1,
          ),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-f06q-b",
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
            "obs-f06q-b",
            orderSnapshot(gid, {
              shopifyUpdatedAt: new Date("2026-08-20T00:00:00.000Z"),
              lines: [
                line(`${gid}/Line/1`),
                line(`${gid}/Line/2`, {
                  quantity: 0,
                  currentQuantity: 0,
                  refundableQuantity: 0,
                  unfulfilledQuantity: 0,
                }),
              ],
            }),
            req2,
            resp2,
          ),
        ],
      });
      const lines = await client.query(
        `SELECT "shopifyGid", "existenceState", quantity
           FROM "ShopifyOrderLineFact" WHERE "shopifyOrderGid" = $1
           ORDER BY "shopifyGid"`,
        [gid],
      );
      expect(lines.rowCount).toBe(2);
      expect(
        lines.rows.every((row) => row.existenceState === "LIVE"),
      ).toBe(true);
      expect(
        lines.rows.find((row) => row.shopifyGid === `${gid}/Line/2`)?.quantity,
      ).toBe(0);
    });
  });
});
