import {
  nextSort,
  reportQuery,
  type ReportLinkState,
} from "../../lib/reports/links";
import type { ReportPage } from "../../lib/reports/registry.server";
import type { ColumnKind } from "../../lib/reports/types";

type Props = Pick<ReportPage, "columns" | "table"> & {
  basePath: string;
  linkState: ReportLinkState;
  filtered: boolean;
};

function headerFormat(kind: ColumnKind): "numeric" | "currency" | "base" {
  if (kind === "money") return "currency";
  return kind === "integer" || kind === "percent" ? "numeric" : "base";
}

export function ReportTable({
  columns,
  table,
  basePath,
  linkState,
  filtered,
}: Props) {
  const href = (overrides: Parameters<typeof reportQuery>[1]) =>
    `${basePath}?${reportQuery(linkState, overrides)}`;

  if (table.totalRows === 0) {
    return (
      <s-paragraph>There is nothing to report for these settings.</s-paragraph>
    );
  }
  if (table.filteredRows === 0) {
    return (
      <s-stack direction="block" gap="base">
        <s-paragraph>No rows match your filters or search.</s-paragraph>
        {filtered && (
          <s-link
            href={`${basePath}?${reportQuery({ ...linkState, facets: {}, search: "", page: 1 })}`}
          >
            Clear filters and search
          </s-link>
        )}
      </s-stack>
    );
  }

  const firstRow = (table.page - 1) * table.pageSize + 1;
  const lastRow = firstRow + table.rows.length - 1;

  return (
    <s-stack direction="block" gap="base">
      <s-table>
        <s-table-header-row>
          {columns.map((column, index) => {
            const sorted = table.sort.key === column.key;
            const arrow = sorted
              ? table.sort.direction === "asc"
                ? " ↑"
                : " ↓"
              : "";
            const next = nextSort(table.sort, column);
            return (
              <s-table-header
                key={column.key}
                format={headerFormat(column.kind)}
                // On a phone the table becomes a list of cards titled by the first column.
                listSlot={index === 0 ? "primary" : "labeled"}
              >
                <s-link
                  href={href({ sort: next })}
                  accessibilityLabel={`Sort by ${column.label}, ${
                    next.direction === "asc" ? "ascending" : "descending"
                  }`}
                >
                  {column.label}
                  {arrow}
                </s-link>
              </s-table-header>
            );
          })}
        </s-table-header-row>
        <s-table-body>
          {table.rows.map((row) => (
            <s-table-row key={row.key}>
              {row.cells.map((cell, index) => (
                <s-table-cell key={columns[index].key}>{cell}</s-table-cell>
              ))}
            </s-table-row>
          ))}
        </s-table-body>
      </s-table>
      <s-stack direction="inline" gap="base" alignItems="center">
        <s-button
          href={href({ page: table.page - 1 })}
          disabled={table.page <= 1}
          variant="secondary"
        >
          Previous
        </s-button>
        <s-button
          href={href({ page: table.page + 1 })}
          disabled={table.page >= table.pageCount}
          variant="secondary"
        >
          Next
        </s-button>
        <s-text>
          Rows {firstRow.toLocaleString("en-US")}–
          {lastRow.toLocaleString("en-US")} of{" "}
          {table.filteredRows.toLocaleString("en-US")}
          {table.filteredRows !== table.totalRows &&
            ` (filtered from ${table.totalRows.toLocaleString("en-US")})`}
          . Page {table.page} of {table.pageCount}.
        </s-text>
      </s-stack>
    </s-stack>
  );
}
