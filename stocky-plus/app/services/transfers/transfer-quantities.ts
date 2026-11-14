/**
 * Limits and quantity rules of a transfer. No server-only imports: the pages
 * use them in the browser too.
 */

export const MAX_TRANSFER_LINE_QUANTITY = 1_000_000;
export const MAX_TRANSFER_LINES = 1_000;
export const MAX_TRANSFER_NOTES_LENGTH = 500;
export const MAX_REJECT_NOTE_LENGTH = 200;
/** Items one pasted list may add to a draft. */
export const MAX_ADDED_TRANSFER_ITEMS = 250;
/** Far above 250 lines of the longest codes; anything larger is not a list of items. */
export const MAX_TRANSFER_ITEM_TEXT_LENGTH = 50_000;

/**
 * Units of a line that leave the source: what was picked, or all of it when
 * nothing was picked. Shipping freezes this number in `pickedQty`.
 */
export function transferShipQuantity(line: {
  quantity: number;
  pickedQty: number;
}): number {
  return line.pickedQty > 0 ? line.pickedQty : line.quantity;
}

export interface TransferLineQuantities {
  quantity: number;
  pickedQty: number;
  receivedQty: number;
  pendingReceiveQty: number;
  rejectedQty: number;
  returnedQty: number;
}

/**
 * Shipped units of a line that are not accounted for yet: not in stock at the
 * destination, not counted in for the next receipt, not rejected and not
 * returned to the source.
 */
export function transferOutstandingQuantity(
  line: TransferLineQuantities,
): number {
  return (
    transferShipQuantity(line) -
    line.receivedQty -
    line.pendingReceiveQty -
    line.rejectedQty -
    line.returnedQty
  );
}

/**
 * Shipped units of a line that never arrived and were written off: what is
 * still unaccounted for once the transfer is finished.
 */
export function transferWrittenOffQuantity(
  status: string,
  line: TransferLineQuantities,
): number {
  return status === "RECEIVED"
    ? Math.max(0, transferOutstandingQuantity(line))
    : 0;
}

export interface TransferTotals {
  lineCount: number;
  /** Units the transfer asks for. */
  requestedUnits: number;
  /** Units that left the source, or will when a draft ships; none for a cancelled transfer. */
  shipUnits: number;
  /** Units in stock at the destination. */
  receivedUnits: number;
  /** Units counted in at the destination and not posted yet. */
  countedInUnits: number;
  rejectedUnits: number;
  /** Units put back into stock at the source when the transfer was closed short. */
  returnedUnits: number;
  /** Units that never arrived and were written off. */
  writtenOffUnits: number;
  /** Shipped units nobody has accounted for yet, while the transfer is in transit. */
  outstandingUnits: number;
}

/** Where the units of a transfer stand, added up over its lines. */
export function transferTotals(
  status: string,
  lines: readonly TransferLineQuantities[],
): TransferTotals {
  const totals: TransferTotals = {
    lineCount: lines.length,
    requestedUnits: 0,
    shipUnits: 0,
    receivedUnits: 0,
    countedInUnits: 0,
    rejectedUnits: 0,
    returnedUnits: 0,
    writtenOffUnits: 0,
    outstandingUnits: 0,
  };
  for (const line of lines) {
    totals.requestedUnits += line.quantity;
    // A cancelled transfer never left the source.
    if (status !== "CANCELLED") totals.shipUnits += transferShipQuantity(line);
    totals.receivedUnits += line.receivedQty;
    totals.countedInUnits += line.pendingReceiveQty;
    totals.rejectedUnits += line.rejectedQty;
    totals.returnedUnits += line.returnedQty;
    totals.writtenOffUnits += transferWrittenOffQuantity(status, line);
    if (status === "IN_TRANSIT") {
      totals.outstandingUnits += Math.max(0, transferOutstandingQuantity(line));
    }
  }
  return totals;
}
