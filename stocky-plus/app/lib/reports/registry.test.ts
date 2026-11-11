import { describe, expect, it } from "vitest";
import { RESERVED_QUERY_KEYS } from "./params";
import { REPORT_GROUPS, findReport, listReports } from "./registry.server";

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
      "abc-analysis",
      "stock-on-hand",
      "dead-stock",
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
