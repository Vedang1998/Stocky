import type { TenantDb } from "../../tenant/tenant-db.server";
import {
  TERMINAL_OPERATION_STATUSES,
  type InventoryOperationStatus,
} from "../inventory-writes/types";
import { findVariantsById } from "../inventory-writes/variant-items.server";
import {
  STOCKTAKE_SOURCE_TYPE,
  stocktakeLineDelta,
  type StocktakeCountSource,
  type StocktakeExpectedSource,
  type StocktakeQuantityBasis,
  type StocktakeScope,
  type StocktakeStatus,
} from "./stocktake.server";

export const STOCKTAKE_LIST_PAGE_SIZE = 20;
export const STOCKTAKE_LINE_PAGE_SIZE = 50;
/** Catalog matches a line search looks at; a broader search asks for a narrower term. */
const SEARCH_MATCH_LIMIT = 500;
const MAX_SEARCH_LENGTH = 100;
const LOOKUP_CHUNK = 2_000;

export const STOCKTAKE_LIST_VIEWS = ["open", "closed"] as const;
export type StocktakeListView = (typeof STOCKTAKE_LIST_VIEWS)[number];

export const STOCKTAKE_LINE_FILTERS = [
  "all",
  "uncounted",
  "counted",
  "differences",
  "movement",
] as const;
export type StocktakeLineFilter = (typeof STOCKTAKE_LINE_FILTERS)[number];

export interface StocktakeHeader {
  id: string;
  name: string;
  locationId: string;
  status: StocktakeStatus;
  scope: StocktakeScope;
  quantityBasis: StocktakeQuantityBasis;
  expectedSource: StocktakeExpectedSource;
  blind: boolean;
  createdAt: Date;
  startedAt: Date | null;
  startedByUserId: string | null;
  completedAt: Date | null;
  completedByUserId: string | null;
  cancelledAt: Date | null;
  cancelledByUserId: string | null;
}

export interface StocktakeListEntry extends StocktakeHeader {
  lineCount: number;
  countedCount: number;
}

export interface StocktakeProgress {
  lineCount: number;
  countedCount: number;
  uncountedCount: number;
  /** Lines counted as zero by the "mark uncounted as zero" step. */
  zeroFilledCount: number;
  /** Counted lines whose count will change stock. */
  differenceCount: number;
  unitsOver: number;
  unitsShort: number;
  /** Counted lines whose stock moved in Shopify and that nobody has reviewed. */
  movementReviewCount: number;
}

export interface StocktakeLineView {
  id: string;
  shopifyVariantId: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  expectedQty: number;
  countedQty: number | null;
  /** Counted minus the quantity it is measured from; null until counted. */
  delta: number | null;
  countSource: StocktakeCountSource | null;
  countedAt: Date | null;
  countedByUserId: string | null;
  movementDetectedQty: number | null;
  movementBaselineQty: number | null;
  movementReviewedAt: Date | null;
}

const HEADER_SELECT = {
  id: true,
  name: true,
  locationId: true,
  status: true,
  scope: true,
  quantityBasis: true,
  expectedSource: true,
  blind: true,
  createdAt: true,
  startedAt: true,
  startedByUserId: true,
  completedAt: true,
  completedByUserId: true,
  cancelledAt: true,
  cancelledByUserId: true,
} as const;

const LINE_SELECT = {
  id: true,
  shopifyVariantId: true,
  expectedQty: true,
  countedQty: true,
  countSource: true,
  countedAt: true,
  countedByUserId: true,
  movementDetectedQty: true,
  movementBaselineQty: true,
  movementReviewedAt: true,
} as const;

type LineRow = Omit<StocktakeLineView, "title" | "sku" | "barcode" | "delta">;

function chunked<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < values.length; start += size) {
    chunks.push(values.slice(start, start + size));
  }
  return chunks;
}

/** A 1-based page number from a query string; anything else is page 1. */
export function readPageNumber(value: string | null): number {
  if (!value || !/^\d{1,6}$/.test(value)) return 1;
  return Math.max(1, Number(value));
}

export function readLineFilter(value: string | null): StocktakeLineFilter {
  return (STOCKTAKE_LINE_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as StocktakeLineFilter)
    : "all";
}

export function readListView(value: string | null): StocktakeListView {
  return value === "closed" ? "closed" : "open";
}

export function readLineSearch(value: string | null): string {
  return (value ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
}

/**
 * One page of counts, newest first: the open ones (in progress), or the
 * closed ones (completed and cancelled), each with how far it has got.
 */
export async function listStocktakes(
  db: TenantDb,
  input: { view: StocktakeListView; page: number },
): Promise<{ stocktakes: StocktakeListEntry[]; hasMore: boolean }> {
  const rows = (await db.stocktake.findMany({
    where: {
      status:
        input.view === "open"
          ? { in: ["DRAFT", "IN_PROGRESS"] }
          : { in: ["COMPLETED", "CANCELLED"] },
    },
    select: HEADER_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (input.page - 1) * STOCKTAKE_LIST_PAGE_SIZE,
    // One more than a page, to know whether another page exists.
    take: STOCKTAKE_LIST_PAGE_SIZE + 1,
  })) as StocktakeHeader[];
  const page = rows.slice(0, STOCKTAKE_LIST_PAGE_SIZE);

  const stocktakes = await Promise.all(
    page.map(async (stocktake) => {
      const [lineCount, countedCount] = (await Promise.all([
        db.stocktakeLineItem.count({ where: { stocktakeId: stocktake.id } }),
        db.stocktakeLineItem.count({
          where: { stocktakeId: stocktake.id, countedQty: { not: null } },
        }),
      ])) as [number, number];
      return { ...stocktake, lineCount, countedCount };
    }),
  );
  return { stocktakes, hasMore: rows.length > STOCKTAKE_LIST_PAGE_SIZE };
}

export async function getStocktake(
  db: TenantDb,
  stocktakeId: string,
): Promise<StocktakeHeader | null> {
  return (await db.stocktake.findFirst({
    where: { id: stocktakeId },
    select: HEADER_SELECT,
  })) as StocktakeHeader | null;
}

/** How far a count has got, from all of its lines. */
export async function getStocktakeProgress(
  db: TenantDb,
  stocktakeId: string,
): Promise<StocktakeProgress> {
  const lines = (await db.stocktakeLineItem.findMany({
    where: { stocktakeId },
    select: {
      expectedQty: true,
      countedQty: true,
      countSource: true,
      movementDetectedQty: true,
      movementBaselineQty: true,
      movementReviewedAt: true,
    },
  })) as Array<
    Pick<
      LineRow,
      | "expectedQty"
      | "countedQty"
      | "countSource"
      | "movementDetectedQty"
      | "movementBaselineQty"
      | "movementReviewedAt"
    >
  >;

  const progress: StocktakeProgress = {
    lineCount: lines.length,
    countedCount: 0,
    uncountedCount: 0,
    zeroFilledCount: 0,
    differenceCount: 0,
    unitsOver: 0,
    unitsShort: 0,
    movementReviewCount: 0,
  };
  for (const line of lines) {
    const delta = stocktakeLineDelta(line);
    if (delta === null) {
      progress.uncountedCount += 1;
      continue;
    }
    progress.countedCount += 1;
    if (line.countSource === "ZERO_FILL") progress.zeroFilledCount += 1;
    if (delta > 0) progress.unitsOver += delta;
    if (delta < 0) progress.unitsShort -= delta;
    if (delta !== 0) progress.differenceCount += 1;
    if (line.movementDetectedQty !== null && line.movementReviewedAt === null) {
      progress.movementReviewCount += 1;
    }
  }
  return progress;
}

async function describeLines(
  db: TenantDb,
  rows: readonly LineRow[],
): Promise<StocktakeLineView[]> {
  const catalog = await findVariantsById(
    db,
    rows.map((row) => row.shopifyVariantId),
  );
  return rows.map((row) => {
    const variant = catalog.get(row.shopifyVariantId);
    return {
      ...row,
      title: variant?.title ?? row.shopifyVariantId,
      sku: variant?.sku ?? null,
      barcode: variant?.barcode ?? null,
      delta: stocktakeLineDelta(row),
    };
  });
}

/**
 * The variants a search term names, by title, SKU or barcode. `tooBroad` is
 * set when more variants match than a search looks at.
 */
async function searchVariantIds(
  db: TenantDb,
  search: string,
): Promise<{ variantIds: string[]; tooBroad: boolean }> {
  const rows = (await db.shopifyVariantCache.findMany({
    where: {
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ],
    },
    select: { shopifyVariantId: true },
    orderBy: { shopifyVariantId: "asc" },
    take: SEARCH_MATCH_LIMIT + 1,
  })) as Array<{ shopifyVariantId: string }>;
  return {
    variantIds: rows
      .slice(0, SEARCH_MATCH_LIMIT)
      .map((row) => row.shopifyVariantId),
    tooBroad: rows.length > SEARCH_MATCH_LIMIT,
  };
}

const FILTER_WHERE: Record<
  Exclude<StocktakeLineFilter, "differences">,
  Record<string, unknown>
> = {
  all: {},
  uncounted: { countedQty: null },
  counted: { countedQty: { not: null } },
  movement: {
    countedQty: { not: null },
    movementDetectedQty: { not: null },
    movementReviewedAt: null,
  },
};

/** One page of a count's lines, in the order they were put on the sheet. */
export async function getStocktakeLines(
  db: TenantDb,
  input: {
    stocktakeId: string;
    filter: StocktakeLineFilter;
    search: string;
    page: number;
  },
): Promise<{
  lines: StocktakeLineView[];
  total: number;
  page: number;
  pageCount: number;
  /** The search matched more catalog items than it looks at; results may be incomplete. */
  searchTooBroad: boolean;
}> {
  const empty = (searchTooBroad = false) => ({
    lines: [],
    total: 0,
    page: 1,
    pageCount: 1,
    searchTooBroad,
  });

  let variantFilter: Record<string, unknown> = {};
  let searchTooBroad = false;
  if (input.search) {
    const found = await searchVariantIds(db, input.search);
    if (found.variantIds.length === 0) return empty();
    variantFilter = { shopifyVariantId: { in: found.variantIds } };
    searchTooBroad = found.tooBroad;
  }
  const skipFor = (total: number) => {
    const pageCount = Math.max(1, Math.ceil(total / STOCKTAKE_LINE_PAGE_SIZE));
    const page = Math.min(input.page, pageCount);
    return { page, pageCount, skip: (page - 1) * STOCKTAKE_LINE_PAGE_SIZE };
  };

  if (input.filter === "differences") {
    // Whether a line differs depends on two of its own columns, which a
    // filter cannot compare; the counted lines are narrowed here instead.
    const counted = (await db.stocktakeLineItem.findMany({
      where: {
        stocktakeId: input.stocktakeId,
        countedQty: { not: null },
        ...variantFilter,
      },
      select: {
        id: true,
        expectedQty: true,
        countedQty: true,
        movementBaselineQty: true,
      },
      orderBy: { id: "asc" },
    })) as Array<
      Pick<LineRow, "id" | "expectedQty" | "countedQty" | "movementBaselineQty">
    >;
    const ids = counted
      .filter((line) => stocktakeLineDelta(line) !== 0)
      .map((line) => line.id);
    const { page, pageCount, skip } = skipFor(ids.length);
    const pageIds = ids.slice(skip, skip + STOCKTAKE_LINE_PAGE_SIZE);
    const rows =
      pageIds.length === 0
        ? []
        : ((await db.stocktakeLineItem.findMany({
            where: { stocktakeId: input.stocktakeId, id: { in: pageIds } },
            select: LINE_SELECT,
            orderBy: { id: "asc" },
          })) as LineRow[]);
    return {
      lines: await describeLines(db, rows),
      total: ids.length,
      page,
      pageCount,
      searchTooBroad,
    };
  }

  const where = {
    stocktakeId: input.stocktakeId,
    ...FILTER_WHERE[input.filter],
    ...variantFilter,
  };
  const total = (await db.stocktakeLineItem.count({ where })) as number;
  const { page, pageCount, skip } = skipFor(total);
  const rows = (await db.stocktakeLineItem.findMany({
    where,
    select: LINE_SELECT,
    orderBy: { id: "asc" },
    skip,
    take: STOCKTAKE_LINE_PAGE_SIZE,
  })) as LineRow[];
  return {
    lines: await describeLines(db, rows),
    total,
    page,
    pageCount,
    searchTooBroad,
  };
}

/** Every line of a count, for the count report. */
export async function listStocktakeLinesForExport(
  db: TenantDb,
  stocktakeId: string,
): Promise<StocktakeLineView[]> {
  const rows = (await db.stocktakeLineItem.findMany({
    where: { stocktakeId },
    select: LINE_SELECT,
    orderBy: { id: "asc" },
  })) as LineRow[];
  const lines: StocktakeLineView[] = [];
  for (const part of chunked(rows, LOOKUP_CHUNK)) {
    lines.push(...(await describeLines(db, part)));
  }
  return lines;
}

export interface StocktakeLedgerSummary {
  /** Attempts to apply this count that reached the ledger. */
  attemptCount: number;
  /** Shopify has not finished answering the last attempt. */
  unfinished: boolean;
  /** Changes Shopify has confirmed for this count so far. */
  appliedChangeCount: number;
  /** Changes Shopify refused in the last attempt. */
  refusedChangeCount: number;
}

/** What the inventory ledger holds for a count: whether applying it has started, and how far it got. */
export async function getStocktakeLedgerSummary(
  db: TenantDb,
  stocktakeId: string,
): Promise<StocktakeLedgerSummary> {
  const operations = (await db.inventoryOperation.findMany({
    where: { sourceType: STOCKTAKE_SOURCE_TYPE, sourceId: stocktakeId },
    select: {
      status: true,
      appliedLineCount: true,
      failedLineCount: true,
      conflictLineCount: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })) as Array<{
    status: InventoryOperationStatus;
    appliedLineCount: number;
    failedLineCount: number;
    conflictLineCount: number;
  }>;
  const last = operations.at(-1);
  return {
    attemptCount: operations.length,
    unfinished: operations.some(
      (operation) => !TERMINAL_OPERATION_STATUSES.has(operation.status),
    ),
    appliedChangeCount: operations.reduce(
      (sum, operation) => sum + operation.appliedLineCount,
      0,
    ),
    refusedChangeCount: last
      ? last.failedLineCount + last.conflictLineCount
      : 0,
  };
}
