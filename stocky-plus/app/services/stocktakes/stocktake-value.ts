/**
 * The value of a count's differences: what the units over and short are worth
 * at Shopify's unit cost. Types and wording only, for the server and the
 * browser; the arithmetic is in stocktake-value.server.ts.
 */
import { formatMoney } from "../../lib/decimal-format";

/** Which unit cost the differences are valued at. */
export type DifferenceValueBasis =
  /** Shopify's unit cost as last synced; the count is still open. */
  | "CURRENT"
  /** The unit cost kept when the count was completed. */
  | "COMPLETION";

export interface DifferenceValue {
  basis: DifferenceValueBasis;
  /**
   * Units counted over, less units counted short, each at its unit cost: a
   * plain decimal for each currency (a shop's costs have one). Empty when no
   * item with a difference has a cost.
   */
  totals: Array<{ currencyCode: string; amount: string }>;
  /** Items with a difference that have a unit cost. */
  costedCount: number;
  /** Items with a difference and no unit cost; they are not in the totals. */
  uncostedCount: number;
}

/** `+$12.00`, `-$214.50` or `$0.00`. */
export function signedMoney(amount: string, currencyCode: string): string {
  const text = formatMoney(amount, currencyCode);
  return amount.startsWith("-") || /^0(\.0+)?$/.test(amount)
    ? text
    : `+${text}`;
}

/** The totals as one phrase, or null when no difference has a cost. */
export function differenceValueAmount(value: DifferenceValue): string | null {
  if (value.totals.length === 0) return null;
  return value.totals
    .map((total) => signedMoney(total.amount, total.currencyCode))
    .join(" and ");
}

const items = (count: number) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? "item" : "items"}`;

/**
 * What the figure is measured at and what it leaves out, as sentences. Null
 * when the count has no differences, so there is no figure to explain.
 */
export function differenceValueNote(value: DifferenceValue): string | null {
  if (value.costedCount + value.uncostedCount === 0) return null;
  const completed = value.basis === "COMPLETION";
  const one = value.uncostedCount === 1;
  const without = completed
    ? `${items(value.uncostedCount)} with a difference had no unit cost when the count was completed`
    : `${items(value.uncostedCount)} with a difference ${one ? "has" : "have"} no unit cost in Shopify`;
  if (value.costedCount === 0) return `${without}.`;
  const at = completed
    ? "At Shopify's unit cost when the count was completed."
    : "At Shopify's unit cost as last synced.";
  return value.uncostedCount === 0
    ? at
    : `${at} ${without} and ${one ? "is" : "are"} not in this figure.`;
}

/**
 * The line the count page and the count record carry: "Value of differences:
 * -$214.50. At Shopify's unit cost as last synced." Null when the count has
 * no differences.
 */
export function differenceValueLine(value: DifferenceValue): string | null {
  const note = differenceValueNote(value);
  if (note === null) return null;
  return `Value of differences: ${differenceValueAmount(value) ?? "not known"}. ${note}`;
}
