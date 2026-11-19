/**
 * One variant's daily demand for Smart Forecast, from the same sales history
 * the reports and the parity worksheet read.
 */
import { loadSalesHistory } from "../analytics/sales-history.server";
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

/**
 * Daily net units for the variant up to `endLocalDate`, starting no earlier
 * than the shop's stored order history, so a day before it is never read as
 * a day without sales. Stock-out days are not known to the app yet, so every
 * day is marked as unknown rather than in stock.
 */
export async function loadDemandHistory(
  db: TenantDb,
  input: {
    variantGid: string;
    endLocalDate: LocalDate;
    horizonDays: number;
    averageDays: number;
    timeZone: string;
    currencyCode: string | null;
    installedAt: Date | null;
  },
): Promise<DemandHistoryResult> {
  const wanted = demandHistoryDays(input.horizonDays, input.averageDays);
  const requestedStart = addDays(input.endLocalDate, -(wanted - 1));
  const history = await loadSalesHistory(db, {
    startLocalDate: requestedStart,
    endLocalDate: input.endLocalDate,
    timeZone: input.timeZone,
    reportCurrency: input.currencyCode,
    variantGids: [input.variantGid],
    installedAt: input.installedAt,
  });

  const historyStart = history.coverage.historyStartLocalDate;
  if (historyStart == null || compareLocalDates(historyStart, input.endLocalDate) > 0) {
    return { days: [], startLocalDate: null };
  }
  const start =
    compareLocalDates(historyStart, requestedStart) > 0 ? historyStart : requestedStart;

  const units = new Map<LocalDate, number>();
  for (const day of history.daily) {
    if (day.variantGid === input.variantGid) units.set(day.localDate, day.netUnits);
  }
  const days: DemandDay[] = [];
  for (let date = start; compareLocalDates(date, input.endLocalDate) <= 0; date = addDays(date, 1)) {
    days.push({ date, units: units.get(date) ?? 0, inStock: null });
  }
  return { days, startLocalDate: start };
}
