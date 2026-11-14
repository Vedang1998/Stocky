/**
 * The purchase-order list: saved views, search, paging and per-view counts.
 */
import type { Prisma } from "@prisma/client";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { formatCalendarDate, parseCalendarDate } from "../../lib/purchasing/form-input";
import {
  INCOMING_STATUSES,
  isIncoming,
  type PurchaseOrderStatus,
} from "../../lib/purchasing/status";
import {
  PURCHASE_ORDER_INCLUDE,
  remainingQuantity,
  totalsFor,
  type PurchaseOrderRecord,
} from "./purchase-order-records.server";

export const PURCHASE_ORDER_VIEWS = [
  "open",
  "draft",
  "incoming",
  "overdue",
  "received",
  "cancelled",
  "archived",
  "all",
] as const;

export type PurchaseOrderView = (typeof PURCHASE_ORDER_VIEWS)[number];

export const PURCHASE_ORDER_VIEW_LABELS: Record<PurchaseOrderView, string> = {
  open: "Open",
  draft: "Drafts",
  incoming: "Incoming",
  overdue: "Overdue",
  received: "Received",
  cancelled: "Cancelled",
  archived: "Archived",
  all: "All",
};

export const PURCHASE_ORDER_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 100;
const SUPPLIER_MATCH_LIMIT = 200;

export type PurchaseOrderListItem = {
  id: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  archived: boolean;
  supplierId: string;
  supplierName: string;
  locationGid: string;
  currency: string;
  /** Order total in the purchase order's currency, as a decimal string. */
  total: string;
  orderedUnits: number;
  receivedUnits: number;
  remainingUnits: number;
  /** YYYY-MM-DD, or null when no date is set. */
  expectedOn: string | null;
  /** Still incoming with an expected date before today. */
  overdue: boolean;
  updatedAt: string;
};

export type PurchaseOrderList = {
  view: PurchaseOrderView;
  items: PurchaseOrderListItem[];
  page: number;
  hasNextPage: boolean;
  counts: Record<PurchaseOrderView, number>;
};

export function isPurchaseOrderView(value: string): value is PurchaseOrderView {
  return (PURCHASE_ORDER_VIEWS as readonly string[]).includes(value);
}

/**
 * `today` is the merchant's calendar date. Without it nothing is overdue,
 * because the server's own date can be a day off from the merchant's.
 */
function viewWhere(
  view: PurchaseOrderView,
  today: Date | null,
): Prisma.PurchaseOrderWhereInput {
  switch (view) {
    case "open":
      return { archivedAt: null, status: { in: ["DRAFT", ...INCOMING_STATUSES] } };
    case "draft":
      return { archivedAt: null, status: "DRAFT" };
    case "incoming":
      return { archivedAt: null, status: { in: [...INCOMING_STATUSES] } };
    case "overdue":
      return today
        ? {
            archivedAt: null,
            status: { in: [...INCOMING_STATUSES] },
            expectedOn: { lt: today },
          }
        : { id: { in: [] } };
    case "received":
      return { archivedAt: null, status: { in: ["RECEIVED", "CLOSED"] } };
    case "cancelled":
      return { archivedAt: null, status: "CANCELLED" };
    case "archived":
      return { archivedAt: { not: null } };
    case "all":
      return {};
  }
}

async function searchWhere(
  db: TenantDb,
  search: string,
): Promise<Prisma.PurchaseOrderWhereInput> {
  const suppliers: Array<{ id: string }> = await db.supplier.findMany({
    where: { name: { contains: search, mode: "insensitive" } },
    select: { id: true },
    orderBy: { id: "asc" },
    take: SUPPLIER_MATCH_LIMIT,
  });
  return {
    OR: [
      { poNumber: { contains: search, mode: "insensitive" } },
      { supplierOrderNumber: { contains: search, mode: "insensitive" } },
      { invoiceNumber: { contains: search, mode: "insensitive" } },
      ...(suppliers.length > 0
        ? [{ supplierId: { in: suppliers.map((supplier) => supplier.id) } }]
        : []),
    ],
  };
}

function toListItem(po: PurchaseOrderRecord, today: Date | null): PurchaseOrderListItem {
  const orderedUnits = po.lineItems.reduce(
    (sum, line) => sum + Math.max(0, line.orderedQty - line.cancelledQty),
    0,
  );
  const receivedUnits = po.lineItems.reduce((sum, line) => sum + line.receivedQty, 0);
  return {
    id: po.id,
    poNumber: po.poNumber ?? po.id,
    status: po.status,
    archived: po.archivedAt !== null,
    supplierId: po.supplierId,
    supplierName: po.supplier.name,
    locationGid: po.locationId,
    currency: po.currency,
    total: totalsFor(po).totalAmount.toFixed(2),
    orderedUnits,
    receivedUnits,
    remainingUnits: po.lineItems.reduce((sum, line) => sum + remainingQuantity(line), 0),
    expectedOn: formatCalendarDate(po.expectedOn),
    overdue:
      today !== null &&
      po.archivedAt === null &&
      isIncoming(po.status) &&
      po.expectedOn !== null &&
      po.expectedOn.getTime() < today.getTime(),
    updatedAt: po.updatedAt.toISOString(),
  };
}

async function countViews(
  db: TenantDb,
  today: Date | null,
): Promise<Record<PurchaseOrderView, number>> {
  const [byStatus, archived, overdue]: [
    Array<{ status: PurchaseOrderStatus; _count: { _all: number } }>,
    number,
    number,
  ] = await Promise.all([
    db.purchaseOrder.groupBy({
      by: ["status"],
      where: { archivedAt: null },
      _count: { _all: true },
    }),
    db.purchaseOrder.count({ where: viewWhere("archived", today) }),
    today ? db.purchaseOrder.count({ where: viewWhere("overdue", today) }) : 0,
  ]);
  const count = (...statuses: PurchaseOrderStatus[]) =>
    byStatus
      .filter((row) => statuses.includes(row.status))
      .reduce((sum, row) => sum + row._count._all, 0);
  const active = byStatus.reduce((sum, row) => sum + row._count._all, 0);
  return {
    open: count("DRAFT", ...INCOMING_STATUSES),
    draft: count("DRAFT"),
    incoming: count(...INCOMING_STATUSES),
    overdue,
    received: count("RECEIVED", "CLOSED"),
    cancelled: count("CANCELLED"),
    archived,
    all: active + archived,
  };
}

export async function listPurchaseOrders(
  db: TenantDb,
  options: {
    view?: PurchaseOrderView;
    search?: string | null;
    supplierId?: string | null;
    /** Only orders delivering to this location. */
    locationGid?: string | null;
    page?: number;
    /** The merchant's calendar date as YYYY-MM-DD. */
    today?: string | null;
  } = {},
): Promise<PurchaseOrderList> {
  const view = options.view ?? "open";
  const page = Number.isSafeInteger(options.page) && options.page! > 0 ? options.page! : 1;
  const today = options.today ? parseCalendarDate(options.today) : null;
  const search = options.search?.trim().slice(0, MAX_SEARCH_LENGTH) ?? "";

  const filters: Prisma.PurchaseOrderWhereInput[] = [viewWhere(view, today)];
  if (options.supplierId) filters.push({ supplierId: options.supplierId });
  if (options.locationGid) filters.push({ locationId: options.locationGid });
  if (search) filters.push(await searchWhere(db, search));

  const [rows, counts]: [PurchaseOrderRecord[], Record<PurchaseOrderView, number>] =
    await Promise.all([
      db.purchaseOrder.findMany({
        where: { AND: filters },
        include: PURCHASE_ORDER_INCLUDE,
        orderBy:
          view === "overdue" || view === "incoming"
            ? [{ expectedOn: { sort: "asc", nulls: "last" } }, { id: "asc" }]
            : [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * PURCHASE_ORDER_PAGE_SIZE,
        take: PURCHASE_ORDER_PAGE_SIZE + 1,
      }),
      countViews(db, today),
    ]);

  return {
    view,
    items: rows.slice(0, PURCHASE_ORDER_PAGE_SIZE).map((po) => toListItem(po, today)),
    page,
    hasNextPage: rows.length > PURCHASE_ORDER_PAGE_SIZE,
    counts,
  };
}
