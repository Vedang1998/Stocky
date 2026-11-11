/**
 * Turns computed report rows into what the page and the CSV export show:
 * filtering, sorting, paging and formatting, all from the column definitions.
 */
import {
  Decimal,
  displayMoney,
  formatMoneyAmount,
  toDecimal,
} from "../analytics/money";
import type { ReportViewRequest } from "./params";
import type {
  CellValue,
  ColumnKind,
  ReportColumn,
  ReportData,
  ReportSort,
  ReportTile,
} from "./types";

export const REPORT_PAGE_SIZE = 50;
/** Rows a single CSV download may hold. */
export const REPORT_EXPORT_ROW_LIMIT = 50_000;
/** Facet choice standing for rows with no value. */
export const FACET_NONE = "__none__";
const FACET_CHOICE_LIMIT = 500;
const EMPTY_CELL = "—";

const integerFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function compareValues(kind: ColumnKind, a: CellValue, b: CellValue): number {
  if (kind === "text" || kind === "date") {
    return String(a).localeCompare(String(b), "en", {
      numeric: kind === "text",
      sensitivity: "base",
    });
  }
  return toDecimal(a as Decimal | number | string).comparedTo(
    toDecimal(b as Decimal | number | string),
  );
}

function isBlank(value: CellValue): boolean {
  return value === null || value === "";
}

/** Sort a copy of `rows`; blank values go last in either direction. */
export function sortRows<Row>(
  data: Pick<ReportData<Row>, "columns" | "rowKey">,
  rows: readonly Row[],
  sort: ReportSort,
): Row[] {
  const column = data.columns.find((c) => c.key === sort.key);
  if (!column) return [...rows];
  const factor = sort.direction === "asc" ? 1 : -1;
  return rows
    .map((row) => ({ row, value: column.value(row), key: data.rowKey(row) }))
    .sort((a, b) => {
      const aBlank = isBlank(a.value);
      const bBlank = isBlank(b.value);
      if (aBlank !== bBlank) return aBlank ? 1 : -1;
      if (!aBlank) {
        const compared = compareValues(column.kind, a.value, b.value);
        if (compared !== 0) return compared * factor;
      }
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    })
    .map((entry) => entry.row);
}

export function resolveSort<Row>(
  data: Pick<ReportData<Row>, "columns" | "defaultSort">,
  view: Pick<ReportViewRequest, "sortKey" | "sortDirection">,
): ReportSort {
  const known = view.sortKey != null && data.columns.some((c) => c.key === view.sortKey);
  if (!known) return data.defaultSort;
  return {
    key: view.sortKey as string,
    direction: view.sortDirection ?? data.defaultSort.direction,
  };
}

function matchesSearch<Row>(
  columns: ReadonlyArray<ReportColumn<Row>>,
  row: Row,
  needle: string,
): boolean {
  return columns.some((column) => {
    const value = column.value(row);
    return value != null && String(value).toLowerCase().includes(needle);
  });
}

/** Apply the facet filters and free-text search. */
export function filterRows<Row>(
  data: Pick<ReportData<Row>, "columns" | "facets" | "searchKeys">,
  rows: readonly Row[],
  view: Pick<ReportViewRequest, "search" | "facets">,
): Row[] {
  const activeFacets = data.facets.filter((facet) => view.facets[facet.key] !== undefined);
  const needle = view.search.toLowerCase();
  const searchColumns = data.columns.filter((c) => data.searchKeys.includes(c.key));
  return rows.filter((row) => {
    for (const facet of activeFacets) {
      const wanted = view.facets[facet.key];
      const actual = facet.value(row);
      if (wanted === FACET_NONE ? actual !== null && actual !== "" : actual !== wanted) {
        return false;
      }
    }
    return needle === "" || matchesSearch(searchColumns, row, needle);
  });
}

export type FacetChoices = Array<{ value: string; label: string }>;

/** Distinct facet values across all rows, so a filter never hides its own choices. */
export function facetChoices<Row>(
  facet: ReportData<Row>["facets"][number],
  rows: readonly Row[],
): FacetChoices {
  const values = new Set<string>();
  let hasNone = false;
  for (const row of rows) {
    const value = facet.value(row);
    if (value === null || value === "") hasNone = true;
    else values.add(value);
  }
  const choices = [...values]
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }))
    .slice(0, FACET_CHOICE_LIMIT)
    .map((value) => ({ value, label: value }));
  if (hasNone) choices.push({ value: FACET_NONE, label: "None" });
  return choices;
}

/** A count with its noun, such as "1 order" or "1,250 orders". */
export function countOf(count: number, singular: string, plural: string): string {
  return `${integerFormat.format(count)} ${count === 1 ? singular : plural}`;
}

/** An instant as the shop's wall-clock time, such as "Nov 10, 2026, 3:45 PM EST". */
export function formatShopInstant(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(instant);
}

/** A fraction (0–1) as a percentage with two decimals, without the sign. */
function percentText(value: CellValue): string {
  return toDecimal(value as Decimal | number | string)
    .times(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
}

export function formatCell(
  kind: ColumnKind,
  value: CellValue,
  currencyCode: string,
): string {
  if (isBlank(value)) return EMPTY_CELL;
  switch (kind) {
    case "integer":
      return integerFormat.format(Number(value));
    case "money":
      return displayMoney(value as Decimal | number | string, currencyCode);
    case "percent":
      return `${percentText(value)}%`;
    default:
      return String(value);
  }
}

/** The value as it is written to a CSV cell: plain, unformatted, lossless. */
export function exportCell(
  kind: ColumnKind,
  value: CellValue,
  currencyCode: string,
): string | number | null {
  if (isBlank(value)) return null;
  switch (kind) {
    case "integer":
      return Number(value);
    case "money":
      return formatMoneyAmount(value as Decimal | number | string, currencyCode);
    case "percent":
      return percentText(value);
    default:
      return String(value);
  }
}

export function exportHeader(
  column: Pick<ReportColumn<unknown>, "label" | "kind">,
  currencyCode: string,
): string {
  if (column.kind === "money") return `${column.label} (${currencyCode})`;
  if (column.kind === "percent") return `${column.label} (%)`;
  return column.label;
}

export type ReportTablePage = {
  rows: Array<{ key: string; cells: string[] }>;
  totalRows: number;
  filteredRows: number;
  page: number;
  pageCount: number;
  pageSize: number;
  sort: ReportSort;
  /** Headline figures for the filtered rows, across every page. */
  tiles: ReportTile[];
};

/** One page of formatted rows for the on-screen table. */
export function tablePage<Row>(
  data: ReportData<Row>,
  view: ReportViewRequest,
  currencyCode: string,
): ReportTablePage {
  const sort = resolveSort(data, view);
  const filtered = sortRows(data, filterRows(data, data.rows, view), sort);
  const pageCount = Math.max(1, Math.ceil(filtered.length / REPORT_PAGE_SIZE));
  const page = Math.min(view.page, pageCount);
  const start = (page - 1) * REPORT_PAGE_SIZE;
  return {
    rows: filtered.slice(start, start + REPORT_PAGE_SIZE).map((row) => ({
      key: data.rowKey(row),
      cells: data.columns.map((column) =>
        formatCell(column.kind, column.value(row), currencyCode),
      ),
    })),
    totalRows: data.rows.length,
    filteredRows: filtered.length,
    page,
    pageCount,
    pageSize: REPORT_PAGE_SIZE,
    sort,
    tiles: data.summarize(filtered),
  };
}

export type ReportExport = {
  headers: string[];
  rows: Array<Array<string | number | null>>;
  /** True when the row limit cut the export short. */
  truncated: boolean;
};

/** Every filtered row, in the on-screen order, as plain CSV values. */
export function exportTable<Row>(
  data: ReportData<Row>,
  view: ReportViewRequest,
  currencyCode: string,
  rowLimit = REPORT_EXPORT_ROW_LIMIT,
): ReportExport {
  const sorted = sortRows(
    data,
    filterRows(data, data.rows, view),
    resolveSort(data, view),
  );
  return {
    headers: data.columns.map((column) => exportHeader(column, currencyCode)),
    rows: sorted
      .slice(0, rowLimit)
      .map((row) =>
        data.columns.map((column) =>
          exportCell(column.kind, column.value(row), currencyCode),
        ),
      ),
    truncated: sorted.length > rowLimit,
  };
}
