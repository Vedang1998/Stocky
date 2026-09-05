import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { CompatibilityProjectionError } from "./errors";
import { mapVariantToLegacyCache } from "./mapping";
import {
  coerceCanonicalInventoryItem,
  coerceCanonicalVariant,
} from "./project";

describe("coerceCanonicalInventoryItem weight validation", () => {
  it("accepts a finite Prisma.Decimal weightValue", () => {
    const item = coerceCanonicalInventoryItem({
      shopifyGid: "gid://shopify/InventoryItem/1",
      shopifyVariantGid: "gid://shopify/ProductVariant/1",
      weightValue: new Prisma.Decimal("1.250000"),
      weightUnit: "GRAMS",
      existenceState: "LIVE",
    });
    expect(item.weightValue?.equals(new Prisma.Decimal("1.250000"))).toBe(true);
  });

  it("accepts a null weightValue", () => {
    const item = coerceCanonicalInventoryItem({
      shopifyGid: "gid://shopify/InventoryItem/1",
      weightValue: null,
      existenceState: "LIVE",
    });
    expect(item.weightValue).toBeNull();
  });

  it("rejects a string weight before any legacy write", () => {
    expect(() =>
      coerceCanonicalInventoryItem({
        shopifyGid: "gid://shopify/InventoryItem/1",
        weightValue: "1.25",
        existenceState: "LIVE",
      }),
    ).toThrow(CompatibilityProjectionError);
    try {
      coerceCanonicalInventoryItem({
        shopifyGid: "gid://shopify/InventoryItem/1",
        weightValue: "NaN",
        existenceState: "LIVE",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CompatibilityProjectionError);
      const typed = error as CompatibilityProjectionError;
      expect(typed.code).toBe("invalid_canonical_inventory_item");
      expect(typed.retryable).toBe(false);
    }
  });

  it("rejects a number weight and a non-finite Decimal", () => {
    expect(() =>
      coerceCanonicalInventoryItem({
        shopifyGid: "gid://shopify/InventoryItem/1",
        weightValue: 1.25,
        existenceState: "LIVE",
      }),
    ).toThrow(CompatibilityProjectionError);
    expect(() =>
      coerceCanonicalInventoryItem({
        shopifyGid: "gid://shopify/InventoryItem/1",
        weightValue: new Prisma.Decimal("NaN"),
        existenceState: "LIVE",
      }),
    ).toThrow(CompatibilityProjectionError);
  });
});

describe("coerceCanonicalVariant inventoryItems shape", () => {
  const now = new Date("2026-08-17T15:30:00.000Z");
  const validVariant = {
    shopifyGid: "gid://shopify/ProductVariant/1",
    shopifyProductGid: "gid://shopify/Product/1",
    title: "Blue",
    sku: "SKU-1",
    barcode: "012345",
    existenceState: "LIVE",
    product: {
      shopifyGid: "gid://shopify/Product/1",
      title: "Widget",
      featuredMediaUrl: "https://cdn.example/widget.jpg",
      existenceState: "LIVE",
    },
    inventoryItems: [
      {
        shopifyGid: "gid://shopify/InventoryItem/1",
        shopifyVariantGid: "gid://shopify/ProductVariant/1",
        weightValue: new Prisma.Decimal("1.250000"),
        weightUnit: "GRAMS",
        existenceState: "LIVE",
      },
    ],
  };

  function expectMalformedInventoryItems(inventoryItems: unknown) {
    const writes: unknown[] = [];
    try {
      const variant = coerceCanonicalVariant({
        ...validVariant,
        inventoryItems,
      });
      writes.push(mapVariantToLegacyCache(variant, now));
    } catch (error) {
      expect(error).toBeInstanceOf(CompatibilityProjectionError);
      const typed = error as CompatibilityProjectionError;
      expect(typed.code).toBe("invalid_canonical_variant");
      expect(typed.retryable).toBe(false);
      expect(typed.identity).toEqual({
        kind: "ProductVariant",
        shopifyGid: "gid://shopify/ProductVariant/1",
      });
    }
    expect(writes).toEqual([]);
  }

  it("accepts a Prisma-include array, including an empty array", () => {
    const withItems = coerceCanonicalVariant(validVariant);
    expect(withItems.inventoryItems).toHaveLength(1);
    const empty = coerceCanonicalVariant({
      ...validVariant,
      inventoryItems: [],
    });
    expect(empty.inventoryItems).toEqual([]);
  });

  it("fails closed on a non-array inventoryItems shape and does not produce a legacy write", () => {
    expectMalformedInventoryItems(undefined);
    expectMalformedInventoryItems(null);
    expectMalformedInventoryItems("gid://shopify/InventoryItem/1");
    expectMalformedInventoryItems({ shopifyGid: "gid://shopify/InventoryItem/1" });
    expectMalformedInventoryItems(1);
  });
});
