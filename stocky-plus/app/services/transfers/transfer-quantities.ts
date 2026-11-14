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
