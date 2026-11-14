import type { TenantDb } from "../../tenant/tenant-db.server";
import {
  TERMINAL_OPERATION_STATUSES,
  type InventoryOperationStatus,
} from "../inventory-writes/types";
import { findVariantsById } from "../inventory-writes/variant-items.server";
import {
  TRANSFER_SOURCE_TYPES,
  transferLegOf,
  type TransferLeg,
  type TransferShortResolution,
  type TransferStatus,
} from "./transfer-core.server";
import {
  transferOutstandingQuantity,
  transferShipQuantity,
  transferTotals,
  transferWrittenOffQuantity,
  type TransferLineQuantities,
  type TransferTotals,
} from "./transfer-quantities";

export const TRANSFER_LIST_PAGE_SIZE = 20;
export const TRANSFER_LINE_PAGE_SIZE = 50;
const LOOKUP_CHUNK = 2_000;

export const TRANSFER_LIST_VIEWS = ["open", "closed"] as const;
export type TransferListView = (typeof TRANSFER_LIST_VIEWS)[number];

/** `open` narrows a transfer in transit to the lines with units still to account for. */
export const TRANSFER_LINE_FILTERS = ["all", "open"] as const;
export type TransferLineFilter = (typeof TRANSFER_LINE_FILTERS)[number];

export interface TransferHeader {
  id: string;
  sourceLocationId: string;
  destinationLocationId: string;
  status: TransferStatus;
  notes: string | null;
  /** Set when the transfer was shipped as a Shopify transfer; ProPo moves no stock for it. */
  shopifyTransferId: string | null;
  shortResolution: TransferShortResolution | null;
  createdAt: Date;
  createdByUserId: string | null;
  shippedAt: Date | null;
  shippedByUserId: string | null;
  receivedAt: Date | null;
  receivedByUserId: string | null;
  cancelledAt: Date | null;
  cancelledByUserId: string | null;
}

export interface TransferListEntry extends TransferHeader {
  totals: TransferTotals;
}

export interface TransferLineView extends TransferLineQuantities {
  id: string;
  shopifyVariantId: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  rejectNote: string | null;
  /** Units that left the source, or will when a draft ships; 0 for a cancelled transfer. */
  shipQty: number;
  /** Shipped units nobody has accounted for yet; 0 unless the transfer is in transit. */
  outstandingQty: number;
  /** Units that never arrived and were written off when the transfer was closed. */
  writtenOffQty: number;
}

const HEADER_SELECT = {
  id: true,
  sourceLocationId: true,
  destinationLocationId: true,
  status: true,
  notes: true,
  shopifyTransferId: true,
  shortResolution: true,
  createdAt: true,
  createdByUserId: true,
  shippedAt: true,
  shippedByUserId: true,
  receivedAt: true,
  receivedByUserId: true,
  cancelledAt: true,
  cancelledByUserId: true,
} as const;

const LINE_SELECT = {
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

interface LineRow extends TransferLineQuantities {
  id: string;
  transferOrderId: string;
  shopifyVariantId: string;
  rejectNote: string | null;
}

function chunked<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < values.length; start += size) {
    chunks.push(values.slice(start, start + size));
  }
  return chunks;
}

export function readTransferListView(value: string | null): TransferListView {
  return value === "closed" ? "closed" : "open";
}

export function readTransferLineFilter(
  value: string | null,
): TransferLineFilter {
  return value === "open" ? "open" : "all";
}

/**
 * One page of transfers, newest first: the open ones (drafts and transfers in
 * transit), or the closed ones (received and cancelled), each with where its
 * units stand.
 */
export async function listTransfers(
  db: TenantDb,
  input: { view: TransferListView; page: number },
): Promise<{ transfers: TransferListEntry[]; hasMore: boolean }> {
  const rows = (await db.transferOrder.findMany({
    where: {
      status:
        input.view === "open"
          ? { in: ["DRAFT", "IN_TRANSIT"] }
          : { in: ["RECEIVED", "CANCELLED"] },
    },
    select: HEADER_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (input.page - 1) * TRANSFER_LIST_PAGE_SIZE,
    // One more than a page, to know whether another page exists.
    take: TRANSFER_LIST_PAGE_SIZE + 1,
  })) as TransferHeader[];
  const page = rows.slice(0, TRANSFER_LIST_PAGE_SIZE);
  if (page.length === 0) return { transfers: [], hasMore: false };

  const lines = (await db.transferLineItem.findMany({
    where: { transferOrderId: { in: page.map((transfer) => transfer.id) } },
    select: LINE_SELECT,
  })) as LineRow[];
  const linesOf = new Map<string, LineRow[]>();
  for (const line of lines) {
    const own = linesOf.get(line.transferOrderId);
    if (own) own.push(line);
    else linesOf.set(line.transferOrderId, [line]);
  }

  return {
    transfers: page.map((transfer) => ({
      ...transfer,
      totals: transferTotals(transfer.status, linesOf.get(transfer.id) ?? []),
    })),
    hasMore: rows.length > TRANSFER_LIST_PAGE_SIZE,
  };
}

export async function getTransfer(
  db: TenantDb,
  transferId: string,
): Promise<TransferHeader | null> {
  return (await db.transferOrder.findFirst({
    where: { id: transferId },
    select: HEADER_SELECT,
  })) as TransferHeader | null;
}

async function describeLines(
  db: TenantDb,
  status: TransferStatus,
  rows: readonly LineRow[],
): Promise<TransferLineView[]> {
  const catalog = await findVariantsById(
    db,
    rows.map((row) => row.shopifyVariantId),
  );
  return rows.map((row) => {
    const variant = catalog.get(row.shopifyVariantId);
    return {
      id: row.id,
      shopifyVariantId: row.shopifyVariantId,
      title: variant?.title ?? row.shopifyVariantId,
      sku: variant?.sku ?? null,
      barcode: variant?.barcode ?? null,
      quantity: row.quantity,
      pickedQty: row.pickedQty,
      receivedQty: row.receivedQty,
      pendingReceiveQty: row.pendingReceiveQty,
      rejectedQty: row.rejectedQty,
      rejectNote: row.rejectNote,
      returnedQty: row.returnedQty,
      shipQty: status === "CANCELLED" ? 0 : transferShipQuantity(row),
      outstandingQty:
        status === "IN_TRANSIT"
          ? Math.max(0, transferOutstandingQuantity(row))
          : 0,
      writtenOffQty: transferWrittenOffQuantity(status, row),
    };
  });
}

const readLineRows = async (
  db: TenantDb,
  transferId: string,
): Promise<LineRow[]> =>
  (await db.transferLineItem.findMany({
    where: { transferOrderId: transferId },
    select: LINE_SELECT,
    orderBy: { id: "asc" },
  })) as LineRow[];

/**
 * One page of a transfer's lines in the order they were added, with the
 * totals over all of its lines.
 */
export async function getTransferLines(
  db: TenantDb,
  input: {
    transfer: { id: string; status: TransferStatus };
    filter: TransferLineFilter;
    page: number;
  },
): Promise<{
  lines: TransferLineView[];
  /** Lines the filter leaves, over all pages. */
  total: number;
  page: number;
  pageCount: number;
  totals: TransferTotals;
}> {
  const { transfer } = input;
  const rows = await readLineRows(db, transfer.id);
  // Whether a line is open depends on five of its own columns, which a
  // database filter cannot add up; a transfer's lines are few enough to
  // narrow here.
  const kept =
    input.filter === "open" && transfer.status === "IN_TRANSIT"
      ? rows.filter(
          (row) =>
            transferOutstandingQuantity(row) > 0 || row.pendingReceiveQty > 0,
        )
      : rows;
  const pageCount = Math.max(
    1,
    Math.ceil(kept.length / TRANSFER_LINE_PAGE_SIZE),
  );
  const page = Math.min(input.page, pageCount);
  const start = (page - 1) * TRANSFER_LINE_PAGE_SIZE;
  return {
    lines: await describeLines(
      db,
      transfer.status,
      kept.slice(start, start + TRANSFER_LINE_PAGE_SIZE),
    ),
    total: kept.length,
    page,
    pageCount,
    totals: transferTotals(transfer.status, rows),
  };
}

/** Every line of a transfer, for the transfer report. */
export async function listTransferLinesForExport(
  db: TenantDb,
  transfer: { id: string; status: TransferStatus },
): Promise<TransferLineView[]> {
  const rows = await readLineRows(db, transfer.id);
  const lines: TransferLineView[] = [];
  for (const part of chunked(rows, LOOKUP_CHUNK)) {
    lines.push(...(await describeLines(db, transfer.status, part)));
  }
  return lines;
}

export interface TransferEvent {
  operationId: string;
  leg: TransferLeg;
  at: Date;
  staffUserId: string | null;
  staffName: string | null;
  status: InventoryOperationStatus;
  /** Shopify has not finished answering this request. */
  unfinished: boolean;
  /** Net units Shopify confirmed: negative when stock left the location, positive when it arrived. */
  netUnits: number;
  /** Changes Shopify refused. */
  refusedChangeCount: number;
}

/**
 * What the inventory ledger holds for a transfer, oldest first: every request
 * that moved, or tried to move, its stock at the source or the destination.
 */
export async function getTransferHistory(
  db: TenantDb,
  transferId: string,
): Promise<TransferEvent[]> {
  const operations = (await db.inventoryOperation.findMany({
    where: {
      sourceType: { in: [...TRANSFER_SOURCE_TYPES] },
      sourceId: transferId,
    },
    select: {
      id: true,
      sourceType: true,
      status: true,
      actorShopifyUserId: true,
      actorDisplayName: true,
      failedLineCount: true,
      conflictLineCount: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })) as Array<{
    id: string;
    sourceType: string;
    status: InventoryOperationStatus;
    actorShopifyUserId: string | null;
    actorDisplayName: string | null;
    failedLineCount: number;
    conflictLineCount: number;
    createdAt: Date;
  }>;
  if (operations.length === 0) return [];

  const applied = (await db.inventoryOperationLine.findMany({
    where: {
      operationId: { in: operations.map((operation) => operation.id) },
      status: "APPLIED",
    },
    select: { operationId: true, delta: true },
  })) as Array<{ operationId: string; delta: number }>;
  const netUnits = new Map<string, number>();
  for (const line of applied) {
    netUnits.set(
      line.operationId,
      (netUnits.get(line.operationId) ?? 0) + line.delta,
    );
  }

  return operations.flatMap((operation) => {
    const leg = transferLegOf(operation.sourceType);
    if (!leg) return [];
    return [
      {
        operationId: operation.id,
        leg,
        at: operation.createdAt,
        staffUserId: operation.actorShopifyUserId,
        staffName: operation.actorDisplayName,
        status: operation.status,
        unfinished: !TERMINAL_OPERATION_STATUSES.has(operation.status),
        netUnits: netUnits.get(operation.id) ?? 0,
        refusedChangeCount:
          operation.failedLineCount + operation.conflictLineCount,
      },
    ];
  });
}
