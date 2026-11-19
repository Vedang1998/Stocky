import { describe, expect, it } from "vitest";
import { RESERVED_QUERY_KEYS, type ReportViewRequest } from "./params";
import { FACET_NONE } from "./present";
import {
  REPORT_GROUPS,
  dropUnknownFacetValues,
  findReport,
  ignoredFilterNotices,
  listReports,
} from "./registry.server";

// Query keys Shopify adds to embedded app URLs.
const SHOPIFY_QUERY_KEYS = [
  "shop",
  "host",
  "embedded",
  "hmac",
  "id_token",
  "locale",
  "session",
  "timestamp",
];

describe("report registry", () => {
  const reports = listReports();

  it("offers the Stocky-parity reports", () => {
    expect(reports.map((report) => report.id)).toEqual([
      "best-sellers",
      "sales-by-variant",
      "sales-by-product",
      "sale-items",
      "orders",
      "sales-statistics",
      "gross-profit",
      "abc-analysis",
      "stock-on-hand",
      "dead-stock",
      "transfers",
      "stocktake-variances",
      "inventory-adjustments",
    ]);
  });

  it("gives every report a unique, URL-safe id and a listed group", () => {
    const ids = reports.map((report) => report.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const report of reports) {
      expect(report.id).toMatch(/^[a-z][a-z-]*[a-z]$/);
      expect(REPORT_GROUPS).toContain(report.group);
      expect(report.title).not.toBe("");
      expect(report.description).not.toBe("");
    }
  });

  it("keeps report options clear of the engine's and Shopify's query keys", () => {
    const taken = new Set<string>([
      ...RESERVED_QUERY_KEYS,
      ...SHOPIFY_QUERY_KEYS,
    ]);
    for (const report of reports) {
      for (const option of report.options) {
        expect(taken.has(option.key), `${report.id}.${option.key}`).toBe(false);
        expect(option.choices.map((choice) => choice.value)).toContain(
          option.defaultValue,
        );
      }
    }
  });

  it("finds a report by id and nothing else", () => {
    expect(findReport("dead-stock")?.title).toBe("Dead stock");
    expect(findReport("Dead-Stock")).toBeNull();
    expect(findReport("toString")).toBeNull();
    expect(findReport(undefined)).toBeNull();
  });
});

describe("filters that match nothing", () => {
  const data = {
    rows: [{ vendor: "Northwind" }, { vendor: null }],
    facets: [
      {
        key: "vendor",
        label: "Vendor",
        value: (row: { vendor: string | null }) => row.vendor,
      },
    ],
  };
  const view = (vendor: string): ReportViewRequest => ({
    search: "",
    facets: { vendor },
    sortKey: null,
    sortDirection: null,
    page: 1,
  });

  it("keeps a value that some row has, and the choice for rows with none", () => {
    for (const vendor of ["Northwind", FACET_NONE]) {
      expect(dropUnknownFacetValues(data, view(vendor))).toEqual({
        view: view(vendor),
        ignored: [],
      });
    }
  });

  it("drops a value no row has and names the filter", () => {
    const result = dropUnknownFacetValues(data, view("All"));
    expect(result.view.facets).toEqual({});
    expect(result.ignored).toEqual(["Vendor"]);
    expect(ignoredFilterNotices(result.ignored)).toEqual([
      {
        tone: "info",
        heading: "A filter was not applied",
        body: "Vendor did not match anything in this report, so it was ignored.",
      },
    ]);
  });

  it("shows no notice when nothing was ignored", () => {
    expect(ignoredFilterNotices([])).toEqual([]);
  });
});
