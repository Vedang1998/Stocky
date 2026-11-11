import { isInventoryWriteEnabled } from "../../lib/feature-flags.server";
import type { TenantDb } from "../../tenant/tenant-db.server";
import type { AdminGraphQLClient } from "../shopify-gql.server";
import { STAFF_REQUIRED_MESSAGE } from "../inventory-writes/actor.server";
import {
  InventoryDocumentClosedError,
  InventoryOperationConflictError,
  InventoryOperationValidationError,
} from "../inventory-writes/errors";
import type { ExecuteInventoryOperationOptions } from "../inventory-writes/execute.server";
import { findActiveLocationIds } from "../inventory-writes/locations.server";
import {
  describeLineProblems,
  describeUnsettled,
  readDocumentLedgerState,
  settleInventoryDocument,
  type DocumentLineProblem,
  type InventoryDocument,
  type SettleResult,
} from "../inventory-writes/settle.server";
import type { InventoryActor } from "../inventory-writes/types";
import {
  findVariantInventoryItems,
  ledgerVariantId,
} from "../inventory-writes/variant-items.server";
import {
  MAX_TRANSFER_LINE_QUANTITY,
  transferShipQuantity,
} from "./transfer-quantities";

type TransferStatus = "DRAFT" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";

interface TransferLine {
  id: string;
  shopifyVariantId: string;
  quantity: number;
  pickedQty: number;
  receivedQty: number;
}

interface TransferWithLines {
  id: string;
  sourceLocationId: string;
  destinationLocationId: string;
  status: TransferStatus;
  shopifyTransferId: string | null;
  lineItems: TransferLine[];
}

export type TransferActionResult = { ok: true } | { ok: false; error: string };

export type TransferMovementResult =
  | { ok: true; alreadyDone: boolean }
  | { ok: false; error: string; problems: DocumentLineProblem[] };

const MAX_NOTES_LENGTH = 500;

const NOT_DRAFT_MESSAGE =
  "This transfer has already been shipped or cancelled. Its lines can no longer be changed.";
const SWITCHED_OFF_MESSAGE =
  "Transfer inventory changes are switched off for this app. Nothing was sent to Shopify and the transfer was not changed.";
const SHOPIFY_MANAGED_MESSAGE =
  "This transfer was shipped as a Shopify transfer. Receive it in Shopify admin; ProPo will not change stock for it.";

/**
 * Hold the transfer row for the rest of the transaction, provided it is still
 * in `status`. Shipping, receiving and cancelling take the same lock before
 * they move the transfer on, so a line saved under it is seen by their check.
 */
async function lockTransferIn(
  tx: TenantDb,
  transferId: string,
  status: TransferStatus,
): Promise<boolean> {
  const locked = await tx.transferOrder.updateMany({
    where: { id: transferId, status },
    data: { status },
  });
  return locked.count === 1;
}

async function loadTransfer(
  db: TenantDb,
  transferId: string,
): Promise<TransferWithLines | null> {
  return (await db.transferOrder.findFirst({
    where: { id: transferId },
    include: { lineItems: true },
  })) as TransferWithLines | null;
}

export async function createTransfer(
  db: TenantDb,
  input: {
    shop: string;
    sourceLocationId: string;
    destinationLocationId: string;
    notes: string | null;
  },
): Promise<TransferActionResult> {
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
  if (notes.length > MAX_NOTES_LENGTH) {
    return {
      ok: false,
      error: `Notes can be at most ${MAX_NOTES_LENGTH} characters.`,
    };
  }

  await db.transferOrder.create({
    data: {
      shop: input.shop,
      sourceLocationId: input.sourceLocationId,
      destinationLocationId: input.destinationLocationId,
      notes: notes || null,
      status: "DRAFT",
    },
  });
  return { ok: true };
}

/** Add units of a variant to a draft transfer; a variant already on it gets the units added to its line. */
export async function addTransferLine(
  db: TenantDb,
  input: { transferId: string; shopifyVariantId: string; quantity: number },
): Promise<TransferActionResult> {
  const transfer = (await db.transferOrder.findFirst({
    where: { id: input.transferId },
  })) as { id: string } | null;
  if (!transfer) return { ok: false, error: "Transfer not found" };

  const known = await findVariantInventoryItems(db, [input.shopifyVariantId]);
  if (!known.has(input.shopifyVariantId)) {
    return { ok: false, error: "That variant is not in this shop's catalog." };
  }

  return db.$transaction(async (tx: TenantDb) => {
    if (!(await lockTransferIn(tx, transfer.id, "DRAFT"))) {
      return { ok: false as const, error: NOT_DRAFT_MESSAGE };
    }
    const existing = (await tx.transferLineItem.findFirst({
      where: {
        transferOrderId: transfer.id,
        shopifyVariantId: input.shopifyVariantId,
      },
    })) as { id: string; quantity: number } | null;
    if (!existing) {
      await tx.transferLineItem.create({
        data: {
          transferOrderId: transfer.id,
          shopifyVariantId: input.shopifyVariantId,
          quantity: input.quantity,
        },
      });
      return { ok: true as const };
    }
    const quantity = existing.quantity + input.quantity;
    if (quantity > MAX_TRANSFER_LINE_QUANTITY) {
      return {
        ok: false as const,
        error: `A transfer line can hold at most ${MAX_TRANSFER_LINE_QUANTITY.toLocaleString("en-US")} units.`,
      };
    }
    await tx.transferLineItem.update({
      where: { id: existing.id },
      data: { quantity },
    });
    return { ok: true as const };
  });
}

export async function setTransferPickedQuantity(
  db: TenantDb,
  input: { lineId: string; pickedQty: number },
): Promise<TransferActionResult> {
  const line = (await db.transferLineItem.findFirst({
    where: { id: input.lineId },
  })) as { id: string; transferOrderId: string } | null;
  if (!line) return { ok: false, error: "Transfer line not found" };

  return db.$transaction(async (tx: TenantDb) => {
    if (!(await lockTransferIn(tx, line.transferOrderId, "DRAFT"))) {
      return { ok: false as const, error: NOT_DRAFT_MESSAGE };
    }
    const current = (await tx.transferLineItem.findFirst({
      where: { id: line.id },
    })) as { quantity: number } | null;
    if (!current) {
      return { ok: false as const, error: "Transfer line not found" };
    }
    if (input.pickedQty > current.quantity) {
      return {
        ok: false as const,
        error: `Picked quantity cannot be more than the ${current.quantity} requested.`,
      };
    }
    await tx.transferLineItem.update({
      where: { id: line.id },
      data: { pickedQty: input.pickedQty },
    });
    return { ok: true as const };
  });
}

type Movement = "shipment" | "receipt" | "cancellation";

type BuiltDocument =
  | {
      ok: true;
      document: InventoryDocument;
      lineByItem: Map<string, { shopifyVariantId: string; title: string }>;
    }
  | { ok: false; error: string };

const MOVEMENT_SOURCE_TYPE = {
  shipment: "TransferShipment",
  receipt: "TransferReceipt",
} as const;

function movementDocument(
  transfer: TransferWithLines,
  movement: Movement,
  desired: InventoryDocument["desired"],
): InventoryDocument {
  return {
    kind: "TRANSFER",
    // A cancellation undoes the shipment, so it is settled against the
    // shipment's own ledger entries.
    source: {
      type:
        movement === "receipt"
          ? MOVEMENT_SOURCE_TYPE.receipt
          : MOVEMENT_SOURCE_TYPE.shipment,
      id: transfer.id,
    },
    reason:
      movement === "shipment"
        ? "movement_created"
        : movement === "receipt"
          ? "movement_received"
          : "movement_canceled",
    quantityName: "available",
    referenceDocumentUri: `gid://propo/TransferOrder/${transfer.id}`,
    desired,
  };
}

/**
 * The stock change one leg of a transfer stands for: the shipped units leave
 * `available` at the source, and the same units arrive at the destination.
 * Both are relative changes, so sales made meanwhile are kept.
 */
async function buildMovementDocument(
  db: TenantDb,
  transfer: TransferWithLines,
  movement: "shipment" | "receipt",
): Promise<BuiltDocument> {
  if (transfer.sourceLocationId === transfer.destinationLocationId) {
    return {
      ok: false,
      error: "This transfer has the same source and destination location.",
    };
  }
  const unitsByVariant = new Map<string, number>();
  for (const line of transfer.lineItems) {
    const units = transferShipQuantity(line);
    if (units <= 0) continue;
    unitsByVariant.set(
      line.shopifyVariantId,
      (unitsByVariant.get(line.shopifyVariantId) ?? 0) + units,
    );
  }
  if (unitsByVariant.size === 0) {
    return { ok: false, error: "Transfer has no line items" };
  }

  const items = await findVariantInventoryItems(db, [...unitsByVariant.keys()]);
  const unresolved = [...unitsByVariant.keys()]
    .filter((id) => !items.get(id)?.inventoryItemId)
    .map((id) => items.get(id)?.title ?? id);
  if (unresolved.length > 0) {
    return {
      ok: false,
      error: `Shopify inventory is not linked yet for: ${unresolved.join(", ")}. Run a catalog sync from the dashboard, then try again.`,
    };
  }

  const lineByItem = new Map<
    string,
    { shopifyVariantId: string; title: string }
  >();
  const desired = [...unitsByVariant].map(([shopifyVariantId, units]) => {
    const item = items.get(shopifyVariantId)!;
    lineByItem.set(item.inventoryItemId!, {
      shopifyVariantId,
      title: item.title,
    });
    return {
      inventoryItemId: item.inventoryItemId!,
      variantId: ledgerVariantId(shopifyVariantId),
      locationId:
        movement === "shipment"
          ? transfer.sourceLocationId
          : transfer.destinationLocationId,
      delta: movement === "shipment" ? -units : units,
      changeFromQuantity: null,
    };
  });

  return {
    ok: true,
    document: movementDocument(transfer, movement, desired),
    lineByItem,
  };
}

type SettleOutcome =
  { ok: true; settle: SettleResult } | { ok: false; error: string };

/** Settle a leg's document, recording new operations only while the transfer is still in `whileIn`. */
async function settle(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  actor: InventoryActor,
  document: InventoryDocument,
  whileIn: TransferStatus,
  options: ExecuteInventoryOperationOptions,
): Promise<SettleOutcome> {
  try {
    return {
      ok: true,
      settle: await settleInventoryDocument(
        db,
        admin,
        {
          ...document,
          actor,
          note: null,
          holdOpen: (tx) => lockTransferIn(tx, document.source.id, whileIn),
        },
        options,
      ),
    };
  } catch (err) {
    if (
      err instanceof InventoryOperationConflictError ||
      err instanceof InventoryDocumentClosedError
    ) {
      return {
        ok: false,
        error:
          "This transfer was changed while its stock was being moved. Reload the page to see where it stands, then try again.",
      };
    }
    if (err instanceof InventoryOperationValidationError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}

const fail = (
  error: string,
  problems: DocumentLineProblem[] = [],
): TransferMovementResult => ({ ok: false, error, problems });

function isSwitchedOn(options: ExecuteInventoryOperationOptions): boolean {
  return (options.isCapabilityEnabled ?? isInventoryWriteEnabled)(
    "transferWrites",
  );
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
  const document = movementDocument(transfer, "cancellation", []);
  const state = await readDocumentLedgerState(db, document);
  if (!state.unfinishedOperationId && state.outstanding.length === 0) {
    return null;
  }
  if (!actor) return fail(STAFF_REQUIRED_MESSAGE);

  const settled = await settle(
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
  options: ExecuteInventoryOperationOptions = {},
): Promise<TransferMovementResult> {
  const transfer = await loadTransfer(db, transferId);
  if (!transfer) return fail("Transfer not found");
  if (transfer.status === "IN_TRANSIT" || transfer.status === "RECEIVED") {
    return { ok: true, alreadyDone: true };
  }
  if (transfer.status !== "DRAFT") {
    return fail("A cancelled transfer cannot be shipped.");
  }
  if (!isSwitchedOn(options)) return fail(SWITCHED_OFF_MESSAGE);

  const built = await buildMovementDocument(db, transfer, "shipment");
  if (!built.ok) return fail(built.error);

  const settled = await settle(
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
      `${describeUnsettled(settled.settle)} The transfer stays a draft.`,
      describeLineProblems(settled.settle.operation, built.lineByItem),
    );
  }

  const outcome = await db.$transaction(async (tx: TenantDb) => {
    if (!(await lockTransferIn(tx, transfer.id, "DRAFT"))) return "not_draft";
    const current = await loadTransfer(tx, transfer.id);
    const rebuilt =
      current && (await buildMovementDocument(tx, current, "shipment"));
    if (!current || !rebuilt || !rebuilt.ok) return "changed";
    const state = await readDocumentLedgerState(tx, rebuilt.document);
    if (state.unfinishedOperationId || state.outstanding.length > 0) {
      return "changed";
    }
    // Freeze what shipped on each line; receiving reads it back.
    for (const line of current.lineItems) {
      await tx.transferLineItem.update({
        where: { id: line.id },
        data: { pickedQty: transferShipQuantity(line) },
      });
    }
    await tx.transferOrder.update({
      where: { id: transfer.id },
      data: { status: "IN_TRANSIT", shippedAt: new Date() },
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
  return fail("Transfer not found");
}

/**
 * Add an in-transit transfer's shipped units at the destination and mark it
 * received. Safe to press again in the same way as shipping.
 */
export async function receiveTransfer(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  actor: InventoryActor,
  transferId: string,
  options: ExecuteInventoryOperationOptions = {},
): Promise<TransferMovementResult> {
  const transfer = await loadTransfer(db, transferId);
  if (!transfer) return fail("Transfer not found");
  if (transfer.status === "RECEIVED") return { ok: true, alreadyDone: true };
  if (transfer.status !== "IN_TRANSIT") {
    return fail("Only a transfer that is in transit can be received.");
  }
  if (transfer.shopifyTransferId) return fail(SHOPIFY_MANAGED_MESSAGE);
  if (!isSwitchedOn(options)) return fail(SWITCHED_OFF_MESSAGE);

  const shipment = await buildMovementDocument(db, transfer, "shipment");
  if (!shipment.ok) return fail(shipment.error);
  const shipped = await readDocumentLedgerState(db, shipment.document);
  if (shipped.unfinishedOperationId || shipped.outstanding.length > 0) {
    return fail(
      "ProPo has no complete record of this transfer leaving the source location, so it will not add stock at the destination.",
    );
  }

  const built = await buildMovementDocument(db, transfer, "receipt");
  if (!built.ok) return fail(built.error);

  const settled = await settle(
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
      `${describeUnsettled(settled.settle)} The transfer stays in transit.`,
      describeLineProblems(settled.settle.operation, built.lineByItem),
    );
  }

  const outcome = await db.$transaction(async (tx: TenantDb) => {
    if (!(await lockTransferIn(tx, transfer.id, "IN_TRANSIT"))) {
      return "not_in_transit";
    }
    const current = await loadTransfer(tx, transfer.id);
    const rebuilt =
      current && (await buildMovementDocument(tx, current, "receipt"));
    if (!current || !rebuilt || !rebuilt.ok) return "unsettled";
    const state = await readDocumentLedgerState(tx, rebuilt.document);
    if (state.unfinishedOperationId || state.outstanding.length > 0) {
      return "unsettled";
    }
    for (const line of current.lineItems) {
      await tx.transferLineItem.update({
        where: { id: line.id },
        data: { receivedQty: transferShipQuantity(line) },
      });
    }
    await tx.transferOrder.update({
      where: { id: transfer.id },
      data: { status: "RECEIVED", receivedAt: new Date() },
    });
    return "received";
  });

  if (outcome === "received") return { ok: true, alreadyDone: false };
  if (outcome === "unsettled") {
    return fail(
      "Shopify has not confirmed every change yet. Receive the transfer again in a moment.",
    );
  }
  const now = await loadTransfer(db, transfer.id);
  return now?.status === "RECEIVED"
    ? { ok: true, alreadyDone: true }
    : fail("Only a transfer that is in transit can be received.");
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
  options: ExecuteInventoryOperationOptions = {},
): Promise<TransferMovementResult> {
  const transfer = await loadTransfer(db, transferId);
  if (!transfer) return fail("Transfer not found");
  if (transfer.status === "IN_TRANSIT" || transfer.status === "RECEIVED") {
    return fail(
      "Only a draft transfer can be cancelled. This one has already shipped.",
    );
  }

  const pending = await returnShippedStock(db, admin, actor, transfer, options);
  if (pending) return pending;
  if (transfer.status === "CANCELLED") return { ok: true, alreadyDone: true };

  const outcome = await db.$transaction(async (tx: TenantDb) => {
    if (!(await lockTransferIn(tx, transfer.id, "DRAFT"))) return "not_draft";
    const state = await readDocumentLedgerState(
      tx,
      movementDocument(transfer, "cancellation", []),
    );
    if (state.unfinishedOperationId || state.outstanding.length > 0) {
      return "shipping";
    }
    await tx.transferOrder.update({
      where: { id: transfer.id },
      data: { status: "CANCELLED" },
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
