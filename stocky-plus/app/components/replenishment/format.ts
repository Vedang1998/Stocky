import {
  formatDecimal,
  formatMoney,
  MISSING_VALUE,
} from "../../lib/decimal-format";

/** Shared by the worksheet table and the line detail, so both show a value the same way. */

export function quantity(value: number | null): string {
  return value == null ? MISSING_VALUE : value.toLocaleString("en-US");
}

/** An amount in the given currency; a plain number when the currency is unknown. */
export function money(
  amount: string | null,
  currencyCode: string | null,
  digits?: number,
): string {
  if (amount == null) return MISSING_VALUE;
  if (!currencyCode) return formatDecimal(amount);
  return formatMoney(amount, currencyCode, { maximumFractionDigits: digits });
}

export function percent(value: string | null): string {
  return value == null ? MISSING_VALUE : `${formatDecimal(value)}%`;
}
