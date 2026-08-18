import { describe, expect, it } from "vitest";
import {
  mapInventoryItemNode,
  mapInventoryLevelNode,
  readInventoryItem,
  readInventoryLevelByPair,
  readProduct,
  readProductVariant,
  readShopCurrencyCode,
  InventoryLevelIdentityMismatchError,
} from "./resources";
import { createMockAdmin } from "./__tests__/mock-admin";

describe("PR5-F2A direct resource readers", () => {
  it("reads a product without using deprecated Product.images", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        product: {
          id: "gid://shopify/Product/1",
          legacyResourceId: "1",
          title: "Trail Bottle",
          handle: "trail-bottle",
          vendor: "Example",
          productType: "Bottle",
          tags: ["outdoor"],
          status: "ACTIVE",
          featuredMedia: {
            preview: { image: { url: "https://cdn.example/bottle.jpg" } },
          },
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        },
      },
    }));
    const product = await readProduct(admin, "gid://shopify/Product/1");
    expect(product?.featuredMediaUrl).toBe("https://cdn.example/bottle.jpg");
    expect(admin.calls[0]?.query).toContain("featuredMedia");
    expect(admin.calls[0]?.query).not.toContain("images(");
  });

  it("preserves variant money as exact strings", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        productVariant: {
          id: "gid://shopify/ProductVariant/2",
          legacyResourceId: "2",
          title: "Default",
          displayName: "Trail Bottle - Default",
          sku: "TB-1",
          barcode: null,
          position: 1,
          price: "19.99",
          compareAtPrice: "0.1",
          selectedOptions: [{ name: "Title", value: "Default" }],
          product: { id: "gid://shopify/Product/1" },
          inventoryItem: { id: "gid://shopify/InventoryItem/3" },
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        },
      },
    }));
    const variant = await readProductVariant(
      admin,
      "gid://shopify/ProductVariant/2",
    );
    expect(variant?.priceAmount).toBe("19.99");
    expect(variant?.compareAtPriceAmount).toBe("0.1");
    expect(typeof variant?.priceAmount).toBe("string");
  });

  it("omits unitCost unless explicitly selected", async () => {
    const admin = createMockAdmin((_query, variables) => {
      expect(variables?.includeUnitCost).toBe(false);
      return {
        data: {
          inventoryItem: {
            id: "gid://shopify/InventoryItem/3",
            legacyResourceId: "3",
            sku: "TB-1",
            tracked: true,
            requiresShipping: true,
            measurement: { weight: { value: 1.25, unit: "POUNDS" } },
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-02T00:00:00Z",
            variants: { nodes: [{ id: "gid://shopify/ProductVariant/2" }] },
          },
        },
      };
    });
    const item = await readInventoryItem(admin, "gid://shopify/InventoryItem/3");
    expect(item?.unitCostSelected).toBe(false);
    expect(item?.unitCostAmount).toBeNull();
    expect(item?.weightUnit).toBe("POUNDS");
    expect(item?.weightValue).toBe(1.25);
  });

  it("rejects a non-finite inventory item weight instead of coercing to NaN", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        inventoryItem: {
          id: "gid://shopify/InventoryItem/3",
          legacyResourceId: "3",
          sku: "TB-1",
          tracked: true,
          requiresShipping: true,
          measurement: { weight: { value: "not-a-number", unit: "KILOGRAMS" } },
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
          variants: { nodes: [{ id: "gid://shopify/ProductVariant/2" }] },
        },
      },
    }));
    await expect(
      readInventoryItem(admin, "gid://shopify/InventoryItem/3"),
    ).rejects.toThrow(/weight.value must be a finite number/);
  });

  it("reads shop currencyCode for Money scalar provenance", async () => {
    const admin = createMockAdmin(() => ({
      data: { shop: { currencyCode: "USD" } },
    }));
    await expect(readShopCurrencyCode(admin)).resolves.toBe("USD");
  });

  it("rejects a string isActive instead of coercing it with Boolean()", () => {
    expect(() =>
      mapInventoryLevelNode({
        id: "gid://shopify/InventoryLevel/9",
        isActive: "false",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        location: { id: "gid://shopify/Location/2" },
        item: { id: "gid://shopify/InventoryItem/1" },
        quantities: [],
      }),
    ).toThrow(/inventoryLevel.isActive must be a boolean/);
  });

  it("rejects NaN weight values", () => {
    expect(() =>
      mapInventoryItemNode(
        {
          id: "gid://shopify/InventoryItem/3",
          legacyResourceId: "3",
          sku: "TB-1",
          tracked: true,
          requiresShipping: true,
          measurement: { weight: { value: Number.NaN, unit: "KILOGRAMS" } },
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        },
        false,
      ),
    ).toThrow(/weight.value must be a finite number/);
  });

  it("preserves unsigned legacyResourceId strings beyond JS safe integer", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        product: {
          id: "gid://shopify/Product/1",
          legacyResourceId: "9007199254740993",
          title: "Trail Bottle",
          handle: "trail-bottle",
          vendor: "Example",
          productType: "Bottle",
          tags: [],
          status: "ACTIVE",
          featuredMedia: null,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        },
      },
    }));
    const product = await readProduct(admin, "gid://shopify/Product/1");
    expect(product?.legacyResourceId).toBe("9007199254740993");
    expect(String(Number("9007199254740993"))).not.toBe("9007199254740993");
  });
});

describe("PR5-F2A inventory-level pair identity", () => {
  const requested = {
    inventoryItemGid: "gid://shopify/InventoryItem/1",
    locationGid: "gid://shopify/Location/2",
  };

  function pairResponse(itemId: string | null, locationId: string | null) {
    return createMockAdmin(() => ({
      data: {
        inventoryItem: {
          id: requested.inventoryItemGid,
          inventoryLevel: {
            id: "gid://shopify/InventoryLevel/9",
            isActive: true,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-02T00:00:00Z",
            location: locationId ? { id: locationId } : null,
            item: itemId ? { id: itemId } : null,
            quantities: [],
          },
        },
      },
    }));
  }

  it("accepts an exact requested pair match", async () => {
    const admin = pairResponse(
      requested.inventoryItemGid,
      requested.locationGid,
    );
    const level = await readInventoryLevelByPair(admin, requested);
    expect(level?.identity).toEqual(requested);
  });

  it("fails closed when the response item identity differs", async () => {
    const admin = pairResponse(
      "gid://shopify/InventoryItem/888",
      requested.locationGid,
    );
    await expect(readInventoryLevelByPair(admin, requested)).rejects.toBeInstanceOf(
      InventoryLevelIdentityMismatchError,
    );
  });

  it("fails closed when the response location identity differs", async () => {
    const admin = pairResponse(
      requested.inventoryItemGid,
      "gid://shopify/Location/999",
    );
    await expect(readInventoryLevelByPair(admin, requested)).rejects.toThrow(
      /location identity/,
    );
  });

  it("fails closed when both identities differ", async () => {
    const admin = pairResponse(
      "gid://shopify/InventoryItem/888",
      "gid://shopify/Location/999",
    );
    await expect(readInventoryLevelByPair(admin, requested)).rejects.toBeInstanceOf(
      InventoryLevelIdentityMismatchError,
    );
  });

  it("permits fallback identity when the response omits item and location ids", async () => {
    const admin = pairResponse(null, null);
    const level = await readInventoryLevelByPair(admin, requested);
    expect(level?.identity).toEqual(requested);
  });
});
