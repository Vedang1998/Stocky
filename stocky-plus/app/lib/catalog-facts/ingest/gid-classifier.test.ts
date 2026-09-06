import { describe, expect, it } from "vitest";
import { classifyJsonlGid, UnknownJsonlIdentityError } from "./gid-classifier";

describe("F3 JSONL GID classifier", () => {
  it.each([
    ["gid://shopify/Product/1", "Product"],
    ["gid://shopify/ProductVariant/1", "ProductVariant"],
    ["gid://shopify/InventoryItem/1", "InventoryItem"],
    ["gid://shopify/Location/1", "Location"],
    ["gid://shopify/InventoryLevel/1", "InventoryLevel"],
    ["gid://shopify/Collection/1", "Collection"],
  ] as const)("classifies %s as %s", (gid, resourceKind) => {
    expect(classifyJsonlGid(gid, "catalog").resourceKind).toBe(resourceKind);
  });

  it("counts Product as the catalog root only", () => {
    expect(classifyJsonlGid("gid://shopify/Product/1", "catalog").root).toBe(
      true,
    );
    expect(
      classifyJsonlGid("gid://shopify/InventoryItem/1", "catalog").root,
    ).toBe(false);
  });

  it("counts InventoryItem as the inventory-level root only", () => {
    expect(
      classifyJsonlGid("gid://shopify/InventoryItem/1", "inventory_levels")
        .root,
    ).toBe(true);
    expect(
      classifyJsonlGid("gid://shopify/InventoryLevel/1", "inventory_levels")
        .root,
    ).toBe(false);
  });

  it.each([
    undefined,
    null,
    "",
    123,
    "gid://shopify/Unknown/1",
    "gid://shopify/ProductVariantish/1",
  ])("fails closed instead of guessing %s", (id) => {
    expect(() => classifyJsonlGid(id, "catalog")).toThrow(
      UnknownJsonlIdentityError,
    );
  });
});
