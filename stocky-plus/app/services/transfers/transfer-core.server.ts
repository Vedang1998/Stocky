import { isInventoryWriteEnabled } from "../../lib/feature-flags.server";
import type { TenantDb } from "../../tenant/tenant-db.server";
import type { AdminGraphQLClient } from "../shopify-gql.server";
import {
  InventoryDocumentClosedError,
  InventoryOperationConflictError,
  InventoryOperationValidationError,
} from "../inventory-writes/errors";
import type { ExecuteInventoryOperationOptions } from "../inventory-writes/execute.server";
import {
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
  transferShipQuantity,
  type TransferLineQuantities,
} from "./transfer-quantities";

/**
 * What the transfer services share: the transfer row and its lock, and the
 * two ledger documents a transfer is made of.
 *
 * `TransferShipment:<id>` is the net change at the source: the shipped units
 * leave, and units returned when a transfer is closed short come back.
 * `TransferReceipt:<id>` is the net change at the destination: every unit
 * received so far. Both are settled through the inventory ledger, so a
 * repeated or interrupted request sends only what Shopify has not confirmed.
 */

export type TransferStatus = "DRAFT" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";
export type TransferShortResolution = "RETURNED" | "WRITTEN_OFF";

export interface TransferLine extends TransferLineQuantities {
  id: string;
  shopifyVariantId: string;
  rejectNote: string | null;
}

export interface TransferWithLines {
  id: string;
  sourceLocationId: string;
  destinationLocationId: string;
  status: TransferStatus;
  shopifyTransferId: string | null;
  lineItems: TransferLine[];
}

export type TransferActionResult = { ok: true } | { ok: false; error: string };

export type TransferBlocker = "SOURCE_SHORT";

export type TransferMovementFailure = {
  ok: false;
  error: string;
  problems: DocumentLineProblem[];
  /** Set when the same request would go through with an explicit confirmation. */
  blocker: TransferBlocker | null;
};

export type TransferMovementResult =
  { ok: true; alreadyDone: boolean } | TransferMovementFailure;

export const TRANSFER_NOT_FOUND_MESSAGE = "Transfer not found";
export const LINE_NOT_FOUND_MESSAGE = "Transfer line not found";
export const NOT_DRAFT_MESSAGE =
  "This transfer has already been shipped or cancelled. Its lines can no longer be changed.";
export const NOT_IN_TRANSIT_MESSAGE =
  "Only a transfer that is in transit can be received.";
export const SWITCHED_OFF_MESSAGE =
  "Transfer inventory changes are switched off for this app. Nothing was sent to Shopify and the transfer was not changed.";
export const SHOPIFY_MANAGED_MESSAGE =
  "This transfer was shipped as a Shopify transfer. Receive it in Shopify admin; ProPo will not change stock for it.";
export const UNREADABLE_MESSAGE =
  "Shopify's current quantities could not be read. Nothing was sent to Shopify. Try again in a moment.";

export const fail = (
  error: string,
  problems: DocumentLineProblem[] = [],
  blocker: TransferBlocker | null = null,
): TransferMovementFailure => ({ ok: false, error, problems, blocker });

export function isSwitchedOn(
  options: ExecuteInventoryOperationOptions,
): boolean {
  return (options.isCapabilityEnabled ?? isInventoryWriteEnabled)(
    "transferWrites",
  );
}

/**
 * Hold the transfer row for the rest of the transaction, provided it is still
 * in `status`. Every step that changes a transfer or its lines takes this
 * lock first, so a line saved under it is seen by the step that moves the
 * transfer on.
 */
export async function lockTransferIn(
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

export async function loadTransfer(
  db: TenantDb,
  transferId: string,
): Promise<TransferWithLines | null> {
  return (await db.transferOrder.findFirst({
    where: { id: transferId },
    include: { lineItems: { orderBy: { id: "asc" } } },
  })) as TransferWithLines | null;
}

export type TransferLeg = "shipment" | "receipt";

const LEG_SOURCE_TYPE = {
  shipment: "TransferShipment",
  receipt: "TransferReceipt",
} as const;

export const TRANSFER_SOURCE_TYPES: readonly string[] =
  Object.values(LEG_SOURCE_TYPE);

/** Which leg of a transfer a ledger source type stands for; null for another module's source. */
export function transferLegOf(sourceType: string): TransferLeg | null {
  if (sourceType === LEG_SOURCE_TYPE.shipment) return "shipment";
  if (sourceType === LEG_SOURCE_TYPE.receipt) return "receipt";
  return null;
}

type TransferReason =
  "movement_created" | "movement_received" | "movement_canceled";

export type LineByItem = Map<
  string,
  { shopifyVariantId: string; title: string }
>;

export type BuiltDocument =
  | { ok: true; document: InventoryDocument; lineByItem: LineByItem }
  | { ok: false; error: string };

function transferDocument(
  transfer: { id: string },
  leg: TransferLeg,
  reason: TransferReason,
  desired: InventoryDocument["desired"],
): InventoryDocument {
  return {
    kind: "TRANSFER",
    source: { type: LEG_SOURCE_TYPE[leg], id: transfer.id },
    reason,
    quantityName: "available",
    referenceDocumentUri: `gid://propo/TransferOrder/${transfer.id}`,
    desired,
  };
}

/**
 * The shipment document with nothing left at all: settling it puts back
 * whatever the ledger shows as having left the source. Used when a transfer
 * that will not ship is cancelled.
 */
export function emptyShipmentDocument(transfer: {
  id: string;
}): InventoryDocument {
  return transferDocument(transfer, "shipment", "movement_canceled", []);
}

/**
 * One leg of a transfer as the net change it stands for, a relative change to
 * `available` so that sales made meanwhile are kept. `unitsOf` gives the
 * units of each line: units that left the source for a shipment, units that
 * arrived for a receipt. A line with no units is left out; if the ledger
 * already moved stock for it, settling the document puts that stock back.
 */
async function buildLegDocument(
  db: TenantDb,
  transfer: TransferWithLines,
  leg: TransferLeg,
  reason: TransferReason,
  unitsOf: (line: TransferLine) => number,
): Promise<BuiltDocument> {
  if (transfer.sourceLocationId === transfer.destinationLocationId) {
    return {
      ok: false,
      error: "This transfer has the same source and destination location.",
    };
  }
  const unitsByVariant = new Map<string, number>();
  for (const line of transfer.lineItems) {
    const units = unitsOf(line);
    if (units <= 0) continue;
    unitsByVariant.set(
      line.shopifyVariantId,
      (unitsByVariant.get(line.shopifyVariantId) ?? 0) + units,
    );
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

  const lineByItem: LineByItem = new Map();
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
        leg === "shipment"
          ? transfer.sourceLocationId
          : transfer.destinationLocationId,
      delta: leg === "shipment" ? -units : units,
      changeFromQuantity: null,
    };
  });

  return {
    ok: true,
    document: transferDocument(transfer, leg, reason, desired),
    lineByItem,
  };
}

/**
 * What a transfer has taken out of the source: the shipped units of every
 * line, less the units that went back there. `returning` gives the units of
 * each line a close-short is about to put back; without it the units each
 * line already records as returned are used.
 */
export async function buildShipmentDocument(
  db: TenantDb,
  transfer: TransferWithLines,
  returning?: (line: TransferLine) => number,
): Promise<BuiltDocument> {
  const built = await buildLegDocument(
    db,
    transfer,
    "shipment",
    returning ? "movement_canceled" : "movement_created",
    (line) =>
      transferShipQuantity(line) -
      (returning ? returning(line) : line.returnedQty),
  );
  if (built.ok && built.document.desired.length === 0 && !returning) {
    return { ok: false, error: "Transfer has no line items" };
  }
  return built;
}

/**
 * What a transfer has put into stock at the destination: the units already
 * received and the units counted in for the receipt being posted.
 */
export function buildReceiptDocument(
  db: TenantDb,
  transfer: TransferWithLines,
): Promise<BuiltDocument> {
  return buildLegDocument(
    db,
    transfer,
    "receipt",
    "movement_received",
    (line) => line.receivedQty + line.pendingReceiveQty,
  );
}

/** True when the ledger has applied exactly what the document asks for and nothing is in flight. */
export async function isSettled(
  db: TenantDb,
  document: InventoryDocument,
): Promise<boolean> {
  const state = await readDocumentLedgerState(db, document);
  return !state.unfinishedOperationId && state.outstanding.length === 0;
}

export type SettleOutcome =
  { ok: true; settle: SettleResult } | { ok: false; error: string };

/** Settle a leg's document, recording new operations only while the transfer is still in `whileIn`. */
export async function settleTransferDocument(
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
