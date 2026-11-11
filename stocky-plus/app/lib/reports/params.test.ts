import { describe, expect, it } from "vitest";
import {
  REPORT_MAX_RANGE_DAYS,
  parseReportRequest,
  parseReportView,
  resolveDateRange,
} from "./params";
import type { ReportOption } from "./types";

const TODAY = "2026-11-10";

function range(preset: string | null, start: string | null = null, end: string | null = null) {
  return resolveDateRange({ preset, start, end, today: TODAY });
}

describe("resolveDateRange", () => {
  it("defaults to the last 30 complete days", () => {
    expect(range(null)).toEqual({
      range: { preset: "last_30_days", startLocalDate: "2026-10-11", endLocalDate: "2026-11-09" },
      problem: null,
    });
  });

  it.each([
    ["today", "2026-11-10", "2026-11-10"],
    ["yesterday", "2026-11-09", "2026-11-09"],
    ["last_7_days", "2026-11-03", "2026-11-09"],
    ["last_90_days", "2026-08-12", "2026-11-09"],
    ["last_365_days", "2025-11-10", "2026-11-09"],
    ["month_to_date", "2026-11-01", "2026-11-10"],
    ["last_month", "2026-10-01", "2026-10-31"],
  ])("resolves %s", (preset, start, end) => {
    expect(range(preset).range).toEqual({ preset, startLocalDate: start, endLocalDate: end });
  });

  it("resolves last month across a year boundary", () => {
    expect(
      resolveDateRange({ preset: "last_month", start: null, end: null, today: "2026-01-15" }).range,
    ).toMatchObject({ startLocalDate: "2025-12-01", endLocalDate: "2025-12-31" });
  });

  it("falls back with a message for an unknown preset", () => {
    const resolved = range("all_time");
    expect(resolved.range.preset).toBe("last_30_days");
    expect(resolved.problem).toMatch(/not available/);
  });

  it("accepts a custom range, including a single day", () => {
    expect(range("custom", "2026-02-27", "2026-03-01")).toEqual({
      range: { preset: "custom", startLocalDate: "2026-02-27", endLocalDate: "2026-03-01" },
      problem: null,
    });
    expect(range("custom", "2026-03-01", "2026-03-01").problem).toBeNull();
  });

  it.each([
    [null, "2026-03-01"],
    ["2026-03-01", null],
    ["2026-02-30", "2026-03-01"],
    ["03/01/2026", "2026-03-05"],
    ["2026-03-01", "2026-03-05; DROP TABLE"],
  ])("rejects an unusable custom range (%s, %s)", (start, end) => {
    const resolved = range("custom", start, end);
    expect(resolved.range.preset).toBe("last_30_days");
    expect(resolved.problem).toMatch(/start and an end date/);
  });

  it("rejects an end date before the start date", () => {
    expect(range("custom", "2026-03-05", "2026-03-01").problem).toMatch(/before the start/);
  });

  it("keeps the most recent days of a range that is too long", () => {
    const resolved = range("custom", "2020-01-01", "2026-06-30");
    expect(resolved.range).toEqual({
      preset: "custom",
      startLocalDate: "2025-06-30",
      endLocalDate: "2026-06-30",
    });
    expect(resolved.problem).toContain(String(REPORT_MAX_RANGE_DAYS));
    // Exactly the limit is accepted as given.
    expect(range("custom", "2025-06-30", "2026-06-30").problem).toBeNull();
  });
});

const VIEW_OPTION: ReportOption = {
  key: "view",
  label: "Show",
  choices: [
    { value: "best", label: "Best" },
    { value: "worst", label: "Worst" },
  ],
  defaultValue: "best",
};

describe("parseReportRequest", () => {
  const parse = (query: string, usesDateRange = true) =>
    parseReportRequest({
      searchParams: new URLSearchParams(query),
      usesDateRange,
      options: [VIEW_OPTION],
      today: TODAY,
    });

  it("accepts a listed option value and replaces anything else with the default", () => {
    expect(parse("view=worst").request.options).toEqual({ view: "worst" });
    expect(parse("view=everything").request.options).toEqual({ view: "best" });
    expect(parse("").request.options).toEqual({ view: "best" });
  });

  it("reports a date problem only for reports that use a date range", () => {
    expect(parse("range=custom").problems).toHaveLength(1);
    expect(parse("range=custom", false).problems).toEqual([]);
  });
});

describe("parseReportView", () => {
  const parse = (query: string) => parseReportView(new URLSearchParams(query), ["vendor"]);

  it("reads search, facets, sort and page", () => {
    expect(parse("q=%20shoe%20&vendor=Northwind&sort=revenue&dir=asc&page=3")).toEqual({
      search: "shoe",
      facets: { vendor: "Northwind" },
      sortKey: "revenue",
      sortDirection: "asc",
      page: 3,
    });
  });

  it("ignores facets the report does not have and empty selections", () => {
    expect(parse("vendor=&location=Main&shop=other.myshopify.com").facets).toEqual({});
  });

  it.each(["0", "-2", "1.5", "abc", "9999999", ""])("treats page %j as the first page", (page) => {
    expect(parse(`page=${page}`).page).toBe(1);
  });

  it("drops an unknown sort direction and bounds long input", () => {
    const view = parse(`dir=sideways&q=${"x".repeat(500)}&vendor=${"v".repeat(900)}`);
    expect(view.sortDirection).toBeNull();
    expect(view.search).toHaveLength(100);
    expect(view.facets.vendor).toHaveLength(300);
  });
});
