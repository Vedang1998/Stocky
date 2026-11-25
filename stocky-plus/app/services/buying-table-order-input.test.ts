/**
 * The Buying Table's order action writes the purchase order itself, so it
 * has to refuse what the purchasing service refuses for every other order:
 * a missing supplier or location, a location that is not the shop's, more
 * lines than an order may have, and a quantity out of range. Before, a
 * missing field ended in a 500 and any text was stored as the location.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

const { db, fetchLocations } = vi.hoisted(() => ({
  db: {
    authority: {
      shopId: "shop-order-input",
      myshopifyDomain: "order-input.myshopify.com",
    },
    shopSettings: { findUnique: vi.fn() },
    supplier: { findFirst: vi.fn() },
    supplierSkuMapping: { findFirst: vi.fn() },
    purchaseOrder: { create: vi.fn() },
  },
  fetchLocations: vi.fn(),
}));

vi.mock("../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => ({
    admin: {},
    tenant: { myshopifyDomain: "order-input.myshopify.com" },
    db,
  })),
}));
vi.mock("./landed-cost.server", () => ({
  resolveTieredUnitCost: vi.fn(async () => null),
}));
vi.mock("./shopify-gql.server", () => ({
  fetchInventoryLevels: vi.fn(),
  fetchLocations,
}));
vi.mock("./forecasting.server", () => ({ computeForecast: vi.fn() }));

const SUPPLIER = "supplier-1";
const LOCATION = "gid://shopify/Location/1";
const OTHER_SHOP_LOCATION = "gid://shopify/Location/2";
const TARGET_MISSING =
  "Choose a supplier and a location before creating a purchase order.";

async function createOrder(fields: Record<string, string>): Promise<unknown> {
  const { action } = await import("../routes/app.buying-table");
  return action({
    request: new Request("https://app.example/app/buying-table", {
      method: "POST",
      body: new URLSearchParams({ intent: "createPO", ...fields }),
    }),
    params: {},
    context: {},
  } as unknown as ActionFunctionArgs);
}

const UNUSABLE: Array<[string, Record<string, string>]> = [
  ["no supplier and no location", {}],
  ["no supplier", { locationId: LOCATION }],
  ["no location", { supplierId: SUPPLIER }],
  ["an empty location", { supplierId: SUPPLIER, locationId: "" }],
  [
    "an over-long location",
    { supplierId: SUPPLIER, locationId: "L".repeat(257) },
  ],
];

describe("Buying Table order input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.shopSettings.findUnique.mockResolvedValue({ subscriptionActive: true });
    db.supplier.findFirst.mockResolvedValue({ id: SUPPLIER });
    db.supplierSkuMapping.findFirst.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        shopifyVariantId: `variant-${where.id}`,
        vendorSku: null,
        moq: 1,
        packSize: 1,
      }),
    );
    db.purchaseOrder.create.mockResolvedValue({ id: "po-1" });
    fetchLocations.mockResolvedValue([{ id: LOCATION, name: "Warehouse" }]);
  });

  it.each(UNUSABLE)(
    "does not create an order with %s",
    async (_label, target) => {
      const result = await createOrder({ ...target, "qty-map-a": "2" });

      expect(result).toEqual({ error: TARGET_MISSING });
      expect(db.supplier.findFirst).not.toHaveBeenCalled();
      expect(db.purchaseOrder.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["a location Shopify does not list for the shop", OTHER_SHOP_LOCATION],
    ["text that is not a location", "anywhere"],
  ])("does not create an order for %s", async (_label, locationId) => {
    const result = await createOrder({
      supplierId: SUPPLIER,
      locationId,
      "qty-map-a": "2",
    });

    expect(result).toEqual({
      error:
        "That location is not one of this shop's locations. Choose a location and try again.",
    });
    expect(db.purchaseOrder.create).not.toHaveBeenCalled();
  });

  it("creates the order at one of the shop's own locations", async () => {
    await createOrder({
      supplierId: SUPPLIER,
      locationId: LOCATION,
      "qty-map-a": "2",
    });

    expect(db.purchaseOrder.create).toHaveBeenCalledTimes(1);
    expect(db.purchaseOrder.create.mock.calls[0][0].data).toMatchObject({
      supplierId: SUPPLIER,
      locationId: LOCATION,
      lineItems: {
        create: [{ shopifyVariantId: "variant-map-a", orderedQty: 2 }],
      },
    });
  });

  it("does not ask Shopify for locations when there is nothing to order", async () => {
    const result = await createOrder({
      supplierId: SUPPLIER,
      locationId: LOCATION,
      "qty-map-a": "0",
    });

    expect(result).toEqual({ ok: false });
    expect(fetchLocations).not.toHaveBeenCalled();
  });

  it.each([
    ["one above the largest quantity", "1000001"],
    ["a quantity beyond 32 bits", "99999999999"],
  ])("does not create an order with %s", async (_label, quantity) => {
    const result = await createOrder({
      supplierId: SUPPLIER,
      locationId: LOCATION,
      "qty-map-a": quantity,
    });

    expect(result).toEqual({ error: "A quantity can be at most 1,000,000." });
    expect(db.purchaseOrder.create).not.toHaveBeenCalled();
  });

  it("accepts the largest quantity an order line may have", async () => {
    await createOrder({
      supplierId: SUPPLIER,
      locationId: LOCATION,
      "qty-map-a": "1000000",
    });

    expect(db.purchaseOrder.create).toHaveBeenCalledTimes(1);
  });

  it("refuses a quantity that a supplier rule lifts out of range", async () => {
    db.supplierSkuMapping.findFirst.mockResolvedValue({
      id: "map-a",
      shopifyVariantId: "variant-map-a",
      vendorSku: null,
      moq: 1,
      packSize: 600_000,
    });

    const result = await createOrder({
      supplierId: SUPPLIER,
      locationId: LOCATION,
      "qty-map-a": "600001",
      roundUpToPackSize: "on",
    });

    expect(result).toEqual({ error: "A quantity can be at most 1,000,000." });
    expect(db.purchaseOrder.create).not.toHaveBeenCalled();
  });

  it("does not look up a single line of an order with more lines than an order may have", async () => {
    const lines = Object.fromEntries(
      Array.from({ length: 1001 }, (_unused, index) => [
        `qty-map-${index}`,
        "1",
      ]),
    );

    const result = await createOrder({
      supplierId: SUPPLIER,
      locationId: LOCATION,
      ...lines,
    });

    expect(result).toEqual({
      error: "A purchase order can have at most 1000 lines.",
    });
    expect(db.supplier.findFirst).not.toHaveBeenCalled();
    expect(db.supplierSkuMapping.findFirst).not.toHaveBeenCalled();
    expect(db.purchaseOrder.create).not.toHaveBeenCalled();
  });
});
