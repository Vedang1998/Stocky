/**
 * How a saved worksheet is being looked at: which rows, in what order, on
 * which page. The view lives in the URL so it survives a reload and can be
 * exported exactly as shown. An unknown value falls back to the default view
 * rather than failing, because a view never changes any quantity.
 */
import { parseChoice } from "../form";

export const WORKSHEET_SHOW = [
  "ALL",
  "TO_ORDER",
  "LOW_STOCK",
  "WARNINGS",
  "EDITED",
] as const;
export type WorksheetShow = (typeof WORKSHEET_SHOW)[number];

export const WORKSHEET_SHOW_LABELS: Record<WorksheetShow, string> = {
  ALL: "All variants",
  TO_ORDER: "To order",
  LOW_STOCK: "Low or out of stock",
  WARNINGS: "With warnings",
  EDITED: "Edited by you",
};

export const WORKSHEET_SORT_KEYS = [
  "product",
  "sku",
  "vendor",
  "supplier",
  "available",
  "incoming",
  "netUnits",
  "unitsPerDay",
  "daysOfStock",
  "suggested",
  "order",
] as const;
export type WorksheetSortKey = (typeof WORKSHEET_SORT_KEYS)[number];
export type SortDirection = "asc" | "desc";

export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_QUERY_LENGTH = 100;

export type WorksheetView = {
  show: WorksheetShow;
  query: string;
  sort: { key: WorksheetSortKey; direction: SortDirection };
  page: number;
  pageSize: number;
};

/** Quantities read best largest first; names read best A to Z. */
function defaultDirection(key: WorksheetSortKey): SortDirection {
  return key === "suggested" || key === "order" || key === "netUnits" || key === "unitsPerDay"
    ? "desc"
    : "asc";
}

export function parseWorksheetView(search: URLSearchParams): WorksheetView {
  const key = parseChoice(search.get("sort"), WORKSHEET_SORT_KEYS) ?? "product";
  const direction =
    parseChoice(search.get("dir"), ["asc", "desc"] as const) ?? defaultDirection(key);
  const pageSize = Number(search.get("perPage"));
  const rawPage = search.get("page") ?? "";
  const page = /^\d{1,9}$/.test(rawPage) ? Number(rawPage) : 1;
  return {
    show: parseChoice(search.get("show"), WORKSHEET_SHOW) ?? "ALL",
    query: (search.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH),
    sort: { key, direction },
    page: Math.max(1, page),
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_PAGE_SIZE,
  };
}

/**
 * The query string for a view with some of it changed. Changing anything
 * other than the page returns to page 1, since the old page number no longer
 * points at the same rows.
 */
export function worksheetViewSearch(
  view: WorksheetView,
  changes: Partial<Omit<WorksheetView, "sort">> & { sortKey?: WorksheetSortKey } = {},
): URLSearchParams {
  const search = new URLSearchParams();
  const show = changes.show ?? view.show;
  const query = changes.query ?? view.query;
  const pageSize = changes.pageSize ?? view.pageSize;

  let sort = view.sort;
  if (changes.sortKey) {
    sort =
      changes.sortKey === view.sort.key
        ? { key: view.sort.key, direction: view.sort.direction === "asc" ? "desc" : "asc" }
        : { key: changes.sortKey, direction: defaultDirection(changes.sortKey) };
  }

  if (show !== "ALL") search.set("show", show);
  if (query) search.set("q", query);
  if (sort.key !== "product" || sort.direction !== "asc") {
    search.set("sort", sort.key);
    search.set("dir", sort.direction);
  }
  if (pageSize !== DEFAULT_PAGE_SIZE) search.set("perPage", String(pageSize));

  const onlyPageChanged =
    changes.show === undefined &&
    changes.query === undefined &&
    changes.pageSize === undefined &&
    changes.sortKey === undefined;
  const page = onlyPageChanged ? (changes.page ?? view.page) : 1;
  if (page > 1) search.set("page", String(page));
  return search;
}
