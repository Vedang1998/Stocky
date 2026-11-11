import { describe, expect, it, vi } from "vitest";
import type { TenantDb } from "../tenant/tenant-db.server";
import type { SubscriptionRecord } from "./entitlements";
import { getPlanUsage } from "./usage.server";

const NOW = new Date("2026-11-10T00:00:00Z");

function subscription(
  overrides: Partial<SubscriptionRecord> = {},
): SubscriptionRecord {
  return {
    id: "gid://shopify/AppSubscription/1001",
    name: "Essentials",
    status: "ACTIVE",
    planHandle: "essentials",
    createdAt: "2026-10-02T00:00:00Z",
    currentPeriodEnd: "2026-12-01T00:00:00Z",
    trialDays: 0,
    billingInterval: "EVERY_30_DAYS",
    price: { amount: "29.0", currencyCode: "USD" },
    ...overrides,
  };
}

function fakeDb(counts: { locations: number; purchaseOrders: number }) {
  const locationCount = vi.fn(async () => counts.locations);
  const purchaseOrderCount = vi.fn(async () => counts.purchaseOrders);
  const db = {
    shopifyLocationFact: { count: locationCount },
    purchaseOrder: { count: purchaseOrderCount },
  } as unknown as TenantDb;
  return { db, locationCount, purchaseOrderCount };
}

describe("getPlanUsage", () => {
  it("counts live active locations and POs created in the billing period", async () => {
    const { db, locationCount, purchaseOrderCount } = fakeDb({
      locations: 2,
      purchaseOrders: 7,
    });

    await expect(getPlanUsage(db, subscription(), NOW)).resolves.toEqual({
      locations: 2,
      monthlyPurchaseOrders: 7,
    });
    expect(locationCount).toHaveBeenCalledWith({
      where: { existenceState: "LIVE", isActive: true },
    });
    expect(purchaseOrderCount).toHaveBeenCalledWith({
      where: {
        createdAt: {
          gte: new Date("2026-11-01T00:00:00Z"),
          lt: new Date("2026-12-01T00:00:00Z"),
        },
      },
    });
  });

  it("reports locations as unknown before the catalog has synced", async () => {
    const { db } = fakeDb({ locations: 0, purchaseOrders: 0 });
    const usage = await getPlanUsage(db, subscription(), NOW);

    expect(usage.locations).toBeNull();
    expect(usage.monthlyPurchaseOrders).toBe(0);
  });

  it("does not count purchase orders without a 30-day billing period", async () => {
    const { db, purchaseOrderCount } = fakeDb({
      locations: 1,
      purchaseOrders: 99,
    });
    const usage = await getPlanUsage(
      db,
      subscription({ billingInterval: "ANNUAL" }),
      NOW,
    );

    expect(usage).toEqual({ locations: 1, monthlyPurchaseOrders: null });
    expect(purchaseOrderCount).not.toHaveBeenCalled();
  });
});
