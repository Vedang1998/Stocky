/**
 * Cross-shop denial characterization — Shop B must not mutate Shop A records.
 *
 * Authenticated shop is always session.shop from authenticate.admin (server-side).
 * Inventory-write flags remain default OFF; no Shopify GraphQL mutations occur.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

const SHOP_A = "shop-a.myshopify.com";
const SHOP_B = "shop-b.myshopify.com";

const {
  prismaMock,
  authenticateAdmin,
  adjustShopifyInventory,
  createShopifyTransfer,
  completeShopifyTransfer,
  applyLandedCostsToPO,
  receivePartialPO,
  recalculatePOLineCost,
  resolveTieredUnitCost,
  featureFlags,
} = vi.hoisted(() => {
  const prismaMock = {
    purchaseOrder: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    pOLineItem: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    stocktake: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    stocktakeLineItem: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    transferOrder: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    transferLineItem: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    supplier: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    supplierSkuMapping: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    volumePriceTier: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    shopifyVariantCache: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    shopSettings: {
      upsert: vi.fn(),
    },
    forecastOverride: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    inventorySnapshot: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  return {
    prismaMock,
    authenticateAdmin: vi.fn(),
    adjustShopifyInventory: vi.fn(),
    createShopifyTransfer: vi.fn(),
    completeShopifyTransfer: vi.fn(),
    applyLandedCostsToPO: vi.fn(),
    receivePartialPO: vi.fn(),
    recalculatePOLineCost: vi.fn(),
    resolveTieredUnitCost: vi.fn(),
    featureFlags: {
      stocktakeInventoryWrites: vi.fn(() => false),
      adjustmentWrites: vi.fn(() => false),
      receiptWrites: vi.fn(() => false),
      costSync: vi.fn(() => false),
      transferWrites: vi.fn(() => false),
    },
  };
});

vi.mock("../db.server", () => ({ default: prismaMock }));

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: authenticateAdmin,
  },
}));

vi.mock("../services/shopify-gql.server", () => ({
  fetchLocations: vi.fn(async () => []),
  fetchInventoryLevels: vi.fn(async () => 0),
  shopifyGraphQL: vi.fn(),
}));

vi.mock("../services/shopify-sync.server", () => ({
  adjustShopifyInventory,
  createShopifyTransfer,
  markShopifyTransferReadyToShip: vi.fn(),
  completeShopifyTransfer,
}));

vi.mock("../services/landed-cost.server", () => ({
  applyLandedCostsToPO,
  receivePartialPO,
  recalculatePOLineCost,
  recordLeadTimeSnapshot: vi.fn(),
  resolveTieredUnitCost,
}));

vi.mock("../lib/feature-flags.server", async () => {
  const actual = await vi.importActual<
    typeof import("../lib/feature-flags.server")
  >("../lib/feature-flags.server");
  return {
    ...actual,
    featureFlags,
    assertInventoryWriteEnabled: actual.assertInventoryWriteEnabled,
    isInventoryWriteEnabled: actual.isInventoryWriteEnabled,
  };
});

function formRequest(fields: Record<string, string>): Request {
  const body = new URLSearchParams(fields);
  return new Request("https://example.com/app", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

function actionArgs(
  request: Request,
  params: Record<string, string> = {},
): ActionFunctionArgs {
  return {
    request,
    params,
    context: {},
  } as ActionFunctionArgs;
}

function authAsShopB() {
  authenticateAdmin.mockResolvedValue({
    session: { shop: SHOP_B },
    admin: { graphql: vi.fn() },
    redirect: vi.fn(),
  });
}

describe("cross-shop denial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authAsShopB();
    // Ensure inventory-write flags stay OFF for every denial case.
    featureFlags.stocktakeInventoryWrites.mockReturnValue(false);
    featureFlags.adjustmentWrites.mockReturnValue(false);
    featureFlags.receiptWrites.mockReturnValue(false);
    featureFlags.costSync.mockReturnValue(false);
    featureFlags.transferWrites.mockReturnValue(false);
  });

  it("keeps inventory-write feature flags disabled during denial tests", async () => {
    const { featureFlags: flags } = await import("../lib/feature-flags.server");
    expect(flags.stocktakeInventoryWrites()).toBe(false);
    expect(flags.transferWrites()).toBe(false);
    expect(flags.receiptWrites()).toBe(false);
  });

  it("denies Shop B mutating Shop A purchase order / line", async () => {
    const { action } = await import("../routes/app.purchase-orders");
    prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);

    const result = await action(
      actionArgs(
        formRequest({
          intent: "addLine",
          poId: "po-shop-a",
          variantId: "gid://shopify/ProductVariant/1",
          quantity: "2",
        }),
      ),
    );

    expect(authenticateAdmin).toHaveBeenCalled();
    expect(prismaMock.purchaseOrder.findFirst).toHaveBeenCalledWith({
      where: { id: "po-shop-a", shop: SHOP_B },
    });
    expect(result).toEqual({ error: "Purchase order not found" });
    expect(prismaMock.pOLineItem.create).not.toHaveBeenCalled();
    expect(applyLandedCostsToPO).not.toHaveBeenCalled();
    expect(receivePartialPO).not.toHaveBeenCalled();
    expect(recalculatePOLineCost).not.toHaveBeenCalled();
  });

  it("denies Shop B updating Shop A stocktake line and never adjusts inventory", async () => {
    const { action } = await import("../routes/app.stocktakes");
    prismaMock.stocktakeLineItem.findFirst.mockResolvedValue(null);

    const result = await action(
      actionArgs(
        formRequest({
          intent: "count",
          lineId: "stl-shop-a",
          countedQty: "5",
        }),
      ),
    );

    expect(prismaMock.stocktakeLineItem.findFirst).toHaveBeenCalledWith({
      where: { id: "stl-shop-a", stocktake: { shop: SHOP_B } },
    });
    expect(result).toEqual({ error: "Stocktake line not found" });
    expect(prismaMock.stocktakeLineItem.update).not.toHaveBeenCalled();
    expect(adjustShopifyInventory).not.toHaveBeenCalled();
  });

  it("denies Shop B adding a line to Shop A transfer", async () => {
    const { action } = await import("../routes/app.transfers");
    prismaMock.transferOrder.findFirst.mockResolvedValue(null);

    const result = await action(
      actionArgs(
        formRequest({
          intent: "addLine",
          transferId: "tr-shop-a",
          variantId: "gid://shopify/ProductVariant/1",
          quantity: "3",
        }),
      ),
    );

    expect(prismaMock.transferOrder.findFirst).toHaveBeenCalledWith({
      where: { id: "tr-shop-a", shop: SHOP_B },
    });
    expect(result).toEqual({ error: "Transfer not found" });
    expect(prismaMock.transferLineItem.create).not.toHaveBeenCalled();
    expect(createShopifyTransfer).not.toHaveBeenCalled();
    expect(completeShopifyTransfer).not.toHaveBeenCalled();
  });

  it("denies Shop B deleting Shop A supplier mapping via foreign supplier id", async () => {
    const { action } = await import("../routes/app.suppliers_.$id");
    // Shop B cannot load Shop A's supplier by id.
    prismaMock.supplier.findFirst.mockResolvedValue(null);

    await expect(
      action(
        actionArgs(
          formRequest({
            intent: "deleteMapping",
            mappingId: "map-shop-a",
          }),
          { id: "supplier-shop-a" },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });

    expect(prismaMock.supplier.findFirst).toHaveBeenCalledWith({
      where: { id: "supplier-shop-a", shop: SHOP_B },
    });
    expect(prismaMock.supplierSkuMapping.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.volumePriceTier.deleteMany).not.toHaveBeenCalled();
  });

  it("denies Shop B Buying Table createPO against Shop A supplier/mapping", async () => {
    const { action } = await import("../routes/app.buying-table");
    prismaMock.supplier.findFirst.mockResolvedValue(null);

    const result = await action(
      actionArgs(
        formRequest({
          intent: "createPO",
          supplierId: "supplier-shop-a",
          locationId: "gid://shopify/Location/1",
          "qty-map-shop-a": "10",
        }),
      ),
    );

    expect(prismaMock.supplier.findFirst).toHaveBeenCalledWith({
      where: { id: "supplier-shop-a", shop: SHOP_B },
    });
    expect(result).toEqual({ error: "Supplier not found" });
    expect(prismaMock.supplierSkuMapping.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.purchaseOrder.create).not.toHaveBeenCalled();
    expect(resolveTieredUnitCost).not.toHaveBeenCalled();
  });

  it("documents shop A id is never accepted as authority from the client", async () => {
    // Session shop is Shop B even if a form field tries to smuggle Shop A.
    const { action } = await import("../routes/app.purchase-orders");
    prismaMock.purchaseOrder.updateMany.mockResolvedValue({ count: 0 });

    const result = await action(
      actionArgs(
        formRequest({
          intent: "cancel",
          poId: "po-shop-a",
          shop: SHOP_A,
        }),
      ),
    );

    expect(prismaMock.purchaseOrder.updateMany).toHaveBeenCalledWith({
      where: { id: "po-shop-a", shop: SHOP_B },
      data: { status: "CANCELLED" },
    });
    expect(result).toEqual({ error: "Purchase order not found" });
    expect(prismaMock.purchaseOrder.update).not.toHaveBeenCalled();
  });

  it("denies Shop B completing Shop A stocktake parent (session shop; no parent/child/Shopify writes)", async () => {
    // Enable write flag only to reach parent-record scoping — not counted as a
    // feature-flag assertion for record-level denial coverage.
    const previous = process.env.FEATURE_STOCKTAKE_INVENTORY_WRITES;
    process.env.FEATURE_STOCKTAKE_INVENTORY_WRITES = "true";
    featureFlags.stocktakeInventoryWrites.mockReturnValue(true);
    try {
      const { action } = await import("../routes/app.stocktakes");
      prismaMock.stocktake.findFirst.mockResolvedValue(null);

      const result = await action(
        actionArgs(
          formRequest({
            intent: "complete",
            stocktakeId: "st-shop-a",
          }),
        ),
      );

      expect(authenticateAdmin).toHaveBeenCalled();
      expect(prismaMock.stocktake.findFirst).toHaveBeenCalledWith({
        where: { id: "st-shop-a", shop: SHOP_B },
        include: { lineItems: true },
      });
      expect(result).toEqual({ error: "Stocktake not found" });
      expect(prismaMock.stocktake.update).not.toHaveBeenCalled();
      expect(prismaMock.stocktakeLineItem.update).not.toHaveBeenCalled();
      expect(adjustShopifyInventory).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) {
        delete process.env.FEATURE_STOCKTAKE_INVENTORY_WRITES;
      } else {
        process.env.FEATURE_STOCKTAKE_INVENTORY_WRITES = previous;
      }
      featureFlags.stocktakeInventoryWrites.mockReturnValue(false);
    }
  });

  it("denies Shop B cancelling Shop A transfer parent (session shop; no parent/child/Shopify writes)", async () => {
    const { action } = await import("../routes/app.transfers");
    prismaMock.transferOrder.updateMany.mockResolvedValue({ count: 0 });

    const result = await action(
      actionArgs(
        formRequest({
          intent: "cancel",
          transferId: "tr-shop-a",
        }),
      ),
    );

    expect(authenticateAdmin).toHaveBeenCalled();
    expect(prismaMock.transferOrder.updateMany).toHaveBeenCalledWith({
      where: { id: "tr-shop-a", shop: SHOP_B, status: "DRAFT" },
      data: { status: "CANCELLED" },
    });
    expect(result).toEqual({ ok: true });
    expect(prismaMock.transferOrder.update).not.toHaveBeenCalled();
    expect(prismaMock.transferLineItem.update).not.toHaveBeenCalled();
    expect(prismaMock.transferLineItem.create).not.toHaveBeenCalled();
    expect(createShopifyTransfer).not.toHaveBeenCalled();
    expect(completeShopifyTransfer).not.toHaveBeenCalled();
  });

  it("denies Buying Table createPO when Shop B supplier resolves but SKU mapping is Shop A", async () => {
    const { action } = await import("../routes/app.buying-table");
    prismaMock.supplier.findFirst.mockResolvedValue({
      id: "supplier-shop-b",
      shop: SHOP_B,
      name: "Shared-looking supplier name",
    });
    // Mapping id belongs to Shop A (or otherwise not under Shop B's supplier).
    prismaMock.supplierSkuMapping.findFirst.mockResolvedValue(null);

    const result = await action(
      actionArgs(
        formRequest({
          intent: "createPO",
          supplierId: "supplier-shop-b",
          locationId: "gid://shopify/Location/1",
          "qty-map-shop-a": "10",
        }),
      ),
    );

    expect(authenticateAdmin).toHaveBeenCalled();
    expect(prismaMock.supplier.findFirst).toHaveBeenCalledWith({
      where: { id: "supplier-shop-b", shop: SHOP_B },
    });
    expect(prismaMock.supplierSkuMapping.findFirst).toHaveBeenCalledWith({
      where: { id: "map-shop-a", supplierId: "supplier-shop-b" },
    });
    expect(result).toEqual({ ok: false });
    expect(prismaMock.purchaseOrder.create).not.toHaveBeenCalled();
    expect(prismaMock.pOLineItem.create).not.toHaveBeenCalled();
    expect(resolveTieredUnitCost).not.toHaveBeenCalled();
    expect(createShopifyTransfer).not.toHaveBeenCalled();
    expect(completeShopifyTransfer).not.toHaveBeenCalled();
    expect(adjustShopifyInventory).not.toHaveBeenCalled();
  });
});
