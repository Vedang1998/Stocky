import { describe, expect, it } from "vitest";
import {
  readInventoryItem,
  readProduct,
  readProductVariant,
  readShopCurrencyCode,
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
  });

  it("reads shop currencyCode for Money scalar provenance", async () => {
    const admin = createMockAdmin(() => ({
      data: { shop: { currencyCode: "USD" } },
    }));
    await expect(readShopCurrencyCode(admin)).resolves.toBe("USD");
  });
});
