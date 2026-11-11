import type { ShopifyInventoryReason } from "../inventory-writes/types";

export const MAX_ADJUSTMENT_LINES = 250;
export const MAX_ADJUSTMENT_QUANTITY = 1_000_000;
export const MAX_ADJUSTMENT_NOTE_LENGTH = 500;
const MAX_CODE_LENGTH = 255;

/**
 * Reasons a merchant can give for an adjustment. Each one is a reason code
 * Shopify accepts for `available`, so it also appears in Shopify's own
 * inventory history.
 */
export const ADJUSTMENT_REASONS = [
  { code: "correction", label: "Correction" },
  { code: "cycle_count_available", label: "Recount" },
  { code: "damaged", label: "Damaged" },
  { code: "shrinkage", label: "Theft or loss" },
  { code: "received", label: "Received stock" },
  { code: "restock", label: "Returned to stock" },
  { code: "promotion", label: "Promotion or donation" },
  { code: "other", label: "Other" },
] as const satisfies ReadonlyArray<{
  code: ShopifyInventoryReason;
  label: string;
}>;

export type AdjustmentReasonCode = (typeof ADJUSTMENT_REASONS)[number]["code"];

export function isAdjustmentReason(
  value: unknown,
): value is AdjustmentReasonCode {
  return ADJUSTMENT_REASONS.some((reason) => reason.code === value);
}

export function adjustmentReasonLabel(code: string): string {
  return (
    ADJUSTMENT_REASONS.find((reason) => reason.code === code)?.label ?? code
  );
}

/**
 * ADJUST changes the quantity by a signed amount. SET moves it to a target,
 * guarded by the quantity Shopify held when the adjustment was prepared.
 */
export const ADJUSTMENT_MODES = ["ADJUST", "SET"] as const;
export type AdjustmentMode = (typeof ADJUSTMENT_MODES)[number];

export function isAdjustmentMode(value: unknown): value is AdjustmentMode {
  return ADJUSTMENT_MODES.includes(value as AdjustmentMode);
}

export interface ParsedAdjustmentLine {
  /** 1-based line of the pasted text, for error messages. */
  lineNumber: number;
  /** SKU, barcode or variant ID exactly as entered. */
  code: string;
  quantity: number;
}

export type ParsedAdjustmentLines =
  { ok: true; lines: ParsedAdjustmentLine[] } | { ok: false; errors: string[] };

const WHOLE_NUMBER = /^[+-]?\d{1,7}$/;

/**
 * Parse pasted adjustment lines, one per row: a SKU, barcode or variant ID,
 * then a quantity, separated by a tab, comma or semicolon (a two-column
 * spreadsheet selection pastes as tab-separated). The quantity is the last
 * field, so a code may itself contain commas.
 */
export function parseAdjustmentLines(
  text: string,
  mode: AdjustmentMode,
): ParsedAdjustmentLines {
  const errors: string[] = [];
  const lines: ParsedAdjustmentLine[] = [];
  const seen = new Map<string, number>();

  const rows = text.split(/\r\n|\r|\n/);
  rows.forEach((row, index) => {
    const lineNumber = index + 1;
    const trimmed = row.trim();
    if (trimmed === "") return;

    const separator = Math.max(
      trimmed.lastIndexOf("\t"),
      trimmed.lastIndexOf(","),
      trimmed.lastIndexOf(";"),
    );
    const code = separator === -1 ? "" : trimmed.slice(0, separator).trim();
    const rawQuantity =
      separator === -1 ? "" : trimmed.slice(separator + 1).trim();
    if (code === "" || rawQuantity === "") {
      errors.push(
        `Line ${lineNumber}: enter a SKU or barcode, a comma, then a quantity.`,
      );
      return;
    }
    if (code.length > MAX_CODE_LENGTH) {
      errors.push(`Line ${lineNumber}: the SKU or barcode is too long.`);
      return;
    }
    const quantity = WHOLE_NUMBER.test(rawQuantity) ? Number(rawQuantity) : NaN;
    if (
      !Number.isInteger(quantity) ||
      Math.abs(quantity) > MAX_ADJUSTMENT_QUANTITY
    ) {
      errors.push(
        `Line ${lineNumber}: "${rawQuantity}" is not a whole number of at most ${MAX_ADJUSTMENT_QUANTITY.toLocaleString("en-US")}.`,
      );
      return;
    }
    if (mode === "ADJUST" && quantity === 0) {
      errors.push(`Line ${lineNumber}: a change of 0 does nothing.`);
      return;
    }
    if (mode === "SET" && quantity < 0) {
      errors.push(`Line ${lineNumber}: a quantity cannot be set below 0.`);
      return;
    }
    const firstSeen = seen.get(code);
    if (firstSeen !== undefined) {
      errors.push(
        `Line ${lineNumber}: ${code} is already on line ${firstSeen}.`,
      );
      return;
    }
    seen.set(code, lineNumber);
    lines.push({ lineNumber, code, quantity });
  });

  if (errors.length === 0 && lines.length === 0) {
    errors.push("Enter at least one line.");
  }
  if (lines.length > MAX_ADJUSTMENT_LINES) {
    errors.push(
      `One adjustment can change at most ${MAX_ADJUSTMENT_LINES} items. Split the rest into another adjustment.`,
    );
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, lines };
}
