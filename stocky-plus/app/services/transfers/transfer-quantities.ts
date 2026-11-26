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
 * Units of a line that left the source, or that leave when its draft ships.
 *
 * A line that has shipped says so in `shippedQty`. A draft that ships in one
 * go sends what was picked, or all of the line when nothing was picked; a
 * draft that ships in parts sends exactly what was picked, which may be
 * nothing. A line shipped before shipments in parts existed has no
 * `shippedQty` and keeps its shipped units in `pickedQty`.
 */
export function transferShipQuantity(
  line: { quantity: number; pickedQty: number; shippedQty?: number | null },
  shipsInParts = false,
): number {
  if (line.shippedQty != null) return line.shippedQty;
  if (shipsInParts) return line.pickedQty;
  return line.pickedQty > 0 ? line.pickedQty : line.quantity;
}

export interface TransferLineQuantities {
  quantity: number;
  pickedQty: number;
  /** Units that left the source; null or absent on a line that has not shipped under shipments in parts. */
  shippedQty?: number | null;
  receivedQty: number;
  pendingReceiveQty: number;
  rejectedQty: number;
  returnedQty: number;
}

/**
 * Whether a transfer is open for more shipments.
 *
 * A transfer in transit is only when every line says what it shipped. Code
 * from before shipments in parts ships a draft whole, keeps the shipped units
 * in `pickedQty` and leaves `shipsInParts` as it found it. Read as shipping in
 * parts, those units would count as picked for a next shipment and leave the
 * source a second time; such a transfer is read as shipped in one go.
 */
export function transferShipsInParts(
  transfer: { status: string; shipsInParts: boolean },
  lines: ReadonlyArray<{ shippedQty?: number | null }>,
): boolean {
  return (
    transfer.shipsInParts &&
    !(
      transfer.status === "IN_TRANSIT" &&
      lines.some((line) => line.shippedQty == null)
    )
  );
}

/**
 * Units of a line that have not left the source yet, on a transfer that is
 * in transit and ships in parts. They ship later, or stay at the source when
 * the transfer is closed.
 */
export function transferUnshippedQuantity(
  line: Pick<TransferLineQuantities, "quantity" | "shippedQty">,
): number {
  return line.shippedQty == null
    ? 0
    : Math.max(0, line.quantity - line.shippedQty);
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
  /** Units that have not left the source yet and ship later; none unless the transfer is in transit and ships in parts. */
  toShipUnits: number;
  /** Units picked for the next shipment of a transfer that ships in parts; none once it is finished or cancelled. */
  nextShipmentUnits: number;
}

/** Where the units of a transfer stand, added up over its lines. */
export function transferTotals(
  status: string,
  lines: readonly TransferLineQuantities[],
  shipsInParts = false,
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
    toShipUnits: 0,
    nextShipmentUnits: 0,
  };
  const open = status === "DRAFT" || status === "IN_TRANSIT";
  for (const line of lines) {
    totals.requestedUnits += line.quantity;
    // A cancelled transfer never left the source.
    if (status !== "CANCELLED") {
      totals.shipUnits += transferShipQuantity(line, shipsInParts);
    }
    if (shipsInParts && open) {
      // On a draft these are the units of its first shipment, already in `shipUnits`.
      totals.nextShipmentUnits += line.pickedQty;
      if (status === "IN_TRANSIT") {
        totals.toShipUnits += transferUnshippedQuantity(line);
      }
    }
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

/** What the inventory ledger shows for a transfer, from the changes Shopify confirmed. */
export interface TransferLedgerStanding {
  /** Requests that moved, or tried to move, stock at the source. */
  shipmentRequests: number;
  /** Net units out of stock at the source. */
  unitsOutOfSource: number;
  /** Net units added to stock at the destination. */
  unitsIntoDestination: number;
  /** Shopify has not finished answering a request at the source. */
  shipmentUnfinished: boolean;
  /** The unfinished request at the source puts stock back: a close that returns units. */
  returnUnfinished?: boolean;
  /** Shopify has not finished answering a request at the destination. */
  receiptUnfinished: boolean;
}

/**
 * A step that was started and did not finish, which the staff member has to
 * finish before the transfer can move on.
 *
 * - `SHIPMENT_UNFINISHED`: a draft whose stock has partly left the source.
 * - `PUT_BACK_UNFINISHED`: a cancelled transfer whose stock is not all back.
 * - `NO_SHIPMENT_RECORD`: in transit, with nothing in the ledger to show its
 *   stock leaving the source.
 * - `RETURN_UNFINISHED`: in transit, with part of its missing units already
 *   back at the source.
 * - `NEXT_SHIPMENT_UNFINISHED`: in transit, with more stock out of the source
 *   than the transfer shows as shipped: a later shipment did not finish.
 * - `RECEIPT_UNFINISHED`: in transit, with the destination's stock out of
 *   line with the units the transfer shows as received.
 */
export type TransferAttention =
  | "SHIPMENT_UNFINISHED"
  | "PUT_BACK_UNFINISHED"
  | "NO_SHIPMENT_RECORD"
  | "RETURN_UNFINISHED"
  | "NEXT_SHIPMENT_UNFINISHED"
  | "RECEIPT_UNFINISHED";

/** Compare where a transfer says its units are with what the ledger shows. */
export function transferAttention(
  status: string,
  totals: Pick<TransferTotals, "shipUnits" | "receivedUnits">,
  ledger: TransferLedgerStanding,
  shipsInParts = false,
): TransferAttention | null {
  const stockOut = ledger.shipmentUnfinished || ledger.unitsOutOfSource !== 0;
  switch (status) {
    case "DRAFT":
      return stockOut ? "SHIPMENT_UNFINISHED" : null;
    case "CANCELLED":
      return stockOut ? "PUT_BACK_UNFINISHED" : null;
    case "IN_TRANSIT":
      if (ledger.shipmentRequests === 0) return "NO_SHIPMENT_RECORD";
      // On a transfer that ships in parts, more out of the source than its
      // lines show as shipped is a later shipment that stopped part-way, and
      // so is a request Shopify is still answering, unless that request is a
      // close putting units back.
      if (
        shipsInParts &&
        (ledger.unitsOutOfSource > totals.shipUnits ||
          (ledger.shipmentUnfinished &&
            !ledger.returnUnfinished &&
            ledger.unitsOutOfSource === totals.shipUnits))
      ) {
        return "NEXT_SHIPMENT_UNFINISHED";
      }
      if (
        ledger.shipmentUnfinished ||
        ledger.unitsOutOfSource !== totals.shipUnits
      ) {
        return "RETURN_UNFINISHED";
      }
      return ledger.receiptUnfinished ||
        ledger.unitsIntoDestination !== totals.receivedUnits
        ? "RECEIPT_UNFINISHED"
        : null;
    default:
      return null;
  }
}
