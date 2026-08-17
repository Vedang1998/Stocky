import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { LEGACY_VARIANT_TITLE_SEPARATOR } from "./constants";
import { CompatibilityProjectionError } from "./errors";
import {
  mapInventoryLevelToLegacySnapshot,
  mapLegacyVariantTitle,
  mapVariantToLegacyCache,
  selectLiveInventoryItem,
} from "./mapping";
import { legacySnapshotDate } from "./snapshot-date";
import type {
  CanonicalInventoryItemRead,
  CanonicalInventoryLevelRead,
  CanonicalVariantRead,
} from "./types";

const NOW = new Date("2026-08-17T15:30:00.000Z");

function liveProduct() {
  return {
    shopifyGid: "gid://shopify/Product/1",
    title: "Widget",
    featuredMediaUrl: "https://cdn.example/widget.jpg",
    existenceState: "LIVE" as const,
  };
}

function liveItem(
  overrides: Partial<CanonicalInventoryItemRead> = {},
): CanonicalInventoryItemRead {
  return {
    shopifyGid: "gid://shopify/InventoryItem/1",
    shopifyVariantGid: "gid://shopify/ProductVariant/1",
    weightValue: new Prisma.Decimal("1.250000"),
    weightUnit: "GRAMS",
    existenceState: "LIVE",
    ...overrides,
  };
}

function liveVariant(
  overrides: Partial<CanonicalVariantRead> = {},
): CanonicalVariantRead {
  return {
    shopifyGid: "gid://shopify/ProductVariant/1",
    shopifyProductGid: "gid://shopify/Product/1",
    title: "Blue",
    sku: "SKU-1",
    barcode: "012345",
    existenceState: "LIVE",
    product: liveProduct(),
    inventoryItems: [liveItem()],
    ...overrides,
  };
}

function liveLevel(
  overrides: Partial<CanonicalInventoryLevelRead> = {},
): CanonicalInventoryLevelRead {
  return {
    inventoryItemGid: "gid://shopify/InventoryItem/1",
    locationGid: "gid://shopify/Location/1",
    availableQuantity: 17,
    existenceState: "LIVE",
    inventoryItem: liveItem(),
    location: {
      shopifyGid: "gid://shopify/Location/1",
      existenceState: "LIVE",
    },
    variantExistenceState: "LIVE",
    ...overrides,
  };
}

describe("compatibility projection mapping", () => {
  it("maps a live canonical variant onto the legacy cache fields", () => {
    const plan = mapVariantToLegacyCache(liveVariant(), NOW);
    expect(plan.action).toBe("upsert");
    if (plan.action !== "upsert") return;
    expect(plan.fields.shopifyVariantId).toBe("gid://shopify/ProductVariant/1");
    expect(plan.fields.shopifyProductId).toBe("gid://shopify/Product/1");
    expect(plan.fields.title).toBe(`Widget${LEGACY_VARIANT_TITLE_SEPARATOR}Blue`);
    expect(plan.fields.sku).toBe("SKU-1");
    expect(plan.fields.barcode).toBe("012345");
    expect(plan.fields.imageUrl).toBe("https://cdn.example/widget.jpg");
    expect(plan.fields.inventoryItemId).toBe("gid://shopify/InventoryItem/1");
    expect(plan.fields.weight?.equals(new Prisma.Decimal("1.25"))).toBe(true);
    expect(plan.fields.weightUnit).toBe("GRAMS");
  });

  it("composes title the same way as ingestBulkVariantCache", () => {
    expect(mapLegacyVariantTitle("Blue", liveProduct())).toBe(
      `Widget${LEGACY_VARIANT_TITLE_SEPARATOR}Blue`,
    );
    expect(mapLegacyVariantTitle("Blue", null)).toBe("Blue");
  });

  it("does not use a tombstoned product as live cache title or image", () => {
    const plan = mapVariantToLegacyCache(
      liveVariant({
        product: {
          ...liveProduct(),
          existenceState: "ABSENT",
          title: "Deleted product",
          featuredMediaUrl: "https://cdn.example/gone.jpg",
        },
      }),
      NOW,
    );
    expect(plan.action).toBe("upsert");
    if (plan.action !== "upsert") return;
    expect(plan.fields.title).toBe("Blue");
    expect(plan.fields.imageUrl).toBeNull();
  });

  it("tombstones a non-live canonical variant instead of upserting cache", () => {
    const plan = mapVariantToLegacyCache(
      liveVariant({ existenceState: "ABSENT" }),
      NOW,
    );
    expect(plan).toEqual({
      action: "tombstone",
      shopifyVariantId: "gid://shopify/ProductVariant/1",
      snapshotDate: legacySnapshotDate(NOW),
    });
  });

  it("selects the lexicographically first LIVE inventory item", () => {
    const chosen = selectLiveInventoryItem([
      liveItem({
        shopifyGid: "gid://shopify/InventoryItem/9",
        existenceState: "ABSENT",
      }),
      liveItem({ shopifyGid: "gid://shopify/InventoryItem/2" }),
      liveItem({ shopifyGid: "gid://shopify/InventoryItem/1" }),
    ]);
    expect(chosen?.shopifyGid).toBe("gid://shopify/InventoryItem/1");
  });

  it("maps live inventory quantities onto today's legacy snapshot", () => {
    const plan = mapInventoryLevelToLegacySnapshot(liveLevel(), NOW);
    expect(plan).toEqual({
      action: "upsert",
      fields: {
        shopifyVariantId: "gid://shopify/ProductVariant/1",
        locationId: "gid://shopify/Location/1",
        snapshotDate: legacySnapshotDate(NOW),
        quantityAvailable: 17,
      },
    });
  });

  it("does not present a tombstoned level as live available quantity", () => {
    const plan = mapInventoryLevelToLegacySnapshot(
      liveLevel({ existenceState: "ABSENT", availableQuantity: 44 }),
      NOW,
    );
    expect(plan?.fields.quantityAvailable).toBe(0);
  });

  it("does not present available quantity when the variant is tombstoned", () => {
    const plan = mapInventoryLevelToLegacySnapshot(
      liveLevel({ variantExistenceState: "ABSENT", availableQuantity: 9 }),
      NOW,
    );
    expect(plan?.fields.quantityAvailable).toBe(0);
  });

  it("skips snapshot mapping when the inventory item has no variant GID", () => {
    const plan = mapInventoryLevelToLegacySnapshot(
      liveLevel({
        inventoryItem: liveItem({ shopifyVariantGid: null }),
      }),
      NOW,
    );
    expect(plan).toBeNull();
  });

  it("fails closed when canonical weight overflows DECIMAL(10, 4)", () => {
    expect(() =>
      mapVariantToLegacyCache(
        liveVariant({
          inventoryItems: [
            liveItem({ weightValue: new Prisma.Decimal("1000000.0000") }),
          ],
        }),
        NOW,
      ),
    ).toThrow(CompatibilityProjectionError);
    try {
      mapVariantToLegacyCache(
        liveVariant({
          inventoryItems: [
            liveItem({ weightValue: new Prisma.Decimal("1000000.0000") }),
          ],
        }),
        NOW,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(CompatibilityProjectionError);
      const typed = error as CompatibilityProjectionError;
      expect(typed.code).toBe("legacy_weight_overflow");
      expect(typed.retryable).toBe(false);
    }
  });
});
