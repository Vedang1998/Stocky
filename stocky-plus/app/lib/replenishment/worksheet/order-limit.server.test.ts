import { describe, expect, it, vi } from "vitest";
import {
  resolveEntitlements,
  type ShopEntitlements,
  type SubscriptionRecord,
} from "../../../billing/entitlements";
import type { TenantDb } from "../../../tenant/tenant-db.server";
import { checkPurchaseOrderAllowance } from "./order-limit.server";

const NOW = new Date("2026-11-10T00:00:00Z");

function entitlementsFor(overrides: Partial<SubscriptionRecord> = {}): ShopEntitlements {
  return resolveEntitlements([
    {
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
    },
  ]);
}

function dbWithOrdersThisPeriod(purchaseOrders: number) {
  const count = vi.fn(async () => purchaseOrders);
  const db = {
    shopifyLocationFact: { count: vi.fn(async () => 1) },
    purchaseOrder: { count },
  } as unknown as TenantDb;
  return { db, count };
}

describe("checkPurchaseOrderAllowance", () => {
  it("allows orders that fit in what is left of the month's allowance", async () => {
    const { db } = dbWithOrdersThisPeriod(47);
    await expect(checkPurchaseOrderAllowance(db, entitlementsFor(), 3, NOW)).resolves.toEqual({
      allowed: true,
    });
  });

  it("refuses the whole request when it would pass the allowance", async () => {
    const { db } = dbWithOrdersThisPeriod(47);
    await expect(checkPurchaseOrderAllowance(db, entitlementsFor(), 4, NOW)).resolves.toEqual({
      allowed: false,
      message:
        "Your plan includes 50 purchase orders per billing month and 3 are left. This would create 4. Create fewer now, or change your plan on the Billing page.",
    });
  });

  it("says so when one or none are left", async () => {
    const one = await checkPurchaseOrderAllowance(
      dbWithOrdersThisPeriod(49).db,
      entitlementsFor(),
      2,
      NOW,
    );
    expect(one).toMatchObject({ allowed: false, message: expect.stringContaining("1 is left") });

    const none = await checkPurchaseOrderAllowance(
      dbWithOrdersThisPeriod(50).db,
      entitlementsFor(),
      1,
      NOW,
    );
    expect(none).toMatchObject({
      allowed: false,
      message: expect.stringContaining("none are left"),
    });
  });

  it("does not count orders on a plan without a monthly allowance", async () => {
    const { db, count } = dbWithOrdersThisPeriod(5000);
    const growth = entitlementsFor({ name: "Growth", planHandle: "growth" });
    await expect(checkPurchaseOrderAllowance(db, growth, 10, NOW)).resolves.toEqual({
      allowed: true,
    });
    expect(count).not.toHaveBeenCalled();
  });

  it("does not enforce the allowance on annual billing, which has no monthly period", async () => {
    const { db } = dbWithOrdersThisPeriod(5000);
    const annual = entitlementsFor({ billingInterval: "ANNUAL" });
    await expect(checkPurchaseOrderAllowance(db, annual, 10, NOW)).resolves.toEqual({
      allowed: true,
    });
  });

  it("refuses when the shop has no active plan", async () => {
    const { db, count } = dbWithOrdersThisPeriod(0);
    await expect(
      checkPurchaseOrderAllowance(db, resolveEntitlements([]), 1, NOW),
    ).resolves.toEqual({
      allowed: false,
      message: "Choose a plan on the Billing page to create purchase orders.",
    });
    expect(count).not.toHaveBeenCalled();
  });
});
