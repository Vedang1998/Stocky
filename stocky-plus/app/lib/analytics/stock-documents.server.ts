/**
 * Transfers, stocktakes and inventory writes as the app recorded them, read
 * for reporting.
 *
 * These are the app's own documents, not Shopify facts: a line says what was
 * requested, shipped, received, counted or written here. Reports read them as
 * they are and never change them.
 */
import type { TenantDb } from "../../tenant/tenant-db.server";
import type { UtcRange } from "./shop-calendar";

const PAGE_SIZE = 500;
const IN_LIST_SIZE = 200;

export type TransferStatus = "DRAFT" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";

export type TransferLine = {
  lineId: string;
  transferId: string;
  status: TransferStatus;
  sourceLocationGid: string;
  destinationLocationGid: string;
  createdAt: Date;
  shippedAt: Date | null;
  receivedAt: Date | null;
  variantGid: string;
  /** Units the transfer asked for. */
  quantity: number;
  pickedQty: number;
  receivedQty: number;
};

export type StocktakeLine = {
  lineId: string;
  stocktakeId: string;
  stocktakeName: string;
  locationGid: string;
  completedAt: Date;
  variantGid: string;
  /** Available quantity on record when the line joined the count. */
  expectedQty: number;
  /** Null when the line was never counted. */
  countedQty: number | null;
};

type TransferRow = {
  id: string;
  status: TransferStatus;
  sourceLocationId: string;
  destinationLocationId: string;
  createdAt: Date;
  shippedAt: Date | null;
  receivedAt: Date | null;
};

type TransferLineRow = {
  id: string;
  transferOrderId: string;
  shopifyVariantId: string;
  quantity: number;
  pickedQty: number;
  receivedQty: number;
};

type StocktakeRow = {
  id: string;
  name: string;
  locationId: string;
  completedAt: Date;
};

type StocktakeLineRow = {
  id: string;
  stocktakeId: string;
  shopifyVariantId: string;
  expectedQty: number;
  countedQty: number | null;
};

export type InventoryChangeKind =
  "ADJUSTMENT" | "STOCKTAKE" | "RECEIPT" | "TRANSFER" | "REVERSAL";

/** One line of an inventory write that Shopify accepted. */
export type InventoryChange = {
  lineId: string;
  operationId: string;
  kind: InventoryChangeKind;
  /** Shopify inventory reason code, such as `correction` or `shrinkage`. */
  reason: string;
  /** The Shopify quantity that changed, such as `available` or `damaged`. */
  quantityName: string;
  actorName: string | null;
  actorChannel: "ADMIN" | "POS" | "SYSTEM";
  note: string | null;
  createdAt: Date;
  variantGid: string | null;
  locationGid: string;
  delta: number;
  /** The quantity Shopify reported after the change; null when it did not say. */
  quantityAfterChange: number | null;
};

type OperationRow = {
  id: string;
  kind: InventoryChangeKind;
  reason: string;
  quantityName: string;
  actorDisplayName: string | null;
  actorChannel: InventoryChange["actorChannel"];
  note: string | null;
  createdAt: Date;
};

type OperationLineRow = {
  id: string;
  operationId: string;
  variantGid: string | null;
  locationGid: string;
  delta: number;
  quantityAfterChange: number | null;
};

type PagedDelegate<Row> = {
  findMany(args: {
    where: Record<string, unknown>;
    select: Record<string, true>;
    orderBy: { id: "asc" };
    take: number;
  }): Promise<Row[]>;
};

/** Every row matching `where`, read in id order one page at a time. */
async function readAll<Row extends { id: string }>(
  delegate: PagedDelegate<Row>,
  where: Record<string, unknown>,
  select: Record<string, true>,
): Promise<Row[]> {
  const rows: Row[] = [];
  let afterId: string | null = null;
  for (;;) {
    const page: Row[] = await delegate.findMany({
      where: afterId ? { ...where, id: { gt: afterId } } : where,
      select,
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
    });
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
    afterId = page[page.length - 1].id;
  }
}

/** Child rows of `parentIds` that also match `filter`, read in bounded `IN` lists. */
async function readChildren<Row extends { id: string }>(
  delegate: PagedDelegate<Row>,
  foreignKey: string,
  parentIds: readonly string[],
  select: Record<string, true>,
  filter: Record<string, unknown> = {},
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let i = 0; i < parentIds.length; i += IN_LIST_SIZE) {
    rows.push(
      ...(await readAll(
        delegate,
        {
          ...filter,
          [foreignKey]: { in: parentIds.slice(i, i + IN_LIST_SIZE) },
        },
        select,
      )),
    );
  }
  return rows;
}

/** Lines of the transfers created inside `range`, whatever their status. */
export async function loadTransferLines(
  db: TenantDb,
  range: UtcRange,
): Promise<TransferLine[]> {
  const transfers = await readAll<TransferRow>(
    db.transferOrder,
    { createdAt: { gte: range.startUtc, lt: range.endUtcExclusive } },
    {
      id: true,
      status: true,
      sourceLocationId: true,
      destinationLocationId: true,
      createdAt: true,
      shippedAt: true,
      receivedAt: true,
    },
  );
  const byId = new Map(transfers.map((transfer) => [transfer.id, transfer]));
  const lines = await readChildren<TransferLineRow>(
    db.transferLineItem,
    "transferOrderId",
    [...byId.keys()],
    {
      id: true,
      transferOrderId: true,
      shopifyVariantId: true,
      quantity: true,
      pickedQty: true,
      receivedQty: true,
    },
  );

  return lines.flatMap((line) => {
    const transfer = byId.get(line.transferOrderId);
    if (!transfer) return [];
    return {
      lineId: line.id,
      transferId: transfer.id,
      status: transfer.status,
      sourceLocationGid: transfer.sourceLocationId,
      destinationLocationGid: transfer.destinationLocationId,
      createdAt: transfer.createdAt,
      shippedAt: transfer.shippedAt,
      receivedAt: transfer.receivedAt,
      variantGid: line.shopifyVariantId,
      quantity: line.quantity,
      pickedQty: line.pickedQty,
      receivedQty: line.receivedQty,
    };
  });
}

/** Lines of the stocktakes completed inside `range`. */
export async function loadCompletedStocktakeLines(
  db: TenantDb,
  range: UtcRange,
): Promise<StocktakeLine[]> {
  const stocktakes = await readAll<StocktakeRow>(
    db.stocktake,
    {
      status: "COMPLETED",
      completedAt: { gte: range.startUtc, lt: range.endUtcExclusive },
    },
    { id: true, name: true, locationId: true, completedAt: true },
  );
  const byId = new Map(
    stocktakes.map((stocktake) => [stocktake.id, stocktake]),
  );
  const lines = await readChildren<StocktakeLineRow>(
    db.stocktakeLineItem,
    "stocktakeId",
    [...byId.keys()],
    {
      id: true,
      stocktakeId: true,
      shopifyVariantId: true,
      expectedQty: true,
      countedQty: true,
    },
  );

  return lines.flatMap((line) => {
    const stocktake = byId.get(line.stocktakeId);
    if (!stocktake) return [];
    return {
      lineId: line.id,
      stocktakeId: stocktake.id,
      stocktakeName: stocktake.name,
      locationGid: stocktake.locationId,
      completedAt: stocktake.completedAt,
      variantGid: line.shopifyVariantId,
      expectedQty: line.expectedQty,
      countedQty: line.countedQty,
    };
  });
}

/**
 * Applied lines of the inventory writes made inside `range`. A line that
 * failed, conflicted or is still waiting to be sent is not a change to
 * Shopify's stock and is left out.
 */
export async function loadAppliedInventoryChanges(
  db: TenantDb,
  range: UtcRange,
): Promise<InventoryChange[]> {
  const operations = await readAll<OperationRow>(
    db.inventoryOperation,
    {
      createdAt: { gte: range.startUtc, lt: range.endUtcExclusive },
      appliedLineCount: { gt: 0 },
    },
    {
      id: true,
      kind: true,
      reason: true,
      quantityName: true,
      actorDisplayName: true,
      actorChannel: true,
      note: true,
      createdAt: true,
    },
  );
  const byId = new Map(
    operations.map((operation) => [operation.id, operation]),
  );
  const lines = await readChildren<OperationLineRow>(
    db.inventoryOperationLine,
    "operationId",
    [...byId.keys()],
    {
      id: true,
      operationId: true,
      variantGid: true,
      locationGid: true,
      delta: true,
      quantityAfterChange: true,
    },
    { status: "APPLIED" },
  );

  return lines.flatMap((line) => {
    const operation = byId.get(line.operationId);
    if (!operation) return [];
    return {
      lineId: line.id,
      operationId: operation.id,
      kind: operation.kind,
      reason: operation.reason,
      quantityName: operation.quantityName,
      actorName: operation.actorDisplayName,
      actorChannel: operation.actorChannel,
      note: operation.note,
      createdAt: operation.createdAt,
      variantGid: line.variantGid,
      locationGid: line.locationGid,
      delta: line.delta,
      quantityAfterChange: line.quantityAfterChange,
    };
  });
}
