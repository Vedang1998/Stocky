/**
 * Authoritative resource-attribute shape for first-LIVE insert and existing
 * attribute-bearing apply. Existence-only observations (no `attributes`) remain
 * valid for an existing row. Quantity-only InventoryLevel observations remain
 * valid without a resource-attribute snapshot. Do not invent USD, ACTIVE, true,
 * "", {}, or [] to satisfy NOT NULL.
 */
import {
  CanonicalApplyIncompleteAuthoritativeAttributesError,
  CanonicalApplyIncompleteFirstLiveError,
  CanonicalApplyNumericScaleError,
  CanonicalApplyQuantityDomainError,
} from "./errors";
import { assertFrozenNumericColumn } from "./money";
import { DIAGNOSTIC, QUANTITY_NAMES, type CanonicalObservation } from "./types";

const PRODUCT_STATUSES = new Set(["ACTIVE", "ARCHIVED", "DRAFT", "UNLISTED"]);
const UNIT_COST_ACCESS = new Set([
  "PRESENT",
  "NULL",
  "OMITTED_NO_PERMISSION",
  "QUERY_ERROR_ISOLATED",
]);

/** PostgreSQL / GraphQL Int domain. */
export const CANONICAL_QUANTITY_INT32_MIN = -2147483648;
export const CANONICAL_QUANTITY_INT32_MAX = 2147483647;

export type FirstLiveValidationOk = { ok: true };
export type FirstLiveValidationFail =
  | {
      ok: false;
      kind: "incomplete";
      missing: string[];
      diagnostic:
        | typeof DIAGNOSTIC.INCOMPLETE_FIRST_LIVE
        | typeof DIAGNOSTIC.INCOMPLETE_AUTHORITATIVE;
      error:
        | CanonicalApplyIncompleteFirstLiveError
        | CanonicalApplyIncompleteAuthoritativeAttributesError;
    }
  | {
      ok: false;
      kind: "numeric_scale";
      field: string;
      diagnostic: typeof DIAGNOSTIC.NUMERIC_SCALE;
      error: CanonicalApplyNumericScaleError;
    }
  | {
      ok: false;
      kind: "quantity_domain";
      field: string;
      diagnostic: typeof DIAGNOSTIC.QUANTITY_DOMAIN;
      error: CanonicalApplyQuantityDomainError;
    };

export type FirstLiveValidation = FirstLiveValidationOk | FirstLiveValidationFail;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
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

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableGid(value: unknown): boolean {
  return value === null || isNonEmptyString(value);
}

function isNullableDate(value: unknown): boolean {
  return value === null || value instanceof Date;
}

function isNullableInt32(value: unknown): boolean {
  return value === null || isCanonicalInt32(value);
}

export function isCanonicalInt32(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= CANONICAL_QUANTITY_INT32_MIN &&
    value <= CANONICAL_QUANTITY_INT32_MAX
  );
}

export function isApprovedSelectedOptions(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((item) => {
    if (item == null || typeof item !== "object" || Array.isArray(item)) return false;
    const rec = item as Record<string, unknown>;
    return (
      hasOwn(rec, "name") &&
      hasOwn(rec, "value") &&
      isNonEmptyString(rec.name) &&
      typeof rec.value === "string"
    );
  });
}

export function inventoryLevelHasResourceAttributes(
  attrs: Record<string, unknown>,
): boolean {
  return hasOwn(attrs, "isActive") || hasOwn(attrs, "shopifyInventoryLevelGid");
}

function failIncomplete(
  missing: string[],
  diagnostic:
    | typeof DIAGNOSTIC.INCOMPLETE_FIRST_LIVE
    | typeof DIAGNOSTIC.INCOMPLETE_AUTHORITATIVE,
): FirstLiveValidationFail {
  const error =
    diagnostic === DIAGNOSTIC.INCOMPLETE_AUTHORITATIVE
      ? new CanonicalApplyIncompleteAuthoritativeAttributesError(missing)
      : new CanonicalApplyIncompleteFirstLiveError(missing);
  return {
    ok: false,
    kind: "incomplete",
    missing,
    diagnostic,
    error,
  };
}

function tryFrozenNumeric(
  value: unknown,
  field: string,
  missing: string[],
  diagnostic:
    | typeof DIAGNOSTIC.INCOMPLETE_FIRST_LIVE
    | typeof DIAGNOSTIC.INCOMPLETE_AUTHORITATIVE,
): FirstLiveValidationFail | null {
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
    return failIncomplete(missing, diagnostic);
  }
}

function assertNullableFrozenNumeric(
  record: Record<string, unknown>,
  field: string,
  missing: string[],
  diagnostic:
    | typeof DIAGNOSTIC.INCOMPLETE_FIRST_LIVE
    | typeof DIAGNOSTIC.INCOMPLETE_AUTHORITATIVE,
): FirstLiveValidationFail | null {
  if (!hasOwn(record, field)) {
    missing.push(field);
    return null;
  }
  if (record[field] == null) return null;
  return tryFrozenNumeric(record[field], field, missing, diagnostic);
}

/**
 * Shared field-shape validator for every canonical resource field this lane owns.
 * Missing property is distinct from explicit null.
 */
export function collectMissingAuthoritativeFields(
  kind: CanonicalObservation["identity"]["resourceKind"],
  attrs: Record<string, unknown>,
): string[] {
  const missing: string[] = [];

  if (kind === "Product") {
    if (!isNonEmptyString(attrs.title)) missing.push("title");
    if (!isNonEmptyString(attrs.handle)) missing.push("handle");
    if (!hasOwn(attrs, "vendor") || !isNullableString(attrs.vendor)) missing.push("vendor");
    if (!hasOwn(attrs, "productType") || !isNullableString(attrs.productType)) {
      missing.push("productType");
    }
    if (!hasOwn(attrs, "tags") || !isStringArray(attrs.tags)) missing.push("tags");
    if (!isNonEmptyString(attrs.status) || !PRODUCT_STATUSES.has(attrs.status)) {
      missing.push("status");
    }
    if (!hasOwn(attrs, "featuredMediaUrl") || !isNullableString(attrs.featuredMediaUrl)) {
      missing.push("featuredMediaUrl");
    }
    return missing;
  }

  if (kind === "ProductVariant") {
    if (!isNonEmptyString(attrs.shopifyProductGid)) missing.push("shopifyProductGid");
    if (!isNonEmptyString(attrs.title)) missing.push("title");
    if (!hasOwn(attrs, "displayName") || !isNullableString(attrs.displayName)) {
      missing.push("displayName");
    }
    if (!hasOwn(attrs, "selectedOptions") || !isApprovedSelectedOptions(attrs.selectedOptions)) {
      missing.push("selectedOptions");
    }
    if (!hasOwn(attrs, "sku") || !isNullableString(attrs.sku)) missing.push("sku");
    if (!hasOwn(attrs, "barcode") || !isNullableString(attrs.barcode)) missing.push("barcode");
    if (!hasOwn(attrs, "priceAmount") || attrs.priceAmount == null) missing.push("priceAmount");
    if (!hasOwn(attrs, "compareAtPriceAmount")) missing.push("compareAtPriceAmount");
    if (!isNonEmptyString(attrs.currencyCode)) missing.push("currencyCode");
    if (!hasOwn(attrs, "position") || !isNullableInt32(attrs.position)) missing.push("position");
    return missing;
  }

  if (kind === "InventoryItem") {
    if (!hasOwn(attrs, "shopifyVariantGid") || !isNullableGid(attrs.shopifyVariantGid)) {
      missing.push("shopifyVariantGid");
    }
    if (!hasOwn(attrs, "sku") || !isNullableString(attrs.sku)) missing.push("sku");
    if (!isPresentBoolean(attrs.tracked)) missing.push("tracked");
    if (!isPresentBoolean(attrs.requiresShipping)) missing.push("requiresShipping");
    if (!hasOwn(attrs, "weightValue")) missing.push("weightValue");
    if (!hasOwn(attrs, "weightUnit") || !isNullableString(attrs.weightUnit)) {
      missing.push("weightUnit");
    }
    if (!hasOwn(attrs, "unitCostAmount")) missing.push("unitCostAmount");
    if (!hasOwn(attrs, "unitCostCurrencyCode") || !isNullableString(attrs.unitCostCurrencyCode)) {
      missing.push("unitCostCurrencyCode");
    }
    if (!isNonEmptyString(attrs.unitCostAccess) || !UNIT_COST_ACCESS.has(attrs.unitCostAccess)) {
      missing.push("unitCostAccess");
    }
    return missing;
  }

  if (kind === "Location") {
    if (!isNonEmptyString(attrs.name)) missing.push("name");
    if (!isPresentBoolean(attrs.isActive)) missing.push("isActive");
    if (!hasOwn(attrs, "deactivatedAt") || !isNullableDate(attrs.deactivatedAt)) {
      missing.push("deactivatedAt");
    }
    if (!isPresentBoolean(attrs.fulfillsOnlineOrders)) missing.push("fulfillsOnlineOrders");
    if (!isPresentBoolean(attrs.shipsInventory)) missing.push("shipsInventory");
    if (!isPresentBoolean(attrs.isFulfillmentService)) missing.push("isFulfillmentService");
    if (!isPresentBoolean(attrs.hasActiveInventory)) missing.push("hasActiveInventory");
    if (!hasOwn(attrs, "address1") || !isNullableString(attrs.address1)) missing.push("address1");
    if (!hasOwn(attrs, "city") || !isNullableString(attrs.city)) missing.push("city");
    if (!hasOwn(attrs, "provinceCode") || !isNullableString(attrs.provinceCode)) {
      missing.push("provinceCode");
    }
    if (!hasOwn(attrs, "countryCode") || !isNullableString(attrs.countryCode)) {
      missing.push("countryCode");
    }
    if (!hasOwn(attrs, "zip") || !isNullableString(attrs.zip)) missing.push("zip");
    return missing;
  }

  if (kind === "InventoryLevel") {
    if (!isPresentBoolean(attrs.isActive)) missing.push("isActive");
    if (!hasOwn(attrs, "shopifyInventoryLevelGid") || !isNullableGid(attrs.shopifyInventoryLevelGid)) {
      missing.push("shopifyInventoryLevelGid");
    }
    return missing;
  }

  missing.push("resourceKind");
  return missing;
}

function validateNumericFields(
  kind: CanonicalObservation["identity"]["resourceKind"],
  attrs: Record<string, unknown>,
  missing: string[],
  diagnostic:
    | typeof DIAGNOSTIC.INCOMPLETE_FIRST_LIVE
    | typeof DIAGNOSTIC.INCOMPLETE_AUTHORITATIVE,
): FirstLiveValidationFail | null {
  if (kind === "ProductVariant") {
    if (hasOwn(attrs, "priceAmount") && attrs.priceAmount != null) {
      const fail = tryFrozenNumeric(attrs.priceAmount, "priceAmount", missing, diagnostic);
      if (fail) return fail;
    }
    const compareFail = assertNullableFrozenNumeric(
      attrs,
      "compareAtPriceAmount",
      missing,
      diagnostic,
    );
    if (compareFail) return compareFail;
  }
  if (kind === "InventoryItem") {
    const weightFail = assertNullableFrozenNumeric(attrs, "weightValue", missing, diagnostic);
    if (weightFail) return weightFail;
    const costFail = assertNullableFrozenNumeric(attrs, "unitCostAmount", missing, diagnostic);
    if (costFail) return costFail;
  }
  return null;
}

function validateResourceSnapshot(
  observation: CanonicalObservation,
  diagnostic:
    | typeof DIAGNOSTIC.INCOMPLETE_FIRST_LIVE
    | typeof DIAGNOSTIC.INCOMPLETE_AUTHORITATIVE,
): FirstLiveValidation {
  const attrs = asRecord(observation.attributes);
  if (!attrs) {
    return failIncomplete(["attributes"], diagnostic);
  }
  const kind = observation.identity.resourceKind;
  const missing = collectMissingAuthoritativeFields(kind, attrs);
  if (missing.length > 0) return failIncomplete(missing, diagnostic);
  const numericFail = validateNumericFields(kind, attrs, missing, diagnostic);
  if (numericFail) return numericFail;
  if (missing.length > 0) return failIncomplete(missing, diagnostic);
  return { ok: true };
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
  return validateResourceSnapshot(observation, DIAGNOSTIC.INCOMPLETE_FIRST_LIVE);
}

/**
 * Existing-row attribute contract. Absence of `attributes` is existence-only.
 * InventoryLevel quantity-only payloads skip resource completeness.
 */
export function validateExistingAuthoritativeAttributes(
  observation: CanonicalObservation,
): FirstLiveValidation {
  if (observation.attributes == null) {
    return { ok: true };
  }
  const attrs = asRecord(observation.attributes);
  if (!attrs) {
    return failIncomplete(["attributes"], DIAGNOSTIC.INCOMPLETE_AUTHORITATIVE);
  }
  if (
    observation.identity.resourceKind === "InventoryLevel" &&
    !inventoryLevelHasResourceAttributes(attrs)
  ) {
    return { ok: true };
  }
  return validateResourceSnapshot(observation, DIAGNOSTIC.INCOMPLETE_AUTHORITATIVE);
}

export function validateObservationNumericColumns(
  observation: CanonicalObservation,
): FirstLiveValidation {
  const attrs = asRecord(observation.attributes);
  if (!attrs) return { ok: true };
  const missing: string[] = [];
  const kind = observation.identity.resourceKind;
  const numericFail = validateNumericFields(
    kind,
    attrs,
    missing,
    DIAGNOSTIC.INCOMPLETE_AUTHORITATIVE,
  );
  if (numericFail) return numericFail;
  return { ok: true };
}

export function validateObservationQuantityColumns(
  observation: CanonicalObservation,
): FirstLiveValidation {
  if (observation.identity.resourceKind !== "InventoryLevel") {
    return { ok: true };
  }
  const attrs = asRecord(observation.attributes);
  // Omitted or explicit-null quantities means no quantity payload was observed.
  // `{ quantities: undefined }` must not be treated as an authoritative array.
  if (!attrs || !hasOwn(attrs, "quantities") || attrs.quantities == null) {
    return { ok: true };
  }
  if (!Array.isArray(attrs.quantities)) {
    return failIncomplete(["quantities"], DIAGNOSTIC.INCOMPLETE_AUTHORITATIVE);
  }
  const names = new Set<string>(QUANTITY_NAMES);
  for (const item of attrs.quantities) {
    if (item == null || typeof item !== "object" || Array.isArray(item)) {
      return {
        ok: false,
        kind: "quantity_domain",
        field: "quantities",
        diagnostic: DIAGNOSTIC.QUANTITY_DOMAIN,
        error: new CanonicalApplyQuantityDomainError("quantities"),
      };
    }
    const rec = item as Record<string, unknown>;
    const name = rec.name;
    if (typeof name !== "string" || !names.has(name)) {
      return {
        ok: false,
        kind: "quantity_domain",
        field: typeof name === "string" ? name : "quantities",
        diagnostic: DIAGNOSTIC.QUANTITY_DOMAIN,
        error: new CanonicalApplyQuantityDomainError(
          typeof name === "string" ? name : "quantities",
          name,
        ),
      };
    }
    if (!hasOwn(rec, "quantity")) {
      return {
        ok: false,
        kind: "quantity_domain",
        field: name,
        diagnostic: DIAGNOSTIC.QUANTITY_DOMAIN,
        error: new CanonicalApplyQuantityDomainError(name),
      };
    }
    const quantity = rec.quantity;
    if (quantity == null) continue;
    if (!isCanonicalInt32(quantity)) {
      return {
        ok: false,
        kind: "quantity_domain",
        field: name,
        diagnostic: DIAGNOSTIC.QUANTITY_DOMAIN,
        error: new CanonicalApplyQuantityDomainError(name, quantity),
      };
    }
  }
  return { ok: true };
}
