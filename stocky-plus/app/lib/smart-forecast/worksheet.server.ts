/**
 * Smart Forecast for rows of a saved replenishment worksheet. Read-only: it
 * never changes the worksheet, its rows or their parity suggestions.
 */
import { hasCapability, type ShopEntitlements } from "../../billing/entitlements";
import { addDays, type LocalDate } from "../replenishment/local-date";
import type { WorksheetHeader } from "../replenishment/worksheet/store.server";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { smartForecast, type SmartForecast } from "./forecast";
import { loadDemandHistories } from "./history.server";

export const SMART_FORECAST_PLAN_MESSAGE = "Smart Forecast is included in the Pro plan.";
export const SMART_FORECAST_METHOD_MESSAGE =
  "Smart Forecast is compared with the Last X days method, so it is available on worksheets made with that method.";

/** What every Smart Forecast on a worksheet is measured against. */
export type SmartForecastBasis = {
  horizonDays: number;
  averageDays: number;
  /** The worksheet's own last complete day, so forecasts match the snapshot. */
  endLocalDate: LocalDate;
  timeZone: string;
};

/**
 * The basis for a worksheet, or null when it was not made with "Last X
 * days". The recent average every method must beat is that method's own
 * number; other methods read different days, so the comparison would not be
 * like for like.
 */
export function smartForecastBasis(
  worksheet: Pick<WorksheetHeader, "settings" | "asOfLocalDate" | "timeZone">,
): SmartForecastBasis | null {
  const params = worksheet.settings?.params;
  if (params?.method !== "LAST_X_DAYS") return null;
  return {
    horizonDays: params.suggestDays,
    averageDays: params.sampleDays,
    endLocalDate: addDays(worksheet.asOfLocalDate as LocalDate, -1),
    timeZone: worksheet.timeZone,
  };
}

export type SmartForecastRow = {
  id: string;
  variantGid: string;
  availableQuantity: number | null;
  incomingQuantity: number | null;
};

/**
 * Smart Forecast for each row, keyed by row id, from one read of the sales
 * history. Rows of the same variant share its history.
 */
export async function smartForecastsForRows(
  db: TenantDb,
  input: {
    basis: SmartForecastBasis;
    rows: readonly SmartForecastRow[];
    currencyCode: string | null;
    installedAt: Date | null;
  },
): Promise<{ historyDays: number; byRow: Map<string, SmartForecast> }> {
  const { basis, rows } = input;
  const histories = await loadDemandHistories(db, {
    variantGids: rows.map((row) => row.variantGid),
    endLocalDate: basis.endLocalDate,
    horizonDays: basis.horizonDays,
    averageDays: basis.averageDays,
    timeZone: basis.timeZone,
    currencyCode: input.currencyCode,
    installedAt: input.installedAt,
  });
  const byRow = new Map<string, SmartForecast>();
  let historyDays = 0;
  for (const row of rows) {
    const days = histories.byVariant.get(row.variantGid) ?? [];
    historyDays = days.length;
    byRow.set(
      row.id,
      smartForecast({
        days,
        horizonDays: basis.horizonDays,
        averageDays: basis.averageDays,
        available: row.availableQuantity,
        incoming: row.incomingQuantity,
      }),
    );
  }
  return { historyDays, byRow };
}

/** One row's Smart Forecast, as the worksheet table shows it. */
export type SmartForecastCell = Pick<SmartForecast, "outcome" | "label" | "forecastUnits">;

/** The Smart Forecast column's data for the rows on the page. */
export type SmartForecastColumn =
  | { status: "OFF" }
  | { status: "PLAN" | "METHOD" }
  | { status: "OK"; byRow: Record<string, SmartForecastCell> };

/**
 * The Smart Forecast column for the rows on one worksheet page. Nothing is
 * read unless the merchant chose the column, the shop's plan includes Smart
 * Forecast and the worksheet was made with "Last X days".
 */
export async function smartForecastColumn(
  db: TenantDb,
  input: {
    shown: boolean;
    entitlements: ShopEntitlements;
    worksheet: Pick<WorksheetHeader, "settings" | "asOfLocalDate" | "timeZone" | "summary">;
    rows: readonly SmartForecastRow[];
    shopCurrencyCode: string | null;
    installedAt: Date | null;
  },
): Promise<SmartForecastColumn> {
  if (!input.shown) return { status: "OFF" };
  if (!hasCapability(input.entitlements, "forecast.smart")) {
    return { status: "PLAN" };
  }
  const basis = smartForecastBasis(input.worksheet);
  if (!basis) return { status: "METHOD" };

  const { byRow } = await smartForecastsForRows(db, {
    basis,
    rows: input.rows,
    currencyCode: input.worksheet.summary?.currencyCode ?? input.shopCurrencyCode,
    installedAt: input.installedAt,
  });
  const cells: Record<string, SmartForecastCell> = {};
  for (const [rowId, { outcome, label, forecastUnits }] of byRow) {
    cells[rowId] = { outcome, label, forecastUnits };
  }
  return { status: "OK", byRow: cells };
}
