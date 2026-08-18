import { describe, expect, it } from "vitest";
import { APPROVED_INVENTORY_QUANTITY_NAMES } from "./types";
import { mapInventoryQuantities } from "./quantities";
import { readInventoryLevelByPair } from "./resources";
import { CATALOG_FACT_INVENTORY_LEVEL_BY_PAIR_QUERY } from "./documents";
import { createMockAdmin } from "./__tests__/mock-admin";

const EIGHT_QUANTITIES = APPROVED_INVENTORY_QUANTITY_NAMES.map((name, index) => ({
  name,
  quantity: index + 1,
  updatedAt: name === "available" ? "2026-08-01T00:00:00Z" : null,
}));

describe("PR5-F2A inventory quantities", () => {
  it("maps all eight approved names and preserves nullable updatedAt", () => {
    const mapped = mapInventoryQuantities(EIGHT_QUANTITIES);
    expect(mapped.missingApprovedNames).toEqual([]);
    expect(mapped.unexpectedNames).toEqual([]);
    expect(mapped.malformedQuantityNames).toEqual([]);
    for (const name of APPROVED_INVENTORY_QUANTITY_NAMES) {
      expect(mapped.byName[name]?.name).toBe(name);
      expect(mapped.byName[name]?.quantity).toBeGreaterThan(0);
    }
    expect(mapped.byName.available?.updatedAt).toBe("2026-08-01T00:00:00Z");
    expect(mapped.byName.on_hand?.updatedAt).toBeNull();
    expect(mapped.byName.incoming?.updatedAt).toBeNull();
    expect(mapped.byName.committed?.updatedAt).toBeNull();
    expect(mapped.byName.reserved?.updatedAt).toBeNull();
    expect(mapped.byName.damaged?.updatedAt).toBeNull();
    expect(mapped.byName.safety_stock?.updatedAt).toBeNull();
    expect(mapped.byName.quality_control?.updatedAt).toBeNull();
  });

  it("does not drop approved names when Shopify also returns an unknown name", () => {
    const mapped = mapInventoryQuantities([
      ...EIGHT_QUANTITIES,
      { name: "future_state", quantity: 9, updatedAt: null },
    ]);
    expect(mapped.missingApprovedNames).toEqual([]);
    expect(mapped.unexpectedNames).toEqual(["future_state"]);
    expect(mapped.malformedQuantityNames).toEqual([]);
    expect(mapped.byName.available?.quantity).toBe(1);
  });

  it("records missing approved names instead of silently substituting available", () => {
    const mapped = mapInventoryQuantities([
      { name: "available", quantity: 4, updatedAt: null },
    ]);
    expect(mapped.byName.available?.quantity).toBe(4);
    expect(mapped.missingApprovedNames).toContain("on_hand");
    expect(mapped.missingApprovedNames).toContain("incoming");
    expect(mapped.byName.on_hand).toBeUndefined();
    expect(mapped.malformedQuantityNames).toEqual([]);
  });

  it("records an unexpected name even when its quantity is malformed", () => {
    const mapped = mapInventoryQuantities([
      { name: "rogue_name", quantity: "12", updatedAt: null },
    ]);
    expect(mapped.unexpectedNames).toEqual(["rogue_name"]);
    expect(mapped.malformedQuantityNames).toEqual(["rogue_name"]);
    expect(mapped.byName.available).toBeUndefined();
  });

  it("distinguishes a malformed approved quantity from a genuinely absent name", () => {
    const mapped = mapInventoryQuantities([
      { name: "available", quantity: 5.5, updatedAt: null },
    ]);
    expect(mapped.malformedQuantityNames).toEqual(["available"]);
    expect(mapped.byName.available).toBeUndefined();
    expect(mapped.missingApprovedNames).not.toContain("available");
    expect(mapped.missingApprovedNames).toContain("on_hand");
  });

  it("keeps eight valid names unchanged when a malformed unexpected name is also present", () => {
    const mapped = mapInventoryQuantities([
      ...EIGHT_QUANTITIES,
      { name: "rogue_name", quantity: "12", updatedAt: null },
    ]);
    expect(mapped.missingApprovedNames).toEqual([]);
    expect(mapped.unexpectedNames).toEqual(["rogue_name"]);
    expect(mapped.malformedQuantityNames).toEqual(["rogue_name"]);
    for (const name of APPROVED_INVENTORY_QUANTITY_NAMES) {
      expect(mapped.byName[name]?.quantity).toBeGreaterThan(0);
    }
  });

  it("queries all eight names on the inventory-level pair helper", async () => {
    const admin = createMockAdmin((_query, variables) => {
      expect(variables?.quantityNames).toEqual([...APPROVED_INVENTORY_QUANTITY_NAMES]);
      return {
        data: {
          inventoryItem: {
            id: "gid://shopify/InventoryItem/1",
            inventoryLevel: {
              id: "gid://shopify/InventoryLevel/9?inventory_item_id=1",
              isActive: true,
              createdAt: "2026-01-01T00:00:00Z",
              updatedAt: "2026-01-02T00:00:00Z",
              location: { id: "gid://shopify/Location/2" },
              item: { id: "gid://shopify/InventoryItem/1" },
              quantities: EIGHT_QUANTITIES,
            },
          },
        },
      };
    });

    const level = await readInventoryLevelByPair(admin, {
      inventoryItemGid: "gid://shopify/InventoryItem/1",
      locationGid: "gid://shopify/Location/2",
    });
    expect(level?.identity).toEqual({
      inventoryItemGid: "gid://shopify/InventoryItem/1",
      locationGid: "gid://shopify/Location/2",
    });
    expect(level?.quantities.missingApprovedNames).toEqual([]);
    expect(level?.quantities.byName.on_hand?.quantity).toBe(2);
    expect(level?.quantities.byName.available?.updatedAt).toBe(
      "2026-08-01T00:00:00Z",
    );
    expect(admin.calls[0]?.query).toBe(CATALOG_FACT_INVENTORY_LEVEL_BY_PAIR_QUERY);
  });
});
