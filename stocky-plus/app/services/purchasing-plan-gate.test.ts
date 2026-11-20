/**
 * The purchasing and bundle actions refuse a shop without an active plan on
 * the server, before they read the form or reach a service.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

const { db, services } = vi.hoisted(() => ({
  db: {
    authority: {
      shopId: "shop-no-plan",
      myshopifyDomain: "no-plan.myshopify.com",
    },
    shopSettings: { findUnique: vi.fn() },
    shopifyVariantCache: { findMany: vi.fn() },
    bomComponent: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
  services: {
    createSupplierFromForm: vi.fn(),
    runSupplierIntent: vi.fn(),
    createPurchaseOrderDraft: vi.fn(),
    runPurchaseOrderIntent: vi.fn(),
    receiveDelivery: vi.fn(),
  },
}));

const tenant = { myshopifyDomain: "no-plan.myshopify.com" };

vi.mock("../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => ({ tenant, db, admin: {} })),
}));
vi.mock("./purchasing/actor.server", () => ({
  requirePurchasingContext: vi.fn(async () => ({
    tenant,
    db,
    admin: {},
    actor: { type: "STAFF", id: "42" },
    inventoryActor: null,
  })),
}));
vi.mock("./purchasing/supplier-actions.server", () => ({
  createSupplierFromForm: services.createSupplierFromForm,
  runSupplierIntent: services.runSupplierIntent,
}));
vi.mock("./purchasing/purchase-order-actions.server", () => ({
  runPurchaseOrderIntent: services.runPurchaseOrderIntent,
  receiveDelivery: services.receiveDelivery,
}));
vi.mock("./purchasing/purchase-orders.server", () => ({
  createPurchaseOrderDraft: services.createPurchaseOrderDraft,
  MAX_EXCHANGE_RATE: 1_000_000,
}));
vi.mock("./purchasing/shop-profile.server", () => ({
  readShopProfile: vi.fn(async () => ({ today: "2026-11-19" })),
}));

type RouteModule = {
  action: (args: ActionFunctionArgs) => Promise<unknown>;
};

interface Write {
  name: string;
  route: () => Promise<RouteModule>;
  params: Record<string, string>;
  fields: Record<string, string>;
}

const WRITES: Write[] = [
  {
    name: "create a supplier",
    route: () => import("../routes/app.suppliers_.new"),
    params: {},
    fields: { name: "Acme", currency: "USD" },
  },
  {
    name: "change a supplier",
    route: () => import("../routes/app.suppliers_.$id"),
    params: { id: "supplier-1" },
    fields: { intent: "archive" },
  },
  {
    name: "create a purchase order",
    route: () => import("../routes/app.purchase-orders_.new"),
    params: {},
    fields: {
      supplierId: "supplier-1",
      locationGid: "gid://shopify/Location/1",
      creationKey: "key-1",
      currency: "USD",
    },
  },
  {
    name: "change a purchase order",
    route: () => import("../routes/app.purchase-orders_.$id"),
    params: { id: "po-1" },
    fields: { intent: "delete", version: "1" },
  },
  {
    name: "receive a delivery",
    route: () => import("../routes/app.purchase-orders_.$id_.receive"),
    params: { id: "po-1" },
    fields: { idempotencyKey: "key-2" },
  },
  {
    name: "add a bundle component",
    route: () => import("../routes/app.bundles"),
    params: {},
    fields: {
      intent: "add",
      bundleVariantId: "gid://shopify/ProductVariant/1",
      componentVariantId: "gid://shopify/ProductVariant/2",
      quantity: "2",
    },
  },
  {
    name: "delete a bundle component",
    route: () => import("../routes/app.bundles"),
    params: {},
    fields: { intent: "delete", id: "component-1" },
  },
];

async function post(write: Write): Promise<unknown> {
  const { action } = await write.route();
  try {
    return await action({
      request: new Request("https://app.example/app", {
        method: "POST",
        body: new URLSearchParams(write.fields),
      }),
      params: write.params,
      context: {},
    } as unknown as ActionFunctionArgs);
  } catch (thrown) {
    return thrown;
  }
}

const reached = () =>
  [
    ...Object.values(services),
    db.shopifyVariantCache.findMany,
    db.bomComponent.upsert,
    db.bomComponent.deleteMany,
  ].filter((fn) => fn.mock.calls.length > 0).length;

describe("purchasing and bundle plan gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.shopifyVariantCache.findMany.mockResolvedValue([
      { shopifyVariantId: "gid://shopify/ProductVariant/1" },
      { shopifyVariantId: "gid://shopify/ProductVariant/2" },
    ]);
    services.createPurchaseOrderDraft.mockResolvedValue({ id: "po-2" });
  });

  for (const snapshot of [{ subscriptionActive: false }, null]) {
    it.each(WRITES)(
      `refuses to $name with 403 when the plan snapshot is ${JSON.stringify(snapshot)}`,
      async (write) => {
        db.shopSettings.findUnique.mockResolvedValue(snapshot);

        const result = await post(write);

        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(403);
        expect(reached()).toBe(0);
      },
    );
  }

  it.each(WRITES)("lets a shop with an active plan $name", async (write) => {
    db.shopSettings.findUnique.mockResolvedValue({ subscriptionActive: true });

    const result = await post(write);

    expect(
      result instanceof Response && result.status === 403,
      "refused with 403",
    ).toBe(false);
    expect(reached()).toBeGreaterThan(0);
  });
});
