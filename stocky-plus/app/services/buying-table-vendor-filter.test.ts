/**
 * The Buying Table vendor filter. The placeholder option has a value of its
 * own, because an `s-select` submits the option's label when the value is
 * empty, and a vendor id that is not on the shop's list loads nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoaderFunctionArgs } from "react-router";

const { db } = vi.hoisted(() => ({
  db: {
    shopSettings: { upsert: vi.fn() },
    supplier: { findMany: vi.fn() },
    supplierSkuMapping: { findMany: vi.fn() },
  },
}));

vi.mock("../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => ({
    admin: {},
    tenant: { myshopifyDomain: "vendor-filter.myshopify.com" },
    db,
  })),
}));
vi.mock("./landed-cost.server", () => ({ resolveTieredUnitCost: vi.fn() }));
vi.mock("./shopify-gql.server", () => ({
  fetchInventoryLevels: vi.fn(),
  fetchLocations: vi.fn(async () => [
    { id: "gid://shopify/Location/1", name: "Shop floor" },
  ]),
}));
vi.mock("./forecasting.server", () => ({ computeForecast: vi.fn() }));

async function load(query: string) {
  const { loader } = await import("../routes/app.buying-table");
  return loader({
    request: new Request(`https://app.example/app/buying-table${query}`),
    params: {},
    context: {},
  } as unknown as LoaderFunctionArgs);
}

describe("Buying Table vendor filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.shopSettings.upsert.mockResolvedValue({ subscriptionActive: true });
    db.supplier.findMany.mockResolvedValue([{ id: "supplier-1", name: "Acme" }]);
    db.supplierSkuMapping.findMany.mockResolvedValue([]);
  });

  it("treats the placeholder option as no vendor chosen", async () => {
    const data = await load("?supplierId=none&metric=REVENUE");

    expect(data.supplierId).toBe("");
    expect(data.supplierNotFound).toBe(false);
    expect(db.supplierSkuMapping.findMany).not.toHaveBeenCalled();
  });

  it("loads nothing for a vendor id that is not on the shop's list and says so", async () => {
    const data = await load("?supplierId=Select+a+vendor");

    expect(data.supplierId).toBe("");
    expect(data.supplierNotFound).toBe(true);
    expect(data.rows).toEqual([]);
    expect(db.supplierSkuMapping.findMany).not.toHaveBeenCalled();
  });

  it("loads the mappings of a vendor on the shop's list", async () => {
    const data = await load("?supplierId=supplier-1");

    expect(data.supplierId).toBe("supplier-1");
    expect(data.supplierNotFound).toBe(false);
    expect(db.supplierSkuMapping.findMany).toHaveBeenCalledWith({
      where: { supplierId: "supplier-1" },
      take: 50,
    });
  });

  it("shows no notice when the page opens without a vendor", async () => {
    const data = await load("");

    expect(data.supplierId).toBe("");
    expect(data.supplierNotFound).toBe(false);
  });
});
