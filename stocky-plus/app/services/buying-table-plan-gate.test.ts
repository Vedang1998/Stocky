/**
 * The Buying Table's actions refuse a shop without an active plan on the
 * server, not only by hiding the forms.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

const { db } = vi.hoisted(() => ({
  db: {
    authority: {
      shopId: "shop-no-plan",
      myshopifyDomain: "no-plan.myshopify.com",
    },
    shopSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    supplier: { findFirst: vi.fn() },
    supplierSkuMapping: { findFirst: vi.fn() },
    purchaseOrder: { create: vi.fn() },
    forecastOverride: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => ({
    tenant: { myshopifyDomain: "no-plan.myshopify.com" },
    db,
  })),
}));
vi.mock("./landed-cost.server", () => ({ resolveTieredUnitCost: vi.fn() }));
vi.mock("./shopify-gql.server", () => ({
  fetchInventoryLevels: vi.fn(),
  fetchLocations: vi.fn(),
}));
vi.mock("./forecasting.server", () => ({ computeForecast: vi.fn() }));

async function post(fields: Record<string, string>): Promise<unknown> {
  const { action } = await import("../routes/app.buying-table");
  try {
    return await action({
      request: new Request("https://app.example/app/buying-table", {
        method: "POST",
        body: new URLSearchParams(fields),
      }),
      params: {},
      context: {},
    } as unknown as ActionFunctionArgs);
  } catch (thrown) {
    return thrown;
  }
}

const WRITES: Array<Record<string, string>> = [
  {
    intent: "createPO",
    supplierId: "supplier-1",
    locationId: "gid://shopify/Location/1",
    "qty-map-a": "5",
  },
  {
    intent: "setLookback",
    variantId: "gid://shopify/ProductVariant/1",
    locationId: "gid://shopify/Location/1",
    lookbackStart: "2026-10-01",
    lookbackEnd: "2026-11-01",
  },
  {
    intent: "clearLookback",
    variantId: "gid://shopify/ProductVariant/1",
    locationId: "gid://shopify/Location/1",
  },
];

describe("Buying Table plan gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const snapshot of [{ subscriptionActive: false }, null]) {
    it(`refuses every write with 403 when the plan snapshot is ${JSON.stringify(snapshot)}`, async () => {
      db.shopSettings.findUnique.mockResolvedValue(snapshot);

      for (const fields of WRITES) {
        const result = await post(fields);
        expect(result, fields.intent).toBeInstanceOf(Response);
        expect((result as Response).status, fields.intent).toBe(403);
      }

      expect(db.supplier.findFirst).not.toHaveBeenCalled();
      expect(db.purchaseOrder.create).not.toHaveBeenCalled();
      expect(db.forecastOverride.upsert).not.toHaveBeenCalled();
      expect(db.forecastOverride.deleteMany).not.toHaveBeenCalled();
    });
  }

  it("lets the writes through with an active plan", async () => {
    db.shopSettings.findUnique.mockResolvedValue({ subscriptionActive: true });

    expect(await post(WRITES[1])).toEqual({ ok: true });
    expect(await post(WRITES[2])).toEqual({ ok: true });
    expect(db.forecastOverride.upsert).toHaveBeenCalledTimes(1);
    expect(db.forecastOverride.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("keeps the development activation reachable without a plan", async () => {
    db.shopSettings.findUnique.mockResolvedValue(null);
    const result = await post({ intent: "devActivate" });
    expect(result).toMatchObject({ error: expect.stringContaining("disabled") });
    expect(db.shopSettings.findUnique).not.toHaveBeenCalled();
  });
});
