/**
 * Smart Forecast for one worksheet row, run when the merchant asks for it in
 * the row's detail. Read-only: it never changes the worksheet or its parity
 * suggestion. No page of its own.
 */
import type { LoaderFunctionArgs } from "react-router";
import { hasCapability } from "../billing/entitlements";
import { getShopEntitlements, requireCapability } from "../billing/entitlements.server";
import type { SmartForecastLoaderResult } from "../components/replenishment/types";
import { addDays } from "../lib/replenishment/local-date";
import { getWorksheet, getWorksheetLine } from "../lib/replenishment/worksheet/store.server";
import { smartForecast } from "../lib/smart-forecast";
import { loadDemandHistory } from "../lib/smart-forecast/history.server";
import { readShopReportingProfile } from "../tenant/bootstrap.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

export const loader = async ({
  request,
  params,
}: LoaderFunctionArgs): Promise<SmartForecastLoaderResult> => {
  const { admin, tenant, db } = await requireAdminTenant({ request, params });
  const entitlements = await getShopEntitlements({ admin, db });
  requireCapability(entitlements, "core.replenishment");
  if (!hasCapability(entitlements, "forecast.smart")) {
    return {
      ok: false,
      reason: "PLAN",
      message: "Smart Forecast is included in the Pro plan.",
    };
  }

  const search = new URL(request.url).searchParams;
  const worksheet = await getWorksheet(db, search.get("worksheetId") ?? "");
  const line = worksheet
    ? await getWorksheetLine(db, worksheet.id, search.get("lineId") ?? "")
    : null;
  if (!worksheet || !line) {
    return { ok: false, reason: "UNAVAILABLE", message: "That row is no longer on this worksheet." };
  }

  // The baseline every Smart Forecast method must beat is the recent
  // average, which is what "Last X days" calculates. Other methods read
  // different days, so the comparison would not be like for like.
  const runParams = worksheet.settings?.params;
  if (runParams?.method !== "LAST_X_DAYS") {
    return {
      ok: false,
      reason: "METHOD",
      message:
        "Smart Forecast is compared with the Last X days method, so it is available on worksheets made with that method.",
    };
  }
  const averageDays = runParams.sampleDays;

  const profile = await readShopReportingProfile(tenant);
  const history = await loadDemandHistory(db, {
    variantGid: line.variantGid,
    // The worksheet's own last complete day, so the forecast matches the snapshot.
    endLocalDate: addDays(worksheet.asOfLocalDate, -1),
    horizonDays: runParams.suggestDays,
    averageDays,
    timeZone: worksheet.timeZone,
    currencyCode: worksheet.summary?.currencyCode ?? profile.currencyCode,
    installedAt: profile.installedAt,
  });

  return {
    ok: true,
    forecast: smartForecast({
      days: history.days,
      horizonDays: runParams.suggestDays,
      averageDays,
      available: line.availableQuantity,
      incoming: line.incomingQuantity,
    }),
    historyDays: history.days.length,
  };
};
