/**
 * First-LIVE canonical insert attribute contract.
 *
 * Existence-only / partial updates remain valid for an EXISTING row.
 * Creating a NEW LIVE fact requires complete authoritative attributes.
 * Do not invent USD, ACTIVE, true, "", {}, or [] to satisfy NOT NULL.
 */
import { CanonicalApplyIncompleteFirstLiveError, CanonicalApplyNumericScaleError } from "./errors";
import { assertFrozenNumericColumn } from "./money";
import { DIAGNOSTIC, type CanonicalObservation } from "./types";

const PRODUCT_STATUSES = new Set(["ACTIVE", "ARCHIVED", "DRAFT", "UNLISTED"]);
const UNIT_COST_ACCESS = new Set([
  "PRESENT",
  "NULL",
  "OMITTED_NO_PERMISSION",
  "QUERY_ERROR_ISOLATED",
]);

export type FirstLiveValidationOk = { ok: true };
export type FirstLiveValidationFail =
  | {
      ok: false;
      kind: "incomplete";
      missing: string[];
      diagnostic: typeof DIAGNOSTIC.INCOMPLETE_FIRST_LIVE;
      error: CanonicalApplyIncompleteFirstLiveError;
    }
  | {
      ok: false;
      kind: "numeric_scale";
      field: string;
      diagnostic: typeof DIAGNOSTIC.NUMERIC_SCALE;
      error: CanonicalApplyNumericScaleError;
    };

export type FirstLiveValidation = FirstLiveValidationOk | FirstLiveValidationFail;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isPresentString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPresentBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isApprovedSelectedOptions(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) {
    return value.every((item) => {
      if (item == null || typeof item !== "object" || Array.isArray(item)) return false;
      const rec = item as { name?: unknown; value?: unknown };
      return typeof rec.name === "string" && typeof rec.value === "string";
    });
  }
  return typeof value === "object";
}

function failIncomplete(missing: string[]): FirstLiveValidationFail {
  return {
    ok: false,
    kind: "incomplete",
    missing,
    diagnostic: DIAGNOSTIC.INCOMPLETE_FIRST_LIVE,
    error: new CanonicalApplyIncompleteFirstLiveError(missing),
  };
}

function tryFrozenNumeric(value: unknown, field: string, missing: string[]): FirstLiveValidationFail | null {
  try {
    assertFrozenNumericColumn(value, field);
    return null;
  } catch (error) {
    if (error instanceof CanonicalApplyNumericScaleError) {
      return {
        ok: false,
        kind: "numeric_scale",
        field,
        diagnostic: DIAGNOSTIC.NUMERIC_SCALE,
        error,
      };
    }
    missing.push(field);
    return failIncomplete(missing);
  }
}

function assertOptionalFrozenNumeric(
  record: Record<string, unknown>,
  field: string,
  missing: string[],
): FirstLiveValidationFail | null {
  if (!hasOwn(record, field) || record[field] == null) return null;
  return tryFrozenNumeric(record[field], field, missing);
}

export function validateFirstLiveAttributes(
  observation: CanonicalObservation,
): FirstLiveValidation {
  const incomingLive =
    observation.existenceKind === "LIVE_REFETCH" ||
    observation.existenceKind === "LIVE_FULL_SYNC_PRESENT";
  if (!incomingLive) {
    return { ok: true };
  }
  const attrs = asRecord(observation.attributes);
  if (!attrs) {
    return failIncomplete(["attributes"]);
  }
  const kind = observation.identity.resourceKind;
  const missing: string[] = [];

  if (kind === "Product") {
    if (!isPresentString(attrs.title)) missing.push("title");
    if (!isPresentString(attrs.handle)) missing.push("handle");
    if (!isStringArray(attrs.tags)) missing.push("tags");
    if (!isPresentString(attrs.status) || !PRODUCT_STATUSES.has(attrs.status)) {
      missing.push("status");
    }
    if (missing.length > 0) return failIncomplete(missing);
    return { ok: true };
  }

  if (kind === "ProductVariant") {
    if (!isNonEmptyString(attrs.shopifyProductGid)) missing.push("shopifyProductGid");
    if (!isPresentString(attrs.title)) missing.push("title");
    if (!isApprovedSelectedOptions(attrs.selectedOptions)) missing.push("selectedOptions");
    if (attrs.priceAmount == null) missing.push("priceAmount");
    if (!isNonEmptyString(attrs.currencyCode)) missing.push("currencyCode");
    if (missing.length > 0) return failIncomplete(missing);
    const priceFail = tryFrozenNumeric(attrs.priceAmount, "priceAmount", missing);
    if (priceFail) return priceFail;
    const compareFail = assertOptionalFrozenNumeric(attrs, "compareAtPriceAmount", missing);
    if (compareFail) return compareFail;
    return { ok: true };
  }

  if (kind === "InventoryItem") {
    if (!isPresentBoolean(attrs.tracked)) missing.push("tracked");
    if (!isPresentBoolean(attrs.requiresShipping)) missing.push("requiresShipping");
    if (!isPresentString(attrs.unitCostAccess) || !UNIT_COST_ACCESS.has(attrs.unitCostAccess)) {
      missing.push("unitCostAccess");
    }
    if (missing.length > 0) return failIncomplete(missing);
    const weightFail = assertOptionalFrozenNumeric(attrs, "weightValue", missing);
    if (weightFail) return weightFail;
    const costFail = assertOptionalFrozenNumeric(attrs, "unitCostAmount", missing);
    if (costFail) return costFail;
    return { ok: true };
  }

  if (kind === "Location") {
    if (!isPresentString(attrs.name)) missing.push("name");
    if (!isPresentBoolean(attrs.isActive)) missing.push("isActive");
    if (!isPresentBoolean(attrs.fulfillsOnlineOrders)) missing.push("fulfillsOnlineOrders");
    if (!isPresentBoolean(attrs.shipsInventory)) missing.push("shipsInventory");
    if (!isPresentBoolean(attrs.isFulfillmentService)) missing.push("isFulfillmentService");
    if (!isPresentBoolean(attrs.hasActiveInventory)) missing.push("hasActiveInventory");
    if (missing.length > 0) return failIncomplete(missing);
    return { ok: true };
  }

  if (kind === "InventoryLevel") {
    if (!isPresentBoolean(attrs.isActive)) missing.push("isActive");
    if (missing.length > 0) return failIncomplete(missing);
    return { ok: true };
  }

  return failIncomplete(["resourceKind"]);
}

export function validateObservationNumericColumns(
  observation: CanonicalObservation,
): FirstLiveValidation {
  const attrs = asRecord(observation.attributes);
  if (!attrs) return { ok: true };
  const missing: string[] = [];
  const kind = observation.identity.resourceKind;
  if (kind === "ProductVariant") {
    if (hasOwn(attrs, "priceAmount") && attrs.priceAmount != null) {
      const fail = tryFrozenNumeric(attrs.priceAmount, "priceAmount", missing);
      if (fail) return fail;
    }
    const compareFail = assertOptionalFrozenNumeric(attrs, "compareAtPriceAmount", missing);
    if (compareFail) return compareFail;
  }
  if (kind === "InventoryItem") {
    const weightFail = assertOptionalFrozenNumeric(attrs, "weightValue", missing);
    if (weightFail) return weightFail;
    const costFail = assertOptionalFrozenNumeric(attrs, "unitCostAmount", missing);
    if (costFail) return costFail;
  }
  return { ok: true };
}
