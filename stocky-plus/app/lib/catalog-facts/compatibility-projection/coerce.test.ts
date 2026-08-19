import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { CompatibilityProjectionError } from "./errors";
import { coerceCanonicalInventoryItem } from "./project";

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
