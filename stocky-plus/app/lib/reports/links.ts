/**
 * Query strings for report links. A report's URL is its whole view state, so
 * sorting, paging and the CSV download are plain links that carry it forward.
 * Browser-safe: no server imports.
 */
import { CUSTOM_RANGE_PRESET } from "./range-presets";
import type { ColumnKind, ReportSort, SortDirection } from "./types";

export type ReportLinkState = {
  usesDateRange: boolean;
  range: { preset: string; startLocalDate: string; endLocalDate: string };
  options: Readonly<Record<string, string>>;
  facets: Readonly<Record<string, string>>;
  search: string;
  sort: ReportSort;
  page: number;
};

export function reportQuery(
  state: ReportLinkState,
  overrides: { sort?: ReportSort; page?: number } = {},
): string {
  const query = new URLSearchParams();
  if (state.usesDateRange) {
    query.set("range", state.range.preset);
    if (state.range.preset === CUSTOM_RANGE_PRESET) {
      query.set("start", state.range.startLocalDate);
      query.set("end", state.range.endLocalDate);
    }
  }
  for (const [key, value] of Object.entries(state.options)) query.set(key, value);
  for (const [key, value] of Object.entries(state.facets)) query.set(key, value);
  if (state.search) query.set("q", state.search);
  const sort = overrides.sort ?? state.sort;
  query.set("sort", sort.key);
  query.set("dir", sort.direction);
  // A new sort starts again from the first page.
  const page = overrides.page ?? (overrides.sort ? 1 : state.page);
  if (page > 1) query.set("page", String(page));
  return query.toString();
}

function firstDirection(kind: ColumnKind): SortDirection {
  return kind === "text" ? "asc" : "desc";
}

/** The sort a click on a column header applies: flip it, or start a new one. */
export function nextSort(
  current: ReportSort,
  column: { key: string; kind: ColumnKind },
): ReportSort {
  if (current.key !== column.key) {
    return { key: column.key, direction: firstDirection(column.kind) };
  }
  return { key: column.key, direction: current.direction === "asc" ? "desc" : "asc" };
}
