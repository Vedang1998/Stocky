import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { ReportView } from "../components/reports/ReportView";
import { AnalyticsPrerequisiteError } from "../lib/analytics/errors";
import { findReport, loadReportContext } from "../lib/reports/registry.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { tenant, db } = await requireAdminTenant({ request, params });
  const report = findReport(params.reportId);
  if (!report) throw new Response("Report not found", { status: 404 });

  try {
    const context = await loadReportContext({ tenant, db });
    const page = await report.page(context, new URL(request.url).searchParams);
    return { ready: true as const, page };
  } catch (error) {
    if (error instanceof AnalyticsPrerequisiteError) {
      return { ready: false as const, title: report.title };
    }
    throw error;
  }
};

export default function Report() {
  const data = useLoaderData<typeof loader>();

  if (!data.ready) {
    return (
      <s-page heading={data.title}>
        <s-link slot="breadcrumb-actions" href="/app/reports">
          Reports
        </s-link>
        <s-banner tone="info" heading="This report is not ready yet">
          <s-paragraph>
            ProPo is still importing your store&apos;s time zone and currency
            from Shopify. Reports need both to place sales on the right day and
            to total money correctly. Check back when the first sync has
            finished.
          </s-paragraph>
        </s-banner>
      </s-page>
    );
  }

  return <ReportView page={data.page} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
