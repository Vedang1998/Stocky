import type { TenantDb } from "../../tenant/tenant-db.server";
import type { AdminGraphQLClient } from "../shopify-gql.server";
import type { ExecuteInventoryOperationOptions } from "../inventory-writes/execute.server";
import {
  describeLineProblems,
  describeUnsettled,
  readDocumentLedgerState,
} from "../inventory-writes/settle.server";
import type { InventoryActor } from "../inventory-writes/types";
import {
  ambiguousCodeMessage,
  findVariantsByCode,
  variantsMatchingCode,
} from "../inventory-writes/variant-items.server";
import {
  buildReceiptDocument,
  buildShipmentDocument,
  fail,
  isSettled,
  isSwitchedOn,
  LINE_NOT_FOUND_MESSAGE,
  loadTransfer,
  lockTransferIn,
  NOT_IN_TRANSIT_MESSAGE,
  settleTransferDocument,
  SHOPIFY_MANAGED_MESSAGE,
  SWITCHED_OFF_MESSAGE,
  TRANSFER_NOT_FOUND_MESSAGE,
  type TransferActionResult,
  type TransferLine,
  type TransferMovementFailure,
  type TransferShortResolution,
  type TransferWithLines,
} from "./transfer-core.server";
import {
  MAX_REJECT_NOTE_LENGTH,
  MAX_TRANSFER_LINE_QUANTITY,
  transferOutstandingQuantity,
} from "./transfer-quantities";

/**
 * Receiving a transfer at its destination.
 *
 * Units are first counted in, by scanning or typing, which changes nothing in
 * Shopify. Posting the receipt adds the counted-in units to stock at the
 * destination; a transfer can be received in as many receipts as it takes.
 * Units that arrived unfit for sale are recorded as rejected and never enter
 * stock. When shipped units are still missing, the transfer is closed short:
 * the missing units go back into stock at the source, or are written off.
 */

const MAX_CODE_LENGTH = 255;
const NO_SHIPMENT_RECORD_MESSAGE =
  "ProPo has no complete record of this transfer leaving the source location, so it will not add stock at the destination.";
const RETURN_UNFINISHED_MESSAGE =
  "Closing this transfer was started and part of its stock is already back at the source, so nothing more can be received. Close the transfer again to finish.";

const unitsText = (units: number) =>
  `${units.toLocaleString("en-US")} ${units === 1 ? "unit" : "units"}`;

const isWholeNumber = (value: unknown, min: number): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= min &&
  value <= MAX_TRANSFER_LINE_QUANTITY;

const countedIn = (lines: readonly TransferLine[]) =>
  lines.reduce((sum, line) => sum + line.pendingReceiveQty, 0);

const missingUnits = (lines: readonly TransferLine[]) =>
  lines.reduce(
    (sum, line) => sum + Math.max(0, transferOutstandingQuantity(line)),
    0,
  );

const LINE_QUANTITIES_SELECT = {
  id: true,
  transferOrderId: true,
  shopifyVariantId: true,
  quantity: true,
  pickedQty: true,
  receivedQty: true,
  pendingReceiveQty: true,
  rejectedQty: true,
  rejectNote: true,
  returnedQty: true,
} as const;

type LockedLine = TransferLine & { transferOrderId: string };

/** Why a transfer cannot take receipts, or null when it can. */
function notReceivable(transfer: {
  status: string;
  shopifyTransferId: string | null;
}): string | null {
  if (transfer.status !== "IN_TRANSIT") return NOT_IN_TRANSIT_MESSAGE;
  return transfer.shopifyTransferId ? SHOPIFY_MANAGED_MESSAGE : null;
}

/** A line of a transfer that is in transit, read under the transfer's lock. */
async function lockInTransitLine(
  tx: TenantDb,
  input: { lineId: string; transferId?: string },
): Promise<{ ok: true; line: LockedLine } | { ok: false; error: string }> {
  const found = (await tx.transferLineItem.findFirst({
    where: {
      id: input.lineId,
      ...(input.transferId ? { transferOrderId: input.transferId } : {}),
    },
    select: { id: true, transferOrderId: true },
  })) as { id: string; transferOrderId: string } | null;
  if (!found) return { ok: false, error: LINE_NOT_FOUND_MESSAGE };

  const transfer = (await tx.transferOrder.findFirst({
    where: { id: found.transferOrderId },
    select: { status: true, shopifyTransferId: true },
  })) as { status: string; shopifyTransferId: string | null } | null;
  if (!transfer) return { ok: false, error: TRANSFER_NOT_FOUND_MESSAGE };
  const refused = notReceivable(transfer);
  if (refused) return { ok: false, error: refused };
  if (!(await lockTransferIn(tx, found.transferOrderId, "IN_TRANSIT"))) {
    return { ok: false, error: NOT_IN_TRANSIT_MESSAGE };
  }
  const line = (await tx.transferLineItem.findFirst({
    where: { id: found.id },
    select: LINE_QUANTITIES_SELECT,
  })) as LockedLine | null;
  return line
    ? { ok: true, line }
    : { ok: false, error: LINE_NOT_FOUND_MESSAGE };
}

export type TransferScanResult =
  | {
      ok: true;
      title: string;
      /** Units of the item counted in for the next receipt, this scan included. */
      countedIn: number;
      /** Shipped units of the item still not accounted for after this scan. */
      outstanding: number;
    }
  | { ok: false; error: string };

/**
 * Count units in at the destination by barcode, SKU or variant ID: each scan
 * adds `quantity` to the item's units for the next receipt. Nothing changes
 * in Shopify until the receipt is posted. A scan is refused when the item is
 * not on the transfer or more units are scanned than were shipped.
 */
export async function recordTransferReceiptScan(
  db: TenantDb,
  input: { transferId: string; code: unknown; quantity?: number },
): Promise<TransferScanResult> {
  const refuse = (error: string) => ({ ok: false as const, error });
  const code = typeof input.code === "string" ? input.code.trim() : "";
  if (code.length === 0 || code.length > MAX_CODE_LENGTH) {
    return refuse("Scan or type a barcode or SKU.");
  }
  const quantity = input.quantity ?? 1;
  if (!isWholeNumber(quantity, 1)) {
    return refuse(
      `Enter the scanned quantity as a whole number from 1 to ${MAX_TRANSFER_LINE_QUANTITY.toLocaleString("en-US")}.`,
    );
  }

  const transfer = await loadTransfer(db, input.transferId);
  if (!transfer) return refuse(TRANSFER_NOT_FOUND_MESSAGE);
  const refused = notReceivable(transfer);
  if (refused) return refuse(refused);

  const matches = variantsMatchingCode(
    await findVariantsByCode(db, [code]),
    code,
  );
  if (matches.length === 0) {
    return refuse(
      `No item in this shop's catalog has the barcode or SKU ${code}.`,
    );
  }
  // Two catalog items may share a barcode; the one on this transfer is meant.
  const onTransfer = new Set(
    transfer.lineItems.map((line) => line.shopifyVariantId),
  );
  const shipped = matches.filter((v) => onTransfer.has(v.shopifyVariantId));
  if (shipped.length === 0) {
    return refuse(
      matches.length === 1
        ? `${matches[0].title} is not on this transfer.`
        : ambiguousCodeMessage(code, matches),
    );
  }
  if (shipped.length > 1) return refuse(ambiguousCodeMessage(code, shipped));
  const [variant] = shipped;

  return db.$transaction(async (tx: TenantDb) => {
    if (!(await lockTransferIn(tx, transfer.id, "IN_TRANSIT"))) {
      return refuse(NOT_IN_TRANSIT_MESSAGE);
    }
    const lines = (await tx.transferLineItem.findMany({
      where: {
        transferOrderId: transfer.id,
        shopifyVariantId: variant.shopifyVariantId,
      },
      select: LINE_QUANTITIES_SELECT,
      orderBy: { id: "asc" },
    })) as LockedLine[];
    const open = missingUnits(lines);
    if (quantity > open) {
      return refuse(
        open === 0
          ? `Every unit of ${variant.title} shipped on this transfer is already accounted for.`
          : `Only ${unitsText(open)} of ${variant.title} ${open === 1 ? "is" : "are"} still to be received on this transfer.`,
      );
    }
    // A variant has one line; if older data has two, they fill in order.
    let left = quantity;
    for (const line of lines) {
      const take = Math.min(
        left,
        Math.max(0, transferOutstandingQuantity(line)),
      );
      if (take === 0) continue;
      await tx.transferLineItem.update({
        where: { id: line.id },
        data: { pendingReceiveQty: line.pendingReceiveQty + take },
      });
      left -= take;
    }
    return {
      ok: true as const,
      title: variant.title,
      countedIn: countedIn(lines) + quantity,
      outstanding: open - quantity,
    };
  });
}

/**
 * Set how many units of a line are counted in for the next receipt. They may
 * not exceed what was shipped less what is already received, rejected or
 * returned.
 */
export async function setTransferReceiveQuantity(
  db: TenantDb,
  input: { lineId: string; quantity: number; transferId?: string },
): Promise<TransferActionResult> {
  if (!isWholeNumber(input.quantity, 0)) {
    return {
      ok: false,
      error: "Enter the units that arrived as a whole number of 0 or more.",
    };
  }
  return db.$transaction(async (tx: TenantDb) => {
    const locked = await lockInTransitLine(tx, input);
    if (!locked.ok) return locked;
    const { line } = locked;
    const most = transferOutstandingQuantity(line) + line.pendingReceiveQty;
    if (input.quantity > most) {
      return {
        ok: false as const,
        error:
          most <= 0
            ? "Every unit shipped on this line is already received, rejected or returned."
            : `Only ${unitsText(most)} of this item ${most === 1 ? "is" : "are"} still to be received.`,
      };
    }
    await tx.transferLineItem.update({
      where: { id: line.id },
      data: { pendingReceiveQty: input.quantity },
    });
    return { ok: true as const };
  });
}

/**
 * Record how many units of a line arrived and were not put into stock, with a
 * short note of why. Rejected units stay out of stock at both locations; no
 * change is sent to Shopify for them.
 */
export async function setTransferRejectedQuantity(
  db: TenantDb,
  input: {
    lineId: string;
    rejectedQty: number;
    note: string | null;
    transferId?: string;
  },
): Promise<TransferActionResult> {
  if (!isWholeNumber(input.rejectedQty, 0)) {
    return {
      ok: false,
      error: "Enter the rejected units as a whole number of 0 or more.",
    };
  }
  const note = input.note?.trim() ?? "";
  if (note.length > MAX_REJECT_NOTE_LENGTH) {
    return {
      ok: false,
      error: `The reason can be at most ${MAX_REJECT_NOTE_LENGTH} characters.`,
    };
  }
  return db.$transaction(async (tx: TenantDb) => {
    const locked = await lockInTransitLine(tx, input);
    if (!locked.ok) return locked;
    const { line } = locked;
    const most = transferOutstandingQuantity(line) + line.rejectedQty;
    if (input.rejectedQty > most) {
      return {
        ok: false as const,
        error:
          most <= 0
            ? "Every unit shipped on this line is already received, counted in or returned."
            : `At most ${unitsText(most)} of this item can be rejected: the rest is already received or counted in.`,
      };
    }
    await tx.transferLineItem.update({
      where: { id: line.id },
      data: {
        rejectedQty: input.rejectedQty,
        rejectNote: input.rejectedQty > 0 && note ? note : null,
      },
    });
    return { ok: true as const };
  });
}

/**
 * Count in every shipped unit nobody has accounted for yet, ready to be
 * checked and posted. Returns how many units that added.
 */
export async function countInOutstandingUnits(
  db: TenantDb,
  input: { transferId: string },
): Promise<{ ok: true; units: number } | { ok: false; error: string }> {
  const transfer = (await db.transferOrder.findFirst({
    where: { id: input.transferId },
    select: { id: true, status: true, shopifyTransferId: true },
  })) as {
    id: string;
    status: string;
    shopifyTransferId: string | null;
  } | null;
  if (!transfer) return { ok: false, error: TRANSFER_NOT_FOUND_MESSAGE };
  const refused = notReceivable(transfer);
  if (refused) return { ok: false, error: refused };

  return db.$transaction(async (tx: TenantDb) => {
    if (!(await lockTransferIn(tx, transfer.id, "IN_TRANSIT"))) {
      return { ok: false as const, error: NOT_IN_TRANSIT_MESSAGE };
    }
    return {
      ok: true as const,
      units: await countInOutstanding(tx, transfer.id),
    };
  });
}

/** Under the transfer's lock: move every unaccounted unit into the next receipt. */
async function countInOutstanding(
  tx: TenantDb,
  transferId: string,
): Promise<number> {
  const lines = (await tx.transferLineItem.findMany({
    where: { transferOrderId: transferId },
    select: LINE_QUANTITIES_SELECT,
    orderBy: { id: "asc" },
  })) as LockedLine[];
  let units = 0;
  for (const line of lines) {
    const open = transferOutstandingQuantity(line);
    if (open <= 0) continue;
    await tx.transferLineItem.update({
      where: { id: line.id },
      data: { pendingReceiveQty: line.pendingReceiveQty + open },
    });
    units += open;
  }
  return units;
}

export type PostReceiptResult =
  | {
      ok: true;
      /** The transfer was already fully received before this request. */
      alreadyDone: boolean;
      /** Units this receipt added to stock at the destination. */
      receivedUnits: number;
      /** Every shipped unit is now received or rejected; the transfer is finished. */
      completed: boolean;
    }
  | TransferMovementFailure;

export interface ReceiveTransferOptions extends ExecuteInventoryOperationOptions {
  now?: () => Date;
}

/**
 * Whether stock may be added at the destination for a transfer in transit:
 * ProPo's own ledger must show the shipped units out of the source, in full.
 */
async function shipmentProblem(
  db: TenantDb,
  transfer: TransferWithLines,
): Promise<string | null> {
  const shipment = await buildShipmentDocument(db, transfer);
  if (!shipment.ok) return shipment.error;
  const state = await readDocumentLedgerState(db, shipment.document);
  if (!state.unfinishedOperationId && state.outstanding.length === 0) {
    return null;
  }
  // The shipment was whole when the transfer went in transit; only an
  // unfinished close can have put part of it back since.
  return state.operationCount === 0
    ? NO_SHIPMENT_RECORD_MESSAGE
    : RETURN_UNFINISHED_MESSAGE;
}

/**
 * Post the units counted in so far: add them to stock at the destination.
 *
 * The lines move on only when the ledger shows every change applied. Posting
 * again, twice at once, or after a partial failure sends only what Shopify
 * has not confirmed yet. The transfer is finished when every shipped unit is
 * received or rejected.
 */
export async function postTransferReceipt(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  actor: InventoryActor,
  transferId: string,
  options: ReceiveTransferOptions = {},
): Promise<PostReceiptResult> {
  const transfer = await loadTransfer(db, transferId);
  if (!transfer) return fail(TRANSFER_NOT_FOUND_MESSAGE);
  if (transfer.status === "RECEIVED") {
    return { ok: true, alreadyDone: true, receivedUnits: 0, completed: true };
  }
  const refused = notReceivable(transfer);
  if (refused) return fail(refused);
  if (!isSwitchedOn(options)) return fail(SWITCHED_OFF_MESSAGE);
  const unshipped = await shipmentProblem(db, transfer);
  if (unshipped) return fail(unshipped);

  const built = await buildReceiptDocument(db, transfer);
  if (!built.ok) return fail(built.error);
  if (
    countedIn(transfer.lineItems) === 0 &&
    (await isSettled(db, built.document))
  ) {
    return fail(
      "No units are counted in. Scan or enter the units that arrived, then post the receipt.",
    );
  }

  const settled = await settleTransferDocument(
    db,
    admin,
    actor,
    built.document,
    "IN_TRANSIT",
    options,
  );
  if (!settled.ok) return fail(settled.error);
  if (!settled.settle.settled) {
    return fail(
      describeUnsettled(
        settled.settle,
        "The transfer stays in transit and the units stay counted in.",
      ),
      describeLineProblems(settled.settle.operation, built.lineByItem),
    );
  }

  const receivedAt = (options.now ?? (() => new Date()))();
  const outcome = await db.$transaction(async (tx: TenantDb) => {
    if (!(await lockTransferIn(tx, transfer.id, "IN_TRANSIT"))) {
      return "not_in_transit" as const;
    }
    const current = await loadTransfer(tx, transfer.id);
    const rebuilt = current && (await buildReceiptDocument(tx, current));
    if (!current || !rebuilt || !rebuilt.ok) return "changed" as const;
    if (!(await isSettled(tx, rebuilt.document))) return "changed" as const;

    let receivedUnits = 0;
    for (const line of current.lineItems) {
      if (line.pendingReceiveQty === 0) continue;
      receivedUnits += line.pendingReceiveQty;
      await tx.transferLineItem.update({
        where: { id: line.id },
        data: {
          receivedQty: line.receivedQty + line.pendingReceiveQty,
          pendingReceiveQty: 0,
        },
      });
    }
    // Counted-in units are now received, so what is missing is unchanged.
    const completed = missingUnits(current.lineItems) === 0;
    if (completed) {
      await tx.transferOrder.update({
        where: { id: transfer.id },
        data: {
          status: "RECEIVED",
          receivedAt,
          receivedByUserId: actor.shopifyUserId,
        },
      });
    }
    return { receivedUnits, completed };
  });

  if (outcome === "changed") {
    return fail(
      "Units were counted in or changed while this receipt was being posted. Post the receipt again to bring Shopify in line with them.",
    );
  }
  if (outcome === "not_in_transit") {
    const now = await loadTransfer(db, transfer.id);
    return now?.status === "RECEIVED"
      ? { ok: true, alreadyDone: true, receivedUnits: 0, completed: true }
      : fail(NOT_IN_TRANSIT_MESSAGE);
  }
  return { ok: true, alreadyDone: false, ...outcome };
}

/**
 * Receive everything still outstanding on a transfer in one step: count every
 * unaccounted unit in, then post the receipt.
 */
export async function receiveTransfer(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  actor: InventoryActor,
  transferId: string,
  options: ReceiveTransferOptions = {},
): Promise<PostReceiptResult> {
  const transfer = await loadTransfer(db, transferId);
  if (!transfer) return fail(TRANSFER_NOT_FOUND_MESSAGE);
  if (transfer.status === "RECEIVED") {
    return { ok: true, alreadyDone: true, receivedUnits: 0, completed: true };
  }
  // Refusals come before anything is counted in, so a refused request leaves
  // the transfer as it was.
  const refused = notReceivable(transfer);
  if (refused) return fail(refused);
  if (!isSwitchedOn(options)) return fail(SWITCHED_OFF_MESSAGE);
  const unshipped = await shipmentProblem(db, transfer);
  if (unshipped) return fail(unshipped);

  const stillInTransit = await db.$transaction(async (tx: TenantDb) => {
    if (!(await lockTransferIn(tx, transfer.id, "IN_TRANSIT"))) return false;
    await countInOutstanding(tx, transfer.id);
    return true;
  });
  if (!stillInTransit) {
    const now = await loadTransfer(db, transfer.id);
    return now?.status === "RECEIVED"
      ? { ok: true, alreadyDone: true, receivedUnits: 0, completed: true }
      : fail(NOT_IN_TRANSIT_MESSAGE);
  }
  return postTransferReceipt(db, admin, actor, transferId, options);
}

export function isShortResolution(
  value: unknown,
): value is TransferShortResolution {
  return value === "RETURNED" || value === "WRITTEN_OFF";
}

export type CloseTransferResult =
  | {
      ok: true;
      alreadyDone: boolean;
      /** Shipped units that never arrived. */
      missingUnits: number;
      /** What was done about them; null when nothing was missing. */
      resolution: TransferShortResolution | null;
    }
  | TransferMovementFailure;

/**
 * Finish a transfer that will receive nothing more.
 *
 * Shipped units that were neither received nor rejected are missing. With
 * `RETURNED` they are put back into stock at the source through the shipment's
 * own ledger document; with `WRITTEN_OFF` they stay out of stock at both
 * locations. The transfer is finished only when the ledger shows the source
 * as it should be, so closing again after a partial failure sends only what
 * Shopify has not confirmed.
 */
export async function closeTransfer(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  actor: InventoryActor,
  transferId: string,
  input: { resolution: unknown },
  options: ReceiveTransferOptions = {},
): Promise<CloseTransferResult> {
  const transfer = await loadTransfer(db, transferId);
  if (!transfer) return fail(TRANSFER_NOT_FOUND_MESSAGE);
  if (transfer.status === "RECEIVED") {
    return { ok: true, alreadyDone: true, missingUnits: 0, resolution: null };
  }
  if (transfer.status !== "IN_TRANSIT") {
    return fail("Only a transfer that is in transit can be closed.");
  }
  if (transfer.shopifyTransferId) return fail(SHOPIFY_MANAGED_MESSAGE);
  if (countedIn(transfer.lineItems) > 0) {
    return fail(
      "Units are counted in and not posted yet. Post the receipt, or set those units back to 0, then close the transfer.",
    );
  }
  const receipt = await buildReceiptDocument(db, transfer);
  if (!receipt.ok) return fail(receipt.error);
  if (!(await isSettled(db, receipt.document))) {
    return fail(
      "The last receipt has not finished posting. Post the receipt again, then close the transfer.",
    );
  }

  const missing = missingUnits(transfer.lineItems);
  if (missing > 0 && !isShortResolution(input.resolution)) {
    return fail(
      `${unitsText(missing)} shipped on this transfer did not arrive. Choose whether to put ${missing === 1 ? "it" : "them"} back into stock at the source or to write ${missing === 1 ? "it" : "them"} off.`,
    );
  }
  const resolution =
    missing > 0 ? (input.resolution as TransferShortResolution) : null;
  const returning =
    resolution === "RETURNED"
      ? (line: TransferLine) => Math.max(0, transferOutstandingQuantity(line))
      : undefined;

  const shipment = await buildShipmentDocument(db, transfer, returning);
  if (!shipment.ok) return fail(shipment.error);
  const state = await readDocumentLedgerState(db, shipment.document);
  if (state.operationCount === 0) return fail(NO_SHIPMENT_RECORD_MESSAGE);
  if (state.unfinishedOperationId || state.outstanding.length > 0) {
    if (!isSwitchedOn(options)) return fail(SWITCHED_OFF_MESSAGE);
    const settled = await settleTransferDocument(
      db,
      admin,
      actor,
      shipment.document,
      "IN_TRANSIT",
      options,
    );
    if (!settled.ok) return fail(settled.error);
    if (!settled.settle.settled) {
      return fail(
        describeUnsettled(settled.settle, "The transfer stays in transit."),
        describeLineProblems(settled.settle.operation, shipment.lineByItem),
      );
    }
  }

  const closedAt = (options.now ?? (() => new Date()))();
  const outcome = await db.$transaction(async (tx: TenantDb) => {
    if (!(await lockTransferIn(tx, transfer.id, "IN_TRANSIT"))) {
      return "not_in_transit" as const;
    }
    const current = await loadTransfer(tx, transfer.id);
    if (!current || countedIn(current.lineItems) > 0) return "changed" as const;
    if (missingUnits(current.lineItems) !== missing) return "changed" as const;
    const [receiptNow, shipmentNow] = await Promise.all([
      buildReceiptDocument(tx, current),
      buildShipmentDocument(tx, current, returning),
    ]);
    if (!receiptNow.ok || !shipmentNow.ok) return "changed" as const;
    if (
      !(await isSettled(tx, receiptNow.document)) ||
      !(await isSettled(tx, shipmentNow.document))
    ) {
      return "changed" as const;
    }
    if (returning) {
      for (const line of current.lineItems) {
        const back = returning(line);
        if (back === 0) continue;
        await tx.transferLineItem.update({
          where: { id: line.id },
          data: { returnedQty: line.returnedQty + back },
        });
      }
    }
    await tx.transferOrder.update({
      where: { id: transfer.id },
      data: {
        status: "RECEIVED",
        receivedAt: closedAt,
        receivedByUserId: actor.shopifyUserId,
        shortResolution: resolution,
      },
    });
    return "closed" as const;
  });

  if (outcome === "closed") {
    return { ok: true, alreadyDone: false, missingUnits: missing, resolution };
  }
  if (outcome === "changed") {
    return fail(
      "This transfer was changed while it was being closed. Reload the page to see where it stands, then close it again.",
    );
  }
  const now = await loadTransfer(db, transfer.id);
  return now?.status === "RECEIVED"
    ? { ok: true, alreadyDone: true, missingUnits: 0, resolution: null }
    : fail("Only a transfer that is in transit can be closed.");
}
