import { describe, expect, it } from "vitest";
import { mapJsonlLineToCanonical } from "./mappers";
import type { ParsedJsonlLine } from "./types";

const base = {
  shopId: "shop-a",
  fenceGeneration: 10n,
  epochId: "run-1",
  syncRunId: "run-1",
  durableJobId: "job-1",
  ingestBatchId: "batch-1",
  observedAt: new Date("2026-09-05T00:00:00Z"),
  currencyCode: "USD",
  unitCostAccess: "OMITTED_NO_PERMISSION" as const,
  unitCostSelected: false,
};

function line(
  resourceKind: ParsedJsonlLine["resourceKind"],
  value: Record<string, unknown>,
): ParsedJsonlLine {
  return { ordinal: 1, resourceKind, root: resourceKind === "Product", value };
}

const product = {
  id: "gid://shopify/Product/1",
  legacyResourceId: "1",
  title: "Widget",
  handle: "widget",
  vendor: "Vendor",
  productType: "Type",
  tags: ["a"],
  status: "ACTIVE",
  featuredMedia: { preview: { image: { url: "https://example.test/p.png" } } },
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-02T00:00:00Z",
};

const variant = {
  id: "gid://shopify/ProductVariant/2",
  legacyResourceId: "2",
  __parentId: "gid://shopify/Product/1",
  title: "Blue",
  displayName: "Widget - Blue",
  sku: "SKU",
  barcode: null,
  position: 1,
  price: "19.99",
  compareAtPrice: "20.01",
  selectedOptions: [{ name: "Color", value: "Blue" }],
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-02T00:00:00Z",
  inventoryItem: {
    id: "gid://shopify/InventoryItem/3",
    sku: "SKU",
    tracked: true,
    requiresShipping: true,
    measurement: { weight: { value: 0.1, unit: "KILOGRAMS" } },
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-02T00:00:00Z",
  },
};

const quantities = [
  "available",
  "on_hand",
  "incoming",
  "committed",
  "reserved",
  "damaged",
  "safety_stock",
  "quality_control",
].map((name, index) => ({
  name,
  quantity: index,
  updatedAt: index === 0 ? "2026-09-02T00:00:00Z" : null,
}));

describe("F3 JSONL canonical mappers", () => {
  it("FX-JSONL-001 maps a complete Product as catalog-owned presence", () => {
    const mapped = mapJsonlLineToCanonical({
      ...base,
      domain: "catalog",
      line: line("Product", product),
    });
    expect(mapped.observations).toHaveLength(1);
    expect(mapped.observations[0]).toMatchObject({
      observationKind: "full_sync",
      existenceKind: "LIVE_FULL_SYNC_PRESENT",
      identity: { resourceKind: "Product", shopifyGid: product.id },
      attributes: { title: "Widget", vendor: "Vendor" },
    });
  });

  it("FX-MONEY maps a variant and its nested InventoryItem without float money conversion", () => {
    const mapped = mapJsonlLineToCanonical({
      ...base,
      domain: "catalog",
      line: line("ProductVariant", variant),
    });
    expect(mapped.observations).toHaveLength(2);
    expect(mapped.observations[0]).toMatchObject({
      identity: { resourceKind: "ProductVariant" },
      attributes: { priceAmount: "19.99", compareAtPriceAmount: "20.01" },
    });
    expect(mapped.observations[1]).toMatchObject({
      identity: { resourceKind: "InventoryItem" },
      attributes: {
        shopifyVariantGid: variant.id,
        weightValue: "0.1",
        unitCostAccess: "OMITTED_NO_PERMISSION",
      },
    });
  });

  it("maps selected unit cost as exact text", () => {
    const withCost = {
      ...variant,
      inventoryItem: {
        ...variant.inventoryItem,
        unitCost: { amount: "0.123456", currencyCode: "USD" },
      },
    };
    const mapped = mapJsonlLineToCanonical({
      ...base,
      unitCostSelected: true,
      unitCostAccess: "PRESENT",
      domain: "catalog",
      line: line("ProductVariant", withCost),
    });
    expect(mapped.observations[1]?.attributes).toMatchObject({
      unitCostAmount: "0.123456",
      unitCostCurrencyCode: "USD",
      unitCostAccess: "PRESENT",
    });
  });

  it("keeps Collection as membership lineage, not canonical identity", () => {
    const mapped = mapJsonlLineToCanonical({
      ...base,
      domain: "catalog",
      line: line("Collection", {
        id: "gid://shopify/Collection/8",
        __parentId: product.id,
        title: "Summer",
      }),
    });
    expect(mapped.observations).toEqual([]);
    expect(mapped.collectionMembership).toEqual({
      productGid: product.id,
      collectionGid: "gid://shopify/Collection/8",
      title: "Summer",
    });
  });

  it("FX-JSONL-002 does not emit InventoryItem presence from inventory-level parent lines", () => {
    const mapped = mapJsonlLineToCanonical({
      ...base,
      domain: "inventory_levels",
      line: line("InventoryItem", {
        id: "gid://shopify/InventoryItem/3",
      }),
    });
    expect(mapped.observations).toEqual([]);
  });

  it("FX-JSONL-002 maps all eight inventory quantities onto pair identity", () => {
    const mapped = mapJsonlLineToCanonical({
      ...base,
      domain: "inventory_levels",
      line: line("InventoryLevel", {
        id: "gid://shopify/InventoryLevel/4",
        item: { id: "gid://shopify/InventoryItem/3" },
        location: { id: "gid://shopify/Location/5" },
        isActive: true,
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-02T00:00:00Z",
        quantities,
      }),
    });
    expect(mapped.observations[0]).toMatchObject({
      identity: {
        resourceKind: "InventoryLevel",
        inventoryItemGid: "gid://shopify/InventoryItem/3",
        locationGid: "gid://shopify/Location/5",
      },
      attributes: { isActive: true },
    });
    expect(
      (mapped.observations[0]?.attributes as { quantities: unknown[] })
        .quantities,
    ).toHaveLength(8);
  });

  it("FX-JSONL-003 fails closed rather than using __parentId as pair identity", () => {
    expect(() =>
      mapJsonlLineToCanonical({
        ...base,
        domain: "inventory_levels",
        line: line("InventoryLevel", {
          id: "gid://shopify/InventoryLevel/4",
          __parentId: "gid://shopify/InventoryItem/3",
          quantities,
        }),
      }),
    ).toThrow();
  });

  it("fails an incomplete eight-name quantity vector", () => {
    expect(() =>
      mapJsonlLineToCanonical({
        ...base,
        domain: "inventory_levels",
        line: line("InventoryLevel", {
          id: "gid://shopify/InventoryLevel/4",
          item: { id: "gid://shopify/InventoryItem/3" },
          location: { id: "gid://shopify/Location/5" },
          quantities: quantities.slice(0, 7),
        }),
      }),
    ).toThrow("inventory_level_quantity_vector_incomplete");
  });

  it("rejects a non-owned resource kind for each domain", () => {
    expect(() =>
      mapJsonlLineToCanonical({
        ...base,
        domain: "inventory_levels",
        line: line("Product", product),
      }),
    ).toThrow("inventory_levels_jsonl_kind_not_owned");
  });
});
