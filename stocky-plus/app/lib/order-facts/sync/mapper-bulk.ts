/**
 * D-owned Bulk A JSONL → C OrderSnapshot mapper.
 * Uses selected Bulk A `discountedTotalSet`, not with-code discounts.
 * Does not edit frozen B documents.
 */
import { requireMoneyBag } from "../admin-read/money";
import { canonicalizeExactDecimalText } from "../apply/money";
import type { OrderLineSnapshot, OrderSnapshot } from "../apply/types";
import type { MoneyBagSides } from "../types";
import { OrderFactsSyncError } from "./errors";
import type { JsonlObject } from "./types";

const SHOPIFY_DATETIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function parseIsoToDate(value: unknown, field: string): Date {
  if (typeof value !== "string" || !SHOPIFY_DATETIME.test(value)) {
    throw new OrderFactsSyncError(
      "order_facts_bulk_datetime_invalid",
      `malformed_datetime:${field}`,
    );
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new OrderFactsSyncError(
      "order_facts_bulk_datetime_invalid",
      `malformed_datetime:${field}`,
    );
  }
  return parsed;
}

function parseOptionalIso(value: unknown, field: string): Date | null {
  if (value == null) return null;
  return parseIsoToDate(value, field);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown, field: string): boolean {
  if (typeof value === "boolean") return value;
  throw new OrderFactsSyncError(
    "order_facts_bulk_field_invalid",
    `${field} must be a boolean in Bulk A JSONL`,
  );
}

function asInt(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  throw new OrderFactsSyncError(
    "order_facts_bulk_field_invalid",
    `${field} must be an integer in Bulk A JSONL`,
  );
}

function nestedId(value: unknown): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function mapMoney(value: unknown, field: string, currency: string): MoneyBagSides {
  return requireMoneyBag(value, field, currency);
}

function mapLine(
  line: JsonlObject,
  currency: string,
): OrderLineSnapshot {
  const id = asString(line.id);
  if (!id) {
    throw new OrderFactsSyncError(
      "order_facts_bulk_line_id_missing",
      "Bulk A line missing string id",
    );
  }
  const discounted = line.discountedTotalSet;
  if (discounted == null) {
    throw new OrderFactsSyncError(
      "order_facts_bulk_discounted_total_missing",
      "Bulk A line missing selected discountedTotalSet",
    );
  }
  return {
    shopifyGid: id,
    quantity: asInt(line.quantity, "line.quantity"),
    currentQuantity: asInt(line.currentQuantity, "line.currentQuantity"),
    refundableQuantity: asInt(line.refundableQuantity, "line.refundableQuantity"),
    unfulfilledQuantity:
      line.unfulfilledQuantity == null
        ? null
        : asInt(line.unfulfilledQuantity, "line.unfulfilledQuantity"),
    isGiftCard: asBoolean(line.isGiftCard, "line.isGiftCard"),
    title: asString(line.title) ?? "",
    variantTitle: asString(line.variantTitle),
    vendor: asString(line.vendor),
    sku: asString(line.sku),
    name: asString(line.name),
    variantGidAtSale: nestedId(line.variant),
    productGidAtSale: nestedId(line.product),
    currentVariantGid: nestedId(line.variant),
    currentProductGid: nestedId(line.product),
    shopifyLegacyResourceId: asString(
      line.variant && typeof line.variant === "object"
        ? (line.variant as { legacyResourceId?: unknown }).legacyResourceId
        : null,
    ),
    originalTotalSet: mapMoney(line.originalTotalSet, "line.originalTotalSet", currency),
    originalUnitPriceSet: mapMoney(
      line.originalUnitPriceSet,
      "line.originalUnitPriceSet",
      currency,
    ),
    discountedTotalSet: mapMoney(
      discounted,
      "line.discountedTotalSet",
      currency,
    ),
    totalDiscountSet: mapMoney(line.totalDiscountSet, "line.totalDiscountSet", currency),
    discountedUnitPriceAfterAllDiscountsSet: line.discountedUnitPriceAfterAllDiscountsSet
      ? mapMoney(
          line.discountedUnitPriceAfterAllDiscountsSet,
          "line.discountedUnitPriceAfterAllDiscountsSet",
          currency,
        )
      : null,
  };
}

export function bulkRootNeedsAgreementRefundFollowUp(root: JsonlObject): boolean {
  if (root.edited === true) return true;
  const amount = (root.totalRefundedSet as { shopMoney?: { amount?: unknown } } | undefined)
    ?.shopMoney?.amount;
  if (typeof amount !== "string") {
    return true;
  }
  return canonicalizeExactDecimalText(amount) !== "0";
}

/**
 * Map a complete Bulk A parent+lines assembly.
 * `confirmed` is not selected by frozen Bulk A; D records true as import
 * provenance because this `orders` connection excludes DraftOrder.
 */
export function mapBulkAAssemblyToOrderSnapshot(
  root: JsonlObject,
  children: JsonlObject[],
): OrderSnapshot {
  const id = asString(root.id);
  if (!id) {
    throw new OrderFactsSyncError(
      "order_facts_bulk_root_id_missing",
      "Bulk A root missing string id",
    );
  }
  const currency = asString(root.currencyCode);
  if (!currency) {
    throw new OrderFactsSyncError(
      "order_facts_bulk_currency_missing",
      "Bulk A root missing currencyCode",
    );
  }
  const lines = children
    .filter((child) => {
      const childId = asString(child.id);
      return Boolean(childId?.startsWith("gid://shopify/LineItem/"));
    })
    .map((child) => mapLine(child, currency));
  return {
    shopifyGid: id,
    name: asString(root.name) ?? "",
    shopifyCreatedAt: parseOptionalIso(root.createdAt, "order.createdAt"),
    shopifyUpdatedAt: parseIsoToDate(root.updatedAt, "order.updatedAt"),
    processedAt: parseOptionalIso(root.processedAt, "order.processedAt"),
    processedAtShopify: asString(root.processedAt),
    cancelledAt: parseOptionalIso(root.cancelledAt, "order.cancelledAt"),
    cancelReason: asString(root.cancelReason),
    closed: asBoolean(root.closed, "order.closed"),
    closedAt: parseOptionalIso(root.closedAt, "order.closedAt"),
    edited: asBoolean(root.edited, "order.edited"),
    test: asBoolean(root.test, "order.test"),
    confirmed: true,
    shopCurrencyCode: currency,
    presentmentCurrencyCode: asString(root.presentmentCurrencyCode),
    taxesIncluded: asBoolean(root.taxesIncluded, "order.taxesIncluded"),
    displayFinancialStatus: asString(root.displayFinancialStatus),
    displayFulfillmentStatus: null,
    sourceName: asString(root.sourceName),
    retailLocationGid: nestedId(root.retailLocation),
    currentSubtotalLineItemsQuantity:
      root.currentSubtotalLineItemsQuantity == null
        ? null
        : asInt(
            root.currentSubtotalLineItemsQuantity,
            "order.currentSubtotalLineItemsQuantity",
          ),
    subtotalLineItemsQuantity: null,
    shopifyLegacyResourceId: asString(root.legacyResourceId),
    originalTotalPriceSet: mapMoney(
      root.originalTotalPriceSet,
      "order.originalTotalPriceSet",
      currency,
    ),
    currentTotalPriceSet: mapMoney(
      root.currentTotalPriceSet,
      "order.currentTotalPriceSet",
      currency,
    ),
    currentSubtotalPriceSet: mapMoney(
      root.currentSubtotalPriceSet,
      "order.currentSubtotalPriceSet",
      currency,
    ),
    currentTotalDiscountsSet: mapMoney(
      root.currentTotalDiscountsSet,
      "order.currentTotalDiscountsSet",
      currency,
    ),
    currentTotalTaxSet: mapMoney(
      root.currentTotalTaxSet,
      "order.currentTotalTaxSet",
      currency,
    ),
    totalRefundedSet: mapMoney(
      root.totalRefundedSet,
      "order.totalRefundedSet",
      currency,
    ),
    netPaymentSet: mapMoney(root.netPaymentSet, "order.netPaymentSet", currency),
    refundDiscrepancySet: null,
    cartDiscountAmountSet: null,
    currentCartDiscountAmountSet: null,
    currentShippingPriceSet: root.currentShippingPriceSet
      ? mapMoney(
          root.currentShippingPriceSet,
          "order.currentShippingPriceSet",
          currency,
        )
      : null,
    lines,
    linesComplete: true,
    agreements: [],
    agreementsComplete: true,
  };
}
