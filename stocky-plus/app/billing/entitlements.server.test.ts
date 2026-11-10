import { Prisma } from "@prisma/client";
import { UNSAFE_ErrorResponseImpl as ErrorResponseImpl } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { describeRouteError } from "../lib/route-error";
import type { TenantDb } from "../tenant/tenant-db.server";
import type { ShopEntitlements, SubscriptionRecord } from "./entitlements";
import {
  getShopEntitlements,
  persistEntitlementSnapshot,
  requireCapability,
} from "./entitlements.server";
import { PLAN_CATALOG_VERSION, findSelfServePlan } from "./plans";

const SHOP_DOMAIN = "fixture-shop.myshopify.com";
const SHOP_ID = "shop_fixture_1";

function fakeDb(shopSettings: {
  findUnique?: ReturnType<typeof vi.fn>;
  create?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
}) {
  const delegate = {
    findUnique: shopSettings.findUnique ?? vi.fn(async () => null),
    create: shopSettings.create ?? vi.fn(async () => ({})),
    update: shopSettings.update ?? vi.fn(async () => ({})),
  };
  const db = {
    authority: { shopId: SHOP_ID, myshopifyDomain: SHOP_DOMAIN },
    shopSettings: delegate,
  } as unknown as TenantDb;
  return { db, shopSettings: delegate };
}

function fakeAdmin(activeSubscriptions: unknown[] | null) {
  return {
    graphql: vi.fn(async () => ({
      json: async () => ({
        data: {
          currentAppInstallation:
            activeSubscriptions === null ? null : { activeSubscriptions },
        },
      }),
    })),
  };
}

function adminSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "gid://shopify/AppSubscription/1001",
    name: "Growth",
    status: "ACTIVE",
    trialDays: 14,
    currentPeriodEnd: "2026-12-01T00:00:00Z",
    createdAt: "2026-11-01T00:00:00Z",
    lineItems: [
      {
        plan: {
          pricingDetails: {
            __typename: "AppRecurringPricing",
            interval: "EVERY_30_DAYS",
            planHandle: "growth",
            price: { amount: "79.0", currencyCode: "USD" },
            discount: null,
          },
        },
      },
    ],
    ...overrides,
  };
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`shop`)",
    { code: "P2002", clientVersion: "test" },
  );
}

const record: SubscriptionRecord = {
  id: "gid://shopify/AppSubscription/1001",
  name: "Essentials",
  status: "ACTIVE",
  planHandle: "essentials",
  createdAt: "2026-11-01T00:00:00Z",
  currentPeriodEnd: "2026-12-01T00:00:00Z",
  trialDays: 0,
  billingInterval: "EVERY_30_DAYS",
  price: { amount: "29.0", currencyCode: "USD" },
};

const onEssentials: ShopEntitlements = {
  state: "active",
  catalogVersion: PLAN_CATALOG_VERSION,
  plan: findSelfServePlan("essentials")!,
  subscription: record,
};

async function denial(run: () => void): Promise<Response> {
  try {
    run();
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
  throw new Error("expected requireCapability to deny");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requireCapability", () => {
  it("allows a capability the plan includes", () => {
    expect(() =>
      requireCapability(onEssentials, "core.purchase_orders"),
    ).not.toThrow();
  });

  it("denies a capability the plan does not include with a 403", async () => {
    const response = await denial(() =>
      requireCapability(onEssentials, "forecast.smart"),
    );
    expect(response.status).toBe(403);
    expect(await response.text()).toBe(
      "Your current ProPo plan does not include this feature. You can change your plan from Billing.",
    );
  });

  it("denies core capabilities without an active subscription", async () => {
    const response = await denial(() =>
      requireCapability(
        { state: "no_subscription", catalogVersion: PLAN_CATALOG_VERSION },
        "core.purchase_orders",
      ),
    );
    expect(response.status).toBe(403);
    expect(await response.text()).toBe(
      "An active ProPo plan is required for this feature. You can choose a plan from Billing.",
    );
  });

  it("produces a denial the app error boundary shows to the merchant", async () => {
    const response = await denial(() =>
      requireCapability(onEssentials, "forecast.smart"),
    );
    const message = await response.text();

    expect(
      describeRouteError(new ErrorResponseImpl(response.status, "", message)),
    ).toEqual({ status: 403, title: "Access not available", message });
  });

  it("denies everything on an unrecognized plan", async () => {
    const response = await denial(() =>
      requireCapability(
        {
          state: "unrecognized_plan",
          catalogVersion: PLAN_CATALOG_VERSION,
          subscription: { ...record, name: "Legacy Gold", planHandle: null },
        },
        "core.replenishment",
      ),
    );
    expect(response.status).toBe(403);
  });
});

describe("persistEntitlementSnapshot", () => {
  const snapshot = { subscriptionActive: true, subscriptionPlan: "growth" };

  it("creates the settings row when none exists", async () => {
    const { db, shopSettings } = fakeDb({});
    await persistEntitlementSnapshot(db, snapshot);

    expect(shopSettings.create).toHaveBeenCalledWith({
      data: { shop: SHOP_DOMAIN, ...snapshot },
    });
    expect(shopSettings.update).not.toHaveBeenCalled();
  });

  it("updates an existing row whose snapshot differs", async () => {
    const { db, shopSettings } = fakeDb({
      findUnique: vi.fn(async () => ({
        subscriptionActive: false,
        subscriptionPlan: null,
      })),
    });
    await persistEntitlementSnapshot(db, snapshot);

    expect(shopSettings.update).toHaveBeenCalledWith({
      where: { shop: SHOP_DOMAIN },
      data: snapshot,
    });
    expect(shopSettings.create).not.toHaveBeenCalled();
  });

  it("writes nothing when the stored snapshot is already current", async () => {
    const { db, shopSettings } = fakeDb({
      findUnique: vi.fn(async () => ({ ...snapshot })),
    });
    await persistEntitlementSnapshot(db, snapshot);

    expect(shopSettings.create).not.toHaveBeenCalled();
    expect(shopSettings.update).not.toHaveBeenCalled();
  });

  it("falls back to an update when a concurrent request created the row (P2002)", async () => {
    const { db, shopSettings } = fakeDb({
      create: vi.fn(async () => {
        throw uniqueViolation();
      }),
    });

    await expect(
      persistEntitlementSnapshot(db, snapshot),
    ).resolves.toBeUndefined();
    expect(shopSettings.create).toHaveBeenCalledTimes(1);
    expect(shopSettings.update).toHaveBeenCalledTimes(1);
    expect(shopSettings.update).toHaveBeenCalledWith({
      where: { shop: SHOP_DOMAIN },
      data: snapshot,
    });
  });

  it("rethrows create failures that are not unique violations", async () => {
    const failure = new Prisma.PrismaClientKnownRequestError("timed out", {
      code: "P2024",
      clientVersion: "test",
    });
    const { db, shopSettings } = fakeDb({
      create: vi.fn(async () => {
        throw failure;
      }),
    });

    await expect(persistEntitlementSnapshot(db, snapshot)).rejects.toBe(
      failure,
    );
    expect(shopSettings.update).not.toHaveBeenCalled();
  });
});

describe("getShopEntitlements", () => {
  it("resolves the active plan and stores its handle", async () => {
    const { db, shopSettings } = fakeDb({});
    const entitlements = await getShopEntitlements({
      admin: fakeAdmin([adminSubscription()]),
      db,
    });

    expect(entitlements.state === "active" && entitlements.plan.handle).toBe(
      "growth",
    );
    expect(shopSettings.create).toHaveBeenCalledWith({
      data: {
        shop: SHOP_DOMAIN,
        subscriptionActive: true,
        subscriptionPlan: "growth",
      },
    });
  });

  it("clears a stored plan when no subscription is active", async () => {
    const { db, shopSettings } = fakeDb({
      findUnique: vi.fn(async () => ({
        subscriptionActive: true,
        subscriptionPlan: "growth",
      })),
    });
    const entitlements = await getShopEntitlements({
      admin: fakeAdmin([adminSubscription({ status: "CANCELLED" })]),
      db,
    });

    expect(entitlements.state).toBe("no_subscription");
    expect(shopSettings.update).toHaveBeenCalledWith({
      where: { shop: SHOP_DOMAIN },
      data: { subscriptionActive: false, subscriptionPlan: null },
    });
  });

  it("fails closed and logs an unknown plan without the shop domain", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { db, shopSettings } = fakeDb({});
    const entitlements = await getShopEntitlements({
      admin: fakeAdmin([
        adminSubscription({
          name: "Legacy Gold",
          lineItems: [
            {
              plan: {
                pricingDetails: {
                  __typename: "AppRecurringPricing",
                  interval: "EVERY_30_DAYS",
                  planHandle: "legacy-gold",
                  price: { amount: "49.0", currencyCode: "USD" },
                  discount: null,
                },
              },
            },
          ],
        }),
      ]),
      db,
    });

    expect(entitlements.state).toBe("unrecognized_plan");
    expect(shopSettings.create).toHaveBeenCalledWith({
      data: {
        shop: SHOP_DOMAIN,
        subscriptionActive: false,
        subscriptionPlan: null,
      },
    });
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(warn.mock.calls[0]);
    expect(logged).toContain(SHOP_ID);
    expect(logged).toContain("Legacy Gold");
    expect(logged).not.toContain(SHOP_DOMAIN);
  });

  it("does not persist anything when Shopify returns no app installation", async () => {
    const { db, shopSettings } = fakeDb({});
    await expect(
      getShopEntitlements({ admin: fakeAdmin(null), db }),
    ).rejects.toThrow(/currentAppInstallation/);

    expect(shopSettings.findUnique).not.toHaveBeenCalled();
    expect(shopSettings.create).not.toHaveBeenCalled();
    expect(shopSettings.update).not.toHaveBeenCalled();
  });
});
