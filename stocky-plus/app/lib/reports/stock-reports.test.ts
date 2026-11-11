import { describe, expect, it } from "vitest";
import { Decimal } from "../analytics/money";
import type { StockLocation } from "../analytics/stock-levels.server";
import type { ReportViewRequest } from "./params";
import { tablePage } from "./present";
import { buildDeadStockReport, buildStockOnHandReport, stockedVariants } from "./stock-reports";
import {
  catalogVariant,
  cellsByColumn,
  locationGid,
  stockLevel,
  variantGid,
} from "./test-fixtures";
import type { ReportData } from "./types";

const VIEW: ReportViewRequest = {
  search: "",
  facets: {},
  sortKey: null,
  sortDirection: null,
  page: 1,
};

const LOCATIONS: StockLocation[] = [
  { locationGid: locationGid(1), name: "Main warehouse", isActive: true },
  { locationGid: locationGid(2), name: "Downtown store", isActive: true },
];

function tiles<Row>(data: ReportData<Row>, view: Partial<ReportViewRequest> = {}) {
  return Object.fromEntries(
    tablePage(data, { ...VIEW, ...view }, "USD").tiles.map((tile) => [tile.label, tile.value]),
  );
}

function headings(data: ReportData<never> | { notices: Array<{ heading: string }> }) {
  return data.notices.map((notice) => notice.heading);
}

describe("buildStockOnHandReport", () => {
  const catalog = [
    catalogVariant(1, { productTitle: "Trail Shoe", variantTitle: "Size 9" }),
    catalogVariant(2, { productTitle: "Laces", unitCost: null, unitCostCurrencyCode: null }),
    catalogVariant(3, { productTitle: "Gift wrap", tracked: false }),
    catalogVariant(4, { productTitle: "Insole", unitCostCurrencyCode: "CAD" }),
    catalogVariant(5, { productTitle: "Sock", priceCurrencyCode: "CAD" }),
  ];
  const levels = [
    stockLevel(1, 1, 10, { available: 7, committed: 3, incoming: 12 }),
    stockLevel(1, 2, 0),
    stockLevel(2, 1, 4),
    stockLevel(3, 1, 50),
    stockLevel(4, 1, -2),
    stockLevel(5, 2, null, { available: null }),
    stockLevel(99, 1, 8),
  ];
  const build = (filter: string) =>
    buildStockOnHandReport({ catalog, levels, locations: LOCATIONS, currencyCode: "USD", filter });

  it("values on-hand units at Shopify cost and at retail", () => {
    const data = build("stocked");
    const row = data.rows.find((r) => r.variant.variantGid === variantGid(1));

    expect(row && cellsByColumn(data, row)).toEqual({
      product: "Trail Shoe",
      variant: "Size 9",
      sku: "SKU-1",
      vendor: "Northwind",
      location: "Main warehouse",
      available: 7,
      onHand: 10,
      committed: 3,
      incoming: 12,
      unitCost: "8.00",
      costValue: "80.00",
      price: "20.00",
      retailValue: "200.00",
    });
  });

  it("lists tracked catalog variants only, and by default only where there is stock", () => {
    const keys = (filter: string) => build(filter).rows.map((r) => build(filter).rowKey(r));
    expect(keys("stocked")).toEqual([
      `${variantGid(1)}|${locationGid(1)}`,
      `${variantGid(2)}|${locationGid(1)}`,
      `${variantGid(4)}|${locationGid(1)}`,
    ]);
    // "all" adds the empty level and the level Shopify has not reported yet.
    // The untracked variant and the level with no catalog variant never appear.
    expect(keys("all")).toHaveLength(5);
  });

  it("leaves cost value blank without a cost in the store currency", () => {
    const data = build("stocked");
    const byProduct = new Map(data.rows.map((r) => [r.variant.productTitle, r]));

    expect(byProduct.get("Laces")).toMatchObject({ unitCost: null, costValue: null });
    expect(byProduct.get("Laces")?.retailValue?.toFixed(2)).toBe("80.00");
    // A cost in another currency is not converted and not counted.
    expect(byProduct.get("Insole")).toMatchObject({ unitCost: null, costValue: null });
  });

  it("shows a negative quantity as reported and values it at zero", () => {
    const data = build("stocked");
    const insole = data.rows.find((r) => r.variant.productTitle === "Insole");
    expect(insole?.level.onHand).toBe(-2);
    expect(insole?.retailValue?.toFixed(2)).toBe("0.00");
  });

  it("keeps an unreported quantity blank instead of zero", () => {
    const data = build("all");
    const sock = data.rows.find((r) => r.variant.productTitle === "Sock");
    expect(sock && cellsByColumn(data, sock)).toMatchObject({
      location: "Downtown store",
      onHand: null,
      costValue: null,
      price: null,
      retailValue: null,
    });
  });

  it("totals the rows on screen and says what the totals leave out", () => {
    const data = build("stocked");
    // 10 + 4 - 2 units; cost 80 (Laces and Insole have none); retail 200 + 80 + 0.
    expect(tiles(data)).toEqual({
      "Units on hand": "12",
      "Cost value": "$80.00",
      "Retail value": "$280.00",
      Variants: "3",
    });
    expect(tiles(data, { search: "laces" })).toMatchObject({
      "Units on hand": "4",
      "Cost value": "$0.00",
    });
    expect(headings(data)).toEqual([
      "1 stock level is below zero",
      "1 variant with stock has no cost",
      "1 stock level has no quantity yet",
    ]);
  });

  it("names a location Shopify no longer lists", () => {
    const data = buildStockOnHandReport({
      catalog,
      levels: [stockLevel(1, 7, 3)],
      locations: LOCATIONS,
      currencyCode: "USD",
      filter: "stocked",
    });
    expect(data.rows[0].location).toBe("Unknown location");
  });

  it("explains an empty report on a shop that has not synced", () => {
    const data = buildStockOnHandReport({
      catalog: [],
      levels: [],
      locations: [],
      currencyCode: "USD",
      filter: "stocked",
    });
    expect(data.rows).toEqual([]);
    expect(headings(data)).toEqual(["No inventory levels have been synced yet"]);
    expect(data.dataAsOf).toBeNull();
  });

  it("reports the latest stock change it reflects", () => {
    const data = buildStockOnHandReport({
      catalog,
      levels: [
        stockLevel(1, 1, 1, { shopifyUpdatedAt: new Date("2026-11-01T00:00:00Z") }),
        stockLevel(2, 1, 1, { shopifyUpdatedAt: new Date("2026-11-09T00:00:00Z") }),
        stockLevel(4, 1, 1, { shopifyUpdatedAt: null }),
      ],
      locations: LOCATIONS,
      currencyCode: "USD",
      filter: "stocked",
    });
    expect(data.dataAsOf).toEqual(new Date("2026-11-09T00:00:00Z"));
  });
});

describe("stockedVariants", () => {
  it("adds a variant's locations together and keeps positive totals", () => {
    const totals = stockedVariants(
      [catalogVariant(1), catalogVariant(2), catalogVariant(3), catalogVariant(4, { tracked: false })],
      [
        stockLevel(1, 1, 5),
        stockLevel(1, 2, -2),
        stockLevel(2, 1, 3),
        stockLevel(2, 2, -3),
        stockLevel(3, 1, null),
        stockLevel(4, 1, 9),
      ],
    );
    expect([...totals].map(([gid, entry]) => [gid, entry.onHand])).toEqual([[variantGid(1), 3]]);
  });
});

describe("buildDeadStockReport", () => {
  const TODAY = "2026-11-10";
  const TZ = "America/New_York";
  const catalog = [
    catalogVariant(1, { productTitle: "Sold last week" }),
    catalogVariant(2, { productTitle: "Sold in spring" }),
    catalogVariant(3, { productTitle: "Never sold" }),
    catalogVariant(4, { productTitle: "New arrival", createdLocalDate: "2026-10-01" }),
    catalogVariant(5, { productTitle: "Out of stock" }),
    catalogVariant(6, { productTitle: "Exactly on the line", unitCost: null }),
    catalogVariant(7, { productTitle: "Age unknown", createdLocalDate: null }),
  ];
  const levels = [
    stockLevel(1, 1, 5),
    stockLevel(2, 1, 6),
    stockLevel(2, 2, 4),
    stockLevel(3, 1, 2),
    stockLevel(4, 1, 30),
    stockLevel(5, 1, 0),
    stockLevel(6, 1, 1),
    stockLevel(7, 1, 1),
  ];
  const lastOrderedAt = new Map([
    [variantGid(1), new Date("2026-11-03T15:00:00Z")],
    [variantGid(2), new Date("2026-04-02T02:30:00Z")],
    // 90 days before 2026-11-10 is 2026-08-12.
    [variantGid(6), new Date("2026-08-12T15:00:00Z")],
  ]);
  const build = (days: number, historyStartLocalDate: string | null = "2025-01-01") =>
    buildDeadStockReport({
      catalog,
      levels,
      lastOrderedAt,
      coverage: { historyStartLocalDate },
      timeZone: TZ,
      currencyCode: "USD",
      today: TODAY,
      days,
    });

  it("lists stocked variants with no order inside the period", () => {
    const data = build(90);
    const rows = new Map(data.rows.map((r) => [r.variant.productTitle, cellsByColumn(data, r)]));

    expect([...rows.keys()].sort()).toEqual([
      "Age unknown",
      "Exactly on the line",
      "Never sold",
      "Sold in spring",
    ]);
    // 02:30Z on 04-02 is still 04-01 in New York; both locations are added up.
    expect(rows.get("Sold in spring")).toMatchObject({
      onHand: 10,
      lastOrderedDate: "2026-04-01",
      daysSinceOrdered: 223,
      unitCost: "8.00",
      costValue: "80.00",
      retailValue: "200.00",
    });
    expect(rows.get("Never sold")).toMatchObject({ lastOrderedDate: null, daysSinceOrdered: null });
    expect(rows.get("Exactly on the line")).toMatchObject({ daysSinceOrdered: 90, costValue: null });
  });

  it("moves the line with the chosen period", () => {
    const titles = (days: number) => build(days).rows.map((r) => r.variant.productTitle).sort();
    expect(titles(180)).toEqual(["Age unknown", "Never sold", "Sold in spring"]);
    expect(titles(365)).toEqual(["Age unknown", "Never sold"]);
    // Seven days ago is 11-03: sold that day counts, and the October arrival is old enough.
    expect(titles(7)).toContain("Sold last week");
    expect(titles(30)).toContain("New arrival");
    expect(titles(60)).not.toContain("New arrival");
  });

  it("totals the money tied up and flags variants it cannot value", () => {
    const data = build(90);
    expect(tiles(data)).toEqual({
      Variants: "4",
      "Units on hand": "14",
      "Cost value": "$104.00",
      "Retail value": "$280.00",
    });
    expect(headings(data)).toEqual(["1 variant with stock has no cost"]);
    expect(data.defaultSort).toEqual({ key: "costValue", direction: "desc" });
  });

  it("warns when the imported order history is shorter than the period", () => {
    expect(headings(build(90, "2026-09-15"))[0]).toBe(
      "Your imported order history is shorter than this period",
    );
    expect(headings(build(90, "2026-08-12"))).toEqual(["1 variant with stock has no cost"]);
    expect(headings(build(90, null))[0]).toBe("No orders have been synced yet");
  });

  it("uses decimal arithmetic for values", () => {
    const data = buildDeadStockReport({
      catalog: [catalogVariant(1, { unitCost: new Decimal("0.1"), priceAmount: new Decimal("0.7") })],
      levels: [stockLevel(1, 1, 3)],
      lastOrderedAt: new Map(),
      coverage: { historyStartLocalDate: "2025-01-01" },
      timeZone: TZ,
      currencyCode: "USD",
      today: TODAY,
      days: 90,
    });
    expect(data.rows[0].costValue?.toString()).toBe("0.3");
    expect(data.rows[0].retailValue?.toString()).toBe("2.1");
  });
});
