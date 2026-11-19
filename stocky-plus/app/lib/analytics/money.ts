/**
 * Decimal-safe money arithmetic for derived reports.
 *
 * Amounts stay `Prisma.Decimal` (decimal.js) from the database through every
 * sum and product; JavaScript numbers are never used for money. Values leave
 * this layer as plain decimal strings so loaders and CSV exports can serialize
 * them without precision loss.
 */
import { Prisma } from "@prisma/client";

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

export const ZERO = new Decimal(0);

export type DecimalLike = Prisma.Decimal | string | number;

export function toDecimal(value: DecimalLike): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export function toDecimalOrNull(
  value: DecimalLike | null | undefined,
): Decimal | null {
  if (value === null || value === undefined) return null;
  return toDecimal(value);
}

export function sumDecimals(values: Iterable<DecimalLike>): Decimal {
  let total = ZERO;
  for (const value of values) total = total.plus(toDecimal(value));
  return total;
}

const fractionDigitsCache = new Map<string, number>();

/**
 * ISO 4217 minor units for `currencyCode` (JPY 0, USD 2, KWD 3), from the
 * runtime's currency data. Unknown codes fall back to 2.
 */
export function currencyFractionDigits(currencyCode: string): number {
  const code = currencyCode.toUpperCase();
  const cached = fractionDigitsCache.get(code);
  if (cached !== undefined) return cached;
  let digits = 2;
  try {
    digits =
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
      }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    digits = 2;
  }
  fractionDigitsCache.set(code, digits);
  return digits;
}

/** Round half away from zero to the currency's minor unit; plain string. */
export function formatMoneyAmount(
  value: DecimalLike,
  currencyCode: string,
): string {
  return toDecimal(value)
    .toDecimalPlaces(currencyFractionDigits(currencyCode), Decimal.ROUND_HALF_UP)
    .toFixed(currencyFractionDigits(currencyCode));
}

/** Human-readable amount with currency symbol, for UI only. */
export function displayMoney(
  value: DecimalLike,
  currencyCode: string,
  locale = "en-US",
): string {
  const amount = formatMoneyAmount(value, currencyCode);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: currencyFractionDigits(currencyCode),
      maximumFractionDigits: currencyFractionDigits(currencyCode),
    }).format(
      // Intl.NumberFormat formats decimal strings exactly (ES2023); the ES2022
      // lib typings only declare number | bigint.
      amount as unknown as number,
    );
  } catch {
    return `${amount} ${currencyCode}`;
  }
}

/**
 * `part / whole` as a percentage string with `places` decimals, or null when
 * `whole` is zero.
 */
export function percentOf(
  part: DecimalLike,
  whole: DecimalLike,
  places = 2,
): string | null {
  const denominator = toDecimal(whole);
  if (denominator.isZero()) return null;
  return toDecimal(part)
    .times(100)
    .dividedBy(denominator)
    .toDecimalPlaces(places, Decimal.ROUND_HALF_UP)
    .toFixed(places);
}
