/**
 * A worksheet run: everything the merchant chose for this view of the
 * replenishment worksheet. It lives in the URL, so a run can be reloaded,
 * bookmarked and exported exactly as shown.
 *
 * Anything missing from the URL comes from the shop's saved defaults. An
 * invalid forecast setting stops the run with a message for that field; an
 * invalid filter, sort or page falls back to the default view.
 */
import { parseChoice, parseWholeNumber, type FieldErrors } from "../form";
import { isLocalDate, type LocalDate } from "../local-date";
import { isScopeKey, SHOP_SCOPE } from "../scope";
import {
  INCOMING_SOURCES,
  MAX_QUANTITY,
  MAX_SAMPLE_DAYS,
  MAX_SUGGEST_DAYS,
  MIN_DAYS,
  PARITY_METHODS,
  type IncomingSource,
  type MethodParameters,
  type ParityMethod,
  type RoundingOptions,
} from "../types";
import { validateMethodParameters } from "../windows";

export const WORKSHEET_SHOW = ["ALL", "TO_ORDER", "LOW_STOCK"] as const;
export type WorksheetShow = (typeof WORKSHEET_SHOW)[number];

export const WORKSHEET_SHOW_LABELS: Record<WorksheetShow, string> = {
  ALL: "All variants",
  TO_ORDER: "With a suggested quantity",
  LOW_STOCK: "Low or out of stock",
};

export const WORKSHEET_SORT_KEYS = [
  "product",
  "sku",
  "vendor",
  "available",
  "incoming",
  "netUnits",
  "unitsPerDay",
  "daysOfStock",
  "suggested",
] as const;
export type WorksheetSortKey = (typeof WORKSHEET_SORT_KEYS)[number];
export type SortDirection = "asc" | "desc";

export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 50;
const MAX_QUERY_LENGTH = 100;
const MAX_FILTER_LENGTH = 255;

export type WorksheetFilters = {
  vendor: string | null;
  productType: string | null;
  supplierId: string | null;
  query: string;
  show: WorksheetShow;
};

export type WorksheetView = {
  filters: WorksheetFilters;
  sort: { key: WorksheetSortKey; direction: SortDirection };
  page: number;
  pageSize: number;
};

export type WorksheetRun = WorksheetView & {
  params: MethodParameters;
  scopeKey: string;
  incomingSource: IncomingSource;
  rounding: RoundingOptions;
};

/** The saved defaults a run starts from. */
export type RunDefaults = {
  defaultMethod: Exclude<ParityMethod, "CUSTOM_RANGE">;
  sampleDays: number;
  suggestDays: number;
  targetQuantity: number | null;
  incomingSource: IncomingSource;
  applyMinimumOrderQuantity: boolean;
  roundUpToPackSize: boolean;
};

/** What the forecast form shows, valid or not, so errors keep the typed text. */
export type RunFormValues = {
  method: ParityMethod;
  sampleDays: string;
  suggestDays: string;
  startDate: string;
  endDate: string;
  targetQuantity: string;
  scopeKey: string;
  incomingSource: IncomingSource;
  applyMinimumOrderQuantity: boolean;
  roundUpToPackSize: boolean;
};

export type ParsedRun =
  | { ok: true; run: WorksheetRun; form: RunFormValues }
  | { ok: false; errors: FieldErrors; view: WorksheetView; form: RunFormValues };

function text(search: URLSearchParams, name: string, maxLength: number): string {
  return (search.get(name) ?? "").trim().slice(0, maxLength);
}

function parseView(search: URLSearchParams): WorksheetView {
  const sortKey = parseChoice(search.get("sort"), WORKSHEET_SORT_KEYS);
  const direction = parseChoice(search.get("dir"), ["asc", "desc"] as const);
  const pageSize = Number(search.get("perPage"));
  const page = Number(search.get("page"));
  return {
    filters: {
      vendor: text(search, "vendor", MAX_FILTER_LENGTH) || null,
      productType: text(search, "type", MAX_FILTER_LENGTH) || null,
      supplierId: text(search, "supplier", MAX_FILTER_LENGTH) || null,
      query: text(search, "q", MAX_QUERY_LENGTH),
      show: parseChoice(search.get("show"), WORKSHEET_SHOW) ?? "ALL",
    },
    sort: {
      key: sortKey ?? "product",
      direction: direction ?? (sortKey === "suggested" ? "desc" : "asc"),
    },
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_PAGE_SIZE,
  };
}

/** A switch is "on"/"off" when the form was submitted, absent on a first visit. */
function parseSwitch(raw: string | null, fallback: boolean): boolean {
  if (raw === "on") return true;
  if (raw === "off") return false;
  return fallback;
}

export function parseWorksheetRun(
  search: URLSearchParams,
  defaults: RunDefaults,
  asOf: LocalDate,
): ParsedRun {
  const errors: FieldErrors = {};
  const view = parseView(search);

  const rawMethod = search.get("method");
  const method = rawMethod == null ? defaults.defaultMethod : parseChoice(rawMethod, PARITY_METHODS);
  if (!method) errors.method = "Choose a forecast method.";

  const rawScope = search.get("scope");
  const scopeKey = rawScope == null || rawScope === "" ? SHOP_SCOPE : rawScope;
  if (!isScopeKey(scopeKey)) errors.scope = "Choose a location.";

  const rawIncoming = search.get("incoming");
  const incomingSource =
    rawIncoming == null ? defaults.incomingSource : parseChoice(rawIncoming, INCOMING_SOURCES);
  if (!incomingSource) errors.incoming = "Choose where incoming stock comes from.";

  const form: RunFormValues = {
    method: method ?? defaults.defaultMethod,
    sampleDays: search.get("sampleDays") ?? String(defaults.sampleDays),
    suggestDays: search.get("suggestDays") ?? String(defaults.suggestDays),
    startDate: search.get("startDate") ?? "",
    endDate: search.get("endDate") ?? "",
    targetQuantity:
      search.get("targetQuantity") ??
      (defaults.targetQuantity == null ? "" : String(defaults.targetQuantity)),
    scopeKey: isScopeKey(scopeKey) ? scopeKey : SHOP_SCOPE,
    incomingSource: incomingSource ?? defaults.incomingSource,
    applyMinimumOrderQuantity: parseSwitch(
      search.get("moq"),
      defaults.applyMinimumOrderQuantity,
    ),
    roundUpToPackSize: parseSwitch(search.get("pack"), defaults.roundUpToPackSize),
  };

  let params: MethodParameters | null = null;
  if (method) {
    const days = (field: "sampleDays" | "suggestDays", label: string, max: number) =>
      parseWholeNumber(form[field], field, label, { min: MIN_DAYS, max }, errors, {
        optional: false,
      });
    switch (method) {
      case "LAST_X_DAYS": {
        const sampleDays = days("sampleDays", "Sales period", MAX_SAMPLE_DAYS);
        const suggestDays = days("suggestDays", "Suggest for", MAX_SUGGEST_DAYS);
        if (sampleDays != null && suggestDays != null) {
          params = { method, sampleDays, suggestDays };
        }
        break;
      }
      case "CUSTOM_RANGE": {
        const suggestDays = days("suggestDays", "Suggest for", MAX_SUGGEST_DAYS);
        if (!isLocalDate(form.startDate)) errors.startDate = "Enter a valid start date.";
        if (!isLocalDate(form.endDate)) errors.endDate = "Enter a valid end date.";
        if (suggestDays != null && !errors.startDate && !errors.endDate) {
          params = {
            method,
            startDate: form.startDate,
            endDate: form.endDate,
            suggestDays,
          };
        }
        break;
      }
      case "SAME_PERIOD_LAST_YEAR": {
        const suggestDays = days("suggestDays", "Suggest for", MAX_SUGGEST_DAYS);
        if (suggestDays != null) params = { method, suggestDays };
        break;
      }
      case "TARGET_STOCK_LEVEL": {
        const targetQuantity = parseWholeNumber(
          form.targetQuantity,
          "targetQuantity",
          "Target quantity",
          { min: 0, max: MAX_QUANTITY },
          errors,
          { optional: false },
        );
        if (targetQuantity != null) params = { method, targetQuantity };
        break;
      }
      case "FILL_SHELVES":
      case "FILL_SHELVES_IF_BELOW_MIN":
        params = { method };
        break;
    }
  }

  if (params) {
    for (const problem of validateMethodParameters(params, asOf)) {
      errors[problem.field] ??= problem.message;
    }
  }

  if (!params || !incomingSource || Object.keys(errors).length > 0) {
    return { ok: false, errors, view, form };
  }
  return {
    ok: true,
    form,
    run: {
      ...view,
      params,
      scopeKey: form.scopeKey,
      incomingSource,
      rounding: {
        applyMinimumOrderQuantity: form.applyMinimumOrderQuantity,
        roundUpToPackSize: form.roundUpToPackSize,
      },
    },
  };
}

/**
 * The query string for a run, with optional changes to its view. Every
 * setting is written out, so the link keeps meaning the same run after the
 * shop's defaults change.
 */
export function worksheetSearch(
  run: WorksheetRun,
  changes: Partial<{
    sort: WorksheetView["sort"];
    page: number;
    pageSize: number;
  }> = {},
): URLSearchParams {
  const search = new URLSearchParams();
  const { params } = run;
  search.set("method", params.method);
  if (params.method === "LAST_X_DAYS") search.set("sampleDays", String(params.sampleDays));
  if (params.method === "CUSTOM_RANGE") {
    search.set("startDate", params.startDate);
    search.set("endDate", params.endDate);
  }
  if ("suggestDays" in params) search.set("suggestDays", String(params.suggestDays));
  if (params.method === "TARGET_STOCK_LEVEL") {
    search.set("targetQuantity", String(params.targetQuantity));
  }
  search.set("scope", run.scopeKey);
  search.set("incoming", run.incomingSource);
  search.set("moq", run.rounding.applyMinimumOrderQuantity ? "on" : "off");
  search.set("pack", run.rounding.roundUpToPackSize ? "on" : "off");

  const { filters } = run;
  if (filters.vendor) search.set("vendor", filters.vendor);
  if (filters.productType) search.set("type", filters.productType);
  if (filters.supplierId) search.set("supplier", filters.supplierId);
  if (filters.query) search.set("q", filters.query);
  if (filters.show !== "ALL") search.set("show", filters.show);

  const sort = changes.sort ?? run.sort;
  search.set("sort", sort.key);
  search.set("dir", sort.direction);
  search.set("perPage", String(changes.pageSize ?? run.pageSize));
  const page = changes.page ?? (changes.sort || changes.pageSize ? 1 : run.page);
  if (page > 1) search.set("page", String(page));
  return search;
}
