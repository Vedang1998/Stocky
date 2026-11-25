/**
 * Security lane round 8: the stored plan snapshot survived an uninstall and
 * reinstall, because only Billing and Replenishment rewrote it. The afterAuth
 * hook now reads the plan again once the shop is bootstrapped, and tells the
 * refresh whether the shop was just reactivated so a failed read fails closed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { appConfigs, bootstrap, refresh, createTenantDb } = vi.hoisted(() => ({
  appConfigs: [] as Array<Record<string, unknown>>,
  bootstrap: vi.fn(),
  refresh: vi.fn(),
  createTenantDb: vi.fn(),
}));

vi.mock("@shopify/shopify-app-react-router/adapters/node", () => ({}));
vi.mock("@shopify/shopify-app-react-router/server", () => ({
  ApiVersion: { July26: "2026-07" },
  AppDistribution: { AppStore: "app_store" },
  shopifyApp: (config: Record<string, unknown>) => {
    appConfigs.push(config);
    return {
      addDocumentResponseHeaders: vi.fn(),
      authenticate: { admin: vi.fn(), webhook: vi.fn() },
      unauthenticated: {},
      login: vi.fn(),
      registerWebhooks: vi.fn(),
      sessionStorage: config.sessionStorage,
    };
  },
}));
vi.mock("../tenant/bootstrap.server", () => ({ shopifySessionStorage: {} }));
vi.mock("../tenant/after-auth.server", () => ({
  runAfterAuthTenantBootstrap: bootstrap,
}));
vi.mock("../tenant/tenant-db.server", () => ({ createTenantDb }));
vi.mock("./entitlements.server", () => ({
  refreshPlanSnapshotAfterAuth: refresh,
}));
vi.mock("../jobs/queue.server", () => ({
  enqueueAfterAuthCatalogSync: vi.fn(),
  enqueueOrderFactsSync: vi.fn(),
}));

import "../shopify.server";

type AfterAuth = (ctx: { session: unknown; admin: unknown }) => Promise<void>;

function afterAuthHook(): AfterAuth {
  const merchantApp = appConfigs.find((config) => "hooks" in config);
  return (merchantApp?.hooks as { afterAuth: AfterAuth }).afterAuth;
}

describe("afterAuth hook", () => {
  const tenant = { shopId: "shop-a", myshopifyDomain: "shop-a.myshopify.com" };
  const tenantDb = { authority: tenant };
  const admin = { graphql: vi.fn() };

  beforeEach(() => {
    bootstrap.mockReset();
    refresh.mockReset();
    createTenantDb.mockReset();
    createTenantDb.mockReturnValue(tenantDb);
  });

  it.each([true, false])(
    "reads the plan again with the shop's admin client (reactivated: %s)",
    async (reactivated) => {
      bootstrap.mockResolvedValue({ tenant, reactivated });

      await afterAuthHook()({
        session: { shop: tenant.myshopifyDomain },
        admin,
      });

      expect(createTenantDb).toHaveBeenCalledWith(tenant);
      expect(refresh).toHaveBeenCalledWith({
        admin,
        db: tenantDb,
        reactivated,
      });
    },
  );

  it("does not read the plan when the bootstrap fails", async () => {
    bootstrap.mockRejectedValue(new Error("bootstrap failed"));

    await expect(
      afterAuthHook()({ session: { shop: tenant.myshopifyDomain }, admin }),
    ).rejects.toThrow("bootstrap failed");
    expect(refresh).not.toHaveBeenCalled();
  });
});
