import { describe, expect, it } from "vitest";
import { Decimal } from "../analytics/money";
import type {
  LowStock,
  LowStockLine,
  LowStockWorksheet,
} from "../analytics/low-stock.server";
import type { ReportViewRequest } from "./params";
import { exportTable, tablePage } from "./present";
import { buildLowStockReport } from "./low-stock-report";
import { cellsByColumn } from "./test-fixtures";
import type { ReportData } from "./types";

const VIEW: ReportViewRequest = {
  search: "",
  facets: {},
  sortKey: null,
  sortDirection: null,
  page: 1,
};

function line(
  variantGid: string,
  overrides: Partial<LowStockLine> = {},
): LowStockLine {
  return {
    variantGid,
    productGid: "gid://shopify/Product/1",
    productTitle: "Trail Shoe",
    variantTitle: "Size 9",
    sku: "TS-9",
    vendor: "Northwind",
    supplierName: "Acme",
    status: "LOW",
    available: 4,
    onHand: 5,
    committed: 1,
    incoming: 0,
    unitsPerDay: new Decimal("2"),
    daysOfStock: new Decimal("2.0"),
    depletionDate: "2026-11-21",
    leadTimeDays: 7,
    reorderPoint: 20,
    price: new Decimal("10.00"),
    priceCurrencyCode: "USD",
    suggestedQuantity: 30,
    orderQuantity: 0,
    purchaseOrderNumber: null,
    ...overrides,
  };
}

const WORKSHEET: LowStockWorksheet = {
  id: "ws1",
  generatedAt: new Date("2026-11-19T15:00:00Z"),
  locationName: null,
  allLocations: true,
  selection: { vendor: null, productType: null, supplierId: null },
};

function build(
  lines: LowStockLine[],
  view = "variants",
  worksheet: LowStockWorksheet | null = WORKSHEET,
) {
  const lowStock: LowStock = { worksheet, lines };
  return buildLowStockReport({
    lowStock,
    view,
    timeZone: "America/New_York",
    currencyCode: "USD",
  });
}

function rowsByKey<Row>(data: ReportData<Row>) {
  return new Map(
    data.rows.map((row) => [data.rowKey(row), cellsByColumn(data, row)]),
  );
}

function tiles<Row>(data: ReportData<Row>) {
  return Object.fromEntries(
    tablePage(data, VIEW, "USD").tiles.map((t) => [t.label, t]),
  );
}

const OUT_OF_STOCK = line("v2", {
  variantGid: "v2",
  variantTitle: "Size 10",
  status: "OUT_OF_STOCK",
  available: 0,
  daysOfStock: new Decimal("0.0"),
  depletionDate: "2026-11-19",
  unitsPerDay: new Decimal("3"),
});

describe("buildLowStockReport: variants", () => {
  it("lists each low or out-of-stock variant with the worksheet's figures", () => {
    const rows = rowsByKey(build([line("v1"), OUT_OF_STOCK]));
    expect(rows.get("v1")).toMatchObject({
      product: "Trail Shoe",
      variant: "Size 9",
      sku: "TS-9",
      vendor: "Northwind",
      supplier: "Acme",
      status: "Low",
      available: 4,
      incoming: 0,
      unitsPerDay: "2.00",
      daysOfStock: "2.0",
      depletion: "2026-11-21",
      leadTime: 7,
      reorderPoint: 20,
      suggested: 30,
      lostRevenue: null,
    });
    expect(rows.get("v2")).toMatchObject({
      status: "Out of stock",
      lostRevenue: "30.00",
    });
  });

  it("shows a single-variant product without the placeholder title", () => {
    const rows = rowsByKey(
      build([line("v1", { variantTitle: "Default Title" })]),
    );
    expect(rows.get("v1")?.variant).toBe("");
  });

  it("leaves lost revenue blank without a rate, a price or a price in the store currency", () => {
    const base = { status: "OUT_OF_STOCK" as const };
    const rows = rowsByKey(
      build([
        line("a", { ...base, unitsPerDay: null }),
        line("b", { ...base, price: null }),
        line("c", { ...base, priceCurrencyCode: "EUR" }),
      ]),
    );
    for (const key of ["a", "b", "c"]) {
      expect(rows.get(key)?.lostRevenue).toBeNull();
    }
  });

  it("leaves lost revenue blank when returns make the selling rate zero or negative", () => {
    const base = { status: "OUT_OF_STOCK" as const };
    const data = build([
      line("zero", { ...base, unitsPerDay: new Decimal("0") }),
      line("negative", { ...base, unitsPerDay: new Decimal("-0.5") }),
    ]);
    const rows = rowsByKey(data);
    expect(rows.get("zero")?.lostRevenue).toBeNull();
    expect(rows.get("negative")?.lostRevenue).toBeNull();
    expect(tiles(data)["Lost revenue per day"]?.value).toBe("—");
  });

  it("dates the figures by the worksheet, not as live records", () => {
    const data = build([line("v1")]);
    expect(data.dataAsOf).toEqual(WORKSHEET.generatedAt);
    expect(build([], "variants", null).dataAsOf).toBeNull();
  });

  it("treats an unknown view as variants", () => {
    expect(build([line("v1")], "nonsense").columns.map((c) => c.key)).toContain(
      "status",
    );
  });
});

describe("buildLowStockReport: products and vendors", () => {
  const lines = [
    line("v1"),
    OUT_OF_STOCK,
    line("v3", {
      productGid: "gid://shopify/Product/2",
      productTitle: "Laces",
      vendor: null,
      available: 2,
      incoming: 10,
      suggestedQuantity: null,
      depletionDate: "2026-11-25",
    }),
  ];

  it("groups variants by product", () => {
    const data = build(lines, "products");
    const rows = rowsByKey(data);
    expect(rows.get("gid://shopify/Product/1")).toMatchObject({
      product: "Trail Shoe",
      vendor: "Northwind",
      variants: 2,
      outOfStock: 1,
      available: 4,
      incoming: 0,
      depletion: "2026-11-19",
      suggested: 60,
      lostRevenue: "30.00",
    });
    expect(rows.get("gid://shopify/Product/2")).toMatchObject({
      variants: 1,
      outOfStock: 0,
      incoming: 10,
      suggested: null,
      lostRevenue: null,
    });
  });

  it("groups by vendor, naming the products without one", () => {
    const data = build(lines, "vendors");
    const rows = rowsByKey(data);
    expect(rows.get("Northwind")).toMatchObject({
      vendor: "Northwind",
      products: 1,
      variants: 2,
      outOfStock: 1,
    });
    expect(rows.get("")).toMatchObject({
      vendor: "No vendor",
      products: 1,
      variants: 1,
    });
  });
});

describe("buildLowStockReport: tiles and notices", () => {
  it("totals what is on screen", () => {
    const t = tiles(build([line("v1"), OUT_OF_STOCK]));
    expect(t["Variants low or out"]?.value).toBe("2");
    expect(t["Out of stock"]?.value).toBe("1");
    expect(t["Suggested order units"]?.value).toBe("60");
    expect(t["Lost revenue per day"]?.value).toContain("30.00");
  });

  it("says there is no worksheet when none was generated", () => {
    const data = build([], "variants", null);
    expect(data.rows).toEqual([]);
    expect(data.notices.map((n) => n.heading)).toEqual([
      "No replenishment worksheet yet",
    ]);
  });

  it("names the worksheet the figures come from", () => {
    const [first, ...rest] = build([line("v1")]).notices;
    expect(first?.heading).toMatch(
      /^From the worksheet generated Nov 19, 2026/,
    );
    expect(rest).toEqual([]);
  });

  it("warns when the worksheet covered one location or part of the catalog", () => {
    const data = build([line("v1")], "variants", {
      ...WORKSHEET,
      allLocations: false,
      locationName: "Downtown store",
      selection: { vendor: "Northwind", productType: null, supplierId: "s1" },
    });
    const byHeading = new Map(data.notices.map((n) => [n.heading, n]));
    expect(byHeading.get("Counted at one location")?.body).toContain(
      "Downtown store",
    );
    const partial = byHeading.get(
      "The worksheet covers only part of your products",
    );
    expect(partial?.tone).toBe("warning");
    expect(partial?.body).toContain("vendor Northwind and one supplier");
  });

  it("warns when the worksheet's settings cannot be read", () => {
    const data = build([line("v1")], "variants", {
      ...WORKSHEET,
      selection: null,
    });
    expect(data.notices.map((n) => n.heading)).toContain(
      "The worksheet's settings could not be read",
    );
  });
});

describe("buildLowStockReport: export", () => {
  it("downloads the variants view in the order on screen, soonest run-out first", () => {
    const file = exportTable(build([line("v1"), OUT_OF_STOCK]), VIEW, "USD");
    const header = file.headers;
    const column = (name: string) => header.indexOf(name);

    expect(file.rows.map((row) => row[column("Variant")])).toEqual([
      "Size 10",
      "Size 9",
    ]);
    expect(file.rows[0]?.[column("Status")]).toBe("Out of stock");
    expect(header).toContain("Lost revenue per day (USD)");
    expect(file.rows[0]?.[column("Lost revenue per day (USD)")]).toBe("30.00");
    expect(file.rows[1]?.[column("Lost revenue per day (USD)")]).toBeNull();
  });

  it("downloads only the rows of the chosen view", () => {
    const file = exportTable(
      build([line("v1"), OUT_OF_STOCK], "vendors"),
      VIEW,
      "USD",
    );
    expect(file.headers).toEqual(
      expect.arrayContaining(["Vendor", "Products", "Variants low or out"]),
    );
    expect(file.headers).not.toContain("SKU");
    expect(file.rows).toHaveLength(1);
  });
});
