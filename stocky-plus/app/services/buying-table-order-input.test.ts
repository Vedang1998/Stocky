/**
 * The Buying Table's order action refuses a bad request before anything is
 * read, and then has the purchasing service create the order. It refuses
 * what the purchasing service refuses for every other order:
 * a missing supplier or location, a location that is not the shop's, more
 * lines than an order may have, and a quantity out of range. Before, a
 * missing field ended in a 500 and any text was stored as the location.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

const { db, fetchLocations, createPurchaseOrderDraft } = vi.hoisted(() => ({
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
  createPurchaseOrderDraft: vi.fn(),
}));

vi.mock("../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => ({
    admin: {},
    tenant: { myshopifyDomain: "order-input.myshopify.com" },
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
    createPurchaseOrderDraft.mockResolvedValue({ id: "po-1", poNumber: "PO-1", created: true });
    fetchLocations.mockResolvedValue([{ id: LOCATION, name: "Warehouse" }]);
  });

  it.each(UNUSABLE)(
    "does not create an order with %s",
    async (_label, target) => {
      const result = await createOrder({ ...target, "qty-map-a": "2" });

      expect(result).toEqual({ error: TARGET_MISSING });
      expect(db.supplier.findFirst).not.toHaveBeenCalled();
      expect(createPurchaseOrderDraft).not.toHaveBeenCalled();
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
    expect(createPurchaseOrderDraft).not.toHaveBeenCalled();
  });

  it("creates the order at one of the shop's own locations", async () => {
    await createOrder({
      supplierId: SUPPLIER,
      locationId: LOCATION,
      "qty-map-a": "2",
    });

    expect(createPurchaseOrderDraft).toHaveBeenCalledTimes(1);
    expect(createPurchaseOrderDraft.mock.calls[0][2]).toMatchObject({
      supplierId: SUPPLIER,
      locationGid: LOCATION,
      lines: [{ variantGid: "variant-map-a", quantity: 2 }],
      source: "replenishment",
    });
    expect(db.purchaseOrder.create).not.toHaveBeenCalled();
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
    expect(createPurchaseOrderDraft).not.toHaveBeenCalled();
  });

  it("accepts the largest quantity an order line may have", async () => {
    await createOrder({
      supplierId: SUPPLIER,
      locationId: LOCATION,
      "qty-map-a": "1000000",
    });

    expect(createPurchaseOrderDraft).toHaveBeenCalledTimes(1);
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
    expect(createPurchaseOrderDraft).not.toHaveBeenCalled();
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
    expect(createPurchaseOrderDraft).not.toHaveBeenCalled();
  });
});

describe("Buying Table order through the purchasing service", () => {
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
    fetchLocations.mockResolvedValue([{ id: LOCATION, name: "Warehouse" }]);
  });

  it("opens the numbered draft, with the page's key so a second press finds the same one", async () => {
    createPurchaseOrderDraft.mockResolvedValue({ id: "po-7", poNumber: "PO-7", created: true });
    const response = await createOrder({
      supplierId: SUPPLIER,
      locationId: LOCATION,
      creationKey: "key-1",
      "qty-map-a": "3",
    });

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe("/app/purchase-orders/po-7");
    const [calledDb, actor, input, options] = createPurchaseOrderDraft.mock.calls[0];
    expect(calledDb).toBe(db);
    // The signed-in staff member is recorded (null here, where no session is read).
    expect(actor).toEqual({ type: "STAFF", id: null });
    expect(input).toEqual({
      supplierId: SUPPLIER,
      locationGid: LOCATION,
      lines: [{ variantGid: "variant-map-a", quantity: 3 }],
      creationKey: "key-1",
      source: "replenishment",
    });
    expect(options).toMatchObject({ today: "2026-11-20" });
  });

  it("shows the purchasing service's refusal instead of failing", async () => {
    const { PurchasingError } = await import("./purchasing/errors");
    createPurchaseOrderDraft.mockRejectedValue(
      new PurchasingError("invalid_input", "This supplier is archived."),
    );
    const result = await createOrder({
      supplierId: SUPPLIER,
      locationId: LOCATION,
      "qty-map-a": "3",
    });
    expect(result).toEqual({ error: "This supplier is archived." });
  });
});
