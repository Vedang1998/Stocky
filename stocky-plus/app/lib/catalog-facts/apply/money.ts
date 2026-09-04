/**
 * Exact money / NUMERIC helpers. priceAmount / compareAtPriceAmount /
 * unitCostAmount / weightValue must remain Decimal/source-safe. No Number,
 * parseFloat, or floating arithmetic. Frozen F1 columns are DECIMAL(20,6).
 */
import { Prisma } from "@prisma/client";
import { CanonicalApplyMoneyError, CanonicalApplyNumericScaleError } from "./errors";

const DECIMAL_TEXT = /^-?\d+(\.\d+)?$/;

/** Frozen ShopifyProductFact / ShopifyVariantFact / ShopifyInventoryItemFact NUMERIC. */
export const FROZEN_CANONICAL_NUMERIC_PRECISION = 20;
export const FROZEN_CANONICAL_NUMERIC_SCALE = 6;

export function exactMoneyText(value: unknown, field: string): string {
  if (typeof value === "number") {
    throw new CanonicalApplyMoneyError(
      `${field} must not use Number / floating arithmetic`,
    );
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!DECIMAL_TEXT.test(trimmed)) {
      throw new CanonicalApplyMoneyError(`${field} is not exact decimal text`);
    }
    return trimmed;
  }
  if (value && typeof value === "object") {
    const record = value as {
      toFixed?: (digits?: number) => string;
      toString?: () => string;
    };
    if (typeof record.toFixed === "function") {
      const text = record.toFixed();
      if (typeof text === "string" && DECIMAL_TEXT.test(text)) return text;
    }
    if (typeof record.toString === "function") {
      const text = record.toString();
      if (typeof text === "string" && DECIMAL_TEXT.test(text) && text !== "[object Object]") {
        return text;
      }
    }
  }
  throw new CanonicalApplyMoneyError(`${field} is not an exact decimal value`);
}

export function exactMoneyTextOrNull(
  value: unknown,
  field: string,
): string | null {
  if (value == null) return null;
  return exactMoneyText(value, field);
}

/**
 * Canonical exact-decimal text for PostgreSQL NUMERIC equality:
 * trailing fractional zeros are insignificant; -0 equals 0.
 */
export function canonicalizeExactDecimalText(text: string): string {
  const trimmed = text.trim();
  if (!DECIMAL_TEXT.test(trimmed)) {
    throw new CanonicalApplyMoneyError("numeric value is not exact decimal text");
  }
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const dot = unsigned.indexOf(".");
  const rawInt = dot === -1 ? unsigned : unsigned.slice(0, dot);
  const rawFrac = dot === -1 ? "" : unsigned.slice(dot + 1);
  const intDigits = rawInt.replace(/^0+/, "") || "0";
  const fracDigits = rawFrac.replace(/0+$/, "");
  if (intDigits === "0" && fracDigits === "") {
    return "0";
  }
  return `${negative ? "-" : ""}${intDigits}${fracDigits ? `.${fracDigits}` : ""}`;
}

export function isExactlyRepresentableAsDecimal20_6(text: string): boolean {
  const trimmed = text.trim();
  if (!DECIMAL_TEXT.test(trimmed)) return false;
  const unsigned = trimmed.startsWith("-") ? trimmed.slice(1) : trimmed;
  const dot = unsigned.indexOf(".");
  const rawInt = dot === -1 ? unsigned : unsigned.slice(0, dot);
  const rawFrac = dot === -1 ? "" : unsigned.slice(dot + 1);
  const intDigits = rawInt.replace(/^0+/, "") || "0";
  const fracSignificant = rawFrac.replace(/0+$/, "");
  if (fracSignificant.length > FROZEN_CANONICAL_NUMERIC_SCALE) return false;
  const integerCount = intDigits === "0" ? 0 : intDigits.length;
  if (integerCount > FROZEN_CANONICAL_NUMERIC_PRECISION - FROZEN_CANONICAL_NUMERIC_SCALE) {
    return false;
  }
  return true;
}

/**
 * Mathematical DECIMAL/NUMERIC equality. Null is distinct from non-null.
 * Scale-equivalent representations compare equal. No IEEE-754.
 */
export function exactNumericEqual(
  left: unknown,
  right: unknown,
  field = "numeric",
): boolean {
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  const leftText = exactMoneyText(left, field);
  const rightText = exactMoneyText(right, field);
  const leftCanonical = canonicalizeExactDecimalText(leftText);
  const rightCanonical = canonicalizeExactDecimalText(rightText);
  return new Prisma.Decimal(leftCanonical).eq(new Prisma.Decimal(rightCanonical));
}

export function assertFrozenNumericColumn(value: unknown, field: string): string {
  const text = exactMoneyText(value, field);
  if (!isExactlyRepresentableAsDecimal20_6(text)) {
    throw new CanonicalApplyNumericScaleError(field, text);
  }
  return text;
}

export function frozenNumericTextOrNull(value: unknown, field: string): string | null {
  if (value == null) return null;
  return assertFrozenNumericColumn(value, field);
}
