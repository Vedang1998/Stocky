/**
 * Report query-string parsing. Everything here is merchant input: it is
 * validated and bounded, and anything unusable falls back to a default with a
 * message rather than an error page.
 */
import {
  addLocalDays,
  diffLocalDays,
  isLocalDate,
  type LocalDate,
} from "../analytics/shop-calendar";
import {
  CUSTOM_RANGE_PRESET,
  DEFAULT_RANGE_PRESET,
} from "./range-presets";
import type {
  ReportDateRange,
  ReportOption,
  ReportRequest,
  SortDirection,
} from "./types";

/** Longest range a report computes on demand. */
export const REPORT_MAX_RANGE_DAYS = 366;
const SEARCH_MAX_LENGTH = 100;
const FACET_VALUE_MAX_LENGTH = 300;

/** Query keys the engine owns; report options and facets must not reuse them. */
export const RESERVED_QUERY_KEYS = [
  "range",
  "start",
  "end",
  "q",
  "sort",
  "dir",
  "page",
] as const;

const TRAILING_DAYS: Readonly<Record<string, number>> = {
  last_7_days: 7,
  last_30_days: 30,
  last_90_days: 90,
  last_365_days: 365,
};

function firstOfMonth(date: LocalDate): LocalDate {
  return `${date.slice(0, 8)}01`;
}

function presetRange(preset: string, today: LocalDate): ReportDateRange | null {
  const trailing = TRAILING_DAYS[preset];
  if (trailing !== undefined) {
    // Complete days only: the range ends yesterday.
    return {
      preset,
      startLocalDate: addLocalDays(today, -trailing),
      endLocalDate: addLocalDays(today, -1),
    };
  }
  switch (preset) {
    case "today":
      return { preset, startLocalDate: today, endLocalDate: today };
    case "yesterday": {
      const yesterday = addLocalDays(today, -1);
      return { preset, startLocalDate: yesterday, endLocalDate: yesterday };
    }
    case "month_to_date":
      return { preset, startLocalDate: firstOfMonth(today), endLocalDate: today };
    case "last_month": {
      const lastDay = addLocalDays(firstOfMonth(today), -1);
      return { preset, startLocalDate: firstOfMonth(lastDay), endLocalDate: lastDay };
    }
    default:
      return null;
  }
}

export type ResolvedDateRange = {
  range: ReportDateRange;
  /** Set when the requested range could not be used as given. */
  problem: string | null;
};

export function resolveDateRange(input: {
  preset: string | null;
  start: string | null;
  end: string | null;
  today: LocalDate;
}): ResolvedDateRange {
  const fallback = presetRange(DEFAULT_RANGE_PRESET, input.today) as ReportDateRange;
  const preset = input.preset ?? DEFAULT_RANGE_PRESET;

  if (preset !== CUSTOM_RANGE_PRESET) {
    const range = presetRange(preset, input.today);
    return range
      ? { range, problem: null }
      : { range: fallback, problem: "That date range is not available. Showing the last 30 days." };
  }

  const { start, end } = input;
  if (!isLocalDate(start) || !isLocalDate(end)) {
    return {
      range: fallback,
      problem: "Enter both a start and an end date. Showing the last 30 days.",
    };
  }
  if (end < start) {
    return {
      range: fallback,
      problem: "The end date is before the start date. Showing the last 30 days.",
    };
  }
  if (diffLocalDays(start, end) + 1 > REPORT_MAX_RANGE_DAYS) {
    return {
      range: {
        preset,
        startLocalDate: addLocalDays(end, -(REPORT_MAX_RANGE_DAYS - 1)),
        endLocalDate: end,
      },
      problem: `Reports cover up to ${REPORT_MAX_RANGE_DAYS} days at a time. Showing the last ${REPORT_MAX_RANGE_DAYS} days of the range you chose.`,
    };
  }
  return { range: { preset, startLocalDate: start, endLocalDate: end }, problem: null };
}

/** What the merchant asked to see of an already computed report. */
export type ReportViewRequest = {
  search: string;
  /** Facet selections by key; an absent key means no filter. */
  facets: Readonly<Record<string, string>>;
  sortKey: string | null;
  sortDirection: SortDirection | null;
  page: number;
};

export type ParsedReportRequest = {
  request: ReportRequest;
  problems: string[];
};

function parsePage(raw: string | null): number {
  if (raw == null || !/^\d{1,6}$/.test(raw)) return 1;
  return Math.max(1, Number(raw));
}

/** The part of the query string that decides what a report computes. */
export function parseReportRequest(input: {
  searchParams: URLSearchParams;
  usesDateRange: boolean;
  options: readonly ReportOption[];
  today: LocalDate;
}): ParsedReportRequest {
  const { searchParams } = input;
  const problems: string[] = [];

  const resolved = resolveDateRange({
    preset: input.usesDateRange ? searchParams.get("range") : null,
    start: searchParams.get("start"),
    end: searchParams.get("end"),
    today: input.today,
  });
  if (input.usesDateRange && resolved.problem) problems.push(resolved.problem);

  const options: Record<string, string> = {};
  for (const option of input.options) {
    const raw = searchParams.get(option.key);
    options[option.key] =
      raw != null && option.choices.some((choice) => choice.value === raw)
        ? raw
        : option.defaultValue;
  }
  return { request: { range: resolved.range, options }, problems };
}

/**
 * The part of the query string that decides how computed rows are shown.
 * `facetKeys` come from the computed report, so an unknown key is ignored.
 */
export function parseReportView(
  searchParams: URLSearchParams,
  facetKeys: readonly string[],
): ReportViewRequest {
  const facets: Record<string, string> = {};
  for (const key of facetKeys) {
    const raw = searchParams.get(key);
    if (raw) facets[key] = raw.slice(0, FACET_VALUE_MAX_LENGTH);
  }
  const direction = searchParams.get("dir");
  return {
    search: (searchParams.get("q") ?? "").trim().slice(0, SEARCH_MAX_LENGTH),
    facets,
    sortKey: searchParams.get("sort"),
    sortDirection: direction === "asc" || direction === "desc" ? direction : null,
    page: parsePage(searchParams.get("page")),
  };
}
