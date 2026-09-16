/**
 * D-owned Bulk A JSONL → C OrderSnapshot mapper (C3).
 * Uses selected `discountedTotalSet(withCodeDiscounts: true)` as canonical
 * line money. Does not invent `confirmed`, agreements, or unselected nulls.
 * Does not edit frozen B documents.
 */
import { optionalMoneyBag, requireMoneyBag } from "../admin-read/money";
import type { OrderLineSnapshot, OrderSnapshot } from "../apply/types";
import type { MoneyBagSides } from "../types";
import { OrderFactsSyncError } from "./errors";
import type { JsonlObject } from "./types";

const SHOPIFY_DATETIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function hasOwn(obj: JsonlObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function omitted(field: string): never {
  throw new OrderFactsSyncError(
    "order_facts_bulk_field_omitted",
    `${field} omitted from selected Bulk A projection`,
  );
}

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

function selectedString(obj: JsonlObject, field: string): string | null {
  if (!hasOwn(obj, field)) omitted(field);
  const value = obj[field];
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new OrderFactsSyncError(
      "order_facts_bulk_field_invalid",
      `${field} must be a string or null in Bulk A JSONL`,
    );
  }
  return value;
}

function selectedRequiredString(obj: JsonlObject, field: string): string {
  const value = selectedString(obj, field);
  if (value == null || value === "") {
    throw new OrderFactsSyncError(
      "order_facts_bulk_field_invalid",
      `${field} must be a non-empty string in Bulk A JSONL`,
    );
  }
  return value;
}

function selectedBoolean(obj: JsonlObject, field: string): boolean {
  if (!hasOwn(obj, field)) omitted(field);
  const value = obj[field];
  if (typeof value !== "boolean") {
    throw new OrderFactsSyncError(
      "order_facts_bulk_field_invalid",
      `${field} must be a boolean in Bulk A JSONL`,
    );
  }
  return value;
}

function selectedInt(obj: JsonlObject, field: string): number | null {
  if (!hasOwn(obj, field)) omitted(field);
  const value = obj[field];
  if (value == null) return null;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  throw new OrderFactsSyncError(
    "order_facts_bulk_field_invalid",
    `${field} must be an integer or null in Bulk A JSONL`,
  );
}

function selectedRequiredInt(obj: JsonlObject, field: string): number {
  const value = selectedInt(obj, field);
  if (value == null) {
    throw new OrderFactsSyncError(
      "order_facts_bulk_field_invalid",
      `${field} must be an integer in Bulk A JSONL`,
    );
  }
  return value;
}

function selectedOptionalIso(obj: JsonlObject, field: string): Date | null {
  if (!hasOwn(obj, field)) omitted(field);
  const value = obj[field];
  if (value == null) return null;
  return parseIsoToDate(value, field);
}

function selectedRequiredIso(obj: JsonlObject, field: string): Date {
  const value = selectedOptionalIso(obj, field);
  if (value == null) {
    throw new OrderFactsSyncError(
      "order_facts_bulk_datetime_invalid",
      `malformed_datetime:${field}`,
    );
  }
  return value;
}

function nestedId(value: unknown): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function selectedMoney(
  obj: JsonlObject,
  field: string,
  currency: string,
): MoneyBagSides {
  if (!hasOwn(obj, field)) omitted(field);
  return requireMoneyBag(obj[field], field, currency);
}

function selectedOptionalMoney(
  obj: JsonlObject,
  field: string,
  currency: string,
): MoneyBagSides | null {
  if (!hasOwn(obj, field)) omitted(field);
  return optionalMoneyBag(obj[field], field, currency);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mapLine(line: JsonlObject, currency: string): OrderLineSnapshot {
  const id = asString(line.id);
  if (!id) {
    throw new OrderFactsSyncError(
      "order_facts_bulk_line_id_missing",
      "Bulk A line missing string id",
    );
  }
  if (!hasOwn(line, "discountedTotalSetWithCodeDiscounts")) {
    throw new OrderFactsSyncError(
      "order_facts_bulk_discounted_total_missing",
      "Bulk A line missing selected discountedTotalSet(withCodeDiscounts: true)",
    );
  }
  const withCode = line.discountedTotalSetWithCodeDiscounts;
  if (withCode == null) {
    throw new OrderFactsSyncError(
      "order_facts_bulk_discounted_total_missing",
      "Bulk A line selected with-code discountedTotalSet is null",
    );
  }
  return {
    shopifyGid: id,
    quantity: selectedRequiredInt(line, "quantity"),
    currentQuantity: selectedRequiredInt(line, "currentQuantity"),
    refundableQuantity: selectedRequiredInt(line, "refundableQuantity"),
    unfulfilledQuantity: selectedInt(line, "unfulfilledQuantity"),
    isGiftCard: selectedBoolean(line, "isGiftCard"),
    title: selectedString(line, "title") ?? "",
    variantTitle: selectedString(line, "variantTitle"),
    vendor: selectedString(line, "vendor"),
    sku: selectedString(line, "sku"),
    name: selectedString(line, "name"),
    variantGidAtSale: nestedId(line.variant),
    productGidAtSale: nestedId(line.product),
    currentVariantGid: nestedId(line.variant),
    currentProductGid: nestedId(line.product),
    shopifyLegacyResourceId: asString(
      line.variant && typeof line.variant === "object"
        ? (line.variant as { legacyResourceId?: unknown }).legacyResourceId
        : null,
    ),
    originalTotalSet: selectedMoney(line, "originalTotalSet", currency),
    originalUnitPriceSet: selectedMoney(line, "originalUnitPriceSet", currency),
    discountedTotalSet: requireMoneyBag(
      withCode,
      "line.discountedTotalSet(withCodeDiscounts: true)",
      currency,
    ),
    totalDiscountSet: selectedMoney(line, "totalDiscountSet", currency),
    discountedUnitPriceAfterAllDiscountsSet: selectedOptionalMoney(
      line,
      "discountedUnitPriceAfterAllDiscountsSet",
      currency,
    ),
  };
}

/**
 * Map a complete Bulk A parent+lines assembly.
 * Agreements remain incomplete until the D supplemental ledger is queried.
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
  const currency = selectedRequiredString(root, "currencyCode");
  const lines = children
    .filter((child) => {
      const childId = asString(child.id);
      return Boolean(childId?.startsWith("gid://shopify/LineItem/"));
    })
    .map((child) => mapLine(child, currency));
  return {
    shopifyGid: id,
    name: selectedString(root, "name") ?? "",
    shopifyCreatedAt: selectedOptionalIso(root, "createdAt"),
    shopifyUpdatedAt: selectedRequiredIso(root, "updatedAt"),
    processedAt: selectedOptionalIso(root, "processedAt"),
    processedAtShopify: selectedString(root, "processedAt"),
    cancelledAt: selectedOptionalIso(root, "cancelledAt"),
    cancelReason: selectedString(root, "cancelReason"),
    closed: selectedBoolean(root, "closed"),
    closedAt: selectedOptionalIso(root, "closedAt"),
    edited: selectedBoolean(root, "edited"),
    test: selectedBoolean(root, "test"),
    confirmed: selectedBoolean(root, "confirmed"),
    shopCurrencyCode: currency,
    presentmentCurrencyCode: selectedString(root, "presentmentCurrencyCode"),
    taxesIncluded: selectedBoolean(root, "taxesIncluded"),
    displayFinancialStatus: selectedString(root, "displayFinancialStatus"),
    displayFulfillmentStatus: selectedString(root, "displayFulfillmentStatus"),
    sourceName: selectedString(root, "sourceName"),
    retailLocationGid: nestedId(root.retailLocation),
    currentSubtotalLineItemsQuantity: selectedInt(
      root,
      "currentSubtotalLineItemsQuantity",
    ),
    subtotalLineItemsQuantity: selectedInt(root, "subtotalLineItemsQuantity"),
    shopifyLegacyResourceId: selectedString(root, "legacyResourceId"),
    originalTotalPriceSet: selectedMoney(root, "originalTotalPriceSet", currency),
    currentTotalPriceSet: selectedMoney(root, "currentTotalPriceSet", currency),
    currentSubtotalPriceSet: selectedMoney(
      root,
      "currentSubtotalPriceSet",
      currency,
    ),
    currentTotalDiscountsSet: selectedMoney(
      root,
      "currentTotalDiscountsSet",
      currency,
    ),
    currentTotalTaxSet: selectedMoney(root, "currentTotalTaxSet", currency),
    totalRefundedSet: selectedMoney(root, "totalRefundedSet", currency),
    netPaymentSet: selectedMoney(root, "netPaymentSet", currency),
    refundDiscrepancySet: selectedOptionalMoney(
      root,
      "refundDiscrepancySet",
      currency,
    ),
    cartDiscountAmountSet: selectedOptionalMoney(
      root,
      "cartDiscountAmountSet",
      currency,
    ),
    currentCartDiscountAmountSet: selectedOptionalMoney(
      root,
      "currentCartDiscountAmountSet",
      currency,
    ),
    currentShippingPriceSet: selectedOptionalMoney(
      root,
      "currentShippingPriceSet",
      currency,
    ),
    lines,
    linesComplete: true,
    agreements: [],
    agreementsComplete: false,
  };
}

export function bulkRootUpdatedAt(root: JsonlObject): string {
  return selectedRequiredString(root, "updatedAt");
}

export function bulkRootCurrencyCode(root: JsonlObject): string {
  return selectedRequiredString(root, "currencyCode");
}
