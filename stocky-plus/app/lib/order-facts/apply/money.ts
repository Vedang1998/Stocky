/**
 * Exact money / NUMERIC helpers for order facts. Frozen columns are DECIMAL(20,6).
 * Never Number, parseFloat, app FX, or division-derived unit price.
 */
import { Prisma } from "@prisma/client";
import {
  FROZEN_ORDER_NUMERIC_PRECISION,
  FROZEN_ORDER_NUMERIC_SCALE,
  type MoneyBagSides,
  type OptionalMoneyBagSides,
} from "../types";
import {
  OrderApplyCurrencyMismatchError,
  OrderApplyMoneyError,
  OrderApplyNumericScaleError,
} from "./errors";

const DECIMAL_TEXT = /^-?\d+(\.\d+)?$/;

export function exactMoneyText(value: unknown, field: string): string {
  if (typeof value === "number") {
    throw new OrderApplyMoneyError(
      `${field} must not use Number / floating arithmetic`,
    );
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!DECIMAL_TEXT.test(trimmed)) {
      throw new OrderApplyMoneyError(`${field} is not exact decimal text`);
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
      if (
        typeof text === "string" &&
        DECIMAL_TEXT.test(text) &&
        text !== "[object Object]"
      ) {
        return text;
      }
    }
  }
  throw new OrderApplyMoneyError(`${field} is not an exact decimal value`);
}

export function canonicalizeExactDecimalText(text: string): string {
  const trimmed = text.trim();
  if (!DECIMAL_TEXT.test(trimmed)) {
    throw new OrderApplyMoneyError("numeric value is not exact decimal text");
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
  if (fracSignificant.length > FROZEN_ORDER_NUMERIC_SCALE) return false;
  const integerCount = intDigits === "0" ? 0 : intDigits.length;
  if (
    integerCount >
    FROZEN_ORDER_NUMERIC_PRECISION - FROZEN_ORDER_NUMERIC_SCALE
  ) {
    return false;
  }
  return true;
}

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
    throw new OrderApplyNumericScaleError(field, text);
  }
  return text;
}

export function frozenNumericTextOrNull(
  value: unknown,
  field: string,
): string | null {
  if (value == null) return null;
  return assertFrozenNumericColumn(value, field);
}

export function sumExactMoney(amounts: readonly string[], field: string): string {
  let acc = new Prisma.Decimal(0);
  for (const amount of amounts) {
    const text = assertFrozenNumericColumn(amount, field);
    acc = acc.plus(new Prisma.Decimal(canonicalizeExactDecimalText(text)));
  }
  return canonicalizeExactDecimalText(acc.toFixed());
}

export type RequiredMoneyBagInput = {
  shopAmount: unknown;
  shopCurrencyCode: unknown;
  presentmentAmount: unknown;
  presentmentCurrencyCode: unknown;
};

export function parseRequiredMoneyBag(
  bag: RequiredMoneyBagInput | null | undefined,
  field: string,
  expectedShopCurrency: string,
): MoneyBagSides {
  if (bag == null) {
    throw new OrderApplyMoneyError(`${field} is a required money bag`);
  }
  const shopAmount = assertFrozenNumericColumn(bag.shopAmount, `${field}.shopAmount`);
  const presentmentAmount = assertFrozenNumericColumn(
    bag.presentmentAmount,
    `${field}.presentmentAmount`,
  );
  const shopCurrencyCode =
    typeof bag.shopCurrencyCode === "string" && bag.shopCurrencyCode.trim() !== ""
      ? bag.shopCurrencyCode.trim()
      : null;
  const presentmentCurrencyCode =
    typeof bag.presentmentCurrencyCode === "string" &&
    bag.presentmentCurrencyCode.trim() !== ""
      ? bag.presentmentCurrencyCode.trim()
      : null;
  if (!shopCurrencyCode || !presentmentCurrencyCode) {
    throw new OrderApplyMoneyError(`${field} is missing currency codes`);
  }
  if (shopCurrencyCode !== expectedShopCurrency) {
    throw new OrderApplyCurrencyMismatchError(field);
  }
  return {
    shopAmount,
    shopCurrencyCode,
    presentmentAmount,
    presentmentCurrencyCode,
  };
}

export function parseOptionalMoneyBag(
  bag: RequiredMoneyBagInput | null | undefined,
  field: string,
  expectedShopCurrency: string,
): OptionalMoneyBagSides | null {
  if (bag == null) return null;
  const parsed = parseRequiredMoneyBag(bag, field, expectedShopCurrency);
  return parsed;
}

export function rejectMixedShopCurrencySum(
  currencies: readonly string[],
  field = "shopMoney",
): void {
  const unique = new Set(currencies.filter((code) => code != null && code !== ""));
  if (unique.size > 1) {
    throw new OrderApplyMoneyError(
      `${field} must not sum mixed shop currencies`,
    );
  }
}
