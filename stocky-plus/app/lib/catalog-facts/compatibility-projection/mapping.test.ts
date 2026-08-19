import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { LEGACY_VARIANT_TITLE_SEPARATOR } from "./constants";
import { CompatibilityProjectionError } from "./errors";
import {
  mapInventoryLevelToLegacySnapshot,
  mapLegacyVariantTitle,
  mapLegacyWeight,
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

function expectInventoryMappingFailure(
  level: CanonicalInventoryLevelRead,
  code: string,
) {
  expect(() => mapInventoryLevelToLegacySnapshot(level, NOW)).toThrow(
    CompatibilityProjectionError,
  );
  try {
    mapInventoryLevelToLegacySnapshot(level, NOW);
  } catch (error) {
    expect(error).toBeInstanceOf(CompatibilityProjectionError);
    const typed = error as CompatibilityProjectionError;
    expect(typed.code).toBe(code);
    expect(typed.retryable).toBe(true);
    expect(typed.identity).toEqual({
      kind: "InventoryLevel",
      inventoryItemGid: level.inventoryItemGid,
      locationGid: level.locationGid,
    });
  }
}

function expectVariantMappingFailure(
  variant: CanonicalVariantRead,
  code: string,
  retryable: boolean,
) {
  expect(() => mapVariantToLegacyCache(variant, NOW)).toThrow(
    CompatibilityProjectionError,
  );
  try {
    mapVariantToLegacyCache(variant, NOW);
  } catch (error) {
    expect(error).toBeInstanceOf(CompatibilityProjectionError);
    const typed = error as CompatibilityProjectionError;
    expect(typed.code).toBe(code);
    expect(typed.retryable).toBe(retryable);
    expect(typed.identity).toEqual({
      kind: "ProductVariant",
      shopifyGid: variant.shopifyGid,
    });
  }
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

  it("fails closed when a LIVE variant's product relation is missing", () => {
    expectVariantMappingFailure(
      liveVariant({ product: null }),
      "canonical_product_not_live",
      false,
    );
  });

  it("fails closed when a LIVE variant's product is not LIVE instead of degrading title/image", () => {
    expectVariantMappingFailure(
      liveVariant({
        product: {
          ...liveProduct(),
          existenceState: "ABSENT",
          title: "Deleted product",
          featuredMediaUrl: "https://cdn.example/gone.jpg",
        },
      }),
      "canonical_product_not_live",
      false,
    );
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

  it("fails closed when more than one LIVE inventory item is linked to a variant", () => {
    expect(() =>
      selectLiveInventoryItem(
        [
          liveItem({
            shopifyGid: "gid://shopify/InventoryItem/9",
            existenceState: "ABSENT",
          }),
          liveItem({ shopifyGid: "gid://shopify/InventoryItem/2" }),
          liveItem({ shopifyGid: "gid://shopify/InventoryItem/1" }),
        ],
        "gid://shopify/ProductVariant/1",
      ),
    ).toThrow(CompatibilityProjectionError);
    try {
      selectLiveInventoryItem(
        [
          liveItem({ shopifyGid: "gid://shopify/InventoryItem/2" }),
          liveItem({ shopifyGid: "gid://shopify/InventoryItem/1" }),
        ],
        "gid://shopify/ProductVariant/1",
      );
    } catch (error) {
      expect(error).toBeInstanceOf(CompatibilityProjectionError);
      const typed = error as CompatibilityProjectionError;
      expect(typed.code).toBe("canonical_multiple_live_inventory_items");
      expect(typed.retryable).toBe(false);
      expect(typed.identity).toEqual({
        kind: "ProductVariant",
        shopifyGid: "gid://shopify/ProductVariant/1",
      });
    }
  });

  it("does not emit a Shopify write target from ambiguous LIVE inventory items", () => {
    expectVariantMappingFailure(
      liveVariant({
        inventoryItems: [
          liveItem({ shopifyGid: "gid://shopify/InventoryItem/2" }),
          liveItem({ shopifyGid: "gid://shopify/InventoryItem/1" }),
        ],
      }),
      "canonical_multiple_live_inventory_items",
      false,
    );
  });

  it("uses the single LIVE inventory item and ignores ABSENT siblings", () => {
    const chosen = selectLiveInventoryItem(
      [
        liveItem({
          shopifyGid: "gid://shopify/InventoryItem/9",
          existenceState: "ABSENT",
        }),
        liveItem({ shopifyGid: "gid://shopify/InventoryItem/2" }),
      ],
      "gid://shopify/ProductVariant/1",
    );
    expect(chosen?.shopifyGid).toBe("gid://shopify/InventoryItem/2");
  });

  it("preserves zero-LIVE-item behavior as a null inventoryItemId", () => {
    const plan = mapVariantToLegacyCache(
      liveVariant({
        inventoryItems: [
          liveItem({
            shopifyGid: "gid://shopify/InventoryItem/9",
            existenceState: "ABSENT",
          }),
        ],
      }),
      NOW,
    );
    expect(plan.action).toBe("upsert");
    if (plan.action !== "upsert") return;
    expect(plan.fields.inventoryItemId).toBeNull();
    expect(plan.fields.weight).toBeNull();
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

  it("projects canonical availableQuantity 0 as true zero, not unknown", () => {
    const plan = mapInventoryLevelToLegacySnapshot(
      liveLevel({ availableQuantity: 0 }),
      NOW,
    );
    expect(plan.fields.quantityAvailable).toBe(0);
  });

  it("copies negative canonical availableQuantity exactly and does not clamp to zero", () => {
    const plan = mapInventoryLevelToLegacySnapshot(
      liveLevel({ availableQuantity: -2 }),
      NOW,
    );
    expect(plan.fields.quantityAvailable).toBe(-2);
  });

  it("fails closed when a LIVE level has unknown availableQuantity", () => {
    expectInventoryMappingFailure(
      liveLevel({ availableQuantity: null }),
      "canonical_available_quantity_missing",
    );
  });

  it("fails closed when a LIVE level is missing Location state rather than explicit ABSENT", () => {
    expectInventoryMappingFailure(
      liveLevel({ location: null, availableQuantity: 17 }),
      "canonical_location_state_missing",
    );
  });

  it("does not collapse missing Location state into unknown availableQuantity", () => {
    expectInventoryMappingFailure(
      liveLevel({ location: null, availableQuantity: null }),
      "canonical_location_state_missing",
    );
  });

  it("fails closed when a LIVE level has unknown variant existence rather than explicit ABSENT", () => {
    expectInventoryMappingFailure(
      liveLevel({ variantExistenceState: null, availableQuantity: 17 }),
      "canonical_variant_state_missing",
    );
  });

  it("does not collapse unknown variant existence into unknown availableQuantity", () => {
    expectInventoryMappingFailure(
      liveLevel({ variantExistenceState: null, availableQuantity: null }),
      "canonical_variant_state_missing",
    );
  });

  it("does not present a tombstoned level as live available quantity", () => {
    const plan = mapInventoryLevelToLegacySnapshot(
      liveLevel({ existenceState: "ABSENT", availableQuantity: 44 }),
      NOW,
    );
    expect(plan.fields.quantityAvailable).toBe(0);
  });

  it("projects zero when a LIVE level has an explicitly ABSENT location", () => {
    const plan = mapInventoryLevelToLegacySnapshot(
      liveLevel({
        location: {
          shopifyGid: "gid://shopify/Location/1",
          existenceState: "ABSENT",
        },
        availableQuantity: 9,
      }),
      NOW,
    );
    expect(plan.fields.quantityAvailable).toBe(0);
  });

  it("projects zero when a LIVE level has an explicitly ABSENT inventory item with known variant identity", () => {
    const plan = mapInventoryLevelToLegacySnapshot(
      liveLevel({
        inventoryItem: liveItem({ existenceState: "ABSENT" }),
        availableQuantity: 9,
      }),
      NOW,
    );
    expect(plan.fields.quantityAvailable).toBe(0);
  });

  it("does not present available quantity when the variant is tombstoned", () => {
    const plan = mapInventoryLevelToLegacySnapshot(
      liveLevel({ variantExistenceState: "ABSENT", availableQuantity: 9 }),
      NOW,
    );
    expect(plan.fields.quantityAvailable).toBe(0);
  });

  it("still projects zero for an ABSENT level whose availableQuantity is also null", () => {
    const plan = mapInventoryLevelToLegacySnapshot(
      liveLevel({ existenceState: "ABSENT", availableQuantity: null }),
      NOW,
    );
    expect(plan.fields.quantityAvailable).toBe(0);
  });

  it("fails closed when the inventory item has no known shopifyVariantGid", () => {
    const level = liveLevel({
      inventoryItem: liveItem({ shopifyVariantGid: null }),
    });
    expectInventoryMappingFailure(level, "canonical_variant_link_missing");
  });

  it("does not invent a variant GID from SKU, barcode, or title", () => {
    expect(() =>
      mapInventoryLevelToLegacySnapshot(
        liveLevel({
          inventoryItem: liveItem({
            shopifyVariantGid: null,
            shopifyGid: "gid://shopify/InventoryItem/sku-trap",
          }),
        }),
        NOW,
      ),
    ).toThrow(CompatibilityProjectionError);
  });

  it("does not treat an ABSENT item without a variant GID as projectable zero", () => {
    expectInventoryMappingFailure(
      liveLevel({
        inventoryItem: liveItem({
          existenceState: "ABSENT",
          shopifyVariantGid: null,
        }),
      }),
      "canonical_variant_link_missing",
    );
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
      expect(typed.identity).toEqual({
        kind: "ProductVariant",
        shopifyGid: "gid://shopify/ProductVariant/1",
      });
    }
  });

  it("rounds weight down when the 5th decimal is below half", () => {
    expect(
      mapLegacyWeight(new Prisma.Decimal("1.00004"))?.equals(
        new Prisma.Decimal("1.0000"),
      ),
    ).toBe(true);
  });

  it("rounds weight half away from zero with explicit ROUND_HALF_UP", () => {
    expect(
      mapLegacyWeight(new Prisma.Decimal("1.00005"))?.equals(
        new Prisma.Decimal("1.0001"),
      ),
    ).toBe(true);
  });

  it("keeps exact four-decimal weights unchanged", () => {
    expect(
      mapLegacyWeight(new Prisma.Decimal("1.2500"))?.equals(
        new Prisma.Decimal("1.2500"),
      ),
    ).toBe(true);
  });

  it("quantizes negative weights with ROUND_HALF_UP independently of global rounding", () => {
    const previous = Prisma.Decimal.rounding;
    try {
      Prisma.Decimal.set({ rounding: Prisma.Decimal.ROUND_DOWN });
      expect(
        mapLegacyWeight(new Prisma.Decimal("-1.00005"))?.equals(
          new Prisma.Decimal("-1.0001"),
        ),
      ).toBe(true);
      expect(
        mapLegacyWeight(new Prisma.Decimal("1.00005"))?.equals(
          new Prisma.Decimal("1.0001"),
        ),
      ).toBe(true);
    } finally {
      Prisma.Decimal.set({ rounding: previous });
    }
  });

  it("returns null weight for null canonical weightValue", () => {
    expect(mapLegacyWeight(null)).toBeNull();
    const plan = mapVariantToLegacyCache(
      liveVariant({
        inventoryItems: [liveItem({ weightValue: null, weightUnit: null })],
      }),
      NOW,
    );
    expect(plan.action).toBe("upsert");
    if (plan.action !== "upsert") return;
    expect(plan.fields.weight).toBeNull();
  });

  it("fails closed when rounding up crosses DECIMAL(10, 4) overflow", () => {
    expect(() => mapLegacyWeight(new Prisma.Decimal("999999.99995"))).toThrow(
      CompatibilityProjectionError,
    );
    try {
      mapLegacyWeight(new Prisma.Decimal("999999.99995"));
    } catch (error) {
      expect(error).toBeInstanceOf(CompatibilityProjectionError);
      const typed = error as CompatibilityProjectionError;
      expect(typed.code).toBe("legacy_weight_overflow");
      expect(typed.retryable).toBe(false);
    }
  });
});
