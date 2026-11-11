import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { CsvDownloadButton } from "../components/reports/CsvDownloadButton";
import { ReportFilters } from "../components/reports/ReportFilters";
import { ReportTable } from "../components/reports/ReportTable";
import { AnalyticsPrerequisiteError } from "../lib/analytics/errors";
import { reportQuery, type ReportLinkState } from "../lib/reports/links";
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
            ProPo is still importing your store&apos;s time zone and currency from
            Shopify. Reports need both to place sales on the right day and to
            total money correctly. Check back when the first sync has finished.
          </s-paragraph>
        </s-banner>
      </s-page>
    );
  }

  const { page } = data;
  const { report, request, view, table } = page;
  const basePath = `/app/reports/${report.id}`;
  const linkState: ReportLinkState = {
    usesDateRange: report.usesDateRange,
    range: request.range,
    options: request.options,
    facets: view.facets,
    search: view.search,
    sort: table.sort,
    page: table.page,
  };
  const filtered = view.search !== "" || Object.keys(view.facets).length > 0;
  const definitions = page.columns.filter((column) => column.definition);

  return (
    <s-page heading={report.title} inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app/reports">
        Reports
      </s-link>

      {page.problems.map((problem) => (
        <s-banner key={problem} tone="warning" heading="Date range adjusted">
          <s-paragraph>{problem}</s-paragraph>
        </s-banner>
      ))}
      {page.notices.map((notice) => (
        <s-banner key={notice.heading} tone={notice.tone} heading={notice.heading}>
          <s-paragraph>{notice.body}</s-paragraph>
        </s-banner>
      ))}

      <ReportFilters
        report={report}
        request={request}
        view={view}
        facets={page.facets}
        table={table}
        searchLabels={page.searchLabels}
      />

      <s-section heading={filtered ? "Totals for the rows shown" : "Totals"}>
        <s-stack direction="block" gap="base">
          {report.usesDateRange && (
            <s-text color="subdued">
              {request.range.startLocalDate === request.range.endLocalDate
                ? request.range.startLocalDate
                : `${request.range.startLocalDate} to ${request.range.endLocalDate}`}
              , {page.timeZone} time
            </s-text>
          )}
          <s-stack direction="inline" gap="base">
            {table.tiles.map((tile) => (
              <s-box key={tile.label} padding="base" borderWidth="base" borderRadius="base">
                <s-stack direction="block" gap="small-300">
                  <s-text color="subdued">{tile.label}</s-text>
                  <s-heading>{tile.value}</s-heading>
                  {tile.detail && <s-text color="subdued">{tile.detail}</s-text>}
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading={report.title}>
        <s-stack direction="block" gap="base">
          <ReportTable
            columns={page.columns}
            table={table}
            basePath={basePath}
            linkState={linkState}
            filtered={filtered}
          />
          {table.filteredRows > 0 && (
            <CsvDownloadButton
              href={`${basePath}/export?${reportQuery(linkState, { page: 1 })}`}
              fallbackFilename={`${report.id}.csv`}
            />
          )}
          {table.filteredRows > page.exportRowLimit && (
            <s-text color="subdued">
              A CSV download holds the first {page.exportRowLimit.toLocaleString("en-US")} rows.
            </s-text>
          )}
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="About this report">
        <s-stack direction="block" gap="base">
          <s-paragraph>{report.description}</s-paragraph>
          <s-paragraph>
            {page.dataAsOf
              ? `Includes Shopify changes up to ${page.dataAsOf}.`
              : "No Shopify data has been synced for this report yet."}
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="How these numbers are calculated">
        <s-stack direction="block" gap="base">
          {definitions.map((column) => (
            <s-paragraph key={column.key}>
              <s-text type="strong">{column.label}.</s-text> {column.definition}
            </s-paragraph>
          ))}
          <s-unordered-list>
            {page.methodNotes.map((note) => (
              <s-list-item key={note}>{note}</s-list-item>
            ))}
          </s-unordered-list>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
