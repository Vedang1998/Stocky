import { reportQuery, type ReportLinkState } from "../../lib/reports/links";
import type { ReportPage } from "../../lib/reports/registry.server";
import { CsvDownloadButton } from "./CsvDownloadButton";
import { ReportFilters } from "./ReportFilters";
import { ReportTable } from "./ReportTable";

/** A computed report: notices, filters, totals, the table and how it is calculated. */
export function ReportView({ page }: { page: ReportPage }) {
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
  // Form fields and download status belong to one view of one report.
  const viewKey = `${report.id}?${reportQuery(linkState)}`;
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
        <s-banner
          key={notice.heading}
          tone={notice.tone}
          heading={notice.heading}
        >
          <s-paragraph>{notice.body}</s-paragraph>
        </s-banner>
      ))}

      <ReportFilters
        key={viewKey}
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
              <s-box
                key={tile.label}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="block" gap="small-300">
                  <s-text color="subdued">{tile.label}</s-text>
                  <s-heading>{tile.value}</s-heading>
                  {tile.detail && (
                    <s-text color="subdued">{tile.detail}</s-text>
                  )}
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading={report.title}>
        <s-stack direction="block" gap="base">
          {table.filteredRows > 0 && (
            <CsvDownloadButton
              key={viewKey}
              href={`${basePath}/export?${reportQuery(linkState, { page: 1 })}`}
              fallbackFilename={`${report.id}.csv`}
            />
          )}
          {table.filteredRows > page.exportRowLimit && (
            <s-text color="subdued">
              A CSV download holds the first{" "}
              {page.exportRowLimit.toLocaleString("en-US")} rows.
            </s-text>
          )}
          <ReportTable
            columns={page.columns}
            table={table}
            basePath={basePath}
            linkState={linkState}
            filtered={filtered}
          />
        </s-stack>
      </s-section>

      <s-section heading="About this report">
        <s-stack direction="block" gap="base">
          <s-paragraph>{report.description}</s-paragraph>
          <s-paragraph>
            {page.dataAsOf
              ? `Includes Shopify changes up to ${page.dataAsOf}.`
              : "No Shopify data has been synced for this report yet."}
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section heading="How these numbers are calculated">
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
