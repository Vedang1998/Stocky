/**
 * The Buying Table's lookback actions refuse a request without a usable
 * product or location with a message. Before, a missing field reached the
 * database as null and the request ended in a 500.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

const { db } = vi.hoisted(() => ({
  db: {
    authority: {
      shopId: "shop-lookback",
      myshopifyDomain: "lookback.myshopify.com",
    },
    shopSettings: { findUnique: vi.fn() },
    forecastOverride: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => ({
    tenant: { myshopifyDomain: "lookback.myshopify.com" },
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
  return action({
    request: new Request("https://app.example/app/buying-table", {
      method: "POST",
      body: new URLSearchParams(fields),
    }),
    params: {},
    context: {},
  } as unknown as ActionFunctionArgs);
}

const VARIANT = "gid://shopify/ProductVariant/1";
const LOCATION = "gid://shopify/Location/1";
const WINDOW = { lookbackStart: "2026-10-01", lookbackEnd: "2026-11-01" };

const UNUSABLE: Array<[string, Record<string, string>]> = [
  ["no product", { locationId: LOCATION }],
  ["no location", { variantId: VARIANT }],
  ["an empty product", { variantId: "", locationId: LOCATION }],
  ["an empty location", { variantId: VARIANT, locationId: "" }],
  [
    "an over-long product",
    { variantId: "v".repeat(257), locationId: LOCATION },
  ],
];

describe("Buying Table lookback input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.shopSettings.findUnique.mockResolvedValue({ subscriptionActive: true });
  });

  it.each(UNUSABLE)(
    "does not save a lookback window with %s",
    async (_label, target) => {
      const result = await post({
        intent: "setLookback",
        ...target,
        ...WINDOW,
      });

      expect(result).toEqual({
        error: expect.stringContaining("product and a location"),
      });
      expect(db.forecastOverride.upsert).not.toHaveBeenCalled();
    },
  );

  it.each(UNUSABLE)(
    "does not clear a lookback window with %s",
    async (_label, target) => {
      const result = await post({ intent: "clearLookback", ...target });

      expect(result).toEqual({
        error: expect.stringContaining("product and a location"),
      });
      expect(db.forecastOverride.deleteMany).not.toHaveBeenCalled();
    },
  );

  it("saves and clears the window of the product and location it was sent", async () => {
    expect(
      await post({
        intent: "setLookback",
        variantId: VARIANT,
        locationId: LOCATION,
        ...WINDOW,
      }),
    ).toEqual({ ok: true });
    expect(db.forecastOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          shop_variantId_locationId: {
            shop: "lookback.myshopify.com",
            variantId: VARIANT,
            locationId: LOCATION,
          },
        },
      }),
    );

    expect(
      await post({
        intent: "clearLookback",
        variantId: VARIANT,
        locationId: LOCATION,
      }),
    ).toEqual({ ok: true });
    expect(db.forecastOverride.deleteMany).toHaveBeenCalledWith({
      where: { variantId: VARIANT, locationId: LOCATION },
    });
  });
});
