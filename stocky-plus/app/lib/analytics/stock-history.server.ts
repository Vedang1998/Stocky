/**
 * Read side of the daily stock history (`docs/reports/DAILY_STOCK_SNAPSHOTS.md`).
 *
 * Shopify serves no past inventory levels, so the app keeps its own copy of
 * each shop-local day. A day with no snapshot row was not captured; nothing
 * here fills it in or substitutes another day.
 */
import type { TenantDb } from "../../tenant/tenant-db.server";
import { toDecimalOrNull, type Decimal } from "./money";
import type { LocalDate } from "./shop-calendar";

const PAGE_SIZE = 2000;

export type StockSnapshotDay = {
  localDate: LocalDate;
  /** The shop's zone when the day was captured. */
  timeZone: string;
  /** The instant the stock was read. */
  capturedAt: Date;
  /** Tracked variant-and-location rows captured; 0 means no tracked stock. */
  levelCount: number;
};

export type StockDayTotals = {
  localDate: LocalDate;
  /** Sum of the on-hand quantities Shopify had reported; null when none were. */
  onHand: number | null;
  /** Rows whose on-hand quantity Shopify had not reported. */
  unreportedLevels: number;
};

export type HistoricalStockLevel = {
  variantGid: string;
  locationGid: string;
  available: number | null;
  onHand: number | null;
  unitCost: Decimal | null;
  unitCostCurrencyCode: string | null;
  price: Decimal;
  priceCurrencyCode: string;
};

/** Captured days from `start` to `end`, both included, oldest first. */
export async function loadStockSnapshotDays(
  db: TenantDb,
  start: LocalDate,
  end: LocalDate,
): Promise<StockSnapshotDay[]> {
  const rows: Array<{
    localDate: string;
    timeZone: string;
    capturedAt: Date;
    levelCount: number;
  }> = await db.dailyStockSnapshot.findMany({
    where: { localDate: { gte: start, lte: end } },
    select: {
      localDate: true,
      timeZone: true,
      capturedAt: true,
      levelCount: true,
    },
    orderBy: { localDate: "asc" },
  });
  return rows;
}

/** The oldest captured day, or null when nothing has been captured yet. */
export async function loadFirstStockSnapshotDate(
  db: TenantDb,
): Promise<LocalDate | null> {
  const first: { localDate: string } | null =
    await db.dailyStockSnapshot.findFirst({
      select: { localDate: true },
      orderBy: { localDate: "asc" },
    });
  return first?.localDate ?? null;
}

/** One total per captured day in the range, summed by the database. */
export async function loadStockDayTotals(
  db: TenantDb,
  start: LocalDate,
  end: LocalDate,
): Promise<StockDayTotals[]> {
  const groups: Array<{
    localDate: string;
    _count: { _all: number; onHandQuantity: number };
    _sum: { onHandQuantity: number | null };
  }> = await db.dailyStockLevel.groupBy({
    by: ["localDate"],
    where: { localDate: { gte: start, lte: end } },
    _count: { _all: true, onHandQuantity: true },
    _sum: { onHandQuantity: true },
    orderBy: { localDate: "asc" },
  });
  return groups.map((group) => ({
    localDate: group.localDate,
    onHand: group._sum.onHandQuantity,
    unreportedLevels: group._count._all - group._count.onHandQuantity,
  }));
}

/** Every variant-and-location row captured for one day. */
export async function loadStockLevelsOn(
  db: TenantDb,
  localDate: LocalDate,
): Promise<HistoricalStockLevel[]> {
  const levels: HistoricalStockLevel[] = [];
  let afterId: string | null = null;
  for (;;) {
    const page: Array<{
      id: string;
      variantGid: string;
      locationGid: string;
      availableQuantity: number | null;
      onHandQuantity: number | null;
      unitCostAmount: Decimal | null;
      unitCostCurrencyCode: string | null;
      priceAmount: Decimal;
      priceCurrencyCode: string;
    }> = await db.dailyStockLevel.findMany({
      where: { localDate, ...(afterId ? { id: { gt: afterId } } : {}) },
      select: {
        id: true,
        variantGid: true,
        locationGid: true,
        availableQuantity: true,
        onHandQuantity: true,
        unitCostAmount: true,
        unitCostCurrencyCode: true,
        priceAmount: true,
        priceCurrencyCode: true,
      },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
    });
    for (const row of page) {
      levels.push({
        variantGid: row.variantGid,
        locationGid: row.locationGid,
        available: row.availableQuantity,
        onHand: row.onHandQuantity,
        unitCost: toDecimalOrNull(row.unitCostAmount),
        unitCostCurrencyCode: row.unitCostCurrencyCode,
        price: toDecimalOrNull(row.priceAmount) as Decimal,
        priceCurrencyCode: row.priceCurrencyCode,
      });
    }
    if (page.length < PAGE_SIZE) break;
    afterId = page[page.length - 1].id;
  }
  return levels;
}
