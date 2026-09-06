import { describe, expect, it } from "vitest";
import { normalizeRebuildCursor } from "./cursor";
import { CompatibilityProjectionError } from "./errors";

function expectInvalidCursor(cursor: unknown) {
  expect(() => normalizeRebuildCursor(cursor)).toThrow(
    CompatibilityProjectionError,
  );
  try {
    normalizeRebuildCursor(cursor);
  } catch (error) {
    expect(error).toBeInstanceOf(CompatibilityProjectionError);
    const typed = error as CompatibilityProjectionError;
    expect(typed.code).toBe("invalid_rebuild_cursor");
    expect(typed.retryable).toBe(false);
  }
}

describe("normalizeRebuildCursor", () => {
  it("treats a null cursor as the variants phase start", () => {
    expect(normalizeRebuildCursor(null)).toEqual({ phase: "variants" });
  });

  it("accepts a variants cursor with afterGid absent or a non-empty string", () => {
    expect(normalizeRebuildCursor({ phase: "variants" })).toEqual({
      phase: "variants",
    });
    expect(
      normalizeRebuildCursor({
        phase: "variants",
        afterGid: "gid://shopify/ProductVariant/1",
      }),
    ).toEqual({
      phase: "variants",
      afterGid: "gid://shopify/ProductVariant/1",
    });
  });

  it("accepts an inventory_levels cursor only when both keyset fields are absent or both are non-empty strings", () => {
    expect(normalizeRebuildCursor({ phase: "inventory_levels" })).toEqual({
      phase: "inventory_levels",
    });
    expect(
      normalizeRebuildCursor({
        phase: "inventory_levels",
        afterItemGid: "gid://shopify/InventoryItem/1",
        afterLocationGid: "gid://shopify/Location/1",
      }),
    ).toEqual({
      phase: "inventory_levels",
      afterItemGid: "gid://shopify/InventoryItem/1",
      afterLocationGid: "gid://shopify/Location/1",
    });
  });

  it("rejects a variants afterGid that is not a non-empty string", () => {
    expectInvalidCursor({ phase: "variants", afterGid: 123 });
    expectInvalidCursor({ phase: "variants", afterGid: "" });
    expectInvalidCursor({ phase: "variants", afterGid: {} });
    expectInvalidCursor({ phase: "variants", afterGid: [] });
  });

  it("rejects a partial inventory_levels composite cursor", () => {
    expectInvalidCursor({
      phase: "inventory_levels",
      afterItemGid: "gid://shopify/InventoryItem/1",
    });
    expectInvalidCursor({
      phase: "inventory_levels",
      afterLocationGid: "gid://shopify/Location/1",
    });
    expectInvalidCursor({
      phase: "inventory_levels",
      afterItemGid: "gid://shopify/InventoryItem/1",
      afterLocationGid: "",
    });
  });

  it("rejects number/object/array coercion on inventory_levels fields", () => {
    expectInvalidCursor({
      phase: "inventory_levels",
      afterItemGid: 1,
      afterLocationGid: 2,
    });
    expectInvalidCursor({
      phase: "inventory_levels",
      afterItemGid: { gid: "x" },
      afterLocationGid: "gid://shopify/Location/1",
    });
  });

  it("rejects an unknown phase", () => {
    expectInvalidCursor({ phase: "rebuild" });
    expectInvalidCursor({ phase: "Variants" });
  });
});
