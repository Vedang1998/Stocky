/**
 * Reading saved worksheets and saving the merchant's final quantities.
 *
 * Rows are sorted, filtered and paged in the database, so a view of a large
 * worksheet costs one page of rows. A final quantity is the only thing a
 * merchant can change on a row; the suggestion and its inputs stay as
 * generated.
 */
import type { Prisma } from "@prisma/client";
import type { AbcClass } from "../../analytics/abc-parity";
import type { TenantDb } from "../../../tenant/tenant-db.server";
import type { ReorderPointSource, StockStatus } from "../stock-health";
import {
  LEAD_TIME_SOURCES,
  MAX_QUANTITY,
  type LeadTimeSource,
  type ParityMethod,
  type RuleAdjustment,
  type TraceStep,
  type Warning,
  type WarningCode,
} from "../types";
import type { WorksheetSummary } from "./generate.server";
import { WORKSHEETS_KEPT } from "./limits";
import type { WorksheetLineDetail } from "./line";
import { readWorksheetSettings, type WorksheetSettings } from "./settings";
import type { WorksheetSortKey, WorksheetView } from "./view";

export type WorksheetHeader = {
  id: string;
  method: ParityMethod;
  scopeKey: string;
  scopeName: string | null;
  /** Null when the stored settings cannot be read by this version. */
  settings: WorksheetSettings | null;
  asOfLocalDate: string;
  timeZone: string;
  summary: WorksheetSummary | null;
  lineCount: number;
  generatedAt: Date;
};

type HeaderRow = Omit<WorksheetHeader, "settings" | "summary"> & {
  settings: unknown;
  summary: unknown;
};

const HEADER_SELECT = {
  id: true,
  method: true,
  scopeKey: true,
  scopeName: true,
  settings: true,
  asOfLocalDate: true,
  timeZone: true,
  summary: true,
  lineCount: true,
  generatedAt: true,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSummary(stored: unknown): WorksheetSummary | null {
  if (
    !isRecord(stored) ||
    typeof stored.currencyCode !== "string" ||
    !isRecord(stored.salesWindow) ||
    !isRecord(stored.coverage) ||
    !isRecord(stored.excludedOrders)
  ) {
    return null;
  }
  // Worksheets made before ABC/U was recorded have no ABC window.
  return { abcWindow: null, ...stored } as WorksheetSummary;
}

function toHeader(row: HeaderRow): WorksheetHeader {
  return {
    ...row,
    settings: readWorksheetSettings(row.settings),
    summary: readSummary(row.summary),
  };
}

/** Saved worksheets, newest first. */
export async function listWorksheets(db: TenantDb): Promise<WorksheetHeader[]> {
  const rows: HeaderRow[] = await db.replenishmentWorksheet.findMany({
    select: HEADER_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: WORKSHEETS_KEPT,
  });
  return rows.map(toHeader);
}

export async function getWorksheet(
  db: TenantDb,
  worksheetId: string,
): Promise<WorksheetHeader | null> {
  const row: HeaderRow | null = await db.replenishmentWorksheet.findFirst({
    where: { id: worksheetId },
    select: HEADER_SELECT,
  });
  return row ? toHeader(row) : null;
}

/** Deletes a worksheet and its rows. Purchase orders made from it are kept. */
export async function deleteWorksheet(db: TenantDb, worksheetId: string): Promise<boolean> {
  const result: { count: number } = await db.replenishmentWorksheet.deleteMany({
    where: { id: worksheetId },
  });
  return result.count > 0;
}

export type WorksheetTotals = {
  variants: number;
  toOrder: number;
  unitsToOrder: number;
  lowStock: number;
  withWarnings: number;
  edited: number;
  /** Rows already placed on a draft purchase order. */
  ordered: number;
};

export async function getWorksheetTotals(
  db: TenantDb,
  worksheetId: string,
): Promise<WorksheetTotals> {
  const [variants, toOrder, lowStock, withWarnings, edited, ordered] = await Promise.all([
    db.replenishmentWorksheetLine.count({ where: { worksheetId } }),
    db.replenishmentWorksheetLine.aggregate({
      where: { worksheetId, orderQuantity: { gt: 0 }, purchaseOrderId: null },
      _count: { _all: true },
      _sum: { orderQuantity: true },
    }),
    db.replenishmentWorksheetLine.count({
      where: { worksheetId, stockStatus: { in: ["LOW", "OUT_OF_STOCK"] } },
    }),
    db.replenishmentWorksheetLine.count({
      where: { worksheetId, warningCodes: { isEmpty: false } },
    }),
    db.replenishmentWorksheetLine.count({
      where: { worksheetId, finalQuantity: { not: null } },
    }),
    db.replenishmentWorksheetLine.count({
      where: { worksheetId, purchaseOrderId: { not: null } },
    }),
  ]);
  return {
    variants,
    toOrder: toOrder._count._all,
    unitsToOrder: toOrder._sum.orderQuantity ?? 0,
    lowStock,
    withWarnings,
    edited,
    ordered,
  };
}

/** A worksheet row as the screen and the export read it. Money is text. */
export type WorksheetLine = {
  id: string;
  variantGid: string;
  productGid: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  barcode: string | null;
  vendor: string | null;
  productType: string | null;
  imageUrl: string | null;
  priceAmount: string | null;
  priceCurrencyCode: string | null;
  unitCostAmount: string | null;
  unitCostCurrencyCode: string | null;
  supplierCostAmount: string | null;
  supplierCostCurrencyCode: string | null;
  supplierId: string | null;
  supplierName: string | null;
  vendorSku: string | null;
  minimumOrderQuantity: number | null;
  packSize: number | null;
  supplierCount: number;
  tracked: boolean;
  availableQuantity: number | null;
  onHandQuantity: number | null;
  committedQuantity: number | null;
  incomingQuantity: number | null;
  netUnits: number | null;
  distinctOrders: number | null;
  revenueAmount: string | null;
  unitsPerDay: string | null;
  abcClass: AbcClass | null;
  stockStatus: StockStatus;
  daysOfStock: string | null;
  depletionDate: string | null;
  leadTimeDays: number | null;
  leadTimeSource: LeadTimeSource | null;
  reorderPoint: number | null;
  reorderPointSource: ReorderPointSource | null;
  forecastDemand: string | null;
  parityQuantity: number | null;
  suggestedQuantity: number | null;
  finalQuantity: number | null;
  orderQuantity: number;
  warningCodes: WarningCode[];
  detail: WorksheetLineDetail;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
};

type DecimalColumn =
  | "priceAmount"
  | "unitCostAmount"
  | "supplierCostAmount"
  | "revenueAmount"
  | "unitsPerDay"
  | "daysOfStock"
  | "forecastDemand";

type LineRow = Omit<
  WorksheetLine,
  | DecimalColumn
  | "abcClass"
  | "detail"
  | "leadTimeSource"
  | "reorderPointSource"
  | "warningCodes"
> &
  Record<DecimalColumn, Prisma.Decimal | null> & {
    abcClass: string | null;
    detail: unknown;
    leadTimeSource: string | null;
    reorderPointSource: string | null;
    warningCodes: string[];
  };

const ABC_CLASSES: readonly AbcClass[] = ["A", "B", "C", "U"];

function text(value: Prisma.Decimal | null): string | null {
  return value == null ? null : value.toFixed();
}

function fixed(value: Prisma.Decimal | null, places: number): string | null {
  return value == null ? null : value.toFixed(places);
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function readDetail(stored: unknown): WorksheetLineDetail {
  const detail = isRecord(stored) ? stored : {};
  const levels = isRecord(detail.levels) ? detail.levels : {};
  const level = (name: string) =>
    typeof levels[name] === "number" ? (levels[name] as number) : null;
  return {
    trace: list<TraceStep>(detail.trace),
    healthTrace: list<TraceStep>(detail.healthTrace),
    warnings: list<Warning>(detail.warnings),
    adjustments: list<RuleAdjustment>(detail.adjustments),
    lowStockReasons: list<string>(detail.lowStockReasons),
    baseNeed: typeof detail.baseNeed === "string" ? detail.baseNeed : null,
    levels: {
      minimumQuantity: level("minimumQuantity"),
      shelfLimitQuantity: level("shelfLimitQuantity"),
      safetyStockQuantity: level("safetyStockQuantity"),
      reorderPointQuantity: level("reorderPointQuantity"),
    },
    suppliers: list<WorksheetLineDetail["suppliers"][number]>(detail.suppliers),
  };
}

function toLine(row: LineRow): WorksheetLine {
  return {
    ...row,
    priceAmount: text(row.priceAmount),
    unitCostAmount: text(row.unitCostAmount),
    supplierCostAmount: text(row.supplierCostAmount),
    revenueAmount: text(row.revenueAmount),
    unitsPerDay: fixed(row.unitsPerDay, 2),
    daysOfStock: fixed(row.daysOfStock, 1),
    forecastDemand: fixed(row.forecastDemand, 2),
    abcClass: (ABC_CLASSES as readonly string[]).includes(row.abcClass ?? "")
      ? (row.abcClass as AbcClass)
      : null,
    leadTimeSource: (LEAD_TIME_SOURCES as readonly string[]).includes(
      row.leadTimeSource ?? "",
    )
      ? (row.leadTimeSource as LeadTimeSource)
      : null,
    reorderPointSource:
      row.reorderPointSource === "MANUAL" || row.reorderPointSource === "AUTOMATIC"
        ? row.reorderPointSource
        : null,
    warningCodes: row.warningCodes as WarningCode[],
    detail: readDetail(row.detail),
  };
}

const LINE_SELECT = {
  id: true,
  variantGid: true,
  productGid: true,
  productTitle: true,
  variantTitle: true,
  sku: true,
  barcode: true,
  vendor: true,
  productType: true,
  imageUrl: true,
  priceAmount: true,
  priceCurrencyCode: true,
  unitCostAmount: true,
  unitCostCurrencyCode: true,
  supplierCostAmount: true,
  supplierCostCurrencyCode: true,
  supplierId: true,
  supplierName: true,
  vendorSku: true,
  minimumOrderQuantity: true,
  packSize: true,
  supplierCount: true,
  tracked: true,
  availableQuantity: true,
  onHandQuantity: true,
  committedQuantity: true,
  incomingQuantity: true,
  netUnits: true,
  distinctOrders: true,
  revenueAmount: true,
  unitsPerDay: true,
  abcClass: true,
  stockStatus: true,
  daysOfStock: true,
  depletionDate: true,
  leadTimeDays: true,
  leadTimeSource: true,
  reorderPoint: true,
  reorderPointSource: true,
  forecastDemand: true,
  parityQuantity: true,
  suggestedQuantity: true,
  finalQuantity: true,
  orderQuantity: true,
  warningCodes: true,
  detail: true,
  purchaseOrderId: true,
  purchaseOrderNumber: true,
} as const;

function lineWhere(
  worksheetId: string,
  view: Pick<WorksheetView, "show" | "query">,
): Record<string, unknown> {
  const where: Record<string, unknown> = { worksheetId };
  switch (view.show) {
    case "TO_ORDER":
      where.orderQuantity = { gt: 0 };
      break;
    case "LOW_STOCK":
      where.stockStatus = { in: ["LOW", "OUT_OF_STOCK"] };
      break;
    case "WARNINGS":
      where.warningCodes = { isEmpty: false };
      break;
    case "EDITED":
      where.finalQuantity = { not: null };
      break;
    case "ALL":
      break;
  }
  if (view.query) {
    // Prisma passes % and _ through to ILIKE as wildcards; search for them literally.
    const contains = {
      contains: view.query.replace(/[\\%_]/g, "\\$&"),
      mode: "insensitive",
    };
    where.OR = [
      { productTitle: contains },
      { variantTitle: contains },
      { sku: contains },
      { barcode: contains },
      { vendorSku: contains },
    ];
  }
  return where;
}

const SORT_COLUMNS: Record<WorksheetSortKey, { column: string; nullable: boolean }> = {
  product: { column: "productTitle", nullable: false },
  sku: { column: "sku", nullable: true },
  vendor: { column: "vendor", nullable: true },
  supplier: { column: "supplierName", nullable: true },
  available: { column: "availableQuantity", nullable: true },
  incoming: { column: "incomingQuantity", nullable: true },
  netUnits: { column: "netUnits", nullable: true },
  unitsPerDay: { column: "unitsPerDay", nullable: true },
  abc: { column: "abcClass", nullable: true },
  daysOfStock: { column: "daysOfStock", nullable: true },
  suggested: { column: "suggestedQuantity", nullable: true },
  order: { column: "orderQuantity", nullable: false },
};

/** Rows without a value sort last in either direction; ties keep a fixed order. */
function lineOrder(sort: WorksheetView["sort"]): Array<Record<string, unknown>> {
  const { column, nullable } = SORT_COLUMNS[sort.key];
  return [
    { [column]: nullable ? { sort: sort.direction, nulls: "last" } : sort.direction },
    { productTitle: "asc" },
    { variantTitle: "asc" },
    { id: "asc" },
  ];
}

export type WorksheetPage = {
  lines: WorksheetLine[];
  /** Rows matching the view's filters, across all pages. */
  matching: number;
  page: number;
  pageCount: number;
};

export async function loadWorksheetPage(
  db: TenantDb,
  worksheetId: string,
  view: WorksheetView,
): Promise<WorksheetPage> {
  const where = lineWhere(worksheetId, view);
  const matching: number = await db.replenishmentWorksheetLine.count({ where });
  const pageCount = Math.max(1, Math.ceil(matching / view.pageSize));
  // A page past the end (a bookmarked page after a filter change) shows the last one.
  const page = Math.min(view.page, pageCount);
  const rows: LineRow[] = await db.replenishmentWorksheetLine.findMany({
    where,
    select: LINE_SELECT,
    orderBy: lineOrder(view.sort),
    skip: (page - 1) * view.pageSize,
    take: view.pageSize,
  });
  return { lines: rows.map(toLine), matching, page, pageCount };
}

const EXPORT_BATCH = 1000;

/** Every row matching the view, in view order, for export. */
export async function* streamWorksheetLines(
  db: TenantDb,
  worksheetId: string,
  view: Pick<WorksheetView, "show" | "query" | "sort">,
): AsyncGenerator<WorksheetLine[]> {
  const where = lineWhere(worksheetId, view);
  const orderBy = lineOrder(view.sort);
  for (let skip = 0; ; skip += EXPORT_BATCH) {
    const rows: LineRow[] = await db.replenishmentWorksheetLine.findMany({
      where,
      select: LINE_SELECT,
      orderBy,
      skip,
      take: EXPORT_BATCH,
    });
    if (rows.length > 0) yield rows.map(toLine);
    if (rows.length < EXPORT_BATCH) return;
  }
}

export async function getWorksheetLine(
  db: TenantDb,
  worksheetId: string,
  lineId: string,
): Promise<WorksheetLine | null> {
  const row: LineRow | null = await db.replenishmentWorksheetLine.findFirst({
    where: { id: lineId, worksheetId },
    select: LINE_SELECT,
  });
  return row ? toLine(row) : null;
}

export type WorksheetEditErrorCode = "line_not_found" | "already_ordered" | "invalid_quantity";

export class WorksheetEditError extends Error {
  constructor(
    readonly code: WorksheetEditErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorksheetEditError";
  }
}

/**
 * Sets the merchant's final quantity for a row, or clears it with null so
 * the row goes back to the suggestion. Rows already on a purchase order are
 * locked: changing them here would no longer change what was ordered.
 */
export async function setFinalQuantity(
  db: TenantDb,
  input: { worksheetId: string; lineId: string; quantity: number | null },
): Promise<{ finalQuantity: number | null; orderQuantity: number }> {
  const { worksheetId, lineId, quantity } = input;
  if (
    quantity != null &&
    (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY)
  ) {
    throw new WorksheetEditError(
      "invalid_quantity",
      `Enter a whole number from 0 to ${MAX_QUANTITY.toLocaleString("en-US")}.`,
    );
  }
  return db.$transaction(async (tx) => {
    const line: { suggestedQuantity: number | null; purchaseOrderId: string | null } | null =
      await tx.replenishmentWorksheetLine.findFirst({
        where: { id: lineId, worksheetId },
        select: { suggestedQuantity: true, purchaseOrderId: true },
      });
    if (!line) {
      throw new WorksheetEditError("line_not_found", "That row is no longer on this worksheet.");
    }
    const orderQuantity = quantity ?? line.suggestedQuantity ?? 0;
    const updated: { count: number } = line.purchaseOrderId
      ? { count: 0 }
      : await tx.replenishmentWorksheetLine.updateMany({
          where: { id: lineId, worksheetId, purchaseOrderId: null },
          data: { finalQuantity: quantity, orderQuantity },
        });
    if (updated.count === 0) {
      throw new WorksheetEditError(
        "already_ordered",
        "This row is already on a purchase order. Change the quantity on the purchase order instead.",
      );
    }
    return { finalQuantity: quantity, orderQuantity };
  });
}
