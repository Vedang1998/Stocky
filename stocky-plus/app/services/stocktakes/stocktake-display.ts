/**
 * Wording shared by the stocktake pages and the count report. No server-only
 * imports: the pages render it in the browser too.
 */

type StocktakeStatus = "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type StocktakeScope = "FULL" | "PARTIAL";
type StocktakeCountSource = "MANUAL" | "SCAN" | "ZERO_FILL";

export const STOCKTAKE_STATUS_BADGE: Record<
  StocktakeStatus,
  { label: string; tone: "info" | "success" | "neutral" }
> = {
  DRAFT: { label: "Not started", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const STOCKTAKE_SCOPE_LABEL: Record<StocktakeScope, string> = {
  FULL: "Full count",
  PARTIAL: "Partial count",
};

export const COUNT_SOURCE_LABEL: Record<StocktakeCountSource, string> = {
  MANUAL: "Typed",
  SCAN: "Scanned",
  ZERO_FILL: "Marked as zero",
};

/** `2026-11-11 21:40 UTC`; the same text on the server and in the browser. */
export function formatUtc(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** `+3`, `-2` or `0`. */
export function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function staffText(userId: string | null | undefined): string {
  return userId ? `staff ID ${userId}` : "staff not recorded";
}

export function itemCount(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "item" : "items"}`;
}
