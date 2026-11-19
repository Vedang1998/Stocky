/**
 * Receiving deliveries against a purchase order.
 *
 * A receipt is recorded first, then its accepted units go to Shopify through
 * the inventory operation ledger, and only the lines Shopify confirms are
 * counted on the purchase order. A receipt whose stock change is unconfirmed
 * stays PENDING and is finished by calling resumePurchaseOrderReceipt; it is
 * never shown as received. Rules: docs/purchasing/PURCHASING_LEDGER.md.
 */
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { isInventoryWriteEnabled } from "../../lib/feature-flags.server";
import { RECEIVING_OFF_MESSAGE } from "../../lib/po-display";
import {
  receivingDenial,
  statusAfterReceiving,
  STATUS_LABELS,
  type PurchaseOrderStatus,
} from "../../lib/purchasing/status";
import type { FieldErrors } from "../../lib/purchasing/form-input";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { STAFF_REQUIRED_MESSAGE } from "../inventory-writes/actor.server";
import { InventoryOperationValidationError } from "../inventory-writes/errors";
import {
  executeInventoryOperation,
  type ExecuteInventoryOperationOptions,
} from "../inventory-writes/execute.server";
import {
  recordInventoryOperation,
  recordInventoryReversal,
} from "../inventory-writes/ledger.server";
import {
  TERMINAL_OPERATION_STATUSES,
  type InventoryActor,
  type InventoryActorChannel,
  type InventoryOperationLineResult,
  type InventoryOperationResult,
} from "../inventory-writes/types";
import type { AdminGraphQLClient } from "../shopify-gql.server";
import type { PurchasingActor } from "./actor.server";
import {
  invalidInput,
  isUniqueViolation,
  notFound,
  PurchasingError,
} from "./errors";
import { recordPurchasingEvent } from "./events.server";
import { listLocations } from "./locations.server";
import {
  lifecycleStateOf,
  loadPurchaseOrder,
  lockPurchaseOrder,
  remainingQuantity,
  type PurchaseOrderLineRecord,
  type PurchaseOrderRecord,
} from "./purchase-order-records.server";
import {
  isVariantGid,
  resolveVariants,
  variantDisplayName,
} from "./variants.server";

export const MAX_RECEIPT_LINES = 1000;
export const MAX_RECEIPT_QUANTITY = 1_000_000;

const RECEIPT_KEY = /^[A-Za-z0-9][A-Za-z0-9:._-]{7,127}$/;
const LEAD_TIME_WINDOW_DAYS = 90;
const MS_PER_DAY = 86_400_000;

const REVERSAL_OFF_MESSAGE =
  "Receiving is turned off for this store, so the receipt was not reversed and no stock changed.";

const RECEIPT_INCLUDE = {
  lines: { orderBy: [{ position: "asc" }, { id: "asc" }] },
} satisfies Prisma.PurchaseOrderReceiptInclude;

type ReceiptRecord = Prisma.PurchaseOrderReceiptGetPayload<{
  include: typeof RECEIPT_INCLUDE;
}>;
type ReceiptLineRecord = ReceiptRecord["lines"][number];
export type PurchaseOrderReceiptStatus = ReceiptRecord["status"];

export type ReceiptLineInput = {
  /** Purchase-order line the units belong to. */
  lineItemId: string;
  /** Units put into stock. */
  acceptedQty: number;
  /** Units refused at the door; recorded, never stocked. */
  rejectedQty?: number;
  rejectReason?: string | null;
};

export type PostReceiptInput = {
  purchaseOrderId: string;
  /**
   * Chosen once per submission by the screen that receives (a UUID). Sending
   * the same key again returns the receipt already recorded instead of
   * receiving twice.
   */
  idempotencyKey: string;
  lines: readonly ReceiptLineInput[];
  /** Packing slip or delivery note number. */
  supplierReference?: string | null;
  note?: string | null;
  /** Accept more units than a line still expects. */
  allowOverReceipt?: boolean;
};

export type ReceiptLineView = {
  id: string;
  lineItemId: string;
  shopifyVariantId: string;
  acceptedQty: number;
  rejectedQty: number;
  rejectReason: string | null;
  /** Accepted units Shopify confirmed; these count as received. */
  postedQty: number;
  reversedQty: number;
  errorMessage: string | null;
};

export type ReceiptView = {
  id: string;
  purchaseOrderId: string;
  receiptNumber: number;
  status: PurchaseOrderReceiptStatus;
  locationGid: string;
  supplierReference: string | null;
  note: string | null;
  actorChannel: string;
  actorUserId: string | null;
  failureMessage: string | null;
  createdAt: Date;
  postedAt: Date | null;
  reversedAt: Date | null;
  lines: ReceiptLineView[];
};

export type ReceivingResult = {
  /**
   * True only when the action asked for is finished: every accepted unit is in
   * Shopify and counted (receive), or every posted unit is back out (reverse).
   */
  complete: boolean;
  /** What to tell the person who pressed the button. */
  message: string;
  /** Null when receiving is switched off and nothing was recorded. */
  receipt: ReceiptView | null;
};

export type ReceivableLine = {
  lineItemId: string;
  shopifyVariantId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  orderedQty: number;
  cancelledQty: number;
  receivedQty: number;
  /** Accepted on receipts Shopify has not confirmed yet. */
  pendingQty: number;
  rejectedQty: number;
  /** Units a new receipt can accept without confirming an over-receipt. */
  openQty: number;
};

export type ReceivingWorksheet = {
  purchaseOrderId: string;
  status: PurchaseOrderStatus;
  locationGid: string;
  /** Why nothing can be received right now, or null when receiving is open. */
  denial: string | null;
  lines: ReceivableLine[];
};

type NormalizedLine = {
  lineItemId: string;
  acceptedQty: number;
  rejectedQty: number;
  rejectReason: string | null;
};

type NormalizedReceipt = {
  purchaseOrderId: string;
  idempotencyKey: string;
  lines: NormalizedLine[];
  supplierReference: string | null;
  note: string | null;
  allowOverReceipt: boolean;
  digest: string;
};

const units = (count: number) => `${count} ${count === 1 ? "unit" : "units"}`;

const sum = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0);

function isSwitchedOn(options: ExecuteInventoryOperationOptions): boolean {
  return (options.isCapabilityEnabled ?? isInventoryWriteEnabled)(
    "receiptWrites",
  );
}

function optionalText(
  value: string | null | undefined,
  max: number,
  label: string,
): string | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "") return null;
  if (trimmed.length > max) {
    throw invalidInput(`${label} must be at most ${max} characters.`);
  }
  return trimmed;
}

function isQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_RECEIPT_QUANTITY
  );
}

const lineField = (lineItemId: string) => `line:${lineItemId}`;

/**
 * Validate a submission and drop the lines nothing arrived for. The digest
 * covers what the receipt does to stock and to the order, so a retry is the
 * same receipt and anything else under the same key is refused.
 */
function normalizeReceipt(input: PostReceiptInput): NormalizedReceipt {
  if (
    typeof input.purchaseOrderId !== "string" ||
    input.purchaseOrderId.length === 0 ||
    input.purchaseOrderId.length > 64
  ) {
    throw notFound("Purchase order");
  }
  if (
    typeof input.idempotencyKey !== "string" ||
    !RECEIPT_KEY.test(input.idempotencyKey)
  ) {
    throw invalidInput(
      "This receiving form has expired. Reload the page and try again.",
    );
  }
  if (!Array.isArray(input.lines) || input.lines.length > MAX_RECEIPT_LINES) {
    throw invalidInput(
      `A receipt can carry at most ${MAX_RECEIPT_LINES} lines.`,
    );
  }

  const fieldErrors: FieldErrors = {};
  const seen = new Set<string>();
  const lines: NormalizedLine[] = [];
  for (const line of input.lines) {
    if (
      typeof line?.lineItemId !== "string" ||
      line.lineItemId.length === 0 ||
      line.lineItemId.length > 64
    ) {
      throw invalidInput("A line on this receipt is not on the purchase order.");
    }
    const field = lineField(line.lineItemId);
    const rejectedQty = line.rejectedQty ?? 0;
    if (!isQuantity(line.acceptedQty) || !isQuantity(rejectedQty)) {
      fieldErrors[field] =
        `Quantities must be whole numbers from 0 to ${MAX_RECEIPT_QUANTITY}.`;
      continue;
    }
    if (seen.has(line.lineItemId)) {
      fieldErrors[field] = "This line appears twice on the receipt.";
      continue;
    }
    seen.add(line.lineItemId);
    if (line.acceptedQty === 0 && rejectedQty === 0) continue;
    lines.push({
      lineItemId: line.lineItemId,
      acceptedQty: line.acceptedQty,
      rejectedQty,
      rejectReason:
        rejectedQty > 0
          ? optionalText(line.rejectReason, 255, "Reject reason")
          : null,
    });
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw invalidInput("Fix the highlighted quantities.", fieldErrors);
  }
  if (lines.length === 0) {
    throw invalidInput("Enter a quantity for at least one line.");
  }

  const allowOverReceipt = input.allowOverReceipt === true;
  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        "purchase-order-receipt-v1",
        input.purchaseOrderId,
        allowOverReceipt,
        [...lines]
          .sort((a, b) => a.lineItemId.localeCompare(b.lineItemId))
          .map((line) => [
            line.lineItemId,
            line.acceptedQty,
            line.rejectedQty,
            line.rejectReason,
          ]),
      ]),
      "utf8",
    )
    .digest("hex");

  return {
    purchaseOrderId: input.purchaseOrderId,
    idempotencyKey: input.idempotencyKey,
    lines,
    supplierReference: optionalText(
      input.supplierReference,
      128,
      "Delivery reference",
    ),
    note: optionalText(input.note, 2000, "Note"),
    allowOverReceipt,
    digest,
  };
}

function assertStaffActor(actor: InventoryActor): void {
  if (actor.channel !== "SYSTEM" && !actor.shopifyUserId) {
    throw new PurchasingError("invalid_state", STAFF_REQUIRED_MESSAGE);
  }
}

async function loadReceipt(
  db: TenantDb,
  receiptId: string,
): Promise<ReceiptRecord> {
  const receipt: ReceiptRecord | null = await db.purchaseOrderReceipt.findFirst(
    { where: { id: receiptId }, include: RECEIPT_INCLUDE },
  );
  if (!receipt) throw notFound("Receipt");
  return receipt;
}

async function findReceiptByKey(
  db: TenantDb,
  idempotencyKey: string,
): Promise<{ id: string; payloadDigest: string } | null> {
  return db.purchaseOrderReceipt.findFirst({
    where: { idempotencyKey },
    select: { id: true, payloadDigest: true },
  });
}

function assertSameSubmission(
  existing: { payloadDigest: string },
  draft: NormalizedReceipt,
): void {
  if (existing.payloadDigest !== draft.digest) {
    throw new PurchasingError(
      "conflict",
      "This receiving form was already submitted with different quantities. Reload the page to see what was received.",
    );
  }
}

/**
 * Per purchase-order line: units accepted on receipts Shopify has not
 * confirmed yet, and units rejected on receipts that stand.
 */
async function receiptQuantitiesByLine(
  db: TenantDb,
  purchaseOrderId: string,
): Promise<{ pending: Map<string, number>; rejected: Map<string, number> }> {
  const receipts: Array<{
    status: PurchaseOrderReceiptStatus;
    lines: Array<{
      lineItemId: string;
      acceptedQty: number;
      rejectedQty: number;
    }>;
  }> = await db.purchaseOrderReceipt.findMany({
    where: { purchaseOrderId, status: { notIn: ["FAILED", "REVERSED"] } },
    select: {
      status: true,
      lines: {
        select: { lineItemId: true, acceptedQty: true, rejectedQty: true },
      },
    },
  });
  const pending = new Map<string, number>();
  const rejected = new Map<string, number>();
  const add = (totals: Map<string, number>, key: string, quantity: number) => {
    if (quantity > 0) totals.set(key, (totals.get(key) ?? 0) + quantity);
  };
  for (const receipt of receipts) {
    for (const line of receipt.lines) {
      if (receipt.status === "PENDING") {
        add(pending, line.lineItemId, line.acceptedQty);
      } else {
        add(rejected, line.lineItemId, line.rejectedQty);
      }
    }
  }
  return { pending, rejected };
}

/**
 * Inventory item for each line that will put stock away: the one captured
 * when the line was added, or the catalog's current one for older lines.
 */
async function inventoryItemsFor(
  tx: TenantDb,
  lines: readonly PurchaseOrderLineRecord[],
): Promise<Map<string, string>> {
  const items = new Map<string, string>();
  const unresolved: PurchaseOrderLineRecord[] = [];
  for (const line of lines) {
    if (line.inventoryItemGid) items.set(line.id, line.inventoryItemGid);
    else unresolved.push(line);
  }
  const lookups = unresolved.filter((line) =>
    isVariantGid(line.shopifyVariantId),
  );
  if (lookups.length > 0) {
    const variants = await resolveVariants(
      tx,
      lookups.map((line) => line.shopifyVariantId),
    );
    for (const line of lookups) {
      const gid = variants.get(line.shopifyVariantId)?.inventoryItemGid;
      if (gid) items.set(line.id, gid);
    }
  }
  return items;
}

/** Stock can only be put away at a location Shopify still has open. */
async function assertDestinationOpen(
  tx: TenantDb,
  locationGid: string,
): Promise<void> {
  const destination = (await listLocations(tx)).find(
    (location) => location.gid === locationGid,
  );
  if (!destination) {
    throw new PurchasingError(
      "invalid_state",
      "The destination of this purchase order is not a location ProPo has synced from Shopify. Sync the catalog and try again.",
    );
  }
  if (!destination.isActive) {
    throw new PurchasingError(
      "invalid_state",
      `${destination.name} is deactivated in Shopify, so stock cannot be received there. Reactivate the location in Shopify and try again.`,
    );
  }
}

/**
 * Record the receipt and its lines under the purchase order's row lock, so two
 * deliveries are never measured against the same open quantity. Nothing is
 * counted as received here.
 */
async function recordReceipt(
  db: TenantDb,
  actor: InventoryActor,
  draft: NormalizedReceipt,
): Promise<string> {
  return db.$transaction(async (tx) => {
    const po = await lockPurchaseOrder(tx, draft.purchaseOrderId);
    // The same submission may have been recorded while this one waited for
    // the lock; its units must not be measured against themselves.
    const duplicate = await findReceiptByKey(tx, draft.idempotencyKey);
    if (duplicate) {
      assertSameSubmission(duplicate, draft);
      return duplicate.id;
    }
    const denial = receivingDenial(lifecycleStateOf(po));
    if (denial) throw new PurchasingError("invalid_state", denial);
    if (draft.lines.some((line) => line.acceptedQty > 0)) {
      await assertDestinationOpen(tx, po.locationId);
    }

    const poLines = new Map(po.lineItems.map((line) => [line.id, line]));
    const { pending } = await receiptQuantitiesByLine(tx, po.id);
    const stocked = draft.lines.flatMap((line) => {
      const poLine = poLines.get(line.lineItemId);
      return poLine && line.acceptedQty > 0 ? [poLine] : [];
    });
    const inventoryItems = await inventoryItemsFor(tx, stocked);

    const fieldErrors: FieldErrors = {};
    for (const line of draft.lines) {
      const poLine = poLines.get(line.lineItemId);
      if (!poLine) {
        throw invalidInput(
          "A line on this receipt is no longer on the purchase order. Reload the page and try again.",
        );
      }
      const open = Math.max(
        0,
        remainingQuantity(poLine) - (pending.get(poLine.id) ?? 0),
      );
      if (line.acceptedQty > open && !draft.allowOverReceipt) {
        fieldErrors[lineField(poLine.id)] =
          open === 0
            ? "Nothing more is expected on this line. Confirm the extra units to receive them anyway."
            : `Only ${units(open)} more expected. Confirm the extra units to receive them anyway.`;
      } else if (line.acceptedQty > 0 && !inventoryItems.has(poLine.id)) {
        fieldErrors[lineField(poLine.id)] =
          "Shopify does not track stock for this product yet. Sync the catalog and try again.";
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      throw invalidInput("Fix the highlighted lines.", fieldErrors);
    }

    const last: { receiptNumber: number } | null =
      await tx.purchaseOrderReceipt.findFirst({
        where: { purchaseOrderId: po.id },
        orderBy: { receiptNumber: "desc" },
        select: { receiptNumber: true },
      });
    const receipt: { id: string } = await tx.purchaseOrderReceipt.create({
      data: {
        purchaseOrderId: po.id,
        receiptNumber: (last?.receiptNumber ?? 0) + 1,
        idempotencyKey: draft.idempotencyKey,
        payloadDigest: draft.digest,
        locationGid: po.locationId,
        supplierReference: draft.supplierReference,
        note: draft.note,
        actorChannel: actor.channel,
        actorUserId: actor.shopifyUserId,
        lines: {
          create: draft.lines.map((line, position) => {
            const poLine = poLines.get(line.lineItemId)!;
            return {
              lineItemId: poLine.id,
              shopifyVariantId: poLine.shopifyVariantId,
              inventoryItemGid: inventoryItems.get(poLine.id) ?? null,
              position,
              acceptedQty: line.acceptedQty,
              rejectedQty: line.rejectedQty,
              rejectReason: line.rejectReason,
            };
          }),
        },
      },
      select: { id: true },
    });
    return receipt.id;
  });
}

function recordedActor(receipt: ReceiptRecord): InventoryActor {
  return {
    shopifyUserId: receipt.actorUserId,
    displayName: null,
    channel: receipt.actorChannel as InventoryActorChannel,
  };
}

function eventActor(actor: InventoryActor): PurchasingActor {
  return actor.channel === "SYSTEM"
    ? { type: "SYSTEM", id: "receiving" }
    : { type: "STAFF", id: actor.shopifyUserId };
}

/**
 * The ledger takes one change per inventory item and location, so receipt
 * lines for the same item are sent as one change.
 */
function stockChanges(receipt: ReceiptRecord) {
  const byItem = new Map<
    string,
    { inventoryItemId: string; variantId: string | null; delta: number }
  >();
  for (const line of receipt.lines) {
    if (line.acceptedQty === 0 || !line.inventoryItemGid) continue;
    const change = byItem.get(line.inventoryItemGid);
    if (change) {
      change.delta += line.acceptedQty;
    } else {
      byItem.set(line.inventoryItemGid, {
        inventoryItemId: line.inventoryItemGid,
        variantId: isVariantGid(line.shopifyVariantId)
          ? line.shopifyVariantId
          : null,
        delta: line.acceptedQty,
      });
    }
  }
  return [...byItem.values()].map((change) => ({
    ...change,
    locationId: receipt.locationGid,
    changeFromQuantity: null,
  }));
}

/** What became of a receipt's or a reversal's stock change. */
type StockOutcome = {
  operationId: string | null;
  /** Ledger line results by inventory item; empty when nothing was sent. */
  lines: Map<string, InventoryOperationLineResult>;
  failureCode: string | null;
  failureMessage: string | null;
};

/** A receipt or reversal that moves no stock settles without the ledger. */
const NO_STOCK_CHANGE: StockOutcome = {
  operationId: null,
  lines: new Map(),
  failureCode: null,
  failureMessage: null,
};

function finishedOutcome(result: InventoryOperationResult): StockOutcome {
  const refused = result.lines.find(
    (line) => line.status !== "APPLIED" && line.errorMessage,
  );
  return {
    operationId: result.operationId,
    lines: new Map(result.lines.map((line) => [line.inventoryItemId, line])),
    failureCode: refused?.errorCode ?? result.lastErrorCode ?? "NOT_APPLIED",
    failureMessage: refused?.errorMessage ?? result.lastErrorMessage,
  };
}

/** The ledger refused the change before anything was sent to Shopify. */
function refusedOutcome(error: InventoryOperationValidationError): StockOutcome {
  return {
    operationId: null,
    lines: new Map(),
    failureCode: error.code,
    failureMessage: error.message,
  };
}

const clip = (message: string | null) => message?.slice(0, 1000) ?? null;

async function noteUnfinished(
  db: TenantDb,
  receipt: ReceiptRecord,
  code: string,
  message: string | null,
): Promise<void> {
  await db.purchaseOrderReceipt.updateMany({
    where: { id: receipt.id, status: receipt.status },
    data: { failureCode: code, failureMessage: clip(message) },
  });
}

/**
 * Record or drop the supplier's measured lead time when the order becomes, or
 * stops being, fully received, and refresh the supplier's rolling average.
 */
async function syncLeadTime(
  tx: TenantDb,
  po: PurchaseOrderRecord,
  fullyReceivedAt: Date | null,
): Promise<void> {
  const placedAt = po.orderedAt ?? po.sentAt;
  const existing: { id: string } | null = await tx.leadTimeSnapshot.findFirst({
    where: { purchaseOrderId: po.id },
    select: { id: true },
  });
  if (fullyReceivedAt) {
    if (!placedAt) return;
    const leadTimeDays = Math.max(
      0,
      (fullyReceivedAt.getTime() - placedAt.getTime()) / MS_PER_DAY,
    );
    if (existing) {
      await tx.leadTimeSnapshot.update({
        where: { id: existing.id },
        data: { leadTimeDays, recordedAt: fullyReceivedAt },
      });
    } else {
      await tx.leadTimeSnapshot.create({
        data: {
          supplierId: po.supplierId,
          purchaseOrderId: po.id,
          leadTimeDays,
          recordedAt: fullyReceivedAt,
        },
      });
    }
  } else {
    if (!existing) return;
    await tx.leadTimeSnapshot.delete({ where: { id: existing.id } });
  }

  const recent: Array<{ leadTimeDays: number }> =
    await tx.leadTimeSnapshot.findMany({
      where: {
        supplierId: po.supplierId,
        recordedAt: {
          gte: new Date(Date.now() - LEAD_TIME_WINDOW_DAYS * MS_PER_DAY),
        },
      },
      select: { leadTimeDays: true },
    });
  await tx.supplier.update({
    where: { id: po.supplierId },
    data: {
      leadTimeDays:
        recent.length > 0
          ? sum(recent.map((snapshot) => snapshot.leadTimeDays)) / recent.length
          : null,
    },
  });
}

/**
 * Move the order to the status its received quantities now imply. Runs inside
 * the settling transaction, after the lines were updated.
 */
async function refreshPurchaseOrderStatus(
  tx: TenantDb,
  purchaseOrderId: string,
  now: Date,
): Promise<{ from: PurchaseOrderStatus; to: PurchaseOrderStatus }> {
  const po = await loadPurchaseOrder(tx, purchaseOrderId);
  const to = statusAfterReceiving(
    po.status,
    po.lineItems,
    po.orderedAt !== null,
  );
  if (to === po.status) return { from: po.status, to };

  const fullyReceivedAt = to === "RECEIVED" ? now : null;
  await tx.purchaseOrder.update({
    where: { id: po.id },
    data: { status: to, fullyReceivedAt },
  });
  if (to === "RECEIVED" || po.status === "RECEIVED") {
    await syncLeadTime(tx, po, fullyReceivedAt);
  }
  return { from: po.status, to };
}

/**
 * Count what Shopify confirmed. The receipt is claimed out of PENDING first,
 * so a second settle of the same receipt does nothing.
 */
async function settleReceipt(
  db: TenantDb,
  receipt: ReceiptRecord,
  outcome: StockOutcome,
): Promise<void> {
  const settled = receipt.lines.map((line) => {
    const sent = line.inventoryItemGid
      ? outcome.lines.get(line.inventoryItemGid)
      : undefined;
    const applied = line.acceptedQty > 0 && sent?.status === "APPLIED";
    return {
      line,
      postedQty: applied ? line.acceptedQty : 0,
      errorCode: applied ? null : (sent?.errorCode ?? null),
      errorMessage: applied ? null : (sent?.errorMessage ?? null),
    };
  });
  const acceptedUnits = sum(receipt.lines.map((line) => line.acceptedQty));
  const postedUnits = sum(settled.map((entry) => entry.postedQty));
  const status: PurchaseOrderReceiptStatus =
    postedUnits === acceptedUnits
      ? "POSTED"
      : postedUnits > 0
        ? "PARTIALLY_POSTED"
        : "FAILED";
  const complete = status === "POSTED";

  await db.$transaction(async (tx) => {
    await lockPurchaseOrder(tx, receipt.purchaseOrderId);
    const now = new Date();
    const claimed: { count: number } = await tx.purchaseOrderReceipt.updateMany(
      {
        where: { id: receipt.id, status: "PENDING" },
        data: {
          status,
          postedAt: status === "FAILED" ? null : now,
          failureCode: complete ? null : outcome.failureCode,
          failureMessage: complete ? null : clip(outcome.failureMessage),
        },
      },
    );
    if (claimed.count === 0) return;

    for (const entry of settled) {
      if (entry.line.acceptedQty === 0) continue;
      await tx.purchaseOrderReceiptLine.update({
        where: { id: entry.line.id },
        data: {
          postedQty: entry.postedQty,
          errorCode: entry.errorCode,
          errorMessage: clip(entry.errorMessage),
        },
      });
      if (entry.postedQty > 0) {
        await tx.pOLineItem.update({
          where: { id: entry.line.lineItemId },
          data: { receivedQty: { increment: entry.postedQty } },
        });
      }
    }

    const moved = await refreshPurchaseOrderStatus(
      tx,
      receipt.purchaseOrderId,
      now,
    );
    await recordPurchasingEvent(tx, {
      subjectType: "PURCHASE_ORDER",
      subjectId: receipt.purchaseOrderId,
      action:
        status === "FAILED"
          ? "purchase_order.receipt_failed"
          : "purchase_order.received",
      actor: eventActor(recordedActor(receipt)),
      details: {
        receiptId: receipt.id,
        receiptNumber: receipt.receiptNumber,
        receiptStatus: status,
        channel: receipt.actorChannel,
        acceptedUnits,
        postedUnits,
        rejectedUnits: sum(receipt.lines.map((line) => line.rejectedQty)),
        inventoryOperationId: outcome.operationId,
        fromStatus: moved.from,
        toStatus: moved.to,
      },
    });
  });
}

/** Take back out of the order what Shopify confirmed leaving stock. */
async function settleReversal(
  db: TenantDb,
  receipt: ReceiptRecord,
  outcome: StockOutcome,
): Promise<void> {
  const settled = receipt.lines
    .filter((line) => line.postedQty > 0)
    .map((line) => {
      const sent = outcome.lines.get(line.inventoryItemGid!);
      const reversed = sent?.status === "APPLIED";
      return {
        line,
        reversedQty: reversed ? line.postedQty : 0,
        errorCode: reversed ? null : (sent?.errorCode ?? null),
        errorMessage: reversed ? null : (sent?.errorMessage ?? null),
      };
    });
  const postedUnits = sum(settled.map((entry) => entry.line.postedQty));
  const reversedUnits = sum(settled.map((entry) => entry.reversedQty));
  const status: PurchaseOrderReceiptStatus =
    reversedUnits === postedUnits
      ? "REVERSED"
      : reversedUnits > 0
        ? "PARTIALLY_REVERSED"
        : "REVERSAL_FAILED";
  const complete = status === "REVERSED";

  await db.$transaction(async (tx) => {
    const po = await lockPurchaseOrder(tx, receipt.purchaseOrderId);
    const now = new Date();
    const claimed: { count: number } = await tx.purchaseOrderReceipt.updateMany(
      {
        where: { id: receipt.id, status: "REVERSING" },
        data: {
          status,
          reversedAt: status === "REVERSAL_FAILED" ? null : now,
          failureCode: complete ? null : outcome.failureCode,
          failureMessage: complete ? null : clip(outcome.failureMessage),
        },
      },
    );
    if (claimed.count === 0) return;

    const poLines = new Map(po.lineItems.map((line) => [line.id, line]));
    for (const entry of settled) {
      await tx.purchaseOrderReceiptLine.update({
        where: { id: entry.line.id },
        data: {
          reversedQty: entry.reversedQty,
          errorCode: entry.errorCode,
          errorMessage: clip(entry.errorMessage),
        },
      });
      const poLine = poLines.get(entry.line.lineItemId);
      if (entry.reversedQty > 0 && poLine) {
        const receivedQty = Math.max(0, poLine.receivedQty - entry.reversedQty);
        poLine.receivedQty = receivedQty;
        await tx.pOLineItem.update({
          where: { id: poLine.id },
          data: { receivedQty },
        });
      }
    }

    const moved = await refreshPurchaseOrderStatus(
      tx,
      receipt.purchaseOrderId,
      now,
    );
    await recordPurchasingEvent(tx, {
      subjectType: "PURCHASE_ORDER",
      subjectId: receipt.purchaseOrderId,
      action:
        status === "REVERSAL_FAILED"
          ? "purchase_order.receipt_reversal_failed"
          : "purchase_order.receipt_reversed",
      actor: receipt.reversedByUserId
        ? { type: "STAFF", id: receipt.reversedByUserId }
        : { type: "SYSTEM", id: "receiving" },
      details: {
        receiptId: receipt.id,
        receiptNumber: receipt.receiptNumber,
        receiptStatus: status,
        postedUnits,
        reversedUnits,
        inventoryOperationId: outcome.operationId,
        fromStatus: moved.from,
        toStatus: moved.to,
      },
    });
  });
}

/**
 * Carry a PENDING receipt or a REVERSING one as far as Shopify allows on this
 * call. Safe to call again at any point: the ledger operation is found by its
 * key, an unconfirmed request is resent unchanged, and settling claims the
 * receipt before it counts anything.
 */
async function advanceReceipt(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  receiptId: string,
  options: ExecuteInventoryOperationOptions,
): Promise<ReceiptRecord> {
  const receipt = await loadReceipt(db, receiptId);
  if (receipt.status !== "PENDING" && receipt.status !== "REVERSING") {
    return receipt;
  }
  const reversing = receipt.status === "REVERSING";
  const settle = reversing ? settleReversal : settleReceipt;
  const movesStock = reversing
    ? receipt.lines.some((line) => line.postedQty > 0)
    : receipt.lines.some((line) => line.acceptedQty > 0);

  if (!movesStock) {
    await settle(db, receipt, NO_STOCK_CHANGE);
    return loadReceipt(db, receiptId);
  }
  if (!isSwitchedOn(options)) {
    await noteUnfinished(
      db,
      receipt,
      "RECEIVING_OFF",
      reversing ? REVERSAL_OFF_MESSAGE : RECEIVING_OFF_MESSAGE,
    );
    return loadReceipt(db, receiptId);
  }

  let operationId = reversing
    ? receipt.reversalOperationId
    : receipt.inventoryOperationId;
  if (!operationId) {
    try {
      const { operation } = reversing
        ? await recordInventoryReversal(db, {
            operationId: receipt.inventoryOperationId!,
            actor: {
              shopifyUserId: receipt.reversedByUserId,
              displayName: null,
              channel: receipt.reversedByUserId ? "ADMIN" : "SYSTEM",
            },
            note: receipt.reversalNote,
          })
        : await recordInventoryOperation(db, {
            kind: "RECEIPT",
            idempotencyKey: `po-receipt:${receipt.id}`,
            source: { type: "PurchaseOrderReceipt", id: receipt.id },
            reason: "received",
            quantityName: "available",
            referenceDocumentUri: `gid://propo/PurchaseOrderReceipt/${receipt.id}`,
            actor: recordedActor(receipt),
            note: receipt.note,
            lines: stockChanges(receipt),
          });
      operationId = operation.id;
    } catch (error) {
      if (!(error instanceof InventoryOperationValidationError)) throw error;
      await settle(db, receipt, refusedOutcome(error));
      return loadReceipt(db, receiptId);
    }
    await db.purchaseOrderReceipt.updateMany({
      where: { id: receipt.id },
      data: reversing
        ? { reversalOperationId: operationId }
        : { inventoryOperationId: operationId },
    });
  }

  const result = await executeInventoryOperation(
    db,
    admin,
    operationId,
    options,
  );
  if (TERMINAL_OPERATION_STATUSES.has(result.status)) {
    await settle(db, receipt, finishedOutcome(result));
  } else {
    await noteUnfinished(
      db,
      receipt,
      result.lastErrorCode ?? "UNCONFIRMED",
      result.lastErrorMessage,
    );
  }
  return loadReceipt(db, receiptId);
}

function toView(receipt: ReceiptRecord): ReceiptView {
  return {
    id: receipt.id,
    purchaseOrderId: receipt.purchaseOrderId,
    receiptNumber: receipt.receiptNumber,
    status: receipt.status,
    locationGid: receipt.locationGid,
    supplierReference: receipt.supplierReference,
    note: receipt.note,
    actorChannel: receipt.actorChannel,
    actorUserId: receipt.actorUserId,
    failureMessage: receipt.failureMessage,
    createdAt: receipt.createdAt,
    postedAt: receipt.postedAt,
    reversedAt: receipt.reversedAt,
    lines: receipt.lines.map((line: ReceiptLineRecord) => ({
      id: line.id,
      lineItemId: line.lineItemId,
      shopifyVariantId: line.shopifyVariantId,
      acceptedQty: line.acceptedQty,
      rejectedQty: line.rejectedQty,
      rejectReason: line.rejectReason,
      postedQty: line.postedQty,
      reversedQty: line.reversedQty,
      errorMessage: line.errorMessage,
    })),
  };
}

function describe(receipt: ReceiptRecord): string {
  const name = `Receipt ${receipt.receiptNumber}`;
  const posted = sum(receipt.lines.map((line) => line.postedQty));
  const rejected = sum(receipt.lines.map((line) => line.rejectedQty));
  const reason = receipt.failureMessage ? ` ${receipt.failureMessage}` : "";
  switch (receipt.status) {
    case "POSTED":
      if (posted === 0) {
        return `${name}: ${units(rejected)} rejected. No stock changed.`;
      }
      return rejected > 0
        ? `${name}: ${units(posted)} received and ${units(rejected)} rejected.`
        : `${name}: ${units(posted)} received.`;
    case "PARTIALLY_POSTED":
      return `${name}: ${units(posted)} received. Shopify refused the other lines, so they are not counted as received.${reason}`;
    case "FAILED":
      return `${name}: nothing was received and no stock changed.${reason}`;
    case "PENDING":
      return receipt.failureCode === "RECEIVING_OFF"
        ? `${name} is saved, but receiving is turned off for this store, so no stock changed and nothing is counted as received yet.`
        : `${name} is saved, but Shopify has not confirmed the stock change yet, so nothing is counted as received. Retry it in a moment.`;
    case "REVERSING":
      return receipt.failureCode === "RECEIVING_OFF"
        ? REVERSAL_OFF_MESSAGE
        : `Shopify has not confirmed the reversal of ${name.toLowerCase()} yet, so it still counts as received. Retry it in a moment.`;
    case "REVERSED":
      return posted > 0
        ? `${name} was reversed and ${units(posted)} taken back out of stock.`
        : `${name} was reversed.`;
    case "PARTIALLY_REVERSED":
      return `${name}: Shopify refused to take some lines back out of stock, so they still count as received.${reason}`;
    case "REVERSAL_FAILED":
      return `${name} could not be reversed and no stock changed.${reason}`;
  }
}

function toResult(
  receipt: ReceiptRecord,
  finished: PurchaseOrderReceiptStatus,
): ReceivingResult {
  return {
    complete: receipt.status === finished,
    message: describe(receipt),
    receipt: toView(receipt),
  };
}

/**
 * Receive a delivery. Accepted units are added to `available` at the purchase
 * order's destination through the inventory ledger and counted on the order
 * only once Shopify confirms them; rejected units are recorded and never
 * stocked.
 *
 * Returns `complete: false` with a message when receiving is switched off
 * (nothing is recorded), when Shopify has not answered yet (the receipt stays
 * PENDING: call resumePurchaseOrderReceipt), or when Shopify refused lines.
 * Throws PurchasingError for input the merchant can correct.
 */
export async function postPurchaseOrderReceipt(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  actor: InventoryActor,
  input: PostReceiptInput,
  options: ExecuteInventoryOperationOptions = {},
): Promise<ReceivingResult> {
  const draft = normalizeReceipt(input);

  let receiptId: string;
  const existing = await findReceiptByKey(db, draft.idempotencyKey);
  if (existing) {
    assertSameSubmission(existing, draft);
    receiptId = existing.id;
  } else {
    if (!isSwitchedOn(options)) {
      return { complete: false, message: RECEIVING_OFF_MESSAGE, receipt: null };
    }
    assertStaffActor(actor);
    try {
      receiptId = await recordReceipt(db, actor, draft);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // The same submission arrived twice at once; the other request won.
      const winner = await findReceiptByKey(db, draft.idempotencyKey);
      if (!winner) throw error;
      assertSameSubmission(winner, draft);
      receiptId = winner.id;
    }
  }
  return toResult(
    await advanceReceipt(db, admin, receiptId, options),
    "POSTED",
  );
}

/**
 * Finish a receipt or reversal that Shopify had not confirmed. Does nothing to
 * a receipt that is already settled.
 */
export async function resumePurchaseOrderReceipt(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  receiptId: string,
  options: ExecuteInventoryOperationOptions = {},
): Promise<ReceivingResult> {
  const before = await loadReceipt(db, receiptId);
  const reversing = [
    "REVERSING",
    "REVERSED",
    "PARTIALLY_REVERSED",
    "REVERSAL_FAILED",
  ].includes(before.status);
  return toResult(
    await advanceReceipt(db, admin, receiptId, options),
    reversing ? "REVERSED" : "POSTED",
  );
}

/**
 * Undo a receipt: the units Shopify confirmed are taken back out of stock
 * through the ledger's reversal, and come off the order once Shopify confirms
 * that. A receipt can be reversed once.
 */
export async function reversePurchaseOrderReceipt(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  actor: InventoryActor,
  input: { receiptId: string; note?: string | null },
  options: ExecuteInventoryOperationOptions = {},
): Promise<ReceivingResult> {
  const note = optionalText(input.note, 2000, "Note");
  const receipt = await loadReceipt(db, input.receiptId);

  if (receipt.status === "POSTED" || receipt.status === "PARTIALLY_POSTED") {
    const movesStock = receipt.lines.some((line) => line.postedQty > 0);
    if (movesStock && !isSwitchedOn(options)) {
      return {
        complete: false,
        message: REVERSAL_OFF_MESSAGE,
        receipt: toView(receipt),
      };
    }
    assertStaffActor(actor);
    await db.$transaction(async (tx) => {
      const po = await lockPurchaseOrder(tx, receipt.purchaseOrderId);
      if (po.archivedAt !== null) {
        throw new PurchasingError(
          "invalid_state",
          "Archived purchase orders are read-only. Unarchive it first.",
        );
      }
      if (po.status === "CLOSED" || po.status === "CANCELLED") {
        throw new PurchasingError(
          "invalid_state",
          `Receipts on a ${STATUS_LABELS[po.status].toLowerCase()} purchase order cannot be reversed.`,
        );
      }
      // Claiming from the posted states is what makes a second press a resume.
      await tx.purchaseOrderReceipt.updateMany({
        where: {
          id: receipt.id,
          status: { in: ["POSTED", "PARTIALLY_POSTED"] },
        },
        data: {
          status: "REVERSING",
          reversalNote: note,
          reversedByUserId: actor.shopifyUserId,
          failureCode: null,
          failureMessage: null,
        },
      });
    });
  } else if (receipt.status === "PENDING" || receipt.status === "FAILED") {
    throw new PurchasingError(
      "invalid_state",
      receipt.status === "PENDING"
        ? "This receipt is still waiting for Shopify. Finish it before reversing it."
        : "Nothing was received on this receipt, so there is nothing to reverse.",
    );
  }

  return toResult(
    await advanceReceipt(db, admin, receipt.id, options),
    "REVERSED",
  );
}

/** Receipts of a purchase order, newest first. */
export async function listPurchaseOrderReceipts(
  db: TenantDb,
  purchaseOrderId: string,
): Promise<ReceiptView[]> {
  const receipts: ReceiptRecord[] = await db.purchaseOrderReceipt.findMany({
    where: { purchaseOrderId },
    include: RECEIPT_INCLUDE,
    orderBy: { receiptNumber: "desc" },
  });
  return receipts.map(toView);
}

/**
 * What a receiving screen needs for each line: how much is still expected
 * once unconfirmed receipts are set aside, and what has been rejected so far.
 */
export async function getReceivingWorksheet(
  db: TenantDb,
  purchaseOrderId: string,
): Promise<ReceivingWorksheet> {
  const po = await loadPurchaseOrder(db, purchaseOrderId);
  const { pending, rejected } = await receiptQuantitiesByLine(db, po.id);

  return {
    purchaseOrderId: po.id,
    status: po.status,
    locationGid: po.locationId,
    denial: receivingDenial(lifecycleStateOf(po)),
    lines: po.lineItems.map((line) => {
      const pendingQty = pending.get(line.id) ?? 0;
      return {
        lineItemId: line.id,
        shopifyVariantId: line.shopifyVariantId,
        name: variantDisplayName(line),
        sku: line.sku,
        barcode: line.barcode,
        orderedQty: line.orderedQty,
        cancelledQty: line.cancelledQty,
        receivedQty: line.receivedQty,
        pendingQty,
        rejectedQty: rejected.get(line.id) ?? 0,
        openQty: Math.max(0, remainingQuantity(line) - pendingQty),
      };
    }),
  };
}
