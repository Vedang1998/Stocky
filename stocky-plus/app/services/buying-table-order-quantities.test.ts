/**
 * Buying Table draft purchase orders use the quantities the merchant entered.
 * Supplier minimum order and pack size apply only when ticked on the form.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

const { db, resolveTieredUnitCost } = vi.hoisted(() => ({
  db: {
    supplier: { findFirst: vi.fn() },
    supplierSkuMapping: { findFirst: vi.fn() },
    purchaseOrder: { create: vi.fn() },
  },
  resolveTieredUnitCost: vi.fn(),
}));

vi.mock("../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => ({
    tenant: { myshopifyDomain: "buying-table.myshopify.com" },
    db,
  })),
}));
vi.mock("./landed-cost.server", () => ({ resolveTieredUnitCost }));
vi.mock("./shopify-gql.server", () => ({
  fetchInventoryLevels: vi.fn(),
  fetchLocations: vi.fn(),
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
  const call = db.purchaseOrder.create.mock.calls.at(-1)?.[0];
  return (call?.data.lineItems.create ?? []) as Array<{
    shopifyVariantId: string;
    orderedQty: number;
  }>;
}

describe("Buying Table draft purchase order quantities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    db.purchaseOrder.create.mockResolvedValue({ id: "po-1" });
    resolveTieredUnitCost.mockResolvedValue(null);
  });

  it("orders exactly what was entered when no supplier rule is ticked", async () => {
    const lines = await createDraft({ "qty-map-a": "5", "qty-map-b": "7" });
    expect(lines.map((line) => line.orderedQty)).toEqual([5, 7]);
    expect(resolveTieredUnitCost).toHaveBeenCalledWith(
      db,
      "supplier-1",
      "variant-map-a",
      5,
    );
  });

  it("raises to the supplier minimum only when that rule is ticked", async () => {
    const lines = await createDraft({
      "qty-map-a": "5",
      "qty-map-b": "7",
      applyMinimumOrderQuantity: "on",
    });
    expect(lines.map((line) => line.orderedQty)).toEqual([12, 7]);
  });

  it("rounds up to full packs only when that rule is ticked", async () => {
    const lines = await createDraft({
      "qty-map-a": "5",
      "qty-map-b": "7",
      roundUpToPackSize: "on",
    });
    expect(lines.map((line) => line.orderedQty)).toEqual([6, 10]);
  });

  it("applies the minimum first and then packs when both are ticked", async () => {
    const lines = await createDraft({
      "qty-map-a": "13",
      "qty-map-b": "7",
      applyMinimumOrderQuantity: "on",
      roundUpToPackSize: "on",
    });
    expect(lines.map((line) => line.orderedQty)).toEqual([18, 10]);
  });

  it("skips blank and zero quantities whatever is ticked", async () => {
    const lines = await createDraft({
      "qty-map-a": "0",
      "qty-map-b": "",
      applyMinimumOrderQuantity: "on",
      roundUpToPackSize: "on",
    });
    expect(lines).toEqual([]);
    expect(db.purchaseOrder.create).not.toHaveBeenCalled();
  });
});
