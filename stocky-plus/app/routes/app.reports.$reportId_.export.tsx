import type { LoaderFunctionArgs } from "react-router";

import { AnalyticsPrerequisiteError } from "../lib/analytics/errors";
import { csvDownloadResponse, toCsv } from "../lib/csv.server";
import { findReport, loadReportContext } from "../lib/reports/registry.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

/** The report exactly as its page shows it, every filtered row, as CSV. */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { tenant, db } = await requireAdminTenant({ request, params });
  const report = findReport(params.reportId);
  if (!report) throw new Response("Report not found", { status: 404 });

  let context;
  try {
    context = await loadReportContext({ tenant, db });
  } catch (error) {
    if (error instanceof AnalyticsPrerequisiteError) {
      return new Response(
        "This report is not ready yet. Your store's time zone and currency are still being imported.",
        { status: 409 },
      );
    }
    throw error;
  }

  const result = await report.export(
    context,
    new URL(request.url).searchParams,
  );
  const period = report.usesDateRange
    ? `${result.request.range.startLocalDate}-to-${result.request.range.endLocalDate}`
    : context.today;
  const response = csvDownloadResponse(
    toCsv(result.headers, result.rows),
    `${report.id}-${period}.csv`,
  );
  if (result.truncated) response.headers.set("X-Report-Truncated", "true");
  return response;
};
