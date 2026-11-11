/**
 * Merchant-facing wording for worksheets. Shared by the screens and the
 * export so the same run is described the same way everywhere.
 */
import type { LocalDate } from "../local-date";
import { div, mul, rational, sign, sub, toFixed, type Rational } from "../rational";
import type { StockStatus } from "../stock-health";
import type { MethodParameters, WarningCode } from "../types";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

/** "2026-11-09" as "Nov 9, 2026". The date is already in the shop's calendar. */
export function formatLocalDate(date: LocalDate): string {
  return DATE_FORMAT.format(new Date(`${date}T00:00:00Z`));
}

export function formatInstant(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(instant);
}

function days(count: number): string {
  return count === 1 ? "1 day" : `${count} days`;
}

export function describeMethod(params: MethodParameters): string {
  switch (params.method) {
    case "LAST_X_DAYS":
      return `Sales from the last ${days(params.sampleDays)}, to cover ${days(params.suggestDays)}`;
    case "CUSTOM_RANGE":
      return `Sales from ${formatLocalDate(params.startDate)} to ${formatLocalDate(params.endDate)}, to cover ${days(params.suggestDays)}`;
    case "SAME_PERIOD_LAST_YEAR":
      return `Sales from the same ${days(params.suggestDays)} last year`;
    case "FILL_SHELVES":
      return "Fill shelves to each variant's shelf limit";
    case "FILL_SHELVES_IF_BELOW_MIN":
      return "Fill shelves when stock is below the minimum";
    case "TARGET_STOCK_LEVEL":
      return `Bring every variant to ${params.targetQuantity.toLocaleString("en-US")} in stock`;
  }
}

export function describeSelection(
  selection: { vendor: string | null; productType: string | null },
  supplierName: string | null,
): string {
  const parts = [
    selection.vendor ? `Vendor: ${selection.vendor}` : null,
    selection.productType ? `Type: ${selection.productType}` : null,
    supplierName ? `Supplier: ${supplierName}` : null,
  ].filter((part): part is string => part != null);
  return parts.length > 0 ? parts.join(", ") : "All products";
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  OUT_OF_STOCK: "Out of stock",
  LOW: "Low",
  OK: "In stock",
  UNKNOWN: "Unknown",
};

/** Short labels for the row; the full sentence is in the row's detail. */
export const WARNING_LABELS: Record<WarningCode, string> = {
  NOT_TRACKED: "Not tracked",
  INVENTORY_UNKNOWN: "Stock unknown",
  INCOMING_UNKNOWN: "Incoming unknown",
  HISTORY_UNAVAILABLE: "No sales history",
  HISTORY_PARTIAL: "Partial sales history",
  SALES_EVIDENCE_UNTRUSTED: "Check sales",
  NEGATIVE_NET_SALES: "More returned than sold",
  NEGATIVE_AVAILABLE: "Oversold",
  SHELF_LIMIT_MISSING: "No shelf limit",
  MINIMUM_MISSING: "No minimum",
  MINIMUM_ABOVE_SHELF_LIMIT: "Minimum above shelf limit",
  PACK_SIZE_MISSING: "No pack size",
  MOQ_MISSING: "No minimum order",
  LEAD_TIME_MISSING: "No lead time",
};

function parseDecimal(text: string | null): Rational | null {
  const match = text == null ? null : /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return null;
  const [, minus, whole, fraction = ""] = match;
  const digits = BigInt(whole + fraction);
  return rational(minus ? -digits : digits, 10n ** BigInt(fraction.length));
}

/**
 * Margin (profit as a share of price) and markup (profit as a share of
 * cost), as percentages to one decimal. Null when the base is not positive,
 * where a percentage would mean nothing.
 */
export function marginAndMarkup(
  price: string | null,
  cost: string | null,
): { margin: string | null; markup: string | null } {
  const priceValue = parseDecimal(price);
  const costValue = parseDecimal(cost);
  if (!priceValue || !costValue) return { margin: null, markup: null };
  const profit = sub(priceValue, costValue);
  const percent = (base: Rational) =>
    sign(base) > 0 ? toFixed(mul(div(profit, base), rational(100)), 1) : null;
  return { margin: percent(priceValue), markup: percent(costValue) };
}
