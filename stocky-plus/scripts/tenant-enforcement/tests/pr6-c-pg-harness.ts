/**
 * Shared disposable-PostgreSQL helpers for PR6-C evidence harnesses.
 */
import { Client } from "pg";
import type { OrderApplyDb } from "../../../app/lib/order-facts/apply/sql";
import type {
  DirectOrderObservation,
  OrderLineSnapshot,
  OrderSnapshot,
} from "../../../app/lib/order-facts/apply/types";
import { getRuntimeClient } from "../connection";
import { ENFORCEMENT_CONTEXT_VERSION } from "../manifest";

export function bag(amount: string, currency = "USD") {
  return {
    shopAmount: amount,
    shopCurrencyCode: currency,
    presentmentAmount: amount,
    presentmentCurrencyCode: currency,
  };
}

export function asQueryRaw(client: Client, onQuery?: () => void): OrderApplyDb {
  return {
    async $queryRaw(strings, ...values) {
      onQuery?.();
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

export async function setTenant(client: Client, shopId: string): Promise<void> {
  await client.query(`SELECT set_config('stocky.current_shop_id', $1, true)`, [
    shopId,
  ]);
  await client.query(
    `SELECT set_config('stocky.tenant_context_version', $1, true)`,
    [ENFORCEMENT_CONTEXT_VERSION],
  );
}

export async function insertObservation(
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

export function line(
  gid: string,
  overrides: Partial<OrderLineSnapshot> = {},
): OrderLineSnapshot {
  return {
    shopifyGid: gid,
    quantity: 1,
    currentQuantity: 1,
    refundableQuantity: 1,
    unfulfilledQuantity: 1,
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
    originalTotalSet: bag("1.00"),
    originalUnitPriceSet: bag("1.00"),
    discountedTotalSet: bag("1.00"),
    totalDiscountSet: bag("0.00"),
    ...overrides,
  };
}

export function orderSnapshot(
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
    currentSubtotalLineItemsQuantity: overrides.lines?.length ?? 1,
    subtotalLineItemsQuantity: overrides.lines?.length ?? 1,
    shopifyLegacyResourceId: "1001",
    originalTotalPriceSet: bag("1.00"),
    currentTotalPriceSet: bag("1.00"),
    currentSubtotalPriceSet: bag("1.00"),
    currentTotalDiscountsSet: bag("0.00"),
    currentTotalTaxSet: bag("0.00"),
    totalRefundedSet: bag("0.00"),
    netPaymentSet: bag("1.00"),
    lines: [defaultLine],
    linesComplete: true,
    agreements: [],
    agreementsComplete: true,
    ...overrides,
  };
}

export function liveOrder(
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

export function receiptFor(key: string, digest: string) {
  return {
    applicationKey: key,
    sourceJobType: "webhook:orders/create",
    rootDurableJobId: `job-${key}`,
    applyingDurableJobId: `job-${key}`,
    payloadDigest: digest.padEnd(48, "x").slice(0, 64),
  };
}

export async function openTenant(shopId: string): Promise<{
  client: Client;
  db: OrderApplyDb;
}> {
  const client = await getRuntimeClient();
  await client.query("BEGIN");
  await setTenant(client, shopId);
  return { client, db: asQueryRaw(client) };
}

export async function countTable(
  shopId: string,
  table: "ShopifyOrderFact" | "SyncApplicationReceipt" | "ShopifyOrderLineFact",
  column: string,
  value: string,
): Promise<number> {
  const client = await getRuntimeClient();
  try {
    await client.query("BEGIN");
    await setTenant(client, shopId);
    const rows = await client.query(
      `SELECT count(*)::int AS n FROM "${table}" WHERE "${column}" = $1`,
      [value],
    );
    await client.query("COMMIT");
    return rows.rows[0].n as number;
  } finally {
    await client.end();
  }
}
