/**
 * Smart Forecast for one worksheet row, run when the merchant asks for it in
 * the row's detail. Read-only: it never changes the worksheet or its parity
 * suggestion. No page of its own.
 */
import type { LoaderFunctionArgs } from "react-router";
import { hasCapability } from "../billing/entitlements";
import { getShopEntitlements, requireCapability } from "../billing/entitlements.server";
import type { SmartForecastLoaderResult } from "../components/replenishment/types";
import { getWorksheet, getWorksheetLine } from "../lib/replenishment/worksheet/store.server";
import type { SmartForecast } from "../lib/smart-forecast";
import {
  SMART_FORECAST_METHOD_MESSAGE,
  SMART_FORECAST_PLAN_MESSAGE,
  smartForecastBasis,
  smartForecastsForRows,
} from "../lib/smart-forecast/worksheet.server";
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
    return { ok: false, reason: "PLAN", message: SMART_FORECAST_PLAN_MESSAGE };
  }

  const search = new URL(request.url).searchParams;
  const worksheet = await getWorksheet(db, search.get("worksheetId") ?? "");
  const line = worksheet
    ? await getWorksheetLine(db, worksheet.id, search.get("lineId") ?? "")
    : null;
  if (!worksheet || !line) {
    return { ok: false, reason: "UNAVAILABLE", message: "That row is no longer on this worksheet." };
  }

  const basis = smartForecastBasis(worksheet);
  if (!basis) return { ok: false, reason: "METHOD", message: SMART_FORECAST_METHOD_MESSAGE };

  const profile = await readShopReportingProfile(tenant);
  const { historyDays, byRow } = await smartForecastsForRows(db, {
    basis,
    rows: [line],
    currencyCode: worksheet.summary?.currencyCode ?? profile.currencyCode,
    installedAt: profile.installedAt,
  });
  return { ok: true, forecast: byRow.get(line.id) as SmartForecast, historyDays };
};
