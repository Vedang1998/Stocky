/**
 * Buying Table draft purchase orders use the quantities the merchant entered.
 * Supplier minimum order and pack size apply only when ticked on the form.
 * The order itself is created by the purchasing service, which prices it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

const { db, createPurchaseOrderDraft } = vi.hoisted(() => ({
  db: {
    authority: {
      shopId: "shop-buying-table",
      myshopifyDomain: "buying-table.myshopify.com",
    },
    shopSettings: { findUnique: vi.fn() },
    supplier: { findFirst: vi.fn() },
    supplierSkuMapping: { findFirst: vi.fn() },
    purchaseOrder: { create: vi.fn() },
  },
  createPurchaseOrderDraft: vi.fn(),
}));

vi.mock("../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => ({
    tenant: { myshopifyDomain: "buying-table.myshopify.com" },
    db,
  })),
}));
vi.mock("./purchasing/purchase-orders.server", async (original) => ({
  ...(await original<typeof import("./purchasing/purchase-orders.server")>()),
  createPurchaseOrderDraft,
}));
vi.mock("./purchasing/shop-profile.server", () => ({
  readShopProfile: vi.fn(async () => ({ today: "2026-11-20" })),
}));
vi.mock("./shopify-gql.server", () => ({
  fetchInventoryLevels: vi.fn(),
  // The order action only writes to a location Shopify lists for the shop.
  fetchLocations: vi.fn(async () => [
    { id: "gid://shopify/Location/1", name: "Warehouse" },
  ]),
}));
vi.mock("./forecasting.server", () => ({ computeForecast: vi.fn() }));

const MAPPINGS: Record<string, { moq: number; packSize: number }> = {
  "map-a": { moq: 12, packSize: 6 },
  "map-b": { moq: 1, packSize: 10 },
};

async function createDraft(fields: Record<string, string>) {
  const { action } = await import("../routes/app.buying-table");
  const body = new URLSearchParams({
    intent: "createPO",
    supplierId: "supplier-1",
    locationId: "gid://shopify/Location/1",
    ...fields,
  });
  await action({
    request: new Request("https://app.example/app/buying-table", {
      method: "POST",
      body,
    }),
    params: {},
    context: {},
  } as unknown as ActionFunctionArgs);
  const input = createPurchaseOrderDraft.mock.calls.at(-1)?.[2];
  return (input?.lines ?? []) as Array<{ variantGid: string; quantity: number }>;
}

describe("Buying Table draft purchase order quantities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.shopSettings.findUnique.mockResolvedValue({ subscriptionActive: true });
    db.supplier.findFirst.mockResolvedValue({ id: "supplier-1" });
    db.supplierSkuMapping.findFirst.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        const mapping = MAPPINGS[where.id];
        return mapping
          ? {
              id: where.id,
              shopifyVariantId: `variant-${where.id}`,
              vendorSku: `sku-${where.id}`,
              ...mapping,
            }
          : null;
      },
    );
    createPurchaseOrderDraft.mockResolvedValue({ id: "po-1", poNumber: "PO-1", created: true });
  });

  it("orders exactly what was entered when no supplier rule is ticked", async () => {
    const lines = await createDraft({ "qty-map-a": "5", "qty-map-b": "7" });
    expect(lines).toEqual([
      { variantGid: "variant-map-a", quantity: 5 },
      { variantGid: "variant-map-b", quantity: 7 },
    ]);
    // Never written directly: the purchasing service creates the order.
    expect(db.purchaseOrder.create).not.toHaveBeenCalled();
  });

  it("raises to the supplier minimum only when that rule is ticked", async () => {
    const lines = await createDraft({
      "qty-map-a": "5",
      "qty-map-b": "7",
      applyMinimumOrderQuantity: "on",
    });
    expect(lines.map((line) => line.quantity)).toEqual([12, 7]);
  });

  it("rounds up to full packs only when that rule is ticked", async () => {
    const lines = await createDraft({
      "qty-map-a": "5",
      "qty-map-b": "7",
      roundUpToPackSize: "on",
    });
    expect(lines.map((line) => line.quantity)).toEqual([6, 10]);
  });

  it("applies the minimum first and then packs when both are ticked", async () => {
    const lines = await createDraft({
      "qty-map-a": "13",
      "qty-map-b": "7",
      applyMinimumOrderQuantity: "on",
      roundUpToPackSize: "on",
    });
    expect(lines.map((line) => line.quantity)).toEqual([18, 10]);
  });

  it("skips blank and zero quantities whatever is ticked", async () => {
    const lines = await createDraft({
      "qty-map-a": "0",
      "qty-map-b": "",
      applyMinimumOrderQuantity: "on",
      roundUpToPackSize: "on",
    });
    expect(lines).toEqual([]);
    expect(createPurchaseOrderDraft).not.toHaveBeenCalled();
  });
});
