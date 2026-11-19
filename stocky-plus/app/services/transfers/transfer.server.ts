import type { TenantDb } from "../../tenant/tenant-db.server";
import type { AdminGraphQLClient } from "../shopify-gql.server";
import { STAFF_REQUIRED_MESSAGE } from "../inventory-writes/actor.server";
import type { ExecuteInventoryOperationOptions } from "../inventory-writes/execute.server";
import { findActiveLocationIds } from "../inventory-writes/locations.server";
import {
  describeLineProblems,
  describeUnsettled,
  readDocumentLedgerState,
  type DocumentLineProblem,
} from "../inventory-writes/settle.server";
import {
  createAvailableQuantityReader,
  type ReadLevelQuantities,
} from "../inventory-writes/shopify-levels.server";
import type { InventoryActor } from "../inventory-writes/types";
import {
  ambiguousCodeMessage,
  findTrackedInventoryItemIds,
  findVariantInventoryItems,
  findVariantsByCode,
  variantsMatchingCode,
  type CatalogVariant,
} from "../inventory-writes/variant-items.server";
import {
  buildShipmentDocument,
  emptyShipmentDocument,
  fail,
  isSettled,
  isSwitchedOn,
  LINE_NOT_FOUND_MESSAGE,
  loadTransfer,
  lockTransferIn,
  NOT_DRAFT_MESSAGE,
  settleTransferDocument,
  SWITCHED_OFF_MESSAGE,
  TRANSFER_NOT_FOUND_MESSAGE,
  UNREADABLE_MESSAGE,
  type LineByItem,
  type TransferActionResult,
  type TransferMovementResult,
  type TransferWithLines,
} from "./transfer-core.server";
import { parseTransferItems } from "./transfer-input";
import {
  MAX_TRANSFER_LINE_QUANTITY,
  MAX_TRANSFER_LINES,
  MAX_TRANSFER_NOTES_LENGTH,
  transferShipQuantity,
} from "./transfer-quantities";

export type {
  TransferActionResult,
  TransferMovementResult,
} from "./transfer-core.server";

const LINE_LIMIT_TEXT = MAX_TRANSFER_LINE_QUANTITY.toLocaleString("en-US");
const TOO_MANY_UNITS_MESSAGE = (title: string) =>
  `${title} would hold more than ${LINE_LIMIT_TEXT} units. A transfer line can hold at most ${LINE_LIMIT_TEXT}.`;

const isLineQuantity = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= MAX_TRANSFER_LINE_QUANTITY;

export type CreateTransferResult =
  { ok: true; transferId: string } | { ok: false; error: string };

export async function createTransfer(
  db: TenantDb,
  input: {
    shop: string;
    sourceLocationId: string;
    destinationLocationId: string;
    notes: string | null;
    actor?: InventoryActor | null;
  },
): Promise<CreateTransferResult> {
  if (!input.sourceLocationId || !input.destinationLocationId) {
    return { ok: false, error: "Choose a source and a destination location." };
  }
  if (input.sourceLocationId === input.destinationLocationId) {
    return { ok: false, error: "Source and destination must differ" };
  }
  const active = await findActiveLocationIds(db, [
    input.sourceLocationId,
    input.destinationLocationId,
  ]);
  if (
    !active.has(input.sourceLocationId) ||
    !active.has(input.destinationLocationId)
  ) {
    return {
      ok: false,
      error:
        "One of those locations is not an active, synced location of this shop. Run a sync from the dashboard, then try again.",
    };
  }

  const notes = input.notes?.trim() ?? "";
  if (notes.length > MAX_TRANSFER_NOTES_LENGTH) {
    return {
      ok: false,
      error: `Notes can be at most ${MAX_TRANSFER_NOTES_LENGTH} characters.`,
    };
  }

  const created = (await db.transferOrder.create({
    data: {
      shop: input.shop,
      sourceLocationId: input.sourceLocationId,
      destinationLocationId: input.destinationLocationId,
      notes: notes || null,
      status: "DRAFT",
      createdByUserId: input.actor?.shopifyUserId ?? null,
    },
    select: { id: true },
  })) as { id: string };
  return { ok: true, transferId: created.id };
}

/** Add units of a variant to a draft transfer; a variant already on it gets the units added to its line. */
export async function addTransferLine(
  db: TenantDb,
  input: { transferId: string; shopifyVariantId: string; quantity: number },
): Promise<TransferActionResult> {
  if (!isLineQuantity(input.quantity)) {
    return {
      ok: false,
      error: `Enter the quantity as a whole number from 1 to ${LINE_LIMIT_TEXT}.`,
    };
  }
  const transfer = (await db.transferOrder.findFirst({
    where: { id: input.transferId },
    select: { id: true },
  })) as { id: string } | null;
  if (!transfer) return { ok: false, error: TRANSFER_NOT_FOUND_MESSAGE };

  const known = await findVariantInventoryItems(db, [input.shopifyVariantId]);
  const variant = known.get(input.shopifyVariantId);
  if (!variant) {
    return { ok: false, error: "That variant is not in this shop's catalog." };
  }

  return db.$transaction((tx: TenantDb) =>
    addUnitsToDraft(tx, transfer.id, [
      {
        shopifyVariantId: variant.shopifyVariantId,
        title: variant.title,
        quantity: input.quantity,
      },
    ]),
  );
}

interface DraftAddition {
  shopifyVariantId: string;
  title: string;
  quantity: number;
}

/**
 * Put units on a draft under its lock: a variant already on the draft gets
 * the units added to its line, any other variant gets a new line. Nothing is
 * changed unless every addition fits.
 */
async function addUnitsToDraft(
  tx: TenantDb,
  transferId: string,
  additions: readonly DraftAddition[],
): Promise<
  | { ok: true; added: number; updated: number; totals: Map<string, number> }
  | { ok: false; error: string }
> {
  if (!(await lockTransferIn(tx, transferId, "DRAFT"))) {
    return { ok: false, error: NOT_DRAFT_MESSAGE };
  }
  const lines = (await tx.transferLineItem.findMany({
    where: { transferOrderId: transferId },
    select: { id: true, shopifyVariantId: true, quantity: true },
    orderBy: { id: "asc" },
  })) as Array<{ id: string; shopifyVariantId: string; quantity: number }>;
  // A variant has one line; if older data has two, the first one takes the units.
  const lineOf = new Map<string, { id: string; quantity: number }>();
  for (const line of lines) {
    if (!lineOf.has(line.shopifyVariantId)) {
      lineOf.set(line.shopifyVariantId, line);
    }
  }

  const fresh = additions.filter((a) => !lineOf.has(a.shopifyVariantId));
  if (lines.length + fresh.length > MAX_TRANSFER_LINES) {
    return {
      ok: false,
      error: `A transfer can hold at most ${MAX_TRANSFER_LINES.toLocaleString("en-US")} items. Put the rest on another transfer.`,
    };
  }
  const totals = new Map<string, number>();
  for (const addition of additions) {
    const quantity =
      (lineOf.get(addition.shopifyVariantId)?.quantity ?? 0) +
      addition.quantity;
    if (quantity > MAX_TRANSFER_LINE_QUANTITY) {
      return { ok: false, error: TOO_MANY_UNITS_MESSAGE(addition.title) };
    }
    totals.set(addition.shopifyVariantId, quantity);
  }

  for (const addition of additions) {
    const line = lineOf.get(addition.shopifyVariantId);
    if (!line) continue;
    await tx.transferLineItem.update({
      where: { id: line.id },
      data: { quantity: totals.get(addition.shopifyVariantId)! },
    });
  }
  if (fresh.length > 0) {
    await tx.transferOrder.update({
      where: { id: transferId },
      data: {
        lineItems: {
          createMany: {
            data: fresh.map((addition) => ({
              shopifyVariantId: addition.shopifyVariantId,
              quantity: addition.quantity,
            })),
          },
        },
      },
      select: { id: true },
    });
  }
  return {
    ok: true,
    added: fresh.length,
    updated: additions.length - fresh.length,
    totals,
  };
}

export type AddTransferItemsResult =
  | {
      ok: true;
      /** Items that were not on the draft before. */
      added: number;
      /** Items already on the draft whose quantity was raised. */
      updated: number;
      /** Each item named, with the quantity its line holds now. */
      items: Array<{ title: string; quantity: number }>;
    }
  | { ok: false; error: string; details: string[] };

/**
 * Add items to a draft transfer by SKU, barcode or variant ID: one scanned
 * code, or a pasted list with an optional quantity per line. Nothing is added
 * unless every line names exactly one item that Shopify tracks.
 */
export async function addTransferItems(
  db: TenantDb,
  input: { transferId: string; itemsText: unknown },
): Promise<AddTransferItemsResult> {
  const refuse = (error: string, details: string[] = []) => ({
    ok: false as const,
    error,
    details,
  });
  if (typeof input.itemsText !== "string") {
    return refuse("Enter at least one SKU or barcode.");
  }
  const parsed = parseTransferItems(input.itemsText);
  if (!parsed.ok) {
    return parsed.errors.length === 1 && !parsed.errors[0].startsWith("Line ")
      ? refuse(parsed.errors[0])
      : refuse(
          "Some lines could not be read. Nothing was added to the transfer.",
          parsed.errors,
        );
  }

  const transfer = (await db.transferOrder.findFirst({
    where: { id: input.transferId },
    select: { id: true, status: true },
  })) as { id: string; status: string } | null;
  if (!transfer) return refuse(TRANSFER_NOT_FOUND_MESSAGE);
  if (transfer.status !== "DRAFT") return refuse(NOT_DRAFT_MESSAGE);

  const catalog = await findVariantsByCode(
    db,
    parsed.items.map((item) => item.code),
  );
  const details: string[] = [];
  const named: Array<{
    lineNumber: number;
    variant: CatalogVariant;
    quantity: number;
  }> = [];
  for (const item of parsed.items) {
    const matches = variantsMatchingCode(catalog, item.code);
    if (matches.length === 0) {
      details.push(
        `Line ${item.lineNumber}: no item has the barcode or SKU ${item.code}.`,
      );
    } else if (matches.length > 1) {
      details.push(
        `Line ${item.lineNumber}: ${ambiguousCodeMessage(item.code, matches)}`,
      );
    } else if (!matches[0].inventoryItemId) {
      details.push(
        `Line ${item.lineNumber}: Shopify inventory is not linked yet for ${matches[0].title}. Run a catalog sync from the dashboard.`,
      );
    } else {
      named.push({
        lineNumber: item.lineNumber,
        variant: matches[0],
        quantity: item.quantity,
      });
    }
  }
  const tracked = await findTrackedInventoryItemIds(
    db,
    named.map(({ variant }) => variant.inventoryItemId!),
  );
  // A SKU and a barcode of the same item are one line on the transfer.
  const additions = new Map<string, DraftAddition>();
  for (const { lineNumber, variant, quantity } of named) {
    if (!tracked.has(variant.inventoryItemId!)) {
      details.push(
        `Line ${lineNumber}: ${variant.title} is not tracked for inventory in Shopify, so it cannot be transferred.`,
      );
      continue;
    }
    const addition = additions.get(variant.shopifyVariantId);
    if (addition) addition.quantity += quantity;
    else {
      additions.set(variant.shopifyVariantId, {
        shopifyVariantId: variant.shopifyVariantId,
        title: variant.title,
        quantity,
      });
    }
  }
  if (details.length > 0) {
    return refuse(
      "Some lines could not be added. Nothing was added to the transfer.",
      details.sort(
        (a, b) =>
          Number(a.slice(5, a.indexOf(":"))) -
          Number(b.slice(5, b.indexOf(":"))),
      ),
    );
  }

  const wanted = [...additions.values()];
  const outcome = await db.$transaction((tx: TenantDb) =>
    addUnitsToDraft(tx, transfer.id, wanted),
  );
  if (!outcome.ok) return refuse(outcome.error);
  return {
    ok: true,
    added: outcome.added,
    updated: outcome.updated,
    items: wanted.map((addition) => ({
      title: addition.title,
      quantity: outcome.totals.get(addition.shopifyVariantId)!,
    })),
  };
}

/** A line of the given transfer, held under the draft lock. */
async function lockDraftLine(
  tx: TenantDb,
  input: { lineId: string; transferId?: string },
): Promise<
  | { ok: true; line: { id: string; quantity: number; pickedQty: number } }
  | { ok: false; error: string }
> {
  const line = (await tx.transferLineItem.findFirst({
    where: {
      id: input.lineId,
      ...(input.transferId ? { transferOrderId: input.transferId } : {}),
    },
    select: { id: true, transferOrderId: true },
  })) as { id: string; transferOrderId: string } | null;
  if (!line) return { ok: false, error: LINE_NOT_FOUND_MESSAGE };
  if (!(await lockTransferIn(tx, line.transferOrderId, "DRAFT"))) {
    return { ok: false, error: NOT_DRAFT_MESSAGE };
  }
  const current = (await tx.transferLineItem.findFirst({
    where: { id: line.id },
    select: { id: true, quantity: true, pickedQty: true },
  })) as { id: string; quantity: number; pickedQty: number } | null;
  return current
    ? { ok: true, line: current }
    : { ok: false, error: LINE_NOT_FOUND_MESSAGE };
}

/** Change how many units a draft line asks for. Picked units above the new quantity are lowered to it. */
export async function setTransferLineQuantity(
  db: TenantDb,
  input: { lineId: string; quantity: number; transferId?: string },
): Promise<TransferActionResult> {
  if (!isLineQuantity(input.quantity)) {
    return {
      ok: false,
      error: `Enter the quantity as a whole number from 1 to ${LINE_LIMIT_TEXT}. To take the item off the transfer, remove its line.`,
    };
  }
  return db.$transaction(async (tx: TenantDb) => {
    const locked = await lockDraftLine(tx, input);
    if (!locked.ok) return locked;
    await tx.transferLineItem.update({
      where: { id: locked.line.id },
      data: {
        quantity: input.quantity,
        pickedQty: Math.min(locked.line.pickedQty, input.quantity),
      },
    });
    return { ok: true as const };
  });
}

/**
 * Take an item off a draft. If an interrupted ship already took its units out
 * of the source, the next ship or cancel puts them back.
 */
export async function removeTransferLine(
  db: TenantDb,
  input: { lineId: string; transferId?: string },
): Promise<TransferActionResult> {
  return db.$transaction(async (tx: TenantDb) => {
    const locked = await lockDraftLine(tx, input);
    if (!locked.ok) return locked;
    await tx.transferLineItem.delete({ where: { id: locked.line.id } });
    return { ok: true as const };
  });
}

export async function setTransferPickedQuantity(
  db: TenantDb,
  input: { lineId: string; pickedQty: number; transferId?: string },
): Promise<TransferActionResult> {
  if (!Number.isInteger(input.pickedQty) || input.pickedQty < 0) {
    return {
      ok: false,
      error: "Enter the picked quantity as a whole number of 0 or more.",
    };
  }
  return db.$transaction(async (tx: TenantDb) => {
    const locked = await lockDraftLine(tx, input);
    if (!locked.ok) return locked;
    if (input.pickedQty > locked.line.quantity) {
      return {
        ok: false as const,
        error: `Picked quantity cannot be more than the ${locked.line.quantity} requested.`,
      };
    }
    await tx.transferLineItem.update({
      where: { id: locked.line.id },
      data: { pickedQty: input.pickedQty },
    });
    return { ok: true as const };
  });
}

export interface ShipTransferOptions extends ExecuteInventoryOperationOptions {
  /** Ship although Shopify shows fewer units available at the source than the transfer takes. */
  allowShortSource?: boolean;
  /** Replaces the live read of Shopify's available quantities. */
  readQuantities?: ReadLevelQuantities;
  now?: () => Date;
}

const unitsText = (units: number) =>
  `${units.toLocaleString("en-US")} ${units === 1 ? "unit" : "units"}`;

/**
 * Compare what is about to leave the source with what Shopify has there now.
 * An item Shopify does not stock at either location stops the shipment,
 * because the change would be refused there or could never be received. An
 * item with fewer units available than the transfer takes stops it until the
 * staff member confirms, because shipping would take the source below zero.
 *
 * Returns null when nothing stands in the way, or when there is no Admin
 * client to read with.
 */
async function checkStockBeforeShipping(
  admin: AdminGraphQLClient | null,
  transfer: TransferWithLines,
  leaving: ReadonlyArray<{ inventoryItemId: string; units: number }>,
  lineByItem: LineByItem,
  options: ShipTransferOptions,
): Promise<TransferMovementResult | null> {
  const read =
    options.readQuantities ??
    (admin ? createAvailableQuantityReader(admin) : null);
  if (!read || leaving.length === 0) return null;

  const itemIds = leaving.map((entry) => entry.inventoryItemId);
  let atSource: Map<string, number | null>;
  let atDestination: Map<string, number | null>;
  try {
    [atSource, atDestination] = await Promise.all([
      read(transfer.sourceLocationId, itemIds),
      read(transfer.destinationLocationId, itemIds),
    ]);
  } catch {
    return fail(UNREADABLE_MESSAGE);
  }

  const notStocked: DocumentLineProblem[] = [];
  const short: DocumentLineProblem[] = [];
  for (const { inventoryItemId, units } of leaving) {
    const line = lineByItem.get(inventoryItemId);
    const problem = (message: string): DocumentLineProblem => ({
      shopifyVariantId: line?.shopifyVariantId ?? "",
      title: line?.title ?? inventoryItemId,
      message,
    });
    const available = atSource.get(inventoryItemId) ?? null;
    if (available === null) {
      notStocked.push(
        problem("Shopify does not stock this item at the source location."),
      );
    } else if ((atDestination.get(inventoryItemId) ?? null) === null) {
      notStocked.push(
        problem(
          "Shopify does not stock this item at the destination, so it could not be received there. Stock it at that location in Shopify first.",
        ),
      );
    } else if (available < units) {
      short.push(
        problem(
          `Shopify shows ${available.toLocaleString("en-US")} available at the source; the transfer takes ${unitsText(units)}.`,
        ),
      );
    }
  }
  if (notStocked.length > 0) {
    return fail(
      "Some items cannot be transferred between these locations yet. Nothing was sent to Shopify and the transfer stays a draft.",
      notStocked,
    );
  }
  if (short.length > 0 && !options.allowShortSource) {
    return fail(
      "The source location does not have enough stock for every item. Nothing was sent to Shopify. Lower the quantities, or ship anyway and let the source go below zero.",
      short,
      "SOURCE_SHORT",
    );
  }
  return null;
}

/**
 * Put back whatever the ledger shows as having left the source for a transfer
 * that will not ship. Returns null when the source is whole again.
 */
async function returnShippedStock(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  actor: InventoryActor | null,
  transfer: TransferWithLines,
  options: ExecuteInventoryOperationOptions,
): Promise<TransferMovementResult | null> {
  const document = emptyShipmentDocument(transfer);
  if (await isSettled(db, document)) return null;
  if (!actor) return fail(STAFF_REQUIRED_MESSAGE);

  const settled = await settleTransferDocument(
    db,
    admin,
    actor,
    document,
    transfer.status,
    options,
  );
  if (!settled.ok) return fail(settled.error);
  if (!settled.settle.settled) {
    return fail(
      `Some of this transfer's stock already left the source and has not been put back yet. ${describeUnsettled(settled.settle)} Cancel the transfer again to finish.`,
    );
  }
  return null;
}

/**
 * Take a draft transfer's stock out of the source location and mark it in
 * transit.
 *
 * The transfer moves on only when the ledger shows every line applied.
 * Pressing ship again, twice at once, or after a partial failure sends only
 * what Shopify has not confirmed yet; a shipped transfer sends nothing.
 */
export async function shipTransfer(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  actor: InventoryActor,
  transferId: string,
  options: ShipTransferOptions = {},
): Promise<TransferMovementResult> {
  const transfer = await loadTransfer(db, transferId);
  if (!transfer) return fail(TRANSFER_NOT_FOUND_MESSAGE);
  if (transfer.status === "IN_TRANSIT" || transfer.status === "RECEIVED") {
    return { ok: true, alreadyDone: true };
  }
  if (transfer.status !== "DRAFT") {
    return fail("A cancelled transfer cannot be shipped.");
  }
  if (!isSwitchedOn(options)) return fail(SWITCHED_OFF_MESSAGE);

  const built = await buildShipmentDocument(db, transfer);
  if (!built.ok) return fail(built.error);

  // Only units that have not left yet are checked: after a partial failure
  // the rest is already out of the source's quantity.
  const state = await readDocumentLedgerState(db, built.document);
  if (!state.unfinishedOperationId) {
    const blocked = await checkStockBeforeShipping(
      admin,
      transfer,
      state.outstanding
        .filter((line) => line.delta < 0)
        .map((line) => ({
          inventoryItemId: line.inventoryItemId,
          units: -line.delta,
        })),
      built.lineByItem,
      options,
    );
    if (blocked) return blocked;
  }

  const settled = await settleTransferDocument(
    db,
    admin,
    actor,
    built.document,
    "DRAFT",
    options,
  );
  if (!settled.ok) return fail(settled.error);
  if (!settled.settle.settled) {
    return fail(
      describeUnsettled(settled.settle, "The transfer stays a draft."),
      describeLineProblems(settled.settle.operation, built.lineByItem),
    );
  }

  const shippedAt = (options.now ?? (() => new Date()))();
  const outcome = await db.$transaction(async (tx: TenantDb) => {
    if (!(await lockTransferIn(tx, transfer.id, "DRAFT"))) return "not_draft";
    const current = await loadTransfer(tx, transfer.id);
    const rebuilt = current && (await buildShipmentDocument(tx, current));
    if (!current || !rebuilt || !rebuilt.ok) return "changed";
    if (!(await isSettled(tx, rebuilt.document))) return "changed";
    // Freeze what shipped on each line; receiving reads it back.
    for (const line of current.lineItems) {
      await tx.transferLineItem.update({
        where: { id: line.id },
        data: { pickedQty: transferShipQuantity(line) },
      });
    }
    await tx.transferOrder.update({
      where: { id: transfer.id },
      data: {
        status: "IN_TRANSIT",
        shippedAt,
        shippedByUserId: actor.shopifyUserId,
      },
    });
    return "shipped";
  });

  if (outcome === "shipped") return { ok: true, alreadyDone: false };
  if (outcome === "changed") {
    return fail(
      "A line was changed while this transfer was being shipped. Ship it again to apply the latest quantities.",
    );
  }

  const now = await loadTransfer(db, transfer.id);
  if (now?.status === "IN_TRANSIT" || now?.status === "RECEIVED") {
    return { ok: true, alreadyDone: true };
  }
  if (now?.status === "CANCELLED") {
    const pending = await returnShippedStock(db, admin, actor, now, options);
    return (
      pending ??
      fail(
        "This transfer was cancelled while it was being shipped. Its stock is back at the source location.",
      )
    );
  }
  return fail(TRANSFER_NOT_FOUND_MESSAGE);
}

/**
 * Cancel a draft transfer. If an interrupted ship already took stock out of
 * the source, that stock is put back first; cancelling again finishes a
 * put-back that Shopify had not confirmed.
 */
export async function cancelTransfer(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  actor: InventoryActor | null,
  transferId: string,
  options: ExecuteInventoryOperationOptions & { now?: () => Date } = {},
): Promise<TransferMovementResult> {
  const transfer = await loadTransfer(db, transferId);
  if (!transfer) return fail(TRANSFER_NOT_FOUND_MESSAGE);
  if (transfer.status === "IN_TRANSIT" || transfer.status === "RECEIVED") {
    return fail(
      "Only a draft transfer can be cancelled. This one has already shipped.",
    );
  }

  const pending = await returnShippedStock(db, admin, actor, transfer, options);
  if (pending) return pending;
  if (transfer.status === "CANCELLED") return { ok: true, alreadyDone: true };

  const cancelledAt = (options.now ?? (() => new Date()))();
  const outcome = await db.$transaction(async (tx: TenantDb) => {
    if (!(await lockTransferIn(tx, transfer.id, "DRAFT"))) return "not_draft";
    if (!(await isSettled(tx, emptyShipmentDocument(transfer)))) {
      return "shipping";
    }
    await tx.transferOrder.update({
      where: { id: transfer.id },
      data: {
        status: "CANCELLED",
        cancelledAt,
        cancelledByUserId: actor?.shopifyUserId ?? null,
      },
    });
    return "cancelled";
  });

  if (outcome === "cancelled") return { ok: true, alreadyDone: false };
  if (outcome === "shipping") {
    return fail(
      "This transfer is being shipped right now. Reload the page, then cancel it again if it is still a draft.",
    );
  }
  const now = await loadTransfer(db, transfer.id);
  return now?.status === "CANCELLED"
    ? { ok: true, alreadyDone: true }
    : fail(
        "Only a draft transfer can be cancelled. This one has already shipped.",
      );
}
