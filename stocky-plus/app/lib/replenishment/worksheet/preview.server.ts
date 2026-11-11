/**
 * "What if" for one worksheet row: the suggestion under a different method
 * or period, without changing the worksheet.
 *
 * The preview reuses the row's stored stock, levels and supplier terms and
 * the worksheet's own date, so the only thing that differs from the saved
 * suggestion is what the merchant changed. Sales for the new period are read
 * fresh for that one variant.
 */
import { aggregateVariantWindow } from "../../analytics/net-units";
import { loadSalesHistory } from "../../analytics/sales-history.server";
import type { TenantDb } from "../../../tenant/tenant-db.server";
import { computeSuggestion } from "../suggestion";
import type { HistoryCoverage, MethodParameters, SuggestionResult } from "../types";
import { sampleWindowFor } from "../windows";
import { coverageForWindow } from "./generate.server";
import type { WorksheetSettings } from "./settings";
import type { WorksheetLine } from "./store.server";

export type PreviewInput = {
  worksheet: {
    asOfLocalDate: string;
    timeZone: string;
    settings: WorksheetSettings;
    currencyCode: string | null;
  };
  line: WorksheetLine;
  params: MethodParameters;
  installedAt: Date | null;
};

export async function previewLineSuggestion(
  db: TenantDb,
  input: PreviewInput,
): Promise<SuggestionResult> {
  const { worksheet, line, params } = input;
  const window = sampleWindowFor(params, worksheet.asOfLocalDate);

  let netUnits: number | null = null;
  let coverage: HistoryCoverage = { kind: "NONE" };
  if (window) {
    const history = await loadSalesHistory(db, {
      startLocalDate: window.start,
      endLocalDate: window.end,
      timeZone: worksheet.timeZone,
      reportCurrency: worksheet.currencyCode,
      variantGids: [line.variantGid],
      installedAt: input.installedAt,
    });
    coverage = coverageForWindow(window, history.coverage.historyStartLocalDate);
    if (coverage.kind !== "NONE") {
      netUnits = aggregateVariantWindow(history.events)[0]?.netUnits ?? 0;
    }
  }

  return computeSuggestion(
    params,
    window,
    {
      tracked: line.tracked,
      available: line.availableQuantity,
      incoming: line.incomingQuantity,
      incomingSource: worksheet.settings.incomingSource,
      netUnitsInWindow: netUnits,
      coverage,
      minimumQuantity: line.detail.levels.minimumQuantity,
      shelfLimitQuantity: line.detail.levels.shelfLimitQuantity,
      minimumOrderQuantity: line.minimumOrderQuantity,
      packSize: line.packSize,
    },
    worksheet.settings.rounding,
  );
}
