import { describe, expect, it } from "vitest";
import type { ReportViewRequest } from "./params";
import { tablePage } from "./present";
import {
  buildOrdersReport,
  buildProductSalesReport,
  buildSaleItemsReport,
  buildSellersReport,
  buildStatisticsReport,
  buildVariantSalesReport,
  salesNotices,
} from "./sales-reports";
import {
  catalogVariant,
  cellsByColumn,
  coverage,
  salesHistory,
  salesInput,
  unitEvent,
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

function tiles<Row>(data: ReportData<Row>, view: Partial<ReportViewRequest> = {}) {
  return Object.fromEntries(
    tablePage(data, { ...VIEW, ...view }, "USD").tiles.map((tile) => [tile.label, tile.value]),
  );
}

function rowsByKey<Row>(data: ReportData<Row>) {
  return new Map(data.rows.map((row) => [data.rowKey(row), cellsByColumn(data, row)]));
}

/**
 * Three days of sales:
 * - order 1 (11-01): 3 × variant 1 at $10, 1 × variant 2 at $40; one unit of
 *   variant 1 refunded later, restated to 11-01
 * - order 2 (11-02): 2 × variant 1 at $10
 * - order 3 (11-02): 1 × variant 3 at $25, fully refunded
 * - order 4 (placed 10-20, before the range): an edit on 11-03 adds 2 × variant 2
 */
function scenario() {
  const history = salesHistory({
    events: [
      unitEvent({ variant: 1, order: 1, localDate: "2026-11-01", units: 3 }),
      unitEvent({ variant: 2, order: 1, localDate: "2026-11-01", units: 1, unitPrice: "40.00" }),
      unitEvent({ variant: 1, order: 1, localDate: "2026-11-01", kind: "REFUNDED", units: -1 }),
      unitEvent({ variant: 1, order: 2, localDate: "2026-11-02", units: 2 }),
      unitEvent({ variant: 3, order: 3, localDate: "2026-11-02", units: 1, unitPrice: "25.00" }),
      unitEvent({ variant: 3, order: 3, localDate: "2026-11-02", kind: "REFUNDED", units: -1, unitPrice: "25.00" }),
      unitEvent({ variant: 2, order: 4, localDate: "2026-11-03", kind: "ADDED", units: 2, unitPrice: "40.00" }),
    ],
    orderDates: { 4: "2026-10-20" },
  });
  return salesInput(history, [
    catalogVariant(1, { productTitle: "Trail Shoe", variantTitle: "Size 9", vendor: "Northwind" }),
    catalogVariant(2, { productTitle: "Trail Shoe", variantTitle: "Size 10", vendor: "Northwind", productGid: "gid://shopify/Product/1" }),
    catalogVariant(3, { productTitle: "Laces", vendor: "Contoso" }),
    catalogVariant(4, { productTitle: "Insole", vendor: "Contoso" }),
    catalogVariant(5, { productTitle: "Old Boot", vendor: "Contoso", productStatus: "ARCHIVED" }),
  ]);
}

describe("buildSellersReport", () => {
  it("ranks sold variants by net revenue with their share", () => {
    const data = buildSellersReport(scenario(), "best");
    const rows = rowsByKey(data);

    expect(data.defaultSort).toEqual({ key: "revenue", direction: "desc" });
    expect(rows.get(variantGid(1))).toMatchObject({
      product: "Trail Shoe",
      variant: "Size 9",
      netUnits: 4,
      revenue: "40.00",
      orders: 2,
      lastSaleDate: "2026-11-02",
    });
    expect(rows.get(variantGid(2))).toMatchObject({ netUnits: 3, revenue: "120.00", orders: 2 });
    // 40 of 160 and 120 of 160.
    expect(rows.get(variantGid(1))?.revenueShare).toBe("0.25");
    expect(rows.get(variantGid(2))?.revenueShare).toBe("0.75");
    // Fully refunded: it sold, nets to nothing, and has no share.
    expect(rows.get(variantGid(3))).toMatchObject({
      netUnits: 0,
      revenue: "0.00",
      revenueShare: null,
      orders: 0,
    });
    expect(rows.has(variantGid(4))).toBe(false);
    expect(tiles(data)).toEqual({
      "Net revenue": "$160.00",
      "Net units": "7",
      "Variants sold": "2",
    });
  });

  it("adds active variants with no sales to the worst-sellers view", () => {
    const data = buildSellersReport(scenario(), "worst");
    const rows = rowsByKey(data);

    expect(data.defaultSort).toEqual({ key: "netUnits", direction: "asc" });
    expect(rows.get(variantGid(4))).toMatchObject({
      product: "Insole",
      netUnits: 0,
      revenue: "0.00",
      orders: 0,
      lastSaleDate: null,
    });
    // Archived products are not something to act on.
    expect(rows.has(variantGid(5))).toBe(false);
    expect(tiles(data)["Active variants with no sales"]).toBe("1");
  });

  it("totals only the rows a filter leaves on screen", () => {
    const data = buildSellersReport(scenario(), "worst");
    expect(tiles(data, { facets: { vendor: "Contoso" } })).toEqual({
      "Net revenue": "$0.00",
      "Net units": "0",
      "Variants sold": "0",
      "Active variants with no sales": "1",
    });
  });
});

describe("buildVariantSalesReport", () => {
  it("breaks net units into ordered, added and returned", () => {
    const data = buildVariantSalesReport(scenario());
    const rows = rowsByKey(data);

    expect(rows.get(variantGid(1))).toMatchObject({
      orderedUnits: 5,
      addedUnits: 0,
      returnedUnits: 1,
      netUnits: 4,
      revenue: "40.00",
      averagePrice: "10.00",
      firstSaleDate: "2026-11-01",
      lastSaleDate: "2026-11-02",
    });
    expect(rows.get(variantGid(2))).toMatchObject({
      orderedUnits: 1,
      addedUnits: 2,
      returnedUnits: 0,
      netUnits: 3,
      averagePrice: "40.00",
    });
    expect(rows.get(variantGid(3))).toMatchObject({ netUnits: 0, averagePrice: null });
    expect(tiles(data)).toEqual({
      "Net revenue": "$160.00",
      "Net units": "7",
      "Units returned": "2",
      Variants: "3",
    });
  });

  it("leaves the average price blank when a sale has no price", () => {
    const input = salesInput(
      salesHistory({
        events: [
          unitEvent({ variant: 1, order: 1, localDate: "2026-11-01", units: 1 }),
          unitEvent({ variant: 1, order: 2, localDate: "2026-11-01", units: 1, unitPrice: null }),
        ],
      }),
      [catalogVariant(1)],
    );
    const [row] = buildVariantSalesReport(input).rows;
    expect(row.sales.netUnits).toBe(2);
    expect(row.sales.revenue.toFixed(2)).toBe("10.00");
    expect(row.averagePrice).toBeNull();
  });
});

describe("buildProductSalesReport", () => {
  it("rolls variants up to their product", () => {
    const data = buildProductSalesReport(scenario());
    const rows = [...rowsByKey(data).values()];

    expect(rows.find((r) => r.product === "Trail Shoe")).toMatchObject({
      vendor: "Northwind",
      variantsSold: 2,
      netUnits: 7,
      revenue: "160.00",
      revenueShare: "1.00",
      // Orders 1, 2 and 4. Order 1 holds both variants and counts once.
      orders: 3,
    });
    expect(rows.find((r) => r.product === "Laces")).toMatchObject({
      netUnits: 0,
      revenue: "0.00",
      revenueShare: null,
      orders: 0,
    });
    expect(tiles(data)).toEqual({ "Net revenue": "$160.00", "Net units": "7", Products: "2" });
  });
});

describe("buildSaleItemsReport", () => {
  it("lists every unit event with its type, unit price and order", () => {
    const data = buildSaleItemsReport(scenario());
    const cells = data.rows.map((row) => cellsByColumn(data, row));

    expect(cells).toHaveLength(7);
    expect(cells[2]).toMatchObject({
      date: "2026-11-01",
      order: "#1",
      product: "Trail Shoe",
      variant: "Size 9",
      type: "Refunded",
      units: -1,
      unitPrice: "10.00",
      revenue: "-10.00",
    });
    expect(cells[6]).toMatchObject({ order: "#4", type: "Added by edit", units: 2, revenue: "80.00" });
    expect(tiles(data)).toEqual({ "Net revenue": "$160.00", "Net units": "7", "Sale items": "7" });
    expect(tiles(data, { facets: { type: "Refunded" } })).toEqual({
      "Net revenue": "-$35.00",
      "Net units": "-2",
      "Sale items": "2",
    });
  });

  it("describes a line as it was sold, not as the catalog reads today", () => {
    const history = salesHistory({
      events: [unitEvent({ variant: 1, order: 1, localDate: "2026-11-01", units: 1 })],
      lines: new Map([
        [
          "gid://shopify/LineItem/1-1",
          {
            lineGid: "gid://shopify/LineItem/1-1",
            title: "Trail Shoe (2025)",
            variantTitle: "Size 9 Wide",
            sku: "OLD-SKU",
            vendor: "Fabrikam",
          },
        ],
      ]),
    });
    const data = buildSaleItemsReport(
      salesInput(history, [catalogVariant(1, { productTitle: "Trail Shoe", sku: "NEW-SKU" })]),
    );
    expect(cellsByColumn(data, data.rows[0])).toMatchObject({
      product: "Trail Shoe (2025)",
      variant: "Size 9 Wide",
      sku: "OLD-SKU",
      vendor: "Fabrikam",
    });
  });
});

describe("buildOrdersReport", () => {
  it("totals units and product revenue per order", () => {
    const data = buildOrdersReport(scenario());
    const rows = rowsByKey(data);

    expect(rows.get("gid://shopify/Order/1")).toMatchObject({
      orderDate: "2026-11-01",
      order: "#1",
      variants: 2,
      unitsSold: 4,
      unitsReturned: 1,
      netUnits: 3,
      revenue: "60.00",
    });
    expect(rows.get("gid://shopify/Order/3")).toMatchObject({ netUnits: 0, revenue: "0.00" });
    // The edited order keeps its own order date, outside the range.
    expect(rows.get("gid://shopify/Order/4")).toMatchObject({
      orderDate: "2026-10-20",
      unitsSold: 2,
      revenue: "80.00",
    });
    // $160 across the three orders that still hold units.
    expect(tiles(data)).toEqual({
      Orders: "4",
      "Net product revenue": "$160.00",
      "Average per order": "$53.33",
    });
  });
});

describe("buildStatisticsReport", () => {
  it("reports every day of the range, including days without sales", () => {
    const input = scenario();
    const data = buildStatisticsReport({
      ...input,
      history: { ...input.history, startLocalDate: "2026-11-01", endLocalDate: "2026-11-04" },
    });
    const days = rowsByKey(data);

    expect([...days.keys()]).toEqual(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"]);
    expect(days.get("2026-11-01")).toMatchObject({
      orders: 1,
      unitsSold: 4,
      unitsReturned: 1,
      netUnits: 3,
      revenue: "60.00",
      averageOrderValue: "60.00",
    });
    expect(days.get("2026-11-02")).toMatchObject({ orders: 2, netUnits: 2, revenue: "20.00" });
    // Units added by an edit count on the day of the edit, but the order was
    // placed earlier, so the day has units and no new order.
    expect(days.get("2026-11-03")).toMatchObject({
      orders: 0,
      unitsSold: 2,
      revenue: "80.00",
      averageOrderValue: null,
    });
    expect(days.get("2026-11-04")).toMatchObject({ orders: 0, netUnits: 0, revenue: "0.00" });

    expect(tiles(data)).toEqual({
      "Net revenue": "$160.00",
      Orders: "3",
      "Average order value": "$53.33",
      "Net units": "7",
      "Units per order": "2.33",
      "Return rate": "22.22%",
      "Variants sold": "3",
      "Best day": "2026-11-03",
    });
  });

  it("shows dashes rather than dividing by zero on an empty range", () => {
    const data = buildStatisticsReport(salesInput(salesHistory({ events: [] }), []));
    expect(data.rows).toHaveLength(3);
    expect(tiles(data)).toMatchObject({
      Orders: "0",
      "Average order value": "—",
      "Units per order": "—",
      "Return rate": "—",
      "Best day": "—",
    });
  });
});

describe("salesNotices", () => {
  const diagnostics = salesHistory({ events: [] }).diagnostics;

  it("says nothing when the data can be read at face value", () => {
    expect(salesNotices({ coverage: coverage(), diagnostics })).toEqual([]);
  });

  it("warns when the range starts before the imported history", () => {
    const [notice] = salesNotices({
      coverage: coverage({ historyStartLocalDate: "2026-10-15", startsBeforeCoverage: true }),
      diagnostics,
    });
    expect(notice).toMatchObject({ tone: "warning" });
    expect(notice.body).toContain("2026-10-15");
    expect(notice.body).toContain("not zero");
  });

  it("tells an unsynced shop apart from a shop with no sales", () => {
    const [notice] = salesNotices({
      coverage: coverage({ historyStartLocalDate: null, startsBeforeCoverage: true }),
      diagnostics,
    });
    expect(notice.heading).toBe("No orders have been synced yet");
  });

  it("reports orders that were left out or could not be priced", () => {
    const headings = salesNotices({
      coverage: coverage(),
      diagnostics: {
        ...diagnostics,
        ordersExcludedSignInconsistent: 2,
        ordersWithoutLedger: 1,
        salesWithoutLine: 3,
        eventsWithoutRevenue: 1250,
      },
    }).map((notice) => `${notice.tone}: ${notice.heading}`);
    expect(headings).toEqual([
      "warning: 2 orders were left out",
      "warning: Some orders are still syncing",
      "info: 1,250 sales have units but no revenue",
    ]);
  });
});
