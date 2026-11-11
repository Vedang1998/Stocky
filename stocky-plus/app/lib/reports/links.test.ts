import { describe, expect, it } from "vitest";
import { nextSort, reportQuery, type ReportLinkState } from "./links";

const STATE: ReportLinkState = {
  usesDateRange: true,
  range: { preset: "last_30_days", startLocalDate: "2026-10-11", endLocalDate: "2026-11-09" },
  options: { view: "worst" },
  facets: { vendor: "Northwind & Sons" },
  search: "trail shoe",
  sort: { key: "revenue", direction: "desc" },
  page: 3,
};

describe("reportQuery", () => {
  it("carries the whole view", () => {
    expect(reportQuery(STATE)).toBe(
      "range=last_30_days&view=worst&vendor=Northwind+%26+Sons&q=trail+shoe&sort=revenue&dir=desc&page=3",
    );
  });

  it("adds the dates only for a custom range", () => {
    const custom = { ...STATE, range: { ...STATE.range, preset: "custom" } };
    expect(reportQuery(custom)).toContain("range=custom&start=2026-10-11&end=2026-11-09");
    expect(reportQuery(STATE)).not.toContain("start=");
  });

  it("leaves the range out for a report without one", () => {
    expect(reportQuery({ ...STATE, usesDateRange: false })).not.toContain("range=");
  });

  it("changes page without touching anything else", () => {
    expect(reportQuery(STATE, { page: 4 })).toBe(reportQuery({ ...STATE, page: 4 }));
    expect(reportQuery(STATE, { page: 1 })).not.toContain("page=");
  });

  it("returns to the first page when the sort changes", () => {
    const query = reportQuery(STATE, { sort: { key: "netUnits", direction: "asc" } });
    expect(query).toContain("sort=netUnits&dir=asc");
    expect(query).not.toContain("page=");
  });

  it("encodes values so they cannot add parameters", () => {
    const query = reportQuery({ ...STATE, search: "a&page=9#x", facets: { vendor: "x=y&sort=z" } });
    const parsed = new URLSearchParams(query);
    expect(parsed.get("q")).toBe("a&page=9#x");
    expect(parsed.get("vendor")).toBe("x=y&sort=z");
    expect(parsed.getAll("sort")).toEqual(["revenue"]);
    expect(parsed.get("page")).toBe("3");
  });
});

describe("nextSort", () => {
  it("flips the direction of the sorted column", () => {
    expect(nextSort({ key: "revenue", direction: "desc" }, { key: "revenue", kind: "money" })).toEqual({
      key: "revenue",
      direction: "asc",
    });
  });

  it("starts text ascending and everything else descending", () => {
    const current = { key: "revenue", direction: "desc" } as const;
    expect(nextSort(current, { key: "product", kind: "text" }).direction).toBe("asc");
    expect(nextSort(current, { key: "netUnits", kind: "integer" }).direction).toBe("desc");
    expect(nextSort(current, { key: "date", kind: "date" }).direction).toBe("desc");
  });
});
