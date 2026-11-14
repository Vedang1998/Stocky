import { describe, expect, it } from "vitest";
import type { LocationStock, VariantStock } from "./api-types";
import {
  splitByLocation,
  summarizeStock,
  variantGidFromPosId,
} from "./stock-summary";

function location(id: number, available: number): LocationStock {
  return {
    locationGid: `gid://shopify/Location/${id}`,
    locationName: `Store ${id}`,
    available,
    onHand: available,
    committed: 0,
    incoming: 0,
    observedAt: "2026-11-10T12:00:00.000Z",
  };
}

function stockAt(...locations: LocationStock[]): VariantStock {
  const available = locations.reduce((sum, l) => sum + (l.available ?? 0), 0);
  return {
    variantGid: "gid://shopify/ProductVariant/11",
    inventoryItemGid: "gid://shopify/InventoryItem/21",
    tracked: true,
    locations,
    totals: { available, onHand: available, committed: 0, incoming: 0 },
  };
}

describe("splitByLocation", () => {
  it("separates the POS location from the others", () => {
    const stock = stockAt(location(1, 4), location(2, 6), location(3, 0));
    const { here, elsewhere } = splitByLocation(stock, 2);
    expect(here?.locationName).toBe("Store 2");
    expect(elsewhere.map((l) => l.locationName)).toEqual(["Store 1", "Store 3"]);
  });

  it("keeps every location when the product is not stocked here", () => {
    const stock = stockAt(location(1, 4));
    expect(splitByLocation(stock, 9)).toEqual({ here: null, elsewhere: stock.locations });
    expect(splitByLocation(stock, null)).toEqual({ here: null, elsewhere: stock.locations });
  });

  it("does not match a location whose ID only starts with the POS location ID", () => {
    expect(splitByLocation(stockAt(location(12, 4)), 1).here).toBeNull();
  });

  it("treats missing stock as no locations", () => {
    expect(splitByLocation(null, 1)).toEqual({ here: null, elsewhere: [] });
  });
});

describe("summarizeStock", () => {
  it("reports this location and the shop total", () => {
    const stock = stockAt(location(1, 4), location(2, 6));
    expect(summarizeStock(stock, 2)).toEqual({
      kind: "levels",
      here: stock.locations[1],
      locationKnown: true,
      locationCount: 2,
      totals: stock.totals,
    });
  });

  it("says when the product is stocked only at other locations", () => {
    expect(summarizeStock(stockAt(location(1, 4)), 2)).toMatchObject({
      kind: "levels",
      here: null,
      locationKnown: true,
      locationCount: 1,
    });
  });

  it("records that POS gave no location", () => {
    expect(summarizeStock(stockAt(location(1, 4)), null)).toMatchObject({
      kind: "levels",
      here: null,
      locationKnown: false,
    });
  });

  it("distinguishes untracked products from products with no stock records", () => {
    expect(summarizeStock({ ...stockAt(location(1, 4)), tracked: false }, 1)).toEqual({
      kind: "untracked",
    });
    expect(summarizeStock(stockAt(), 1)).toEqual({ kind: "unstocked" });
    expect(summarizeStock(null, 1)).toEqual({ kind: "unstocked" });
  });
});

describe("variantGidFromPosId", () => {
  it("builds the variant GID from the POS numeric ID", () => {
    expect(variantGidFromPosId(44556677)).toBe("gid://shopify/ProductVariant/44556677");
  });

  it.each([0, -3, 1.5, Number.NaN, 2 ** 60, "12", null, undefined])(
    "rejects %s",
    (value) => {
      expect(variantGidFromPosId(value)).toBeNull();
    },
  );
});
