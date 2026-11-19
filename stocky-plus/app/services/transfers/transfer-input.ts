import {
  MAX_ADDED_TRANSFER_ITEMS,
  MAX_TRANSFER_ITEM_TEXT_LENGTH,
  MAX_TRANSFER_LINE_QUANTITY,
} from "./transfer-quantities";

const MAX_CODE_LENGTH = 255;
const WHOLE_NUMBER = /^\d{1,7}$/;

export interface ParsedTransferItem {
  /** 1-based line of the pasted text where the code first appears. */
  lineNumber: number;
  /** SKU, barcode or variant ID exactly as entered. */
  code: string;
  quantity: number;
}

export type ParsedTransferItems =
  { ok: true; items: ParsedTransferItem[] } | { ok: false; errors: string[] };

/**
 * Parse a pasted list of items for a transfer, one per row: a SKU, barcode or
 * variant ID, optionally followed by a quantity after a tab, comma or
 * semicolon (a two-column spreadsheet selection pastes as tab-separated). A
 * row without a quantity is one unit, and a code listed more than once has
 * its units added up, so a column of scanned barcodes can be pasted as it is.
 */
export function parseTransferItems(text: string): ParsedTransferItems {
  if (text.length > MAX_TRANSFER_ITEM_TEXT_LENGTH) {
    return {
      ok: false,
      errors: [
        `That is too much text for one list. Add at most ${MAX_ADDED_TRANSFER_ITEMS} items at a time.`,
      ],
    };
  }

  const errors: string[] = [];
  const byCode = new Map<string, ParsedTransferItem>();

  text.split(/\r\n|\r|\n/).forEach((row, index) => {
    const lineNumber = index + 1;
    const trimmed = row.trim();
    if (trimmed === "") return;

    // The quantity is the last field, and only when it is a number: a code
    // may itself contain a comma.
    const separator = Math.max(
      trimmed.lastIndexOf("\t"),
      trimmed.lastIndexOf(","),
      trimmed.lastIndexOf(";"),
    );
    const lastField =
      separator === -1 ? "" : trimmed.slice(separator + 1).trim();
    const hasQuantity = /^[+-]?\d+$/.test(lastField);
    const code = hasQuantity ? trimmed.slice(0, separator).trim() : trimmed;
    if (code === "") {
      errors.push(`Line ${lineNumber}: enter a SKU or barcode.`);
      return;
    }
    if (code.length > MAX_CODE_LENGTH) {
      errors.push(`Line ${lineNumber}: the SKU or barcode is too long.`);
      return;
    }
    const quantity = !hasQuantity
      ? 1
      : WHOLE_NUMBER.test(lastField)
        ? Number(lastField)
        : NaN;
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_TRANSFER_LINE_QUANTITY
    ) {
      errors.push(
        `Line ${lineNumber}: "${lastField}" is not a whole number from 1 to ${MAX_TRANSFER_LINE_QUANTITY.toLocaleString("en-US")}.`,
      );
      return;
    }

    const existing = byCode.get(code);
    if (existing) existing.quantity += quantity;
    else byCode.set(code, { lineNumber, code, quantity });
  });

  for (const item of byCode.values()) {
    if (item.quantity > MAX_TRANSFER_LINE_QUANTITY) {
      errors.push(
        `Line ${item.lineNumber}: ${item.code} adds up to more than ${MAX_TRANSFER_LINE_QUANTITY.toLocaleString("en-US")} units.`,
      );
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  if (byCode.size === 0) {
    return { ok: false, errors: ["Enter at least one SKU or barcode."] };
  }
  if (byCode.size > MAX_ADDED_TRANSFER_ITEMS) {
    return {
      ok: false,
      errors: [
        `Add at most ${MAX_ADDED_TRANSFER_ITEMS} items at a time. This list has ${byCode.size.toLocaleString("en-US")}.`,
      ],
    };
  }
  return { ok: true, items: [...byCode.values()] };
}
