/**
 * Exact money helpers. priceAmount / compareAtPriceAmount / unitCostAmount
 * must remain Decimal/source-safe. No Number, parseFloat, or floating arithmetic.
 */
import { CanonicalApplyMoneyError } from "./errors";

const DECIMAL_TEXT = /^-?\d+(\.\d+)?$/;

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
