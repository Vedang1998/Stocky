/**
 * Counting a delivery by scanning: matching a scanned or typed code to a
 * purchase-order line. Safe for client and server bundles.
 */

export type ScannableLine = {
  lineItemId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  /** Units a new receipt can accept without confirming an over-receipt. */
  openQty: number;
};

function sameCode(candidate: string | null, code: string): boolean {
  return candidate !== null && candidate.trim().toLowerCase() === code;
}

/**
 * The line a code belongs to: barcode first, then SKU, both compared without
 * regard to case or surrounding spaces. Null when the code is empty or no
 * line on the order carries it.
 */
export function findScannedLine<Line extends ScannableLine>(
  lines: readonly Line[],
  scanned: string,
): Line | null {
  const code = scanned.trim().toLowerCase();
  if (!code) return null;
  return (
    lines.find((line) => sameCode(line.barcode, code)) ??
    lines.find((line) => sameCode(line.sku, code)) ??
    null
  );
}

/** A count field's value as a whole number of units; anything else is zero. */
export function readCount(value: string | undefined): number {
  if (value === undefined || !/^\d{1,7}$/.test(value.trim())) return 0;
  return Number(value.trim());
}
