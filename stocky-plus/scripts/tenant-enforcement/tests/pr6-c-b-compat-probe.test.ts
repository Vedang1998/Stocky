/**
 * PR6-C scratch B→C compatibility probe.
 *
 * Pin (PR #39 comment 5643079993, live corrected B head):
 *   610ed0503a3aa2998aca7228f4fca9617bed23a3
 *
 * This file is a test-local mapper, not a production PR6-D adapter and not a
 * B overlay. B `admin-read/**` is not committed onto the C branch. Fixtures
 * match the frozen B typed-read contract at that SHA. Overlay files, if used
 * locally, must be removed before inventory and commit.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { applyOrderFacts } from "../../../app/lib/order-facts/apply";
import { OrderApplyReceiptNotCertifiableError } from "../../../app/lib/order-facts/apply/errors";
import type { OrderApplyDb } from "../../../app/lib/order-facts/apply/sql";
import type { DirectOrderObservation } from "../../../app/lib/order-facts/apply/types";
import { DIAGNOSTIC } from "../../../app/lib/order-facts/apply/types";
import type { MoneyBagSides } from "../../../app/lib/order-facts/types";
import { allocateCatalogObservationGeneration } from "../../../app/lib/catalog-facts/observation-generation";
import { getRuntimeClient } from "../connection";
import { ENFORCEMENT_CONTEXT_VERSION } from "../manifest";
import { resetSchemaAndApplyEnforcement } from "./helpers";
import {
  B_TYPED_READ_CONTRACT_PIN,
  incompleteObservationFromB,
  mapBOrderReadResult,
  mapBRefundReadResult,
  type CompatMapContext,
  type OrderFactSnapshot,
  type OrderLineRead,
  type OrderReadResult,
  type RefundRead,
  type RequestCostAccumulator,
} from "./pr6-c-b-compat-mapper";

export { B_TYPED_READ_CONTRACT_PIN };

const ZERO_COST: RequestCostAccumulator = {
  requests: 0,
  requestedQueryCost: 0,
};

function bag(
  shopAmount: string,
  shopCurrency = "USD",
  presentmentAmount = shopAmount,
  presentmentCurrency = shopCurrency,
): MoneyBagSides {
  return {
    shopAmount,
    shopCurrencyCode: shopCurrency,
    presentmentAmount,
    presentmentCurrencyCode: presentmentCurrency,
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
      60_000,
      args.scopes ?? ["read_orders"],
    ],
  );
}

function ctxFor(
  shopId: string,
  token: string,
  req: bigint,
  resp: bigint,
  extras: Partial<CompatMapContext> = {},
): CompatMapContext {
  return {
    shopId,
    observationToken: token,
    observationRequestGen: req,
    observationResponseGen: resp,
    existenceObservedAt: new Date("2026-09-11T00:00:00.000Z"),
    accessScopeSnapshot: ["read_orders"],
    ...extras,
  };
}

function lineRead(
  id: string,
  overrides: Partial<OrderLineRead> = {},
): OrderLineRead {
  return {
    id,
    sku: "SKU-1",
    title: "Widget",
    variantTitle: null,
    vendor: null,
    name: "Widget",
    isGiftCard: false,
    quantity: 6,
    currentQuantity: 3,
    refundableQuantity: 3,
    unfulfilledQuantity: 3,
    nonFulfillableQuantity: 0,
    originalTotalSet: bag("60.00"),
    originalUnitPriceSet: bag("10.00"),
    discountedTotalSetWithCodeDiscounts: bag("9.00"),
    discountedTotalSetWithoutCodeDiscounts: bag("9.50"),
    totalDiscountSet: bag("0.00"),
    discountedUnitPriceAfterAllDiscountsSet: bag("9.00"),
    variant: {
      id: "gid://shopify/ProductVariant/1",
      legacyResourceId: "1",
      sku: "SKU-1",
    },
    product: { id: "gid://shopify/Product/1", legacyResourceId: "1" },
    ...overrides,
  };
}

function orderRead(
  id: string,
  overrides: Partial<OrderFactSnapshot> = {},
): OrderFactSnapshot {
  const line = lineRead(`${id}/LineItem/1`);
  return {
    id,
    legacyResourceId: "1001",
    name: "#1001",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-10T12:34:56Z",
    processedAt: "2026-08-01T00:00:00Z",
    cancelledAt: null,
    cancelReason: null,
    closed: false,
    closedAt: null,
    edited: false,
    test: false,
    confirmed: true,
    currencyCode: "USD",
    presentmentCurrencyCode: "EUR",
    taxesIncluded: true,
    displayFinancialStatus: "PAID",
    displayFulfillmentStatus: "UNFULFILLED",
    sourceName: "web",
    currentSubtotalLineItemsQuantity: 3,
    subtotalLineItemsQuantity: 6,
    retailLocationId: "gid://shopify/Location/9",
    originalTotalPriceSet: bag("60.00", "USD", "54.00", "EUR"),
    currentTotalPriceSet: bag("30.00", "USD", "27.00", "EUR"),
    currentSubtotalPriceSet: bag("30.00", "USD", "27.00", "EUR"),
    currentTotalDiscountsSet: bag("0.00", "USD", "0.00", "EUR"),
    currentTotalTaxSet: bag("0.00", "USD", "0.00", "EUR"),
    totalRefundedSet: bag("30.00", "USD", "27.00", "EUR"),
    netPaymentSet: bag("30.00", "USD", "27.00", "EUR"),
    refundDiscrepancySet: null,
    cartDiscountAmountSet: null,
    currentCartDiscountAmountSet: null,
    currentShippingPriceSet: null,
    lineItems: [line],
    agreements: [
      {
        id: `${id}/Agreement/order`,
        happenedAt: "2026-08-01T00:00:00Z",
        reason: "ORDER",
        typename: "OrderAgreement",
        refundId: null,
        edgeCursor: "cursor-order",
        salesComplete: true,
        sales: [
          {
            id: `${id}/Sale/order`,
            typename: "ProductSale",
            quantity: 6,
            lineType: "PRODUCT",
            actionType: "ORDER",
            totalAmount: bag("60.00"),
            lineItemId: line.id,
          },
        ],
      },
      {
        id: `${id}/Agreement/refund`,
        happenedAt: "2026-08-11T00:00:00Z",
        reason: "REFUND",
        typename: "RefundAgreement",
        refundId: `${id}/Refund/1`,
        edgeCursor: "cursor-refund",
        salesComplete: true,
        sales: [
          {
            id: `${id}/Sale/return`,
            typename: "ProductSale",
            quantity: -3,
            lineType: "PRODUCT",
            actionType: "RETURN",
            totalAmount: bag("-30.00"),
            lineItemId: line.id,
          },
        ],
      },
    ],
    refunds: [],
    ...overrides,
  };
}

function refundRead(
  id: string,
  orderId: string | null,
  overrides: Partial<RefundRead> = {},
): RefundRead {
  const lineItemId =
    orderId != null ? `${orderId}/LineItem/1` : "gid://shopify/LineItem/orphan";
  return {
    id,
    legacyResourceId: "91",
    createdAt: "2026-08-11T00:00:00Z",
    updatedAt: "2026-08-11T00:00:00Z",
    processedAt: "2026-08-11T00:00:00Z",
    orderId,
    totalRefundedSet: bag("10.00"),
    refundLineItems: [
      {
        id: null,
        quantity: 1,
        restockType: "RETURN",
        restocked: true,
        restockLocationId: "gid://shopify/Location/7",
        lineItemId,
        refundLineOrdinal: 2,
        subtotalSet: bag("10.00"),
        totalTaxSet: bag("0.00"),
        priceSet: bag("10.00"),
      },
    ],
    orderAdjustments: [],
    refundShippingLines: [],
    transactions: [
      {
        id: `${id}/Txn/1`,
        status: "SUCCESS",
        kind: "REFUND",
        createdAt: "2026-08-11T00:00:00Z",
        processedAt: "2026-08-11T00:00:00Z",
        amountSet: bag("10.00"),
      },
    ],
    childrenComplete: true,
    ...overrides,
  };
}

function completeOrder(
  value: OrderFactSnapshot,
): OrderReadResult<OrderFactSnapshot> {
  return { status: "complete", value, cost: ZERO_COST };
}

function completeRefund(value: RefundRead): OrderReadResult<RefundRead> {
  return { status: "complete", value, cost: ZERO_COST };
}

describe("PR6-C B→C compatibility probe", () => {
  it("pins the corrected B typed-read contract SHA", () => {
    expect(B_TYPED_READ_CONTRACT_PIN).toBe(
      "610ed0503a3aa2998aca7228f4fca9617bed23a3",
    );
    expect(B_TYPED_READ_CONTRACT_PIN).not.toBe(
      "d9717f68ea981aa68f108428a31d7726d0ba2a8f",
    );
  });

  it("preserves source values, raw timestamps, and with-code discount authority", () => {
    const gid = "gid://shopify/Order/bc-source";
    const mapped = mapBOrderReadResult(
      completeOrder(orderRead(gid)),
      ctxFor("shop", "tok", 1n, 2n),
    );
    expect(mapped.status).toBe("mapped");
    if (mapped.status !== "mapped") return;
    const order = mapped.observation.order;
    expect(order?.processedAtShopify).toBe("2026-08-01T00:00:00Z");
    expect(order?.shopifyUpdatedAt.toISOString()).toBe(
      "2026-08-10T12:34:56.000Z",
    );
    expect(order?.shopCurrencyCode).toBe("USD");
    expect(order?.presentmentCurrencyCode).toBe("EUR");
    expect(order?.originalTotalPriceSet.shopAmount).toBe("60.00");
    expect(order?.originalTotalPriceSet.presentmentAmount).toBe("54.00");
    expect(order?.lines[0]?.discountedTotalSet.shopAmount).toBe("9.00");
    expect(order?.lines[0]?.discountedTotalSet.shopAmount).not.toBe("9.50");
    expect(order?.lines[0]?.variantGidAtSale).toBe(
      "gid://shopify/ProductVariant/1",
    );
    expect(order?.lines[0]?.shopifyLegacyResourceId).toBeNull();
    expect(order?.agreements[1]?.reason).toBe("REFUND");
    expect(order?.agreements[1]?.sales[0]?.quantity).toBe(-3);
  });

  it("rejects unknown parent identity and does not cast orderId null to a string", () => {
    const refund = refundRead("gid://shopify/Refund/orphan", null);
    const mapped = mapBRefundReadResult(
      completeRefund(refund),
      ctxFor("shop", "tok", 1n, 2n),
    );
    expect(mapped.status).toBe("blocked");
    if (mapped.status !== "blocked") return;
    expect(mapped.code).toBe("unknown_parent_order_gid");
    expect(refund.orderId).toBeNull();
    expect(mapped).not.toHaveProperty("observation");
  });

  it("uses enclosing Order GID for embedded refunds and blocks a contradictory returned parent", () => {
    const orderGid = "gid://shopify/Order/embed";
    const ok = mapBRefundReadResult(
      completeRefund(refundRead("gid://shopify/Refund/embed", null)),
      ctxFor("shop", "tok", 1n, 2n, { enclosingOrderGid: orderGid }),
    );
    expect(ok.status).toBe("mapped");
    if (ok.status === "mapped") {
      expect(ok.observation.refund?.shopifyOrderGid).toBe(orderGid);
    }
    const clash = mapBRefundReadResult(
      completeRefund(
        refundRead("gid://shopify/Refund/clash", "gid://shopify/Order/other"),
      ),
      ctxFor("shop", "tok", 1n, 2n, { enclosingOrderGid: orderGid }),
    );
    expect(clash.status).toBe("blocked");
    if (clash.status === "blocked") {
      expect(clash.code).toBe("contradictory_parent_order_gid");
    }
  });

  it("flows restocked, restockLocationId, and B-supplied refundLineOrdinal", () => {
    const orderGid = "gid://shopify/Order/restock";
    const mapped = mapBRefundReadResult(
      completeRefund(
        refundRead("gid://shopify/Refund/restock", orderGid, {
          refundLineItems: [
            {
              id: null,
              quantity: 1,
              restockType: "CANCEL",
              restocked: false,
              restockLocationId: "gid://shopify/Location/22",
              lineItemId: `${orderGid}/LineItem/1`,
              refundLineOrdinal: 7,
              subtotalSet: bag("10.00"),
              totalTaxSet: bag("0.00"),
              priceSet: bag("10.00"),
            },
          ],
        }),
      ),
      ctxFor("shop", "tok", 1n, 2n),
    );
    expect(mapped.status).toBe("mapped");
    if (mapped.status !== "mapped") return;
    const line = mapped.observation.refund?.lines[0];
    expect(line?.restocked).toBe(false);
    expect(line?.restockLocationGid).toBe("gid://shopify/Location/22");
    expect(line?.refundLineOrdinal).toBe(7);
    expect(line?.refundLineOrdinal).not.toBe(0);
  });

  it("treats null_observed as neutral query evidence, not INACCESSIBLE_HISTORY_WINDOW", () => {
    const bResult: OrderReadResult<OrderFactSnapshot> = {
      status: "null_observed",
      resourceKind: "Order",
      requestedGid: "gid://shopify/Order/null",
      queryCompleted: true,
      nodeReturned: null,
      phase: "initial",
      cost: ZERO_COST,
    };
    expect("kind" in bResult).toBe(false);
    const mapped = mapBOrderReadResult(
      bResult,
      ctxFor("shop", "tok", 1n, 2n),
    );
    expect(mapped.status).toBe("null_observed");
    if (mapped.status !== "null_observed") return;
    expect(mapped.observation.existenceKind).toBe("ABSENT_CONFIRMED_QUERY");
    expect(mapped.observation.existenceKind).not.toBe(
      "INACCESSIBLE_HISTORY_WINDOW",
    );
    expect(mapped.observation.queryCompleted).toBe(true);
    expect(mapped.observation.queryReturnedNull).toBe(true);
  });

  it("does not parse English detail to invent an existence kind (bypass)", () => {
    const incomplete: OrderReadResult<OrderFactSnapshot> = {
      status: "incomplete",
      outcome: "SNAPSHOT_PAGINATION_INCOMPLETE",
      resourceKind: "Order",
      requestedGid: "gid://shopify/Order/inc",
      phase: "lineItems",
      reason: "SNAPSHOT_PAGINATION_INCOMPLETE",
      detail:
        "INACCESSIBLE_HISTORY_WINDOW because the node looked null to the operator",
      cost: ZERO_COST,
    };
    const mapped = mapBOrderReadResult(
      incomplete,
      ctxFor("shop", "tok", 1n, 2n),
    );
    expect(mapped.status).toBe("incomplete");
    if (mapped.status === "incomplete") {
      expect(mapped.reason).toBe("SNAPSHOT_PAGINATION_INCOMPLETE");
      expect(mapped.reason).not.toBe("INACCESSIBLE_HISTORY_WINDOW");
    }
  });

  it("does not treat a continuation failure as null_observed", () => {
    const failure: OrderReadResult<OrderFactSnapshot> = {
      status: "failure",
      kind: "ADMIN_READ_ERROR",
      resourceKind: "Order",
      requestedGid: "gid://shopify/Order/fail",
      phase: "agreements",
      reason: "ADMIN_READ_ERROR",
      detail: "null node after pagination",
      cost: ZERO_COST,
    };
    const mapped = mapBOrderReadResult(
      failure,
      ctxFor("shop", "tok", 1n, 2n),
    );
    expect(mapped.status).toBe("failure");
    if (mapped.status === "failure") {
      expect(mapped.reason).toBe("ADMIN_READ_ERROR");
      expect(mapped.phase).toBe("agreements");
    }
  });

  it("does not fall back to without-code discounts as a second authority (bypass)", () => {
    const gid = "gid://shopify/Order/disc";
    const snapshot = orderRead(gid);
    const mapped = mapBOrderReadResult(
      completeOrder(snapshot),
      ctxFor("shop", "tok", 1n, 2n),
    );
    expect(mapped.status).toBe("mapped");
    if (mapped.status !== "mapped") return;
    const line = snapshot.lineItems[0]!;
    expect(line.discountedTotalSetWithoutCodeDiscounts.shopAmount).toBe("9.50");
    expect(mapped.observation.order?.lines[0]?.discountedTotalSet.shopAmount).toBe(
      line.discountedTotalSetWithCodeDiscounts.shopAmount,
    );
  });
});

describe("PR6-C B→C compatibility probe PostgreSQL", () => {
  let prisma: PrismaClient;
  let shopId: string;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    const shop = await prisma.shop.create({
      data: { myshopifyDomain: "pr6-c-bcompat.myshopify.com" },
    });
    shopId = shop.id;
  }, 600_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function withTenant<T>(
    fn: (client: Client, db: OrderApplyDb) => Promise<T>,
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

  async function applyMapped(
    client: Client,
    db: OrderApplyDb,
    observation: DirectOrderObservation,
    receipt?: {
      applicationKey: string;
      payloadDigest: string;
    },
  ) {
    await insertObservation(client, {
      id: observation.observationToken,
      shopId,
      resourceKind: observation.identity.resourceKind,
      shopifyGid: observation.identity.shopifyGid,
      requestGen: observation.observationRequestGen,
    });
    return applyOrderFacts(db, {
      shopId,
      observations: [observation],
      receipt: receipt
        ? {
            applicationKey: receipt.applicationKey,
            sourceJobType: "probe:b-compat",
            rootDurableJobId: "job-bcompat",
            applyingDurableJobId: "job-bcompat",
            payloadDigest: receipt.payloadDigest,
          }
        : undefined,
    });
  }

  it("persists source money, raw processedAt, restock fields, and with-code totals", async () => {
    const gid = "gid://shopify/Order/bc-pg-source";
    const refundGid = "gid://shopify/Refund/bc-pg-source";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      const resp = await allocateCatalogObservationGeneration(db);
      const mapped = mapBOrderReadResult(
        completeOrder(
          orderRead(gid, {
            refunds: [refundRead(refundGid, gid)],
          }),
        ),
        ctxFor(shopId, "obs-bc-source", req, resp),
      );
      expect(mapped.status).toBe("mapped");
      if (mapped.status !== "mapped") return;
      const result = await applyMapped(client, db, mapped.observation);
      expect(result.results[0]?.outcome).toBe("applied");
      const order = await client.query(
        `SELECT name,
                "processedAtShopify",
                "shopCurrencyCode",
                "presentmentCurrencyCode",
                "originalTotalShopAmount"::text AS shop_amt,
                "originalTotalPresentmentAmount"::text AS pres_amt,
                "retailLocationGid"
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(order.rows[0].processedAtShopify).toBe("2026-08-01T00:00:00Z");
      expect(order.rows[0].shopCurrencyCode).toBe("USD");
      expect(order.rows[0].presentmentCurrencyCode).toBe("EUR");
      expect(order.rows[0].shop_amt).toMatch(/60/);
      expect(order.rows[0].pres_amt).toMatch(/54/);
      expect(order.rows[0].retailLocationGid).toBe("gid://shopify/Location/9");
      const line = await client.query(
        `SELECT "discountedTotalShopAmount"::text AS dt,
                "variantGidAtSale",
                "shopifyLegacyResourceId"
           FROM "ShopifyOrderLineFact" WHERE "shopifyOrderGid" = $1`,
        [gid],
      );
      expect(line.rows[0].dt).toMatch(/9\.0/);
      expect(line.rows[0].dt).not.toMatch(/9\.5/);
      expect(line.rows[0].variantGidAtSale).toBe(
        "gid://shopify/ProductVariant/1",
      );
      expect(line.rows[0].shopifyLegacyResourceId).toBeNull();
      const refundLine = await client.query(
        `SELECT restocked, "restockLocationGid", "refundLineOrdinal"
           FROM "ShopifyOrderRefundLineFact" WHERE "shopifyRefundGid" = $1`,
        [refundGid],
      );
      expect(refundLine.rowCount).toBe(1);
      expect(refundLine.rows[0].restocked).toBe(true);
      expect(refundLine.rows[0].restockLocationGid).toBe(
        "gid://shopify/Location/7",
      );
      expect(refundLine.rows[0].refundLineOrdinal).toBe(2);
    });
  });

  it("does not apply a standalone refund whose B orderId is null", async () => {
    const refundGid = "gid://shopify/Refund/bc-orphan";
    const mapped = mapBRefundReadResult(
      completeRefund(refundRead(refundGid, null)),
      ctxFor(shopId, "obs-bc-orphan", 1n, 2n),
    );
    expect(mapped.status).toBe("blocked");
    await withTenant(async (client) => {
      const refunds = await client.query(
        `SELECT 1 FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(refunds.rowCount).toBe(0);
      const receipts = await client.query(
        `SELECT count(*)::int AS n FROM "SyncApplicationReceipt"
          WHERE "applicationKey" = $1`,
        ["bc-orphan-must-not-exist"],
      );
      expect(receipts.rows[0].n).toBe(0);
    });
  });

  it("adjudicates aged-out null_observed as INACCESSIBLE without taking B's old label", async () => {
    const gid = "gid://shopify/Order/bc-null-aged";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      const resp1 = await allocateCatalogObservationGeneration(db);
      const live = mapBOrderReadResult(
        completeOrder(
          orderRead(gid, {
            processedAt: "2026-01-01T00:00:00Z",
            createdAt: "2026-01-01T00:00:00Z",
            lineItems: [
              lineRead(`${gid}/LineItem/1`, {
                quantity: 1,
                currentQuantity: 1,
              }),
            ],
            agreements: [
              {
                id: `${gid}/Agreement/order`,
                happenedAt: "2026-01-01T00:00:00Z",
                reason: "ORDER",
                typename: "OrderAgreement",
                refundId: null,
                edgeCursor: "c",
                salesComplete: true,
                sales: [
                  {
                    id: `${gid}/Sale/order`,
                    typename: "ProductSale",
                    quantity: 1,
                    lineType: "PRODUCT",
                    actionType: "ORDER",
                    totalAmount: bag("10.00"),
                    lineItemId: `${gid}/LineItem/1`,
                  },
                ],
              },
            ],
          }),
        ),
        ctxFor(shopId, "obs-bc-aged-live", req1, resp1),
      );
      expect(live.status).toBe("mapped");
      if (live.status !== "mapped") return;
      await applyMapped(client, db, live.observation);

      const req2 = await allocateCatalogObservationGeneration(db);
      const resp2 = await allocateCatalogObservationGeneration(db);
      const nullObs = mapBOrderReadResult(
        {
          status: "null_observed",
          resourceKind: "Order",
          requestedGid: gid,
          queryCompleted: true,
          nodeReturned: null,
          phase: "initial",
          cost: ZERO_COST,
        },
        ctxFor(shopId, "obs-bc-aged-null", req2, resp2, {
          existenceObservedAt: new Date("2026-09-11T00:00:00.000Z"),
        }),
      );
      expect(nullObs.status).toBe("null_observed");
      if (nullObs.status !== "null_observed") return;
      expect(nullObs.observation.existenceKind).not.toBe(
        "INACCESSIBLE_HISTORY_WINDOW",
      );
      const result = await applyMapped(client, db, nullObs.observation);
      expect(result.results[0]?.outcome).toBe("applied");
      const row = await client.query(
        `SELECT "existenceState", "existenceKind", "deletedAt", "historyWindowState"
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].existenceState).toBe("LIVE");
      expect(row.rows[0].existenceKind).toBe("INACCESSIBLE_HISTORY_WINDOW");
      expect(row.rows[0].deletedAt).toBeNull();
      expect(row.rows[0].historyWindowState).toBe(
        "ORDER_HISTORY_WINDOW_TRUNCATED",
      );
    });
  });

  it("adjudicates in-window null_observed as a confirmed tombstone", async () => {
    const gid = "gid://shopify/Order/bc-null-window";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      const resp1 = await allocateCatalogObservationGeneration(db);
      const live = mapBOrderReadResult(
        completeOrder(orderRead(gid)),
        ctxFor(shopId, "obs-bc-win-live", req1, resp1, {
          existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
        }),
      );
      expect(live.status).toBe("mapped");
      if (live.status !== "mapped") return;
      await applyMapped(client, db, live.observation);
      const req2 = await allocateCatalogObservationGeneration(db);
      const resp2 = await allocateCatalogObservationGeneration(db);
      const nullObs = mapBOrderReadResult(
        {
          status: "null_observed",
          resourceKind: "Order",
          requestedGid: gid,
          queryCompleted: true,
          nodeReturned: null,
          phase: "initial",
          cost: ZERO_COST,
        },
        ctxFor(shopId, "obs-bc-win-null", req2, resp2, {
          existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
        }),
      );
      expect(nullObs.status).toBe("null_observed");
      if (nullObs.status !== "null_observed") return;
      await applyMapped(client, db, nullObs.observation);
      const row = await client.query(
        `SELECT "existenceState", "existenceKind", "deletionSource"
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].existenceState).toBe("ABSENT");
      expect(row.rows[0].existenceKind).toBe("ABSENT_CONFIRMED_QUERY");
      expect(row.rows[0].deletionSource).toBe("CONFIRMED_QUERY");
    });
  });

  it("maps B incomplete walks to C incomplete with no canonical facts", async () => {
    const gid = "gid://shopify/Order/bc-incomplete";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      const resp = await allocateCatalogObservationGeneration(db);
      const bResult: OrderReadResult<OrderFactSnapshot> = {
        status: "incomplete",
        outcome: "SNAPSHOT_PAGINATION_INCOMPLETE",
        resourceKind: "Order",
        requestedGid: gid,
        phase: "refunds",
        reason: "SNAPSHOT_PAGINATION_INCOMPLETE",
        detail: "do not parse this English as INACCESSIBLE_HISTORY_WINDOW",
        cost: ZERO_COST,
      };
      const mapped = mapBOrderReadResult(
        bResult,
        ctxFor(shopId, "obs-bc-inc", req, resp),
      );
      expect(mapped.status).toBe("incomplete");
      const observation = incompleteObservationFromB(
        bResult,
        ctxFor(shopId, "obs-bc-inc", req, resp),
      );
      expect(observation.existenceKind).not.toBe(
        "INACCESSIBLE_HISTORY_WINDOW",
      );
      const result = await applyMapped(client, db, observation);
      expect(result.results[0]?.outcome).toBe("incomplete");
      const facts = await client.query(
        `SELECT 1 FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(facts.rowCount).toBe(0);
      const obs = await client.query(
        `SELECT "terminalOutcome" FROM "OrderFactObservationInFlight" WHERE id = 'obs-bc-inc'`,
      );
      expect(obs.rows[0].terminalOutcome).toBe(
        "SNAPSHOT_PAGINATION_INCOMPLETE",
      );
    });
  });

  it("rejects malformed required decimal from a complete B payload and retries without a leftover receipt", async () => {
    const gid = "gid://shopify/Order/bc-money";
    const receipt = {
      applicationKey: "bc-money-key",
      payloadDigest: "bc-money-digest-64chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    };
    await expect(
      withTenant(async (client, db) => {
        const req = await allocateCatalogObservationGeneration(db);
        const resp = await allocateCatalogObservationGeneration(db);
        const bad = orderRead(gid, {
          netPaymentSet: bag("not-a-number", "USD", "30.00", "EUR"),
        });
        const mapped = mapBOrderReadResult(
          completeOrder(bad),
          ctxFor(shopId, "obs-bc-money-bad", req, resp),
        );
        expect(mapped.status).toBe("mapped");
        if (mapped.status !== "mapped") return;
        await applyMapped(client, db, mapped.observation, receipt);
      }),
    ).rejects.toBeInstanceOf(OrderApplyReceiptNotCertifiableError);
    await withTenant(async (client, db) => {
      const receipts = await client.query(
        `SELECT count(*)::int AS n FROM "SyncApplicationReceipt" WHERE "applicationKey" = $1`,
        [receipt.applicationKey],
      );
      expect(receipts.rows[0].n).toBe(0);
      const leftover = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(leftover.rows[0].n).toBe(0);
      const req = await allocateCatalogObservationGeneration(db);
      const resp = await allocateCatalogObservationGeneration(db);
      const mapped = mapBOrderReadResult(
        completeOrder(orderRead(gid)),
        ctxFor(shopId, "obs-bc-money-good", req, resp),
      );
      expect(mapped.status).toBe("mapped");
      if (mapped.status !== "mapped") return;
      const applied = await applyMapped(
        client,
        db,
        mapped.observation,
        receipt,
      );
      expect(applied.receiptStatus).toBe("applied");
      const after = await client.query(
        `SELECT count(*)::int AS n FROM "SyncApplicationReceipt" WHERE "applicationKey" = $1`,
        [receipt.applicationKey],
      );
      expect(after.rows[0].n).toBe(1);
    });
  });

  it("mixed-exchange 6/3/3/0 is unit-clean; stale ordered-5 is LINE_UNIT_IDENTITY_INCONSISTENT", async () => {
    const cleanGid = "gid://shopify/Order/bc-units-clean";
    const staleGid = "gid://shopify/Order/bc-units-stale";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      const resp1 = await allocateCatalogObservationGeneration(db);
      const clean = mapBOrderReadResult(
        completeOrder(orderRead(cleanGid)),
        ctxFor(shopId, "obs-bc-units-clean", req1, resp1),
      );
      expect(clean.status).toBe("mapped");
      if (clean.status !== "mapped") return;
      expect(clean.observation.order?.agreements[1]?.reason).toBe("REFUND");
      expect(clean.observation.order?.agreements[1]?.agreementTypename).toBe(
        "RefundAgreement",
      );
      await applyMapped(client, db, clean.observation);
      const cleanDiag = await client.query(
        `SELECT "unitDiagnosticState" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [cleanGid],
      );
      expect(cleanDiag.rows[0].unitDiagnosticState).toBeNull();

      const req2 = await allocateCatalogObservationGeneration(db);
      const resp2 = await allocateCatalogObservationGeneration(db);
      const stale = mapBOrderReadResult(
        completeOrder(
          orderRead(staleGid, {
            lineItems: [
              lineRead(`${staleGid}/LineItem/1`, {
                quantity: 5,
                currentQuantity: 3,
              }),
            ],
          }),
        ),
        ctxFor(shopId, "obs-bc-units-stale", req2, resp2),
      );
      expect(stale.status).toBe("mapped");
      if (stale.status !== "mapped") return;
      await applyMapped(client, db, stale.observation);
      const staleDiag = await client.query(
        `SELECT "unitDiagnosticState" FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [staleGid],
      );
      expect(staleDiag.rows[0].unitDiagnosticState).toBe(
        DIAGNOSTIC.LINE_UNIT,
      );
    });
  });

  it("preserves established at-sale GIDs when a later B read reports a different current variant", async () => {
    const gid = "gid://shopify/Order/bc-atsale";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      const resp1 = await allocateCatalogObservationGeneration(db);
      const first = mapBOrderReadResult(
        completeOrder(orderRead(gid)),
        ctxFor(shopId, "obs-bc-atsale-1", req1, resp1),
      );
      expect(first.status).toBe("mapped");
      if (first.status !== "mapped") return;
      await applyMapped(client, db, first.observation);
      const req2 = await allocateCatalogObservationGeneration(db);
      const resp2 = await allocateCatalogObservationGeneration(db);
      const later = mapBOrderReadResult(
        completeOrder(
          orderRead(gid, {
            updatedAt: "2026-08-20T00:00:00Z",
            lineItems: [
              lineRead(`${gid}/LineItem/1`, {
                sku: "SKU-RECREATED",
                variant: {
                  id: "gid://shopify/ProductVariant/99",
                  legacyResourceId: "99",
                  sku: "SKU-RECREATED",
                },
                product: {
                  id: "gid://shopify/Product/99",
                  legacyResourceId: "99",
                },
              }),
            ],
          }),
        ),
        ctxFor(shopId, "obs-bc-atsale-2", req2, resp2),
      );
      expect(later.status).toBe("mapped");
      if (later.status !== "mapped") return;
      expect(later.observation.order?.lines[0]?.currentVariantGid).toBe(
        "gid://shopify/ProductVariant/99",
      );
      expect(later.observation.order?.lines[0]?.variantGidAtSale).toBe(
        "gid://shopify/ProductVariant/99",
      );
      await applyMapped(client, db, later.observation);
      const line = await client.query(
        `SELECT "variantGidAtSale", "currentVariantGid", sku
           FROM "ShopifyOrderLineFact" WHERE "shopifyOrderGid" = $1`,
        [gid],
      );
      expect(line.rows[0].variantGidAtSale).toBe(
        "gid://shopify/ProductVariant/1",
      );
      expect(line.rows[0].currentVariantGid).toBe(
        "gid://shopify/ProductVariant/99",
      );
      expect(line.rows[0].sku).toBe("SKU-RECREATED");
    });
  });
});
