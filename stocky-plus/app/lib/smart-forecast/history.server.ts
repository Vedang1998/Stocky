/**
 * One variant's daily demand for Smart Forecast, from the same sales history
 * the reports and the parity worksheet read.
 */
import { loadSalesHistory } from "../analytics/sales-history.server";
import { enumerateLocalDates, localRangeToUtc } from "../analytics/shop-calendar";
import { addDays, compareLocalDates, type LocalDate } from "../replenishment/local-date";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { MAX_ORIGINS, ORIGIN_STEP_DAYS } from "./backtest";
import type { DemandDay } from "./forecast";
import { minimumHistory, SMART_MODELS } from "./models";

/**
 * Days of history that give every model enough to forecast from at the
 * oldest backtest cut, with all cuts in the past.
 */
export function demandHistoryDays(horizonDays: number, averageDays: number): number {
  const longest = Math.max(
    ...SMART_MODELS.map((model) => minimumHistory(model, { averageDays })),
  );
  return longest + ORIGIN_STEP_DAYS * (MAX_ORIGINS - 1) + horizonDays;
}

export type DemandHistoryResult = {
  days: DemandDay[];
  /** Null when the app has no order history for the shop yet. */
  startLocalDate: LocalDate | null;
};

/** The history window holds more orders than the caller allowed reading. */
export class DemandHistoryTooLargeError extends Error {
  constructor(readonly orders: number, readonly maxOrders: number) {
    super(`The sales history holds ${orders} orders; at most ${maxOrders} are read here.`);
    this.name = "DemandHistoryTooLargeError";
  }
}

type HistoryWindow = {
  endLocalDate: LocalDate;
  horizonDays: number;
  averageDays: number;
  timeZone: string;
  currencyCode: string | null;
  installedAt: Date | null;
};

/**
 * Daily net units for each variant up to `endLocalDate`, from one read of the
 * sales history. Days start no earlier than the shop's stored order history,
 * so a day before it is never read as a day without sales. Stock-out days are
 * not known to the app yet, so every day is marked as unknown rather than in
 * stock. Every requested variant gets an entry, with the same days.
 */
export async function loadDemandHistories(
  db: TenantDb,
  input: HistoryWindow & {
    variantGids: readonly string[];
    /**
     * The sales history read scans every order in the window, not only the
     * requested variants. When set, a window with more orders than this is
     * refused with `DemandHistoryTooLargeError` after one count.
     */
    maxOrders?: number;
  },
): Promise<{ startLocalDate: LocalDate | null; byVariant: Map<string, DemandDay[]> }> {
  const byVariant = new Map<string, DemandDay[]>();
  const variantGids = [...new Set(input.variantGids)];
  if (variantGids.length === 0) return { startLocalDate: null, byVariant };

  const wanted = demandHistoryDays(input.horizonDays, input.averageDays);
  const requestedStart = addDays(input.endLocalDate, -(wanted - 1));
  if (input.maxOrders != null) {
    const { startUtc, endUtcExclusive } = localRangeToUtc(
      requestedStart,
      input.endLocalDate,
      input.timeZone,
    );
    // Must count the same orders the scan below reads: live orders by
    // processedAt over the same local-date window (see loadSalesHistory).
    // If the scan's filter or timestamp changes, change this count with it.
    const orders: number = await db.shopifyOrderFact.count({
      where: { existenceState: "LIVE", processedAt: { gte: startUtc, lt: endUtcExclusive } },
    });
    if (orders > input.maxOrders) throw new DemandHistoryTooLargeError(orders, input.maxOrders);
  }
  const history = await loadSalesHistory(db, {
    startLocalDate: requestedStart,
    endLocalDate: input.endLocalDate,
    timeZone: input.timeZone,
    reportCurrency: input.currencyCode,
    variantGids,
    installedAt: input.installedAt,
  });

  const historyStart = history.coverage.historyStartLocalDate;
  const hasHistory =
    historyStart != null && compareLocalDates(historyStart, input.endLocalDate) <= 0;
  const start = !hasHistory
    ? null
    : compareLocalDates(historyStart, requestedStart) > 0
      ? historyStart
      : requestedStart;
  const dates = start == null ? [] : enumerateLocalDates(start, input.endLocalDate);

  const units = new Map<string, Map<LocalDate, number>>();
  for (const day of history.daily) {
    let variant = units.get(day.variantGid);
    if (!variant) units.set(day.variantGid, (variant = new Map()));
    variant.set(day.localDate, day.netUnits);
  }
  for (const gid of variantGids) {
    const sold = units.get(gid);
    byVariant.set(
      gid,
      dates.map((date) => ({ date, units: sold?.get(date) ?? 0, inStock: null })),
    );
  }
  return { startLocalDate: start, byVariant };
}

/** One variant's daily demand; see `loadDemandHistories`. */
export async function loadDemandHistory(
  db: TenantDb,
  input: HistoryWindow & { variantGid: string },
): Promise<DemandHistoryResult> {
  const { variantGid, ...window } = input;
  const result = await loadDemandHistories(db, { ...window, variantGids: [variantGid] });
  return {
    days: result.byVariant.get(variantGid) ?? [],
    startLocalDate: result.startLocalDate,
  };
}
