/**
 * SEC-18: the Home page's actions (start a catalog sync, dismiss a low stock
 * alert) refuse a shop without an active plan on the server.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

const { db, enqueueCatalogSync, enqueueOrderFactsSync } = vi.hoisted(() => ({
  db: {
    authority: {
      shopId: "shop-home",
      myshopifyDomain: "home.myshopify.com",
    },
    shopSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    lowStockAlert: { updateMany: vi.fn() },
    purchaseOrder: { count: vi.fn(async () => 0) },
    supplier: { count: vi.fn(async () => 0) },
    shopifyVariantCache: { count: vi.fn(async () => 0) },
  },
  enqueueCatalogSync: vi.fn(),
  enqueueOrderFactsSync: vi.fn(),
}));

vi.mock("../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => ({
    tenant: { shopId: "shop-home", myshopifyDomain: "home.myshopify.com" },
    db,
  })),
}));
vi.mock("../jobs/queue.server", () => ({
  enqueueCatalogSync,
  enqueueOrderFactsSync,
}));
vi.mock("../services/forecasting.server", () => ({
  getLowStockAlerts: vi.fn(async () => []),
}));
vi.mock("../services/setup-guide.server", () => ({
  loadSetupGuide: vi.fn(async () => ({
    steps: [],
    doneCount: 0,
    complete: true,
  })),
}));
vi.mock("../sync/sync-status.server", () => ({
  readCatalogSyncStatus: vi.fn(async () => []),
}));

async function load() {
  const { loader } = await import("../routes/app._index");
  return loader({
    request: new Request("https://app.example/app"),
    params: {},
    context: {},
  } as unknown as LoaderFunctionArgs);
}

async function post(fields: Record<string, string>): Promise<unknown> {
  const { action } = await import("../routes/app._index");
  try {
    return await action({
      request: new Request("https://app.example/app", {
        method: "POST",
        body: new URLSearchParams(fields),
      }),
      params: {},
      context: {},
    } as unknown as ActionFunctionArgs);
  } catch (thrown) {
    return thrown;
  }
}

const WRITES: Record<string, string>[] = [
  { intent: "syncCatalog" },
  { intent: "ackAlert", alertId: "alert-1" },
];

describe("Home page plan gate (SEC-18)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["an inactive plan", { subscriptionActive: false }],
    ["no settings row", null],
  ])("refuses every action with 403 for %s", async (_label, settings) => {
    db.shopSettings.findUnique.mockResolvedValue(settings);

    for (const fields of WRITES) {
      const result = await post(fields);
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(403);
    }
    expect(enqueueCatalogSync).not.toHaveBeenCalled();
    expect(enqueueOrderFactsSync).not.toHaveBeenCalled();
    expect(db.lowStockAlert.updateMany).not.toHaveBeenCalled();
  });

  it("lets the actions through with an active plan", async () => {
    db.shopSettings.findUnique.mockResolvedValue({ subscriptionActive: true });

    expect(await post(WRITES[0])).toEqual({ synced: true });
    expect(enqueueCatalogSync).toHaveBeenCalledTimes(1);
    expect(enqueueOrderFactsSync).toHaveBeenCalledTimes(1);

    expect(await post(WRITES[1])).toEqual({ ok: true });
    expect(db.lowStockAlert.updateMany).toHaveBeenCalledWith({
      where: { id: "alert-1" },
      data: { acknowledged: true },
    });
  });

  it("writes nothing for an alert dismissal without an alert id", async () => {
    db.shopSettings.findUnique.mockResolvedValue({ subscriptionActive: true });

    expect(await post({ intent: "ackAlert" })).toEqual({ ok: false });
    expect(db.lowStockAlert.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["no settings row", null, false],
    [
      "an inactive plan",
      { subscriptionActive: false, subscriptionPlan: null },
      false,
    ],
    [
      "an active plan",
      { subscriptionActive: true, subscriptionPlan: "growth" },
      true,
    ],
  ])(
    "Home's page load reads the plan for %s and writes nothing",
    async (_label, settings, active) => {
      db.shopSettings.findUnique.mockResolvedValue(settings);

      const data = await load();

      expect(data.planActive).toBe(active);
      expect(db.shopSettings.upsert).not.toHaveBeenCalled();
    },
  );
});
