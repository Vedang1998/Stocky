/**
 * Order-fact writers. INSERT and UPDATE only — never DELETE/deleteMany.
 * Unique races retry the full apply. Do not use conflict-target upsert.
 */
import type { OrderSourceKind } from "../types";
import type { GenerationInterval } from "./clocks";
import {
  OrderApplyAffectedRowError,
  OrderApplyProcessingDisabledError,
} from "./errors";
import type { ExistenceDecision } from "./existence";
import { parseRequiredMoneyBag } from "./money";
import {
  parseAdjustmentMoney,
  parseLineMoney,
  parseOrderMoney,
  parseRefundMoney,
  parseSaleMoney,
  refundShopCurrency,
} from "./parse";
import {
  asBigIntOrNull,
  asBool,
  asDate,
  asString,
  asStringArray,
  newFactId,
  queryRows,
  throwIfUniqueViolation,
  type OrderApplyDb,
} from "./sql";
import type {
  AdjustmentSnapshot,
  AgreementSnapshot,
  OrderLineSnapshot,
  OrderSnapshot,
  RefundLineSnapshot,
  RefundSnapshot,
  SaleSnapshot,
  TransactionSnapshot,
} from "./types";

export type OrderFactRow = {
  id: string;
  existenceState: "LIVE" | "ABSENT";
  existenceKind: string;
  existenceRequestGen: bigint | null;
  existenceResponseGen: bigint | null;
  existenceDiagnosticState: string | null;
  historyWindowState: string | null;
  shopifyCreatedAt: Date | null;
  shopifyUpdatedAt: Date | null;
  processedAt: Date | null;
  deletedAt: Date | null;
  deletionSource: string | null;
  accessScopeSnapshot: string[];
  shopCurrencyCode: string;
  cancelledAt: Date | null;
  test: boolean;
  variantGidAtSale?: string | null;
  productGidAtSale?: string | null;
};

function mapFactRow(row: Record<string, unknown>): OrderFactRow {
  return {
    id: String(row.id),
    existenceState: row.existenceState as "LIVE" | "ABSENT",
    existenceKind: String(row.existenceKind),
    existenceRequestGen: asBigIntOrNull(
      row.existenceRequestGen,
      "existenceRequestGen",
    ),
    existenceResponseGen: asBigIntOrNull(
      row.existenceResponseGen,
      "existenceResponseGen",
    ),
    existenceDiagnosticState: asString(row.existenceDiagnosticState),
    historyWindowState: asString(row.historyWindowState),
    shopifyCreatedAt: asDate(row.shopifyCreatedAt),
    shopifyUpdatedAt: asDate(row.shopifyUpdatedAt),
    processedAt: asDate(row.processedAt),
    deletedAt: asDate(row.deletedAt),
    deletionSource: asString(row.deletionSource),
    accessScopeSnapshot: asStringArray(row.accessScopeSnapshot),
    shopCurrencyCode: asString(row.shopCurrencyCode) ?? "USD",
    cancelledAt: asDate(row.cancelledAt),
    test: asBool(row.test, false),
    variantGidAtSale: asString(row.variantGidAtSale),
    productGidAtSale: asString(row.productGidAtSale),
  };
}

export async function lockAndReadOrderFact(
  db: OrderApplyDb,
  shopId: string,
  shopifyGid: string,
): Promise<OrderFactRow | null> {
  const rows = await queryRows<Record<string, unknown>>(db)`
    SELECT id, "existenceState", "existenceKind", "existenceRequestGen",
           "existenceResponseGen", "existenceDiagnosticState", "historyWindowState",
           "shopifyCreatedAt", "shopifyUpdatedAt", "processedAt", "deletedAt",
           "deletionSource", "accessScopeSnapshot", "shopCurrencyCode",
           "cancelledAt", test
      FROM "ShopifyOrderFact"
     WHERE "shopId" = ${shopId} AND "shopifyGid" = ${shopifyGid}
     FOR UPDATE`;
  return rows[0] ? mapFactRow(rows[0]) : null;
}

export async function lockAndReadRefundFact(
  db: OrderApplyDb,
  shopId: string,
  shopifyGid: string,
): Promise<OrderFactRow | null> {
  const rows = await queryRows<Record<string, unknown>>(db)`
    SELECT id, "existenceState", "existenceKind", "existenceRequestGen",
           "existenceResponseGen", "existenceDiagnosticState", "historyWindowState",
           "shopifyCreatedAt", "shopifyUpdatedAt", "processedAt", "deletedAt",
           "deletionSource", "accessScopeSnapshot",
           "totalRefundedShopCurrencyCode",
           NULL::timestamptz AS "cancelledAt", false AS test
      FROM "ShopifyOrderRefundFact"
     WHERE "shopId" = ${shopId} AND "shopifyGid" = ${shopifyGid}
     FOR UPDATE`;
  if (!rows[0]) return null;
  const mapped = mapFactRow({
    ...rows[0],
    shopCurrencyCode: rows[0].totalRefundedShopCurrencyCode,
  });
  return mapped;
}

function genPair(interval: GenerationInterval | null): {
  request: string | null;
  response: string | null;
} {
  if (!interval) return { request: null, response: null };
  return {
    request: interval.requestGen.toString(),
    response: interval.responseGen.toString(),
  };
}

function liveExistenceColumns(write: ExistenceWriteInput): {
  state: "LIVE" | "ABSENT";
  kind: string;
  observedAt: Date;
  request: string | null;
  response: string | null;
  scopesJson: string;
  sourceKind: OrderSourceKind;
} {
  const gens = genPair(
    write.decision.nextKind === "LIVE_FULL_SYNC_PRESENT" ? null : write.interval,
  );
  return {
    state: write.decision.nextState,
    kind: write.decision.nextKind,
    observedAt: write.observedAt,
    request: gens.request,
    response: gens.response,
    scopesJson: JSON.stringify([...write.accessScopeSnapshot]),
    sourceKind: write.sourceKind,
  };
}

function childAbsenceInterval(
  write: ExistenceWriteInput,
): GenerationInterval | null {
  if (write.decision.nextKind === "LIVE_FULL_SYNC_PRESENT") return null;
  if (!write.interval) return null;
  return write.interval;
}

function refundLineAbsenceKey(lineItemGid: string, ordinal: number): string {
  return `${lineItemGid}\u001f${String(ordinal)}`;
}

export type ExistenceWriteInput = {
  decision: Extract<ExistenceDecision, { mutate: true }>;
  interval: GenerationInterval | null;
  observedAt: Date;
  sourceKind: OrderSourceKind;
  accessScopeSnapshot: readonly string[];
};

function deletionSourceSql(
  source: "CONFIRMED_QUERY" | "WEBHOOK" | null,
): string | null {
  return source;
}

async function requireSingleUpdatedRow(
  rows: { id: string }[],
  context: string,
): Promise<void> {
  if (rows.length !== 1) {
    throw new OrderApplyAffectedRowError(context, rows.length);
  }
}

export async function insertOrderFact(
  db: OrderApplyDb,
  shopId: string,
  order: OrderSnapshot,
  write: ExistenceWriteInput,
  sourceKind: OrderSourceKind,
): Promise<string> {
  const money = parseOrderMoney(order);
  const id = newFactId();
  const gens = genPair(
    write.decision.nextKind === "LIVE_FULL_SYNC_PRESENT"
      ? null
      : write.interval,
  );
  const scopes = [...write.accessScopeSnapshot];
  try {
    await queryRows(db)`
      INSERT INTO "ShopifyOrderFact" (
        id, "shopId", "shopifyGid", name,
        "shopifyCreatedAt", "shopifyUpdatedAt",
        "processedAt", "processedAtShopify",
        "cancelledAt", "cancelReason", closed, "closedAt",
        edited, test, confirmed,
        "shopCurrencyCode", "presentmentCurrencyCode", "taxesIncluded",
        "displayFinancialStatus", "displayFulfillmentStatus", "sourceName",
        "retailLocationGid",
        "currentSubtotalLineItemsQuantity", "subtotalLineItemsQuantity",
        "originalTotalShopAmount", "originalTotalShopCurrencyCode",
        "originalTotalPresentmentAmount", "originalTotalPresentmentCurrencyCode",
        "currentTotalShopAmount", "currentTotalShopCurrencyCode",
        "currentTotalPresentmentAmount", "currentTotalPresentmentCurrencyCode",
        "currentSubtotalShopAmount", "currentSubtotalShopCurrencyCode",
        "currentSubtotalPresentmentAmount", "currentSubtotalPresentmentCurrencyCode",
        "currentTotalDiscountsShopAmount", "currentTotalDiscountsShopCurrencyCode",
        "currentTotalDiscountsPresentmentAmount", "currentTotalDiscountsPresentmentCurrencyCode",
        "currentTotalTaxShopAmount", "currentTotalTaxShopCurrencyCode",
        "currentTotalTaxPresentmentAmount", "currentTotalTaxPresentmentCurrencyCode",
        "totalRefundedShopAmount", "totalRefundedShopCurrencyCode",
        "totalRefundedPresentmentAmount", "totalRefundedPresentmentCurrencyCode",
        "netPaymentShopAmount", "netPaymentShopCurrencyCode",
        "netPaymentPresentmentAmount", "netPaymentPresentmentCurrencyCode",
        "refundDiscrepancyShopAmount", "refundDiscrepancyShopCurrencyCode",
        "refundDiscrepancyPresentmentAmount", "refundDiscrepancyPresentmentCurrencyCode",
        "cartDiscountShopAmount", "cartDiscountShopCurrencyCode",
        "cartDiscountPresentmentAmount", "cartDiscountPresentmentCurrencyCode",
        "currentCartDiscountShopAmount", "currentCartDiscountShopCurrencyCode",
        "currentCartDiscountPresentmentAmount", "currentCartDiscountPresentmentCurrencyCode",
        "currentShippingShopAmount", "currentShippingShopCurrencyCode",
        "currentShippingPresentmentAmount", "currentShippingPresentmentCurrencyCode",
        "existenceState", "existenceKind", "existenceObservedAt",
        "existenceRequestGen", "existenceResponseGen",
        "attributeRequestGen", "attributeResponseGen",
        "attributeFreshnessState",
        "existenceDiagnosticState", "historyWindowState",
        "sourceKind", "accessScopeSnapshot",
        "deletedAt", "deletionSource",
        "shopifyLegacyResourceId",
        "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${shopId}, ${order.shopifyGid}, ${order.name},
        ${order.shopifyCreatedAt}, ${order.shopifyUpdatedAt},
        ${order.processedAt}, ${order.processedAtShopify},
        ${order.cancelledAt}, ${order.cancelReason}, ${order.closed}, ${order.closedAt},
        ${order.edited}, ${order.test}, ${order.confirmed},
        ${order.shopCurrencyCode}, ${order.presentmentCurrencyCode}, ${order.taxesIncluded},
        ${order.displayFinancialStatus}, ${order.displayFulfillmentStatus}, ${order.sourceName},
        ${order.retailLocationGid},
        ${order.currentSubtotalLineItemsQuantity}, ${order.subtotalLineItemsQuantity},
        ${money.originalTotalPriceSet.shopAmount}::numeric, ${money.originalTotalPriceSet.shopCurrencyCode},
        ${money.originalTotalPriceSet.presentmentAmount}::numeric, ${money.originalTotalPriceSet.presentmentCurrencyCode},
        ${money.currentTotalPriceSet.shopAmount}::numeric, ${money.currentTotalPriceSet.shopCurrencyCode},
        ${money.currentTotalPriceSet.presentmentAmount}::numeric, ${money.currentTotalPriceSet.presentmentCurrencyCode},
        ${money.currentSubtotalPriceSet.shopAmount}::numeric, ${money.currentSubtotalPriceSet.shopCurrencyCode},
        ${money.currentSubtotalPriceSet.presentmentAmount}::numeric, ${money.currentSubtotalPriceSet.presentmentCurrencyCode},
        ${money.currentTotalDiscountsSet.shopAmount}::numeric, ${money.currentTotalDiscountsSet.shopCurrencyCode},
        ${money.currentTotalDiscountsSet.presentmentAmount}::numeric, ${money.currentTotalDiscountsSet.presentmentCurrencyCode},
        ${money.currentTotalTaxSet.shopAmount}::numeric, ${money.currentTotalTaxSet.shopCurrencyCode},
        ${money.currentTotalTaxSet.presentmentAmount}::numeric, ${money.currentTotalTaxSet.presentmentCurrencyCode},
        ${money.totalRefundedSet.shopAmount}::numeric, ${money.totalRefundedSet.shopCurrencyCode},
        ${money.totalRefundedSet.presentmentAmount}::numeric, ${money.totalRefundedSet.presentmentCurrencyCode},
        ${money.netPaymentSet.shopAmount}::numeric, ${money.netPaymentSet.shopCurrencyCode},
        ${money.netPaymentSet.presentmentAmount}::numeric, ${money.netPaymentSet.presentmentCurrencyCode},
        ${money.refundDiscrepancySet?.shopAmount ?? null}::numeric, ${money.refundDiscrepancySet?.shopCurrencyCode ?? null},
        ${money.refundDiscrepancySet?.presentmentAmount ?? null}::numeric, ${money.refundDiscrepancySet?.presentmentCurrencyCode ?? null},
        ${money.cartDiscountAmountSet?.shopAmount ?? null}::numeric, ${money.cartDiscountAmountSet?.shopCurrencyCode ?? null},
        ${money.cartDiscountAmountSet?.presentmentAmount ?? null}::numeric, ${money.cartDiscountAmountSet?.presentmentCurrencyCode ?? null},
        ${money.currentCartDiscountAmountSet?.shopAmount ?? null}::numeric, ${money.currentCartDiscountAmountSet?.shopCurrencyCode ?? null},
        ${money.currentCartDiscountAmountSet?.presentmentAmount ?? null}::numeric, ${money.currentCartDiscountAmountSet?.presentmentCurrencyCode ?? null},
        ${money.currentShippingPriceSet?.shopAmount ?? null}::numeric, ${money.currentShippingPriceSet?.shopCurrencyCode ?? null},
        ${money.currentShippingPriceSet?.presentmentAmount ?? null}::numeric, ${money.currentShippingPriceSet?.presentmentCurrencyCode ?? null},
        ${write.decision.nextState}::"OrderExistenceState",
        ${write.decision.nextKind}::"OrderExistenceKind",
        ${write.observedAt},
        ${gens.request}::bigint, ${gens.response}::bigint,
        ${gens.request}::bigint, ${gens.response}::bigint,
        'ORDERED'::"OrderAttributeFreshnessState",
        ${write.decision.diagnostic}, ${write.decision.historyWindowState ?? null},
        ${sourceKind}::"OrderSourceKind", ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(scopes)}::jsonb)),
        ${write.decision.deletedAtNow ? write.observedAt : null},
        ${deletionSourceSql(write.decision.deletionSource)}::"OrderDeletionSource",
        ${order.shopifyLegacyResourceId},
        clock_timestamp(), clock_timestamp()
      )`;
  } catch (error) {
    throwIfUniqueViolation(error);
  }
  return id;
}

export async function updateOrderAttributes(
  db: OrderApplyDb,
  shopId: string,
  factId: string,
  order: OrderSnapshot,
  interval: GenerationInterval | null,
  unitDiagnostic: string | null,
): Promise<void> {
  const money = parseOrderMoney(order);
  const gens = genPair(interval);
  await queryRows(db)`
    UPDATE "ShopifyOrderFact"
       SET name = ${order.name},
           "shopifyCreatedAt" = ${order.shopifyCreatedAt},
           "shopifyUpdatedAt" = ${order.shopifyUpdatedAt},
           "processedAt" = ${order.processedAt},
           "processedAtShopify" = ${order.processedAtShopify},
           "cancelledAt" = ${order.cancelledAt},
           "cancelReason" = ${order.cancelReason},
           closed = ${order.closed},
           "closedAt" = ${order.closedAt},
           edited = ${order.edited},
           test = ${order.test},
           confirmed = ${order.confirmed},
           "shopCurrencyCode" = ${order.shopCurrencyCode},
           "presentmentCurrencyCode" = ${order.presentmentCurrencyCode},
           "taxesIncluded" = ${order.taxesIncluded},
           "displayFinancialStatus" = ${order.displayFinancialStatus},
           "displayFulfillmentStatus" = ${order.displayFulfillmentStatus},
           "sourceName" = ${order.sourceName},
           "retailLocationGid" = ${order.retailLocationGid},
           "currentSubtotalLineItemsQuantity" = ${order.currentSubtotalLineItemsQuantity},
           "subtotalLineItemsQuantity" = ${order.subtotalLineItemsQuantity},
           "originalTotalShopAmount" = ${money.originalTotalPriceSet.shopAmount}::numeric,
           "originalTotalShopCurrencyCode" = ${money.originalTotalPriceSet.shopCurrencyCode},
           "originalTotalPresentmentAmount" = ${money.originalTotalPriceSet.presentmentAmount}::numeric,
           "originalTotalPresentmentCurrencyCode" = ${money.originalTotalPriceSet.presentmentCurrencyCode},
           "currentTotalShopAmount" = ${money.currentTotalPriceSet.shopAmount}::numeric,
           "currentTotalShopCurrencyCode" = ${money.currentTotalPriceSet.shopCurrencyCode},
           "currentTotalPresentmentAmount" = ${money.currentTotalPriceSet.presentmentAmount}::numeric,
           "currentTotalPresentmentCurrencyCode" = ${money.currentTotalPriceSet.presentmentCurrencyCode},
           "currentSubtotalShopAmount" = ${money.currentSubtotalPriceSet.shopAmount}::numeric,
           "currentSubtotalShopCurrencyCode" = ${money.currentSubtotalPriceSet.shopCurrencyCode},
           "currentSubtotalPresentmentAmount" = ${money.currentSubtotalPriceSet.presentmentAmount}::numeric,
           "currentSubtotalPresentmentCurrencyCode" = ${money.currentSubtotalPriceSet.presentmentCurrencyCode},
           "currentTotalDiscountsShopAmount" = ${money.currentTotalDiscountsSet.shopAmount}::numeric,
           "currentTotalDiscountsShopCurrencyCode" = ${money.currentTotalDiscountsSet.shopCurrencyCode},
           "currentTotalDiscountsPresentmentAmount" = ${money.currentTotalDiscountsSet.presentmentAmount}::numeric,
           "currentTotalDiscountsPresentmentCurrencyCode" = ${money.currentTotalDiscountsSet.presentmentCurrencyCode},
           "currentTotalTaxShopAmount" = ${money.currentTotalTaxSet.shopAmount}::numeric,
           "currentTotalTaxShopCurrencyCode" = ${money.currentTotalTaxSet.shopCurrencyCode},
           "currentTotalTaxPresentmentAmount" = ${money.currentTotalTaxSet.presentmentAmount}::numeric,
           "currentTotalTaxPresentmentCurrencyCode" = ${money.currentTotalTaxSet.presentmentCurrencyCode},
           "totalRefundedShopAmount" = ${money.totalRefundedSet.shopAmount}::numeric,
           "totalRefundedShopCurrencyCode" = ${money.totalRefundedSet.shopCurrencyCode},
           "totalRefundedPresentmentAmount" = ${money.totalRefundedSet.presentmentAmount}::numeric,
           "totalRefundedPresentmentCurrencyCode" = ${money.totalRefundedSet.presentmentCurrencyCode},
           "netPaymentShopAmount" = ${money.netPaymentSet.shopAmount}::numeric,
           "netPaymentShopCurrencyCode" = ${money.netPaymentSet.shopCurrencyCode},
           "netPaymentPresentmentAmount" = ${money.netPaymentSet.presentmentAmount}::numeric,
           "netPaymentPresentmentCurrencyCode" = ${money.netPaymentSet.presentmentCurrencyCode},
           "refundDiscrepancyShopAmount" = ${money.refundDiscrepancySet?.shopAmount ?? null}::numeric,
           "refundDiscrepancyShopCurrencyCode" = ${money.refundDiscrepancySet?.shopCurrencyCode ?? null},
           "refundDiscrepancyPresentmentAmount" = ${money.refundDiscrepancySet?.presentmentAmount ?? null}::numeric,
           "refundDiscrepancyPresentmentCurrencyCode" = ${money.refundDiscrepancySet?.presentmentCurrencyCode ?? null},
           "cartDiscountShopAmount" = ${money.cartDiscountAmountSet?.shopAmount ?? null}::numeric,
           "cartDiscountShopCurrencyCode" = ${money.cartDiscountAmountSet?.shopCurrencyCode ?? null},
           "cartDiscountPresentmentAmount" = ${money.cartDiscountAmountSet?.presentmentAmount ?? null}::numeric,
           "cartDiscountPresentmentCurrencyCode" = ${money.cartDiscountAmountSet?.presentmentCurrencyCode ?? null},
           "currentCartDiscountShopAmount" = ${money.currentCartDiscountAmountSet?.shopAmount ?? null}::numeric,
           "currentCartDiscountShopCurrencyCode" = ${money.currentCartDiscountAmountSet?.shopCurrencyCode ?? null},
           "currentCartDiscountPresentmentAmount" = ${money.currentCartDiscountAmountSet?.presentmentAmount ?? null}::numeric,
           "currentCartDiscountPresentmentCurrencyCode" = ${money.currentCartDiscountAmountSet?.presentmentCurrencyCode ?? null},
           "currentShippingShopAmount" = ${money.currentShippingPriceSet?.shopAmount ?? null}::numeric,
           "currentShippingShopCurrencyCode" = ${money.currentShippingPriceSet?.shopCurrencyCode ?? null},
           "currentShippingPresentmentAmount" = ${money.currentShippingPriceSet?.presentmentAmount ?? null}::numeric,
           "currentShippingPresentmentCurrencyCode" = ${money.currentShippingPriceSet?.presentmentCurrencyCode ?? null},
           "attributeRequestGen" = ${gens.request}::bigint,
           "attributeResponseGen" = ${gens.response}::bigint,
           "unitDiagnosticState" = ${unitDiagnostic},
           "shopifyLegacyResourceId" = ${order.shopifyLegacyResourceId},
           "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND id = ${factId}`;
}

export async function updateOrderExistence(
  db: OrderApplyDb,
  shopId: string,
  factId: string,
  write: ExistenceWriteInput,
): Promise<void> {
  const gens = genPair(
    write.decision.nextKind === "LIVE_FULL_SYNC_PRESENT"
      ? null
      : write.interval,
  );
  const scopes = [...write.accessScopeSnapshot];
  const updated = await queryRows<{ id: string }>(db)`
    UPDATE "ShopifyOrderFact"
       SET "existenceState" = ${write.decision.nextState}::"OrderExistenceState",
           "existenceKind" = ${write.decision.nextKind}::"OrderExistenceKind",
           "existenceObservedAt" = ${write.observedAt},
           "existenceRequestGen" = ${gens.request}::bigint,
           "existenceResponseGen" = ${gens.response}::bigint,
           "existenceDiagnosticState" = ${write.decision.diagnostic},
           "historyWindowState" = ${write.decision.historyWindowState ?? null},
           "deletedAt" = CASE
             WHEN ${write.decision.nextState} = 'LIVE' THEN NULL
             WHEN ${write.decision.deletedAtNow} THEN COALESCE("deletedAt", ${write.observedAt})
             ELSE "deletedAt"
           END,
           "deletionSource" = CASE
             WHEN ${write.decision.nextState} = 'LIVE' THEN NULL
             ELSE ${deletionSourceSql(write.decision.deletionSource)}::"OrderDeletionSource"
           END,
           "accessScopeSnapshot" = ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(scopes)}::jsonb)),
           "attributeFreshnessState" = CASE
             WHEN ${write.decision.nextKind} = 'INACCESSIBLE_HISTORY_WINDOW'
             THEN 'DEGRADED'::"OrderAttributeFreshnessState"
             ELSE "attributeFreshnessState"
           END,
           "sourceKind" = ${write.sourceKind}::"OrderSourceKind",
           "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND id = ${factId}
     RETURNING id`;
  await requireSingleUpdatedRow(updated, "ShopifyOrderFact existence");
}

export async function updateOrderDiagnosticsOnly(
  db: OrderApplyDb,
  shopId: string,
  factId: string,
  diagnostic: string | null,
  historyWindowState: string | null,
): Promise<void> {
  const updated = await queryRows<{ id: string }>(db)`
    UPDATE "ShopifyOrderFact"
       SET "existenceDiagnosticState" = COALESCE(${diagnostic}, "existenceDiagnosticState"),
           "historyWindowState" = COALESCE(${historyWindowState}, "historyWindowState"),
           "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND id = ${factId}
     RETURNING id`;
  await requireSingleUpdatedRow(updated, "ShopifyOrderFact diagnostics");
}

export async function updateRefundExistence(
  db: OrderApplyDb,
  shopId: string,
  factId: string,
  write: ExistenceWriteInput,
): Promise<void> {
  const gens = genPair(
    write.decision.nextKind === "LIVE_FULL_SYNC_PRESENT"
      ? null
      : write.interval,
  );
  const scopes = [...write.accessScopeSnapshot];
  const updated = await queryRows<{ id: string }>(db)`
    UPDATE "ShopifyOrderRefundFact"
       SET "existenceState" = ${write.decision.nextState}::"OrderExistenceState",
           "existenceKind" = ${write.decision.nextKind}::"OrderExistenceKind",
           "existenceObservedAt" = ${write.observedAt},
           "existenceRequestGen" = ${gens.request}::bigint,
           "existenceResponseGen" = ${gens.response}::bigint,
           "existenceDiagnosticState" = ${write.decision.diagnostic},
           "historyWindowState" = ${write.decision.historyWindowState ?? null},
           "deletedAt" = CASE
             WHEN ${write.decision.nextState} = 'LIVE' THEN NULL
             WHEN ${write.decision.deletedAtNow} THEN COALESCE("deletedAt", ${write.observedAt})
             ELSE "deletedAt"
           END,
           "deletionSource" = CASE
             WHEN ${write.decision.nextState} = 'LIVE' THEN NULL
             ELSE ${deletionSourceSql(write.decision.deletionSource)}::"OrderDeletionSource"
           END,
           "accessScopeSnapshot" = ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(scopes)}::jsonb)),
           "attributeFreshnessState" = CASE
             WHEN ${write.decision.nextKind} = 'INACCESSIBLE_HISTORY_WINDOW'
             THEN 'DEGRADED'::"OrderAttributeFreshnessState"
             ELSE "attributeFreshnessState"
           END,
           "sourceKind" = ${write.sourceKind}::"OrderSourceKind",
           "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND id = ${factId}
     RETURNING id`;
  await requireSingleUpdatedRow(updated, "ShopifyOrderRefundFact existence");
}

export async function updateRefundDiagnosticsOnly(
  db: OrderApplyDb,
  shopId: string,
  factId: string,
  diagnostic: string | null,
  historyWindowState: string | null,
): Promise<void> {
  const updated = await queryRows<{ id: string }>(db)`
    UPDATE "ShopifyOrderRefundFact"
       SET "existenceDiagnosticState" = COALESCE(${diagnostic}, "existenceDiagnosticState"),
           "historyWindowState" = COALESCE(${historyWindowState}, "historyWindowState"),
           "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND id = ${factId}
     RETURNING id`;
  await requireSingleUpdatedRow(updated, "ShopifyOrderRefundFact diagnostics");
}

export async function nominateAbsenceCandidate(
  db: OrderApplyDb,
  shopId: string,
  factId: string,
): Promise<void> {
  await queryRows(db)`
    UPDATE "ShopifyOrderFact"
       SET "absenceNominationState" = 'CANDIDATE'::"OrderAbsenceNominationState",
           "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId}
       AND id = ${factId}
       AND "existenceState" = 'LIVE'
       AND "deletedAt" IS NULL`;
}

export async function upsertOrderLine(
  db: OrderApplyDb,
  shopId: string,
  order: OrderSnapshot,
  line: OrderLineSnapshot,
  write: ExistenceWriteInput,
  sourceKind: OrderSourceKind,
): Promise<void> {
  const money = parseLineMoney(line, order.shopCurrencyCode);
  const gens = genPair(
    write.decision.nextKind === "LIVE_FULL_SYNC_PRESENT" ? null : write.interval,
  );
  const live = liveExistenceColumns(write);
  const scopes = [...write.accessScopeSnapshot];
  const existing = await queryRows<{
    id: string;
    variantGidAtSale: string | null;
    productGidAtSale: string | null;
  }>(db)`
    SELECT id, "variantGidAtSale", "productGidAtSale"
      FROM "ShopifyOrderLineFact"
     WHERE "shopId" = ${shopId} AND "shopifyGid" = ${line.shopifyGid}
     FOR UPDATE`;
  const variantGid =
    existing[0]?.variantGidAtSale ?? line.variantGidAtSale;
  const productGid =
    existing[0]?.productGidAtSale ?? line.productGidAtSale;
  if (existing[0]) {
    await queryRows(db)`
      UPDATE "ShopifyOrderLineFact"
         SET quantity = ${line.quantity},
             "currentQuantity" = ${line.currentQuantity},
             "refundableQuantity" = ${line.refundableQuantity},
             "unfulfilledQuantity" = ${line.unfulfilledQuantity},
             "isGiftCard" = ${line.isGiftCard},
             title = ${line.title},
             "variantTitle" = ${line.variantTitle},
             vendor = ${line.vendor},
             sku = ${line.sku},
             name = ${line.name},
             "variantGidAtSale" = ${variantGid},
             "productGidAtSale" = ${productGid},
             "currentVariantGid" = ${line.currentVariantGid},
             "currentProductGid" = ${line.currentProductGid},
             "orderProcessedAt" = ${order.processedAt},
             "orderCancelledAt" = ${order.cancelledAt},
             "orderTest" = ${order.test},
             "orderShopCurrencyCode" = ${order.shopCurrencyCode},
             "originalTotalShopAmount" = ${money.originalTotalSet.shopAmount}::numeric,
             "originalTotalShopCurrencyCode" = ${money.originalTotalSet.shopCurrencyCode},
             "originalTotalPresentmentAmount" = ${money.originalTotalSet.presentmentAmount}::numeric,
             "originalTotalPresentmentCurrencyCode" = ${money.originalTotalSet.presentmentCurrencyCode},
             "originalUnitPriceShopAmount" = ${money.originalUnitPriceSet.shopAmount}::numeric,
             "originalUnitPriceShopCurrencyCode" = ${money.originalUnitPriceSet.shopCurrencyCode},
             "originalUnitPricePresentmentAmount" = ${money.originalUnitPriceSet.presentmentAmount}::numeric,
             "originalUnitPricePresentmentCurrencyCode" = ${money.originalUnitPriceSet.presentmentCurrencyCode},
             "discountedTotalShopAmount" = ${money.discountedTotalSet.shopAmount}::numeric,
             "discountedTotalShopCurrencyCode" = ${money.discountedTotalSet.shopCurrencyCode},
             "discountedTotalPresentmentAmount" = ${money.discountedTotalSet.presentmentAmount}::numeric,
             "discountedTotalPresentmentCurrencyCode" = ${money.discountedTotalSet.presentmentCurrencyCode},
             "totalDiscountShopAmount" = ${money.totalDiscountSet.shopAmount}::numeric,
             "totalDiscountShopCurrencyCode" = ${money.totalDiscountSet.shopCurrencyCode},
             "totalDiscountPresentmentAmount" = ${money.totalDiscountSet.presentmentAmount}::numeric,
             "totalDiscountPresentmentCurrencyCode" = ${money.totalDiscountSet.presentmentCurrencyCode},
             "discountedUnitPriceAfterAllDiscountsShopAmount" = ${money.discountedUnitPriceAfterAllDiscountsSet?.shopAmount ?? null}::numeric,
             "discountedUnitPriceAfterAllDiscountsShopCurrencyCode" = ${money.discountedUnitPriceAfterAllDiscountsSet?.shopCurrencyCode ?? null},
             "discountedUnitPriceAfterAllDiscountsPresentmentAmount" = ${money.discountedUnitPriceAfterAllDiscountsSet?.presentmentAmount ?? null}::numeric,
             "discountedUnitPriceAfterAllDiscountsPresentmentCurrencyCode" = ${money.discountedUnitPriceAfterAllDiscountsSet?.presentmentCurrencyCode ?? null},
             "attributeRequestGen" = ${gens.request}::bigint,
             "attributeResponseGen" = ${gens.response}::bigint,
             "existenceState" = ${live.state}::"OrderExistenceState",
             "existenceKind" = ${live.kind}::"OrderExistenceKind",
             "existenceObservedAt" = ${live.observedAt},
             "existenceRequestGen" = ${live.request}::bigint,
             "existenceResponseGen" = ${live.response}::bigint,
             "deletedAt" = CASE WHEN ${live.state} = 'LIVE' THEN NULL ELSE "deletedAt" END,
             "deletionSource" = CASE WHEN ${live.state} = 'LIVE' THEN NULL ELSE "deletionSource" END,
             "accessScopeSnapshot" = ARRAY(SELECT jsonb_array_elements_text(${live.scopesJson}::jsonb)),
             "sourceKind" = ${live.sourceKind}::"OrderSourceKind",
             "shopifyLegacyResourceId" = ${line.shopifyLegacyResourceId},
             "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${existing[0].id}`;
    return;
  }
  const id = newFactId();
  try {
    await queryRows(db)`
      INSERT INTO "ShopifyOrderLineFact" (
        id, "shopId", "shopifyGid", "shopifyOrderGid",
        quantity, "currentQuantity", "refundableQuantity", "unfulfilledQuantity",
        "isGiftCard", title, "variantTitle", vendor, sku, name,
        "variantGidAtSale", "productGidAtSale", "currentVariantGid", "currentProductGid",
        "orderProcessedAt", "orderCancelledAt", "orderTest", "orderShopCurrencyCode",
        "originalTotalShopAmount", "originalTotalShopCurrencyCode",
        "originalTotalPresentmentAmount", "originalTotalPresentmentCurrencyCode",
        "originalUnitPriceShopAmount", "originalUnitPriceShopCurrencyCode",
        "originalUnitPricePresentmentAmount", "originalUnitPricePresentmentCurrencyCode",
        "discountedTotalShopAmount", "discountedTotalShopCurrencyCode",
        "discountedTotalPresentmentAmount", "discountedTotalPresentmentCurrencyCode",
        "totalDiscountShopAmount", "totalDiscountShopCurrencyCode",
        "totalDiscountPresentmentAmount", "totalDiscountPresentmentCurrencyCode",
        "discountedUnitPriceAfterAllDiscountsShopAmount",
        "discountedUnitPriceAfterAllDiscountsShopCurrencyCode",
        "discountedUnitPriceAfterAllDiscountsPresentmentAmount",
        "discountedUnitPriceAfterAllDiscountsPresentmentCurrencyCode",
        "existenceState", "existenceKind", "existenceObservedAt",
        "existenceRequestGen", "existenceResponseGen",
        "attributeRequestGen", "attributeResponseGen",
        "sourceKind", "accessScopeSnapshot", "shopifyLegacyResourceId",
        "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${shopId}, ${line.shopifyGid}, ${order.shopifyGid},
        ${line.quantity}, ${line.currentQuantity}, ${line.refundableQuantity}, ${line.unfulfilledQuantity},
        ${line.isGiftCard}, ${line.title}, ${line.variantTitle}, ${line.vendor}, ${line.sku}, ${line.name},
        ${variantGid}, ${productGid}, ${line.currentVariantGid}, ${line.currentProductGid},
        ${order.processedAt}, ${order.cancelledAt}, ${order.test}, ${order.shopCurrencyCode},
        ${money.originalTotalSet.shopAmount}::numeric, ${money.originalTotalSet.shopCurrencyCode},
        ${money.originalTotalSet.presentmentAmount}::numeric, ${money.originalTotalSet.presentmentCurrencyCode},
        ${money.originalUnitPriceSet.shopAmount}::numeric, ${money.originalUnitPriceSet.shopCurrencyCode},
        ${money.originalUnitPriceSet.presentmentAmount}::numeric, ${money.originalUnitPriceSet.presentmentCurrencyCode},
        ${money.discountedTotalSet.shopAmount}::numeric, ${money.discountedTotalSet.shopCurrencyCode},
        ${money.discountedTotalSet.presentmentAmount}::numeric, ${money.discountedTotalSet.presentmentCurrencyCode},
        ${money.totalDiscountSet.shopAmount}::numeric, ${money.totalDiscountSet.shopCurrencyCode},
        ${money.totalDiscountSet.presentmentAmount}::numeric, ${money.totalDiscountSet.presentmentCurrencyCode},
        ${money.discountedUnitPriceAfterAllDiscountsSet?.shopAmount ?? null}::numeric,
        ${money.discountedUnitPriceAfterAllDiscountsSet?.shopCurrencyCode ?? null},
        ${money.discountedUnitPriceAfterAllDiscountsSet?.presentmentAmount ?? null}::numeric,
        ${money.discountedUnitPriceAfterAllDiscountsSet?.presentmentCurrencyCode ?? null},
        ${write.decision.nextState}::"OrderExistenceState",
        ${write.decision.nextKind}::"OrderExistenceKind",
        ${write.observedAt},
        ${gens.request}::bigint, ${gens.response}::bigint,
        ${gens.request}::bigint, ${gens.response}::bigint,
        ${sourceKind}::"OrderSourceKind", ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(scopes)}::jsonb)), ${line.shopifyLegacyResourceId},
        clock_timestamp(), clock_timestamp()
      )`;
  } catch (error) {
    throwIfUniqueViolation(error);
  }
}

export async function refreshLineDenormalized(
  db: OrderApplyDb,
  shopId: string,
  orderGid: string,
  order: Pick<
    OrderSnapshot,
    "processedAt" | "cancelledAt" | "test" | "shopCurrencyCode"
  >,
): Promise<void> {
  await queryRows(db)`
    UPDATE "ShopifyOrderLineFact"
       SET "orderProcessedAt" = ${order.processedAt},
           "orderCancelledAt" = ${order.cancelledAt},
           "orderTest" = ${order.test},
           "orderShopCurrencyCode" = ${order.shopCurrencyCode},
           "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND "shopifyOrderGid" = ${orderGid}`;
}

export async function upsertAgreementAndSales(
  db: OrderApplyDb,
  shopId: string,
  order: OrderSnapshot,
  agreement: AgreementSnapshot,
  write: ExistenceWriteInput,
  sourceKind: OrderSourceKind,
): Promise<void> {
  const gens = genPair(
    write.decision.nextKind === "LIVE_FULL_SYNC_PRESENT" ? null : write.interval,
  );
  const live = liveExistenceColumns(write);
  const scopes = [...write.accessScopeSnapshot];
  const existing = await queryRows<{ id: string }>(db)`
    SELECT id FROM "ShopifyOrderAgreementFact"
     WHERE "shopId" = ${shopId} AND "shopifyGid" = ${agreement.shopifyGid}
     FOR UPDATE`;
  let agreementId = existing[0]?.id;
  if (agreementId) {
    await queryRows(db)`
      UPDATE "ShopifyOrderAgreementFact"
         SET "happenedAt" = ${agreement.happenedAt},
             "agreementTypename" = ${agreement.agreementTypename},
             reason = ${agreement.reason},
             "refundGid" = ${agreement.refundGid},
             "attributeRequestGen" = ${gens.request}::bigint,
             "attributeResponseGen" = ${gens.response}::bigint,
             "existenceState" = ${live.state}::"OrderExistenceState",
             "existenceKind" = ${live.kind}::"OrderExistenceKind",
             "existenceObservedAt" = ${live.observedAt},
             "existenceRequestGen" = ${live.request}::bigint,
             "existenceResponseGen" = ${live.response}::bigint,
             "deletedAt" = CASE WHEN ${live.state} = 'LIVE' THEN NULL ELSE "deletedAt" END,
             "deletionSource" = CASE WHEN ${live.state} = 'LIVE' THEN NULL ELSE "deletionSource" END,
             "accessScopeSnapshot" = ARRAY(SELECT jsonb_array_elements_text(${live.scopesJson}::jsonb)),
             "sourceKind" = ${live.sourceKind}::"OrderSourceKind",
             "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${agreementId}`;
  } else {
    agreementId = newFactId();
    try {
      await queryRows(db)`
        INSERT INTO "ShopifyOrderAgreementFact" (
          id, "shopId", "shopifyGid", "shopifyOrderGid",
          "happenedAt", "agreementTypename", reason, "refundGid",
          "existenceState", "existenceKind", "existenceObservedAt",
          "existenceRequestGen", "existenceResponseGen",
          "attributeRequestGen", "attributeResponseGen",
          "sourceKind", "accessScopeSnapshot",
          "createdAt", "updatedAt"
        ) VALUES (
          ${agreementId}, ${shopId}, ${agreement.shopifyGid}, ${order.shopifyGid},
          ${agreement.happenedAt}, ${agreement.agreementTypename}, ${agreement.reason}, ${agreement.refundGid},
          ${write.decision.nextState}::"OrderExistenceState",
          ${write.decision.nextKind}::"OrderExistenceKind",
          ${write.observedAt},
          ${gens.request}::bigint, ${gens.response}::bigint,
          ${gens.request}::bigint, ${gens.response}::bigint,
          ${sourceKind}::"OrderSourceKind", ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(scopes)}::jsonb)),
          clock_timestamp(), clock_timestamp()
        )`;
    } catch (error) {
      throwIfUniqueViolation(error);
    }
  }
  for (const sale of agreement.sales) {
    await upsertSale(
      db,
      shopId,
      order,
      agreement,
      sale,
      write,
      sourceKind,
    );
  }
}

async function upsertSale(
  db: OrderApplyDb,
  shopId: string,
  order: OrderSnapshot,
  agreement: AgreementSnapshot,
  sale: SaleSnapshot,
  write: ExistenceWriteInput,
  sourceKind: OrderSourceKind,
): Promise<void> {
  const money = parseSaleMoney(sale, order.shopCurrencyCode);
  const gens = genPair(
    write.decision.nextKind === "LIVE_FULL_SYNC_PRESENT" ? null : write.interval,
  );
  const live = liveExistenceColumns(write);
  const scopes = [...write.accessScopeSnapshot];
  const existing = await queryRows<{ id: string }>(db)`
    SELECT id FROM "ShopifyOrderAgreementSaleFact"
     WHERE "shopId" = ${shopId} AND "shopifyGid" = ${sale.shopifyGid}
     FOR UPDATE`;
  if (existing[0]) {
    await queryRows(db)`
      UPDATE "ShopifyOrderAgreementSaleFact"
         SET quantity = ${sale.quantity},
             "lineType" = ${sale.lineType},
             "actionType" = ${sale.actionType},
             "saleTypename" = ${sale.saleTypename},
             "shopifyLineItemGid" = ${sale.shopifyLineItemGid},
             "happenedAt" = ${agreement.happenedAt},
             "totalAmountShopAmount" = ${money.shopAmount}::numeric,
             "totalAmountShopCurrencyCode" = ${money.shopCurrencyCode},
             "totalAmountPresentmentAmount" = ${money.presentmentAmount}::numeric,
             "totalAmountPresentmentCurrencyCode" = ${money.presentmentCurrencyCode},
             "attributeRequestGen" = ${gens.request}::bigint,
             "attributeResponseGen" = ${gens.response}::bigint,
             "existenceState" = ${live.state}::"OrderExistenceState",
             "existenceKind" = ${live.kind}::"OrderExistenceKind",
             "existenceObservedAt" = ${live.observedAt},
             "existenceRequestGen" = ${live.request}::bigint,
             "existenceResponseGen" = ${live.response}::bigint,
             "deletedAt" = CASE WHEN ${live.state} = 'LIVE' THEN NULL ELSE "deletedAt" END,
             "deletionSource" = CASE WHEN ${live.state} = 'LIVE' THEN NULL ELSE "deletionSource" END,
             "accessScopeSnapshot" = ARRAY(SELECT jsonb_array_elements_text(${live.scopesJson}::jsonb)),
             "sourceKind" = ${live.sourceKind}::"OrderSourceKind",
             "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${existing[0].id}`;
    return;
  }
  const id = newFactId();
  try {
    await queryRows(db)`
      INSERT INTO "ShopifyOrderAgreementSaleFact" (
        id, "shopId", "shopifyGid", "shopifyAgreementGid", "shopifyOrderGid",
        quantity, "lineType", "actionType", "saleTypename", "shopifyLineItemGid",
        "happenedAt",
        "totalAmountShopAmount", "totalAmountShopCurrencyCode",
        "totalAmountPresentmentAmount", "totalAmountPresentmentCurrencyCode",
        "existenceState", "existenceKind", "existenceObservedAt",
        "existenceRequestGen", "existenceResponseGen",
        "attributeRequestGen", "attributeResponseGen",
        "sourceKind", "accessScopeSnapshot",
        "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${shopId}, ${sale.shopifyGid}, ${agreement.shopifyGid}, ${order.shopifyGid},
        ${sale.quantity}, ${sale.lineType}, ${sale.actionType}, ${sale.saleTypename}, ${sale.shopifyLineItemGid},
        ${agreement.happenedAt},
        ${money.shopAmount}::numeric, ${money.shopCurrencyCode},
        ${money.presentmentAmount}::numeric, ${money.presentmentCurrencyCode},
        ${write.decision.nextState}::"OrderExistenceState",
        ${write.decision.nextKind}::"OrderExistenceKind",
        ${write.observedAt},
        ${gens.request}::bigint, ${gens.response}::bigint,
        ${gens.request}::bigint, ${gens.response}::bigint,
        ${sourceKind}::"OrderSourceKind", ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(scopes)}::jsonb)),
        clock_timestamp(), clock_timestamp()
      )`;
  } catch (error) {
    throwIfUniqueViolation(error);
  }
}

export async function upsertRefundSnapshot(
  db: OrderApplyDb,
  shopId: string,
  refund: RefundSnapshot,
  write: ExistenceWriteInput,
  sourceKind: OrderSourceKind,
  localOrderCurrency: string | null,
): Promise<{ id: string; moneyDiagnosticState: string | null }> {
  const shopCurrency = refundShopCurrency(refund, localOrderCurrency);
  const money = parseRefundMoney(refund, shopCurrency);
  const gens = genPair(
    write.decision.nextKind === "LIVE_FULL_SYNC_PRESENT" ? null : write.interval,
  );
  const scopes = [...write.accessScopeSnapshot];
  const existing = await queryRows<{ id: string }>(db)`
    SELECT id FROM "ShopifyOrderRefundFact"
     WHERE "shopId" = ${shopId} AND "shopifyGid" = ${refund.shopifyGid}
     FOR UPDATE`;
  let id = existing[0]?.id;
  if (id) {
    await queryRows(db)`
      UPDATE "ShopifyOrderRefundFact"
         SET "shopifyOrderGid" = ${refund.shopifyOrderGid},
             "shopifyCreatedAt" = ${refund.shopifyCreatedAt},
             "shopifyUpdatedAt" = ${refund.shopifyUpdatedAt},
             "processedAt" = ${refund.processedAt},
             "processedAtShopify" = ${refund.processedAtShopify},
             "totalRefundedShopAmount" = ${money.totalRefundedSet.shopAmount}::numeric,
             "totalRefundedShopCurrencyCode" = ${money.totalRefundedSet.shopCurrencyCode},
             "totalRefundedPresentmentAmount" = ${money.totalRefundedSet.presentmentAmount}::numeric,
             "totalRefundedPresentmentCurrencyCode" = ${money.totalRefundedSet.presentmentCurrencyCode},
             "refundShippingLineCount" = ${money.shippingLineCount},
             "refundShippingSubtotalShopAmount" = ${money.shippingSubtotal?.shopAmount ?? null}::numeric,
             "refundShippingSubtotalShopCurrencyCode" = ${money.shippingSubtotal?.shopCurrencyCode ?? null},
             "refundShippingSubtotalPresentmentAmount" = ${money.shippingSubtotal?.presentmentAmount ?? null}::numeric,
             "refundShippingSubtotalPresentmentCurrencyCode" = ${money.shippingSubtotal?.presentmentCurrencyCode ?? null},
             "refundShippingTaxShopAmount" = ${money.shippingTax?.shopAmount ?? null}::numeric,
             "refundShippingTaxShopCurrencyCode" = ${money.shippingTax?.shopCurrencyCode ?? null},
             "refundShippingTaxPresentmentAmount" = ${money.shippingTax?.presentmentAmount ?? null}::numeric,
             "refundShippingTaxPresentmentCurrencyCode" = ${money.shippingTax?.presentmentCurrencyCode ?? null},
             "moneyDiagnosticState" = ${money.moneyDiagnosticState},
             "attributeRequestGen" = ${gens.request}::bigint,
             "attributeResponseGen" = ${gens.response}::bigint,
             "shopifyLegacyResourceId" = ${refund.shopifyLegacyResourceId},
             "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${id}`;
  } else {
    id = newFactId();
    try {
      await queryRows(db)`
        INSERT INTO "ShopifyOrderRefundFact" (
          id, "shopId", "shopifyGid", "shopifyOrderGid",
          "shopifyCreatedAt", "shopifyUpdatedAt",
          "processedAt", "processedAtShopify",
          "totalRefundedShopAmount", "totalRefundedShopCurrencyCode",
          "totalRefundedPresentmentAmount", "totalRefundedPresentmentCurrencyCode",
          "refundShippingLineCount",
          "refundShippingSubtotalShopAmount", "refundShippingSubtotalShopCurrencyCode",
          "refundShippingSubtotalPresentmentAmount", "refundShippingSubtotalPresentmentCurrencyCode",
          "refundShippingTaxShopAmount", "refundShippingTaxShopCurrencyCode",
          "refundShippingTaxPresentmentAmount", "refundShippingTaxPresentmentCurrencyCode",
          "existenceState", "existenceKind", "existenceObservedAt",
          "existenceRequestGen", "existenceResponseGen",
          "attributeRequestGen", "attributeResponseGen",
          "moneyDiagnosticState",
          "sourceKind", "accessScopeSnapshot", "shopifyLegacyResourceId",
          "createdAt", "updatedAt"
        ) VALUES (
          ${id}, ${shopId}, ${refund.shopifyGid}, ${refund.shopifyOrderGid},
          ${refund.shopifyCreatedAt}, ${refund.shopifyUpdatedAt},
          ${refund.processedAt}, ${refund.processedAtShopify},
          ${money.totalRefundedSet.shopAmount}::numeric, ${money.totalRefundedSet.shopCurrencyCode},
          ${money.totalRefundedSet.presentmentAmount}::numeric, ${money.totalRefundedSet.presentmentCurrencyCode},
          ${money.shippingLineCount},
          ${money.shippingSubtotal?.shopAmount ?? null}::numeric, ${money.shippingSubtotal?.shopCurrencyCode ?? null},
          ${money.shippingSubtotal?.presentmentAmount ?? null}::numeric, ${money.shippingSubtotal?.presentmentCurrencyCode ?? null},
          ${money.shippingTax?.shopAmount ?? null}::numeric, ${money.shippingTax?.shopCurrencyCode ?? null},
          ${money.shippingTax?.presentmentAmount ?? null}::numeric, ${money.shippingTax?.presentmentCurrencyCode ?? null},
          ${write.decision.nextState}::"OrderExistenceState",
          ${write.decision.nextKind}::"OrderExistenceKind",
          ${write.observedAt},
          ${gens.request}::bigint, ${gens.response}::bigint,
          ${gens.request}::bigint, ${gens.response}::bigint,
          ${money.moneyDiagnosticState},
          ${sourceKind}::"OrderSourceKind", ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(scopes)}::jsonb)), ${refund.shopifyLegacyResourceId},
          clock_timestamp(), clock_timestamp()
        )`;
    } catch (error) {
      throwIfUniqueViolation(error);
    }
  }
  for (const line of refund.lines) {
    await upsertRefundLine(db, shopId, refund, line, write, sourceKind, shopCurrency);
  }
  for (const adj of refund.adjustments) {
    await upsertAdjustment(db, shopId, refund, adj, write, sourceKind, shopCurrency);
  }
  for (const txn of refund.transactions) {
    await upsertTransaction(db, shopId, refund, txn, write, sourceKind, shopCurrency);
  }
  await markOmittedRefundChildrenAbsent(db, shopId, refund, write);
  return { id, moneyDiagnosticState: money.moneyDiagnosticState };
}

async function upsertRefundLine(
  db: OrderApplyDb,
  shopId: string,
  refund: RefundSnapshot,
  line: RefundLineSnapshot,
  write: ExistenceWriteInput,
  sourceKind: OrderSourceKind,
  shopCurrency: string,
): Promise<void> {
  const gens = genPair(
    write.decision.nextKind === "LIVE_FULL_SYNC_PRESENT" ? null : write.interval,
  );
  const live = liveExistenceColumns(write);
  const scopes = [...write.accessScopeSnapshot];
  const parsed = parseLineLikeRefund(line, shopCurrency);
  const existing = await queryRows<{ id: string }>(db)`
    SELECT id FROM "ShopifyOrderRefundLineFact"
     WHERE "shopId" = ${shopId}
       AND "shopifyRefundGid" = ${refund.shopifyGid}
       AND "shopifyLineItemGid" = ${line.shopifyLineItemGid}
       AND "refundLineOrdinal" = ${line.refundLineOrdinal}
     FOR UPDATE`;
  if (existing[0]) {
    await queryRows(db)`
      UPDATE "ShopifyOrderRefundLineFact"
         SET "shopifyGid" = ${line.shopifyGid},
             quantity = ${line.quantity},
             "restockType" = ${line.restockType},
             restocked = ${line.restocked},
             "restockLocationGid" = ${line.restockLocationGid},
             "subtotalShopAmount" = ${parsed.subtotal.shopAmount}::numeric,
             "subtotalShopCurrencyCode" = ${parsed.subtotal.shopCurrencyCode},
             "subtotalPresentmentAmount" = ${parsed.subtotal.presentmentAmount}::numeric,
             "subtotalPresentmentCurrencyCode" = ${parsed.subtotal.presentmentCurrencyCode},
             "totalTaxShopAmount" = ${parsed.tax.shopAmount}::numeric,
             "totalTaxShopCurrencyCode" = ${parsed.tax.shopCurrencyCode},
             "totalTaxPresentmentAmount" = ${parsed.tax.presentmentAmount}::numeric,
             "totalTaxPresentmentCurrencyCode" = ${parsed.tax.presentmentCurrencyCode},
             "priceShopAmount" = ${parsed.price.shopAmount}::numeric,
             "priceShopCurrencyCode" = ${parsed.price.shopCurrencyCode},
             "pricePresentmentAmount" = ${parsed.price.presentmentAmount}::numeric,
             "pricePresentmentCurrencyCode" = ${parsed.price.presentmentCurrencyCode},
             "existenceState" = ${live.state}::"OrderExistenceState",
             "existenceKind" = ${live.kind}::"OrderExistenceKind",
             "existenceObservedAt" = ${live.observedAt},
             "existenceRequestGen" = ${live.request}::bigint,
             "existenceResponseGen" = ${live.response}::bigint,
             "deletedAt" = CASE WHEN ${live.state} = 'LIVE' THEN NULL ELSE "deletedAt" END,
             "deletionSource" = CASE WHEN ${live.state} = 'LIVE' THEN NULL ELSE "deletionSource" END,
             "accessScopeSnapshot" = ARRAY(SELECT jsonb_array_elements_text(${live.scopesJson}::jsonb)),
             "sourceKind" = ${live.sourceKind}::"OrderSourceKind",
             "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${existing[0].id}`;
    return;
  }
  const id = newFactId();
  try {
    await queryRows(db)`
      INSERT INTO "ShopifyOrderRefundLineFact" (
        id, "shopId", "shopifyRefundGid", "shopifyLineItemGid", "refundLineOrdinal",
        "shopifyGid", "shopifyOrderGid", quantity, "restockType", restocked, "restockLocationGid",
        "subtotalShopAmount", "subtotalShopCurrencyCode",
        "subtotalPresentmentAmount", "subtotalPresentmentCurrencyCode",
        "totalTaxShopAmount", "totalTaxShopCurrencyCode",
        "totalTaxPresentmentAmount", "totalTaxPresentmentCurrencyCode",
        "priceShopAmount", "priceShopCurrencyCode",
        "pricePresentmentAmount", "pricePresentmentCurrencyCode",
        "existenceState", "existenceKind", "existenceObservedAt",
        "existenceRequestGen", "existenceResponseGen",
        "sourceKind", "accessScopeSnapshot",
        "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${shopId}, ${refund.shopifyGid}, ${line.shopifyLineItemGid}, ${line.refundLineOrdinal},
        ${line.shopifyGid}, ${refund.shopifyOrderGid}, ${line.quantity}, ${line.restockType}, ${line.restocked}, ${line.restockLocationGid},
        ${parsed.subtotal.shopAmount}::numeric, ${parsed.subtotal.shopCurrencyCode},
        ${parsed.subtotal.presentmentAmount}::numeric, ${parsed.subtotal.presentmentCurrencyCode},
        ${parsed.tax.shopAmount}::numeric, ${parsed.tax.shopCurrencyCode},
        ${parsed.tax.presentmentAmount}::numeric, ${parsed.tax.presentmentCurrencyCode},
        ${parsed.price.shopAmount}::numeric, ${parsed.price.shopCurrencyCode},
        ${parsed.price.presentmentAmount}::numeric, ${parsed.price.presentmentCurrencyCode},
        ${write.decision.nextState}::"OrderExistenceState",
        ${write.decision.nextKind}::"OrderExistenceKind",
        ${write.observedAt},
        ${gens.request}::bigint, ${gens.response}::bigint,
        ${sourceKind}::"OrderSourceKind", ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(scopes)}::jsonb)),
        clock_timestamp(), clock_timestamp()
      )`;
  } catch (error) {
    throwIfUniqueViolation(error);
  }
}

function parseLineLikeRefund(
  line: RefundLineSnapshot,
  shopCurrency: string,
) {
  return {
    subtotal: parseRequiredMoneyBag(line.subtotalSet, "subtotalSet", shopCurrency),
    tax: parseRequiredMoneyBag(line.totalTaxSet, "totalTaxSet", shopCurrency),
    price: parseRequiredMoneyBag(line.priceSet, "priceSet", shopCurrency),
  };
}

async function upsertAdjustment(
  db: OrderApplyDb,
  shopId: string,
  refund: RefundSnapshot,
  adj: AdjustmentSnapshot,
  write: ExistenceWriteInput,
  sourceKind: OrderSourceKind,
  shopCurrency: string,
): Promise<void> {
  const parsed = parseAdjustmentMoney(adj, shopCurrency);
  const gens = genPair(
    write.decision.nextKind === "LIVE_FULL_SYNC_PRESENT" ? null : write.interval,
  );
  const live = liveExistenceColumns(write);
  const scopes = [...write.accessScopeSnapshot];
  const existing = await queryRows<{ id: string }>(db)`
    SELECT id FROM "ShopifyOrderAdjustmentFact"
     WHERE "shopId" = ${shopId} AND "shopifyGid" = ${adj.shopifyGid}
     FOR UPDATE`;
  if (existing[0]) {
    await queryRows(db)`
      UPDATE "ShopifyOrderAdjustmentFact"
         SET reason = ${adj.reason},
             "amountShopAmount" = ${parsed.amountSet.shopAmount}::numeric,
             "amountShopCurrencyCode" = ${parsed.amountSet.shopCurrencyCode},
             "amountPresentmentAmount" = ${parsed.amountSet.presentmentAmount}::numeric,
             "amountPresentmentCurrencyCode" = ${parsed.amountSet.presentmentCurrencyCode},
             "taxAmountShopAmount" = ${parsed.taxAmountSet.shopAmount}::numeric,
             "taxAmountShopCurrencyCode" = ${parsed.taxAmountSet.shopCurrencyCode},
             "taxAmountPresentmentAmount" = ${parsed.taxAmountSet.presentmentAmount}::numeric,
             "taxAmountPresentmentCurrencyCode" = ${parsed.taxAmountSet.presentmentCurrencyCode},
             "existenceState" = ${live.state}::"OrderExistenceState",
             "existenceKind" = ${live.kind}::"OrderExistenceKind",
             "existenceObservedAt" = ${live.observedAt},
             "existenceRequestGen" = ${live.request}::bigint,
             "existenceResponseGen" = ${live.response}::bigint,
             "deletedAt" = CASE WHEN ${live.state} = 'LIVE' THEN NULL ELSE "deletedAt" END,
             "deletionSource" = CASE WHEN ${live.state} = 'LIVE' THEN NULL ELSE "deletionSource" END,
             "accessScopeSnapshot" = ARRAY(SELECT jsonb_array_elements_text(${live.scopesJson}::jsonb)),
             "sourceKind" = ${live.sourceKind}::"OrderSourceKind",
             "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${existing[0].id}`;
    return;
  }
  const id = newFactId();
  try {
    await queryRows(db)`
      INSERT INTO "ShopifyOrderAdjustmentFact" (
        id, "shopId", "shopifyGid", "shopifyRefundGid", "shopifyOrderGid", reason,
        "amountShopAmount", "amountShopCurrencyCode",
        "amountPresentmentAmount", "amountPresentmentCurrencyCode",
        "taxAmountShopAmount", "taxAmountShopCurrencyCode",
        "taxAmountPresentmentAmount", "taxAmountPresentmentCurrencyCode",
        "existenceState", "existenceKind", "existenceObservedAt",
        "existenceRequestGen", "existenceResponseGen",
        "sourceKind", "accessScopeSnapshot",
        "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${shopId}, ${adj.shopifyGid}, ${refund.shopifyGid}, ${refund.shopifyOrderGid}, ${adj.reason},
        ${parsed.amountSet.shopAmount}::numeric, ${parsed.amountSet.shopCurrencyCode},
        ${parsed.amountSet.presentmentAmount}::numeric, ${parsed.amountSet.presentmentCurrencyCode},
        ${parsed.taxAmountSet.shopAmount}::numeric, ${parsed.taxAmountSet.shopCurrencyCode},
        ${parsed.taxAmountSet.presentmentAmount}::numeric, ${parsed.taxAmountSet.presentmentCurrencyCode},
        ${write.decision.nextState}::"OrderExistenceState",
        ${write.decision.nextKind}::"OrderExistenceKind",
        ${write.observedAt},
        ${gens.request}::bigint, ${gens.response}::bigint,
        ${sourceKind}::"OrderSourceKind", ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(scopes)}::jsonb)),
        clock_timestamp(), clock_timestamp()
      )`;
  } catch (error) {
    throwIfUniqueViolation(error);
  }
}

async function upsertTransaction(
  db: OrderApplyDb,
  shopId: string,
  refund: RefundSnapshot,
  txn: TransactionSnapshot,
  write: ExistenceWriteInput,
  sourceKind: OrderSourceKind,
  shopCurrency: string,
): Promise<void> {
  const amount = parseRequiredMoneyBag(txn.amountSet, "amountSet", shopCurrency);
  const gens = genPair(
    write.decision.nextKind === "LIVE_FULL_SYNC_PRESENT" ? null : write.interval,
  );
  const live = liveExistenceColumns(write);
  const scopes = [...write.accessScopeSnapshot];
  const existing = await queryRows<{ id: string }>(db)`
    SELECT id FROM "ShopifyOrderRefundTransactionFact"
     WHERE "shopId" = ${shopId} AND "shopifyGid" = ${txn.shopifyGid}
     FOR UPDATE`;
  if (existing[0]) {
    await queryRows(db)`
      UPDATE "ShopifyOrderRefundTransactionFact"
         SET status = ${txn.status},
             kind = ${txn.kind},
             "shopifyCreatedAt" = ${txn.shopifyCreatedAt},
             "processedAt" = ${txn.processedAt},
             "amountShopAmount" = ${amount.shopAmount}::numeric,
             "amountShopCurrencyCode" = ${amount.shopCurrencyCode},
             "amountPresentmentAmount" = ${amount.presentmentAmount}::numeric,
             "amountPresentmentCurrencyCode" = ${amount.presentmentCurrencyCode},
             "existenceState" = ${live.state}::"OrderExistenceState",
             "existenceKind" = ${live.kind}::"OrderExistenceKind",
             "existenceObservedAt" = ${live.observedAt},
             "existenceRequestGen" = ${live.request}::bigint,
             "existenceResponseGen" = ${live.response}::bigint,
             "deletedAt" = CASE WHEN ${live.state} = 'LIVE' THEN NULL ELSE "deletedAt" END,
             "deletionSource" = CASE WHEN ${live.state} = 'LIVE' THEN NULL ELSE "deletionSource" END,
             "accessScopeSnapshot" = ARRAY(SELECT jsonb_array_elements_text(${live.scopesJson}::jsonb)),
             "sourceKind" = ${live.sourceKind}::"OrderSourceKind",
             "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${existing[0].id}`;
    return;
  }
  const id = newFactId();
  try {
    await queryRows(db)`
      INSERT INTO "ShopifyOrderRefundTransactionFact" (
        id, "shopId", "shopifyGid", "shopifyRefundGid", "shopifyOrderGid",
        status, kind, "shopifyCreatedAt", "processedAt",
        "amountShopAmount", "amountShopCurrencyCode",
        "amountPresentmentAmount", "amountPresentmentCurrencyCode",
        "existenceState", "existenceKind", "existenceObservedAt",
        "existenceRequestGen", "existenceResponseGen",
        "sourceKind", "accessScopeSnapshot",
        "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${shopId}, ${txn.shopifyGid}, ${refund.shopifyGid}, ${refund.shopifyOrderGid},
        ${txn.status}, ${txn.kind}, ${txn.shopifyCreatedAt}, ${txn.processedAt},
        ${amount.shopAmount}::numeric, ${amount.shopCurrencyCode},
        ${amount.presentmentAmount}::numeric, ${amount.presentmentCurrencyCode},
        ${write.decision.nextState}::"OrderExistenceState",
        ${write.decision.nextKind}::"OrderExistenceKind",
        ${write.observedAt},
        ${gens.request}::bigint, ${gens.response}::bigint,
        ${sourceKind}::"OrderSourceKind", ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(scopes)}::jsonb)),
        clock_timestamp(), clock_timestamp()
      )`;
  } catch (error) {
    throwIfUniqueViolation(error);
  }
}

async function markOmittedChildRowsAbsent(
  db: OrderApplyDb,
  table:
    | "ShopifyOrderLineFact"
    | "ShopifyOrderAgreementFact"
    | "ShopifyOrderAgreementSaleFact"
    | "ShopifyOrderAdjustmentFact"
    | "ShopifyOrderRefundTransactionFact",
  shopId: string,
  parentGid: string,
  presentGids: readonly string[],
  write: ExistenceWriteInput,
): Promise<void> {
  const interval = childAbsenceInterval(write);
  if (!interval) return;
  const gens = genPair(interval);
  const scopesJson = JSON.stringify([...write.accessScopeSnapshot]);
  const presentJson = JSON.stringify([...presentGids]);
  const presentCount = presentGids.length;
  const sqlByTable: Record<typeof table, () => Promise<unknown>> = {
    ShopifyOrderLineFact: () =>
      queryRows(db)`
        UPDATE "ShopifyOrderLineFact"
           SET "existenceState" = 'ABSENT'::"OrderExistenceState",
               "existenceKind" = 'ABSENT_CONFIRMED_QUERY'::"OrderExistenceKind",
               "existenceObservedAt" = ${write.observedAt},
               "existenceRequestGen" = ${gens.request}::bigint,
               "existenceResponseGen" = ${gens.response}::bigint,
               "deletedAt" = COALESCE("deletedAt", ${write.observedAt}),
               "deletionSource" = 'CONFIRMED_QUERY'::"OrderDeletionSource",
               "accessScopeSnapshot" = ARRAY(SELECT jsonb_array_elements_text(${scopesJson}::jsonb)),
               "sourceKind" = ${write.sourceKind}::"OrderSourceKind",
               "updatedAt" = clock_timestamp()
         WHERE "shopId" = ${shopId}
           AND "shopifyOrderGid" = ${parentGid}
           AND "existenceState" = 'LIVE'
           AND (
             ${presentCount}::int = 0
             OR NOT ("shopifyGid" = ANY (ARRAY(SELECT jsonb_array_elements_text(${presentJson}::jsonb))))
           )`,
    ShopifyOrderAgreementFact: () =>
      queryRows(db)`
        UPDATE "ShopifyOrderAgreementFact"
           SET "existenceState" = 'ABSENT'::"OrderExistenceState",
               "existenceKind" = 'ABSENT_CONFIRMED_QUERY'::"OrderExistenceKind",
               "existenceObservedAt" = ${write.observedAt},
               "existenceRequestGen" = ${gens.request}::bigint,
               "existenceResponseGen" = ${gens.response}::bigint,
               "deletedAt" = COALESCE("deletedAt", ${write.observedAt}),
               "deletionSource" = 'CONFIRMED_QUERY'::"OrderDeletionSource",
               "accessScopeSnapshot" = ARRAY(SELECT jsonb_array_elements_text(${scopesJson}::jsonb)),
               "sourceKind" = ${write.sourceKind}::"OrderSourceKind",
               "updatedAt" = clock_timestamp()
         WHERE "shopId" = ${shopId}
           AND "shopifyOrderGid" = ${parentGid}
           AND "existenceState" = 'LIVE'
           AND (
             ${presentCount}::int = 0
             OR NOT ("shopifyGid" = ANY (ARRAY(SELECT jsonb_array_elements_text(${presentJson}::jsonb))))
           )`,
    ShopifyOrderAgreementSaleFact: () =>
      queryRows(db)`
        UPDATE "ShopifyOrderAgreementSaleFact"
           SET "existenceState" = 'ABSENT'::"OrderExistenceState",
               "existenceKind" = 'ABSENT_CONFIRMED_QUERY'::"OrderExistenceKind",
               "existenceObservedAt" = ${write.observedAt},
               "existenceRequestGen" = ${gens.request}::bigint,
               "existenceResponseGen" = ${gens.response}::bigint,
               "deletedAt" = COALESCE("deletedAt", ${write.observedAt}),
               "deletionSource" = 'CONFIRMED_QUERY'::"OrderDeletionSource",
               "accessScopeSnapshot" = ARRAY(SELECT jsonb_array_elements_text(${scopesJson}::jsonb)),
               "sourceKind" = ${write.sourceKind}::"OrderSourceKind",
               "updatedAt" = clock_timestamp()
         WHERE "shopId" = ${shopId}
           AND "shopifyOrderGid" = ${parentGid}
           AND "existenceState" = 'LIVE'
           AND (
             ${presentCount}::int = 0
             OR NOT ("shopifyGid" = ANY (ARRAY(SELECT jsonb_array_elements_text(${presentJson}::jsonb))))
           )`,
    ShopifyOrderAdjustmentFact: () =>
      queryRows(db)`
        UPDATE "ShopifyOrderAdjustmentFact"
           SET "existenceState" = 'ABSENT'::"OrderExistenceState",
               "existenceKind" = 'ABSENT_CONFIRMED_QUERY'::"OrderExistenceKind",
               "existenceObservedAt" = ${write.observedAt},
               "existenceRequestGen" = ${gens.request}::bigint,
               "existenceResponseGen" = ${gens.response}::bigint,
               "deletedAt" = COALESCE("deletedAt", ${write.observedAt}),
               "deletionSource" = 'CONFIRMED_QUERY'::"OrderDeletionSource",
               "accessScopeSnapshot" = ARRAY(SELECT jsonb_array_elements_text(${scopesJson}::jsonb)),
               "sourceKind" = ${write.sourceKind}::"OrderSourceKind",
               "updatedAt" = clock_timestamp()
         WHERE "shopId" = ${shopId}
           AND "shopifyRefundGid" = ${parentGid}
           AND "existenceState" = 'LIVE'
           AND (
             ${presentCount}::int = 0
             OR NOT ("shopifyGid" = ANY (ARRAY(SELECT jsonb_array_elements_text(${presentJson}::jsonb))))
           )`,
    ShopifyOrderRefundTransactionFact: () =>
      queryRows(db)`
        UPDATE "ShopifyOrderRefundTransactionFact"
           SET "existenceState" = 'ABSENT'::"OrderExistenceState",
               "existenceKind" = 'ABSENT_CONFIRMED_QUERY'::"OrderExistenceKind",
               "existenceObservedAt" = ${write.observedAt},
               "existenceRequestGen" = ${gens.request}::bigint,
               "existenceResponseGen" = ${gens.response}::bigint,
               "deletedAt" = COALESCE("deletedAt", ${write.observedAt}),
               "deletionSource" = 'CONFIRMED_QUERY'::"OrderDeletionSource",
               "accessScopeSnapshot" = ARRAY(SELECT jsonb_array_elements_text(${scopesJson}::jsonb)),
               "sourceKind" = ${write.sourceKind}::"OrderSourceKind",
               "updatedAt" = clock_timestamp()
         WHERE "shopId" = ${shopId}
           AND "shopifyRefundGid" = ${parentGid}
           AND "existenceState" = 'LIVE'
           AND (
             ${presentCount}::int = 0
             OR NOT ("shopifyGid" = ANY (ARRAY(SELECT jsonb_array_elements_text(${presentJson}::jsonb))))
           )`,
  };
  await sqlByTable[table]();
}

export async function markOmittedOrderChildrenAbsent(
  db: OrderApplyDb,
  shopId: string,
  order: OrderSnapshot,
  write: ExistenceWriteInput,
): Promise<void> {
  if (!childAbsenceInterval(write)) return;
  const presentLines = order.lines.map((item) => item.shopifyGid);
  const presentAgreements = order.agreements.map((item) => item.shopifyGid);
  const presentSales = order.agreements.flatMap((agreement) =>
    agreement.sales.map((item) => item.shopifyGid),
  );
  await markOmittedChildRowsAbsent(
    db,
    "ShopifyOrderLineFact",
    shopId,
    order.shopifyGid,
    presentLines,
    write,
  );
  await markOmittedChildRowsAbsent(
    db,
    "ShopifyOrderAgreementFact",
    shopId,
    order.shopifyGid,
    presentAgreements,
    write,
  );
  await markOmittedChildRowsAbsent(
    db,
    "ShopifyOrderAgreementSaleFact",
    shopId,
    order.shopifyGid,
    presentSales,
    write,
  );
}

export async function markOmittedRefundChildrenAbsent(
  db: OrderApplyDb,
  shopId: string,
  refund: RefundSnapshot,
  write: ExistenceWriteInput,
): Promise<void> {
  const interval = childAbsenceInterval(write);
  if (!interval) return;
  const gens = genPair(interval);
  const scopesJson = JSON.stringify([...write.accessScopeSnapshot]);
  const presentLineKeys = JSON.stringify(
    refund.lines.map((item) =>
      refundLineAbsenceKey(item.shopifyLineItemGid, item.refundLineOrdinal),
    ),
  );
  const presentLineCount = refund.lines.length;
  await queryRows(db)`
    UPDATE "ShopifyOrderRefundLineFact"
       SET "existenceState" = 'ABSENT'::"OrderExistenceState",
           "existenceKind" = 'ABSENT_CONFIRMED_QUERY'::"OrderExistenceKind",
           "existenceObservedAt" = ${write.observedAt},
           "existenceRequestGen" = ${gens.request}::bigint,
           "existenceResponseGen" = ${gens.response}::bigint,
           "deletedAt" = COALESCE("deletedAt", ${write.observedAt}),
           "deletionSource" = 'CONFIRMED_QUERY'::"OrderDeletionSource",
           "accessScopeSnapshot" = ARRAY(SELECT jsonb_array_elements_text(${scopesJson}::jsonb)),
           "sourceKind" = ${write.sourceKind}::"OrderSourceKind",
           "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId}
       AND "shopifyRefundGid" = ${refund.shopifyGid}
       AND "existenceState" = 'LIVE'
       AND (
         ${presentLineCount}::int = 0
         OR NOT (
           ("shopifyLineItemGid" || chr(31) || "refundLineOrdinal"::text)
           = ANY (ARRAY(SELECT jsonb_array_elements_text(${presentLineKeys}::jsonb)))
         )
       )`;
  await markOmittedChildRowsAbsent(
    db,
    "ShopifyOrderAdjustmentFact",
    shopId,
    refund.shopifyGid,
    refund.adjustments.map((item) => item.shopifyGid),
    write,
  );
  await markOmittedChildRowsAbsent(
    db,
    "ShopifyOrderRefundTransactionFact",
    shopId,
    refund.shopifyGid,
    refund.transactions.map((item) => item.shopifyGid),
    write,
  );
}

export async function applyOrderUnitDiagnostics(
  db: OrderApplyDb,
  shopId: string,
  orderFactId: string,
  diagnostic: string | null,
): Promise<void> {
  await queryRows(db)`
    UPDATE "ShopifyOrderFact"
       SET "unitDiagnosticState" = ${diagnostic},
           "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND id = ${orderFactId}`;
}

export async function applyLineUnitDiagnostics(
  db: OrderApplyDb,
  shopId: string,
  lineGid: string,
  diagnostic: string | null,
): Promise<void> {
  await queryRows(db)`
    UPDATE "ShopifyOrderLineFact"
       SET "unitDiagnosticState" = ${diagnostic},
           "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND "shopifyGid" = ${lineGid}`;
}

export async function requireProcessingEnabled(
  db: OrderApplyDb,
  shopId: string,
): Promise<void> {
  const rows = await queryRows<{ processingEnabled: boolean }>(db)`
    SELECT stocky_shop_processing_enabled(${shopId}) AS "processingEnabled"`;
  if (!asBool(rows[0]?.processingEnabled, false)) {
    throw new OrderApplyProcessingDisabledError();
  }
}
