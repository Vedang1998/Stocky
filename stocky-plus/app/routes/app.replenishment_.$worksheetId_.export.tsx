import type { LoaderFunctionArgs } from "react-router";
import { getShopEntitlements, requireCapability } from "../billing/entitlements.server";
import { csvDownloadResponse, toCsv } from "../lib/csv.server";
import {
  WORKSHEET_CSV_HEADERS,
  worksheetCsvRow,
} from "../lib/replenishment/worksheet/export";
import {
  getWorksheet,
  streamWorksheetLines,
} from "../lib/replenishment/worksheet/store.server";
import { parseWorksheetView } from "../lib/replenishment/worksheet/view";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

/** The worksheet as CSV, with the same search, filter and order as the screen. */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, db } = await requireAdminTenant({ request, params });
  requireCapability(await getShopEntitlements({ admin, db }), "core.replenishment");

  const worksheet = params.worksheetId ? await getWorksheet(db, params.worksheetId) : null;
  if (!worksheet) {
    return new Response("That worksheet no longer exists.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const view = parseWorksheetView(new URL(request.url).searchParams);
  const salesDays = worksheet.summary?.salesWindow.days ?? null;
  const rows = [];
  for await (const lines of streamWorksheetLines(db, worksheet.id, view)) {
    for (const line of lines) rows.push(worksheetCsvRow(line, salesDays));
  }
  return csvDownloadResponse(
    toCsv(WORKSHEET_CSV_HEADERS, rows),
    `replenishment-${worksheet.asOfLocalDate}.csv`,
  );
};
