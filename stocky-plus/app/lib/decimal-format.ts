/**
 * Display formatting for decimal strings produced by `serializeDecimals`
 * (app/lib/decimal-wire.server.ts). Safe for client and server bundles.
 *
 * Intl.NumberFormat formats a numeric string as an exact decimal, so "1.005"
 * rounds to 1.01 where `Number("1.005").toFixed(2)` gives 1.00. The locale is
 * fixed by default so server and browser render identical text.
 */

const DECIMAL_STRING = /^-?\d+(\.\d+)?$/;
const DEFAULT_LOCALE = "en-US";

/** Shown in place of a value that is not set. */
export const MISSING_VALUE = "—";

export type DecimalFormatOptions = {
  locale?: string;
  /** Upper bound on displayed decimals; trailing zeros beyond the minimum are dropped. */
  maximumFractionDigits?: number;
};

// The ES2022 lib types limit format() to number | bigint. The runtime accepts
// numeric strings and, unlike a number, formats them without binary rounding.
type DecimalStringFormatter = { format(value: string): string };

function decimalFormatter(
  locale: string,
  options: Intl.NumberFormatOptions,
): DecimalStringFormatter {
  return new Intl.NumberFormat(locale, options) as unknown as DecimalStringFormatter;
}

function assertDecimalString(value: string): void {
  if (!DECIMAL_STRING.test(value)) {
    throw new TypeError(
      `Expected a plain decimal string such as "12.50", received ${JSON.stringify(value)}`,
    );
  }
}

/**
 * Money in the given ISO 4217 currency, rounded half away from zero to the
 * currency's own decimals unless `maximumFractionDigits` allows more (unit
 * costs carry four). A currency code Intl does not accept is shown as text
 * after the amount instead of failing the page.
 */
export function formatMoney(
  amount: string | null | undefined,
  currencyCode: string,
  options: DecimalFormatOptions = {},
): string {
  if (amount === null || amount === undefined) return MISSING_VALUE;
  assertDecimalString(amount);
  const locale = options.locale ?? DEFAULT_LOCALE;
  try {
    return decimalFormatter(locale, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: options.maximumFractionDigits,
    }).format(amount);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    const plain = decimalFormatter(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: Math.max(2, options.maximumFractionDigits ?? 2),
    }).format(amount);
    return `${plain} ${currencyCode}`.trim();
  }
}

/** Plain number such as a quantity or rate: "2.0000" becomes "2". */
export function formatDecimal(
  value: string | null | undefined,
  options: DecimalFormatOptions = {},
): string {
  if (value === null || value === undefined) return MISSING_VALUE;
  assertDecimalString(value);
  return decimalFormatter(options.locale ?? DEFAULT_LOCALE, {
    maximumFractionDigits: options.maximumFractionDigits ?? 6,
  }).format(value);
}
