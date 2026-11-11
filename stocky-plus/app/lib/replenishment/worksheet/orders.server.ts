/**
 * Turning a worksheet into draft purchase orders, one per supplier.
 *
 * The worksheet decides what goes on each order: every row with a quantity
 * to order that is not on an order yet. The purchasing module creates the
 * draft; quantities are passed exactly as the worksheet shows them. Rows are
 * then linked to their order, which locks them against further edits here.
 */
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { TenantDb } from "../../../tenant/tenant-db.server";
import { isLocationGid, SHOP_SCOPE } from "../scope";
import { WorksheetError } from "./generate.server";

const LIVE = "LIVE";
const LINK_BATCH = 500;

export type DraftOrderRequest = {
  supplierId: string;
  locationGid: string;
  /** Purchasing prices each line from the supplier's terms. */
  lines: Array<{ variantGid: string; quantity: number }>;
  /** The same key always returns the same order, so a retry cannot duplicate it. */
  creationKey: string;
  source: "replenishment";
};

export type DraftOrder = {
  id: string;
  poNumber: string;
  /** False when the key matched an order created by an earlier attempt. */
  created: boolean;
};

/** How the worksheet reaches the purchasing module. */
export type DraftOrderPort = {
  create(request: DraftOrderRequest): Promise<DraftOrder>;
  /** Most lines purchasing accepts on one order; larger groups are split. */
  maxLinesPerOrder: number;
};

export type OrderGroup = {
  supplierId: string;
  supplierName: string;
  lines: number;
  units: number;
  /** Units × supplier cost over the rows that have a cost, per currency. */
  costByCurrency: Array<{ currencyCode: string; amount: string }>;
  linesWithoutCost: number;
};

export type OrderGroups = {
  groups: OrderGroup[];
  /** Rows with a quantity to order but no supplier to order them from. */
  linesWithoutSupplier: number;
};

type PendingLine = {
  id: string;
  variantGid: string;
  orderQuantity: number;
  supplierId: string | null;
  supplierName: string | null;
  supplierCostAmount: Prisma.Decimal | null;
  supplierCostCurrencyCode: string | null;
};

async function loadPendingLines(
  db: TenantDb,
  worksheetId: string,
  supplierId?: string,
): Promise<PendingLine[]> {
  return db.replenishmentWorksheetLine.findMany({
    where: {
      worksheetId,
      orderQuantity: { gt: 0 },
      purchaseOrderId: null,
      ...(supplierId ? { supplierId } : {}),
    },
    select: {
      id: true,
      variantGid: true,
      orderQuantity: true,
      supplierId: true,
      supplierName: true,
      supplierCostAmount: true,
      supplierCostCurrencyCode: true,
    },
    orderBy: [{ productTitle: "asc" }, { variantTitle: "asc" }, { id: "asc" }],
  });
}

/** What creating purchase orders from the worksheet would produce right now. */
export async function getOrderGroups(db: TenantDb, worksheetId: string): Promise<OrderGroups> {
  const pending = await loadPendingLines(db, worksheetId);
  const groups = new Map<
    string,
    { group: OrderGroup; costs: Map<string, Prisma.Decimal> }
  >();
  let linesWithoutSupplier = 0;

  for (const line of pending) {
    if (!line.supplierId) {
      linesWithoutSupplier += 1;
      continue;
    }
    let entry = groups.get(line.supplierId);
    if (!entry) {
      entry = {
        group: {
          supplierId: line.supplierId,
          supplierName: line.supplierName ?? "Supplier",
          lines: 0,
          units: 0,
          costByCurrency: [],
          linesWithoutCost: 0,
        },
        costs: new Map(),
      };
      groups.set(line.supplierId, entry);
    }
    entry.group.lines += 1;
    entry.group.units += line.orderQuantity;
    if (line.supplierCostAmount && line.supplierCostCurrencyCode) {
      const currency = line.supplierCostCurrencyCode;
      const cost = line.supplierCostAmount.times(line.orderQuantity);
      entry.costs.set(currency, (entry.costs.get(currency) ?? new Prisma.Decimal(0)).plus(cost));
    } else {
      entry.group.linesWithoutCost += 1;
    }
  }

  return {
    groups: [...groups.values()]
      .map(({ group, costs }) => ({
        ...group,
        costByCurrency: [...costs]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([currencyCode, amount]) => ({ currencyCode, amount: amount.toFixed(2) })),
      }))
      .sort((a, b) => a.supplierName.localeCompare(b.supplierName)),
    linesWithoutSupplier,
  };
}

export type CreatedOrder = {
  supplierId: string;
  supplierName: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  /** Rows now linked to the order. */
  lines: number;
  /**
   * Rows that are on the order but were edited or ordered elsewhere while it
   * was being created. They stay open on the worksheet.
   */
  changedLines: number;
  /** False when an earlier attempt had already created this order. */
  created: boolean;
};

async function resolveDestination(
  db: TenantDb,
  scopeKey: string,
  requested: string | null,
): Promise<string> {
  const locationGid = scopeKey === SHOP_SCOPE ? requested : scopeKey;
  if (!isLocationGid(locationGid)) {
    throw new WorksheetError(
      "location_not_found",
      "Choose the location the stock will be delivered to.",
    );
  }
  const location: { isActive: boolean } | null = await db.shopifyLocationFact.findFirst({
    where: { shopifyGid: locationGid, existenceState: LIVE },
    select: { isActive: true },
  });
  if (!location?.isActive) {
    throw new WorksheetError(
      "location_not_found",
      "That location is not active in your store. Choose another delivery location.",
    );
  }
  return locationGid;
}

/**
 * Links rows to their order and returns how many were linked. A row is
 * linked only while it is still unordered and still shows the quantity that
 * went on the order, so a locked row never disagrees with its order.
 */
async function linkLines(
  db: TenantDb,
  worksheetId: string,
  lines: readonly PendingLine[],
  order: DraftOrder,
): Promise<number> {
  const idsByQuantity = new Map<number, string[]>();
  for (const line of lines) {
    const ids = idsByQuantity.get(line.orderQuantity);
    if (ids) ids.push(line.id);
    else idsByQuantity.set(line.orderQuantity, [line.id]);
  }
  let linked = 0;
  for (const [orderQuantity, ids] of idsByQuantity) {
    for (let i = 0; i < ids.length; i += LINK_BATCH) {
      const result: { count: number } = await db.replenishmentWorksheetLine.updateMany({
        where: {
          worksheetId,
          id: { in: ids.slice(i, i + LINK_BATCH) },
          orderQuantity,
          purchaseOrderId: null,
        },
        data: { purchaseOrderId: order.id, purchaseOrderNumber: order.poNumber },
      });
      linked += result.count;
    }
  }
  return linked;
}

/**
 * Identifies an order by exactly what is on it. Repeating a request that
 * failed part-way finds the order it already created; a request for
 * different rows or quantities can never be mistaken for it.
 */
function creationKey(
  worksheetId: string,
  supplierId: string,
  locationGid: string,
  lines: readonly PendingLine[],
): string {
  const digest = createHash("sha256").update(`${locationGid};`);
  for (const line of lines) digest.update(`${line.variantGid}=${line.orderQuantity};`);
  return `replenishment:${worksheetId}:${supplierId}:${digest.digest("hex").slice(0, 32)}`;
}

/**
 * Creates draft purchase orders for the chosen suppliers from the
 * worksheet's unordered rows, then links each row to its order. A supplier
 * with more rows than one order holds gets several orders.
 *
 * Safe to repeat: if a request fails after an order was created but before
 * its rows were linked, the next attempt gets the same order back from
 * purchasing and finishes the links.
 */
export async function createDraftOrders(
  db: TenantDb,
  purchasing: DraftOrderPort,
  input: {
    worksheet: { id: string; scopeKey: string };
    supplierIds: readonly string[];
    locationGid: string | null;
  },
): Promise<CreatedOrder[]> {
  const { worksheet } = input;
  const locationGid = await resolveDestination(db, worksheet.scopeKey, input.locationGid);
  const created: CreatedOrder[] = [];

  for (const supplierId of new Set(input.supplierIds)) {
    const pending = await loadPendingLines(db, worksheet.id, supplierId);
    for (let start = 0; start < pending.length; start += purchasing.maxLinesPerOrder) {
      const lines = pending.slice(start, start + purchasing.maxLinesPerOrder);
      const order = await purchasing.create({
        supplierId,
        locationGid,
        lines: lines.map((line) => ({
          variantGid: line.variantGid,
          quantity: line.orderQuantity,
        })),
        creationKey: creationKey(worksheet.id, supplierId, locationGid, lines),
        source: "replenishment",
      });

      const linked = await linkLines(db, worksheet.id, lines, order);
      created.push({
        supplierId,
        supplierName: lines[0].supplierName ?? "Supplier",
        purchaseOrderId: order.id,
        purchaseOrderNumber: order.poNumber,
        lines: linked,
        changedLines: lines.length - linked,
        created: order.created,
      });
    }
  }
  return created;
}
