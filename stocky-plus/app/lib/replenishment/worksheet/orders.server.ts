/**
 * Turning a worksheet into draft purchase orders, one per supplier.
 *
 * The worksheet decides what goes on each order: every row with a quantity
 * to order that is not on an order yet. The purchasing module creates the
 * draft; quantities are passed exactly as the worksheet shows them. Rows are
 * then linked to their order, which locks them against further edits here.
 */
import { Prisma } from "@prisma/client";
import type { TenantDb } from "../../../tenant/tenant-db.server";
import { isLocationGid, SHOP_SCOPE } from "../scope";
import { WorksheetError } from "./generate.server";

const LIVE = "LIVE";
const LINK_BATCH = 500;

export type DraftOrderRequest = {
  supplierId: string;
  locationGid: string;
  lines: Array<{ variantGid: string; quantity: number; unitCost?: string }>;
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

export type CreateDraftOrder = (request: DraftOrderRequest) => Promise<DraftOrder>;

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
  lines: number;
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
 * Creates one draft purchase order per chosen supplier from the worksheet's
 * unordered rows. Safe to repeat: a supplier's nth order from a worksheet
 * always uses the same key, so a retry after a failure links the rows to the
 * order that already exists instead of creating another.
 */
export async function createDraftOrders(
  db: TenantDb,
  createDraft: CreateDraftOrder,
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
    if (pending.length === 0) continue;

    const earlier: Array<{ purchaseOrderId: string | null }> =
      await db.replenishmentWorksheetLine.groupBy({
        by: ["purchaseOrderId"],
        where: { worksheetId: worksheet.id, supplierId, purchaseOrderId: { not: null } },
      });
    const order = await createDraft({
      supplierId,
      locationGid,
      lines: pending.map((line) => ({
        variantGid: line.variantGid,
        quantity: line.orderQuantity,
        ...(line.supplierCostAmount ? { unitCost: line.supplierCostAmount.toFixed() } : {}),
      })),
      creationKey: `replenishment:${worksheet.id}:${supplierId}:${earlier.length + 1}`,
      source: "replenishment",
    });

    const ids = pending.map((line) => line.id);
    for (let i = 0; i < ids.length; i += LINK_BATCH) {
      await db.replenishmentWorksheetLine.updateMany({
        where: {
          worksheetId: worksheet.id,
          id: { in: ids.slice(i, i + LINK_BATCH) },
          purchaseOrderId: null,
        },
        data: { purchaseOrderId: order.id, purchaseOrderNumber: order.poNumber },
      });
    }
    created.push({
      supplierId,
      supplierName: pending[0].supplierName ?? "Supplier",
      purchaseOrderId: order.id,
      purchaseOrderNumber: order.poNumber,
      lines: pending.length,
      created: order.created,
    });
  }
  return created;
}
