/**
 * The Buying Table's order action refuses a bad request before anything is
 * read, and then has the purchasing service create the order. A missing
 * supplier or location, more lines than an order may have and a quantity out
 * of range are refused here; the supplier and the location themselves are
 * checked by the purchasing service, as for every other order. Before, a
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
    supplierSkuMapping: { findMany: vi.fn() },
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

function resetMocks() {
  vi.clearAllMocks();
  db.shopSettings.findUnique.mockResolvedValue({ subscriptionActive: true });
  db.supplierSkuMapping.findMany.mockImplementation(
    async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({
        id,
        shopifyVariantId: `variant-${id}`,
        vendorSku: null,
        moq: 1,
        packSize: 1,
      })),
  );
  createPurchaseOrderDraft.mockResolvedValue({ id: "po-1", poNumber: "PO-1", created: true });
  fetchLocations.mockResolvedValue([{ id: LOCATION, name: "Warehouse" }]);
}

describe("Buying Table order input", () => {
  beforeEach(resetMocks);

  it.each(UNUSABLE)(
    "does not create an order with %s",
    async (_label, target) => {
      const result = await createOrder({ ...target, "qty-map-a": "2" });

      expect(result).toEqual({ error: TARGET_MISSING });
      expect(db.supplierSkuMapping.findMany).not.toHaveBeenCalled();
      expect(createPurchaseOrderDraft).not.toHaveBeenCalled();
    },
  );

  it("leaves the location check to the purchasing service and shows its refusal", async () => {
    const { PurchasingError } = await import("./purchasing/errors");
    createPurchaseOrderDraft.mockRejectedValue(
      new PurchasingError("invalid_input", "That location is not part of this store."),
    );

    const result = await createOrder({
      supplierId: SUPPLIER,
      locationId: "anywhere",
      "qty-map-a": "2",
    });

    expect(result).toEqual({ error: "That location is not part of this store." });
    expect(createPurchaseOrderDraft.mock.calls[0][2]).toMatchObject({
      locationGid: "anywhere",
    });
    // One check, in the service: the route no longer asks Shopify itself.
    expect(fetchLocations).not.toHaveBeenCalled();
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
  });

  it("reads nothing when there is nothing to order", async () => {
    const result = await createOrder({
      supplierId: SUPPLIER,
      locationId: LOCATION,
      "qty-map-a": "0",
    });

    expect(result).toEqual({ ok: false });
    expect(db.supplierSkuMapping.findMany).not.toHaveBeenCalled();
    expect(createPurchaseOrderDraft).not.toHaveBeenCalled();
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
    db.supplierSkuMapping.findMany.mockResolvedValue([
      {
        id: "map-a",
        shopifyVariantId: "variant-map-a",
        vendorSku: null,
        moq: 1,
        packSize: 600_000,
      },
    ]);

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
    expect(db.supplierSkuMapping.findMany).not.toHaveBeenCalled();
    expect(createPurchaseOrderDraft).not.toHaveBeenCalled();
  });
});

describe("Buying Table order through the purchasing service", () => {
  beforeEach(resetMocks);

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
      creationKey: expect.stringMatching(/^buying-table:key-1:[0-9a-f]{32}$/),
      source: "replenishment",
    });
    expect(options).toMatchObject({ today: "2026-11-20" });
  });

  it("keys the draft by the page and exactly what is on it", async () => {
    const keyFor = async (fields: Record<string, string>) => {
      createPurchaseOrderDraft.mockClear();
      await createOrder({ supplierId: SUPPLIER, locationId: LOCATION, ...fields });
      return createPurchaseOrderDraft.mock.calls[0][2].creationKey as string | null;
    };

    const first = await keyFor({ creationKey: "key-1", "qty-map-a": "3" });
    // The same press again on the same page finds the same draft.
    expect(await keyFor({ creationKey: "key-1", "qty-map-a": "3" })).toBe(first);
    // Changed quantities on the same page make a new order, not the old one.
    expect(await keyFor({ creationKey: "key-1", "qty-map-a": "4" })).not.toBe(first);
    // A fresh page makes a new order with the same lines.
    expect(await keyFor({ creationKey: "key-2", "qty-map-a": "3" })).not.toBe(first);
    // A page key that is not one the page renders gives no key at all.
    expect(await keyFor({ creationKey: "bad key!", "qty-map-a": "3" })).toBeNull();
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
