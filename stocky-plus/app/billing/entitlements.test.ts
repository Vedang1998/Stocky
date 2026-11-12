import { describe, expect, it } from "vitest";
import {
  checkLimit,
  currentMonthlyBillingPeriod,
  entitlementSnapshot,
  hasCapability,
  resolveEntitlements,
  selectActiveSubscription,
  trialEndsAt,
  type ShopEntitlements,
  type SubscriptionRecord,
} from "./entitlements";
import {
  CAPABILITY_KEYS,
  CORE_CAPABILITIES,
  PLAN_CATALOG_VERSION,
  SELF_SERVE_PLANS,
  findSelfServePlan,
} from "./plans";

function subscription(
  overrides: Partial<SubscriptionRecord> = {},
): SubscriptionRecord {
  return {
    id: "gid://shopify/AppSubscription/1001",
    name: "Growth",
    status: "ACTIVE",
    planHandle: "growth",
    createdAt: "2026-11-01T00:00:00Z",
    currentPeriodEnd: "2026-12-01T00:00:00Z",
    trialEndsAt: null,
    endsAtPeriodEnd: false,
    billingInterval: "EVERY_30_DAYS",
    price: { amount: "79.0", currencyCode: "USD" },
    ...overrides,
  };
}

function activeOn(handle: string): ShopEntitlements {
  const plan = findSelfServePlan(handle);
  if (!plan) throw new Error(`fixture plan ${handle} missing`);
  return {
    state: "active",
    catalogVersion: PLAN_CATALOG_VERSION,
    plan,
    subscription: subscription({ name: plan.displayName, planHandle: handle }),
  };
}

const NONE: ShopEntitlements = {
  state: "no_subscription",
  catalogVersion: PLAN_CATALOG_VERSION,
};

describe("selectActiveSubscription", () => {
  it("returns null when there are no subscriptions", () => {
    expect(selectActiveSubscription([])).toBeNull();
  });

  it.each(["PENDING", "FROZEN", "CANCELLED", "DECLINED", "EXPIRED"])(
    "never treats a %s subscription as active",
    (status) => {
      expect(selectActiveSubscription([subscription({ status })])).toBeNull();
      expect(resolveEntitlements([subscription({ status })]).state).toBe(
        "no_subscription",
      );
    },
  );

  it("ignores unexpected status values", () => {
    expect(
      selectActiveSubscription([
        subscription({ status: "active" }),
        subscription({ status: "ACCEPTED" }),
        subscription({ status: "" }),
      ]),
    ).toBeNull();
  });

  it("picks the ACTIVE subscription among inactive ones", () => {
    const active = subscription({ id: "gid://shopify/AppSubscription/2" });
    const picked = selectActiveSubscription([
      subscription({
        id: "gid://shopify/AppSubscription/1",
        status: "CANCELLED",
        createdAt: "2026-11-05T00:00:00Z",
      }),
      active,
      subscription({
        id: "gid://shopify/AppSubscription/3",
        status: "PENDING",
        createdAt: "2026-11-06T00:00:00Z",
      }),
    ]);
    expect(picked).toBe(active);
  });

  it("prefers the newest ACTIVE subscription regardless of order", () => {
    const older = subscription({
      id: "gid://shopify/AppSubscription/9",
      createdAt: "2026-10-01T00:00:00Z",
    });
    const newer = subscription({
      id: "gid://shopify/AppSubscription/1",
      createdAt: "2026-11-01T00:00:00Z",
    });
    expect(selectActiveSubscription([older, newer])).toBe(newer);
    expect(selectActiveSubscription([newer, older])).toBe(newer);
  });

  it("breaks createdAt ties on id so the result is order-independent", () => {
    const a = subscription({ id: "gid://shopify/AppSubscription/10" });
    const b = subscription({ id: "gid://shopify/AppSubscription/11" });
    expect(selectActiveSubscription([a, b])).toBe(b);
    expect(selectActiveSubscription([b, a])).toBe(b);
  });
});

describe("resolveEntitlements", () => {
  it("reports no subscription when nothing is ACTIVE", () => {
    expect(resolveEntitlements([])).toEqual(NONE);
  });

  it("maps the App Pricing plan handle to its plan", () => {
    const result = resolveEntitlements([
      subscription({ name: "Anything", planHandle: "pro" }),
    ]);
    expect(result.state).toBe("active");
    expect(result.state === "active" && result.plan.handle).toBe("pro");
    expect(result.catalogVersion).toBe(PLAN_CATALOG_VERSION);
  });

  it("falls back to the subscription name, ignoring case", () => {
    const result = resolveEntitlements([
      subscription({ name: "ESSENTIALS", planHandle: null }),
    ]);
    expect(result.state === "active" && result.plan.handle).toBe("essentials");
  });

  it("prefers the plan handle over a conflicting name", () => {
    const result = resolveEntitlements([
      subscription({ name: "Pro", planHandle: "growth" }),
    ]);
    expect(result.state === "active" && result.plan.handle).toBe("growth");
  });

  it("does not let a display name rescue a handle that matches no plan", () => {
    const result = resolveEntitlements([
      subscription({ name: "Pro", planHandle: "pro-legacy" }),
    ]);
    expect(result.state).toBe("unrecognized_plan");
    expect(hasCapability(result, "core.purchase_orders")).toBe(false);
  });

  it("fails closed on an unknown plan", () => {
    const unknown = subscription({ name: "Legacy Gold", planHandle: "gold" });
    const result = resolveEntitlements([unknown]);

    expect(result).toEqual({
      state: "unrecognized_plan",
      catalogVersion: PLAN_CATALOG_VERSION,
      subscription: unknown,
    });
    for (const key of CAPABILITY_KEYS) {
      expect(hasCapability(result, key)).toBe(false);
    }
    expect(entitlementSnapshot(result)).toEqual({
      subscriptionActive: false,
      subscriptionPlan: null,
    });
  });

  it("does not grant contract-plan entitlements from a subscription name", () => {
    const result = resolveEntitlements([
      subscription({ name: "Enterprise", planHandle: "enterprise" }),
    ]);
    expect(result.state).toBe("unrecognized_plan");
  });

  it("resolves the newest of several ACTIVE subscriptions", () => {
    const result = resolveEntitlements([
      subscription({
        id: "gid://shopify/AppSubscription/1",
        planHandle: "essentials",
        createdAt: "2026-09-01T00:00:00Z",
      }),
      subscription({
        id: "gid://shopify/AppSubscription/2",
        planHandle: "pro",
        createdAt: "2026-11-01T00:00:00Z",
      }),
    ]);
    expect(result.state === "active" && result.plan.handle).toBe("pro");
  });
});

describe("hasCapability", () => {
  it("grants every core capability on every self-serve plan", () => {
    for (const plan of SELF_SERVE_PLANS) {
      for (const key of CORE_CAPABILITIES) {
        expect(hasCapability(activeOn(plan.handle), key)).toBe(true);
      }
    }
  });

  it("follows the plan's capability list", () => {
    expect(hasCapability(activeOn("essentials"), "cost.landed")).toBe(false);
    expect(hasCapability(activeOn("growth"), "cost.landed")).toBe(true);
    expect(hasCapability(activeOn("growth"), "forecast.smart")).toBe(false);
    expect(hasCapability(activeOn("pro"), "forecast.smart")).toBe(true);
  });

  it("grants nothing without a subscription", () => {
    for (const key of CAPABILITY_KEYS) {
      expect(hasCapability(NONE, key)).toBe(false);
    }
  });
});

describe("entitlementSnapshot", () => {
  it("stores the plan handle for an active plan", () => {
    expect(entitlementSnapshot(activeOn("growth"))).toEqual({
      subscriptionActive: true,
      subscriptionPlan: "growth",
    });
  });

  it("stores an inactive snapshot without a subscription", () => {
    expect(entitlementSnapshot(NONE)).toEqual({
      subscriptionActive: false,
      subscriptionPlan: null,
    });
  });
});

describe("checkLimit", () => {
  const capped = SELF_SERVE_PLANS.find(
    (plan) => plan.limits.monthlyPurchaseOrders !== null,
  )!;
  const uncapped = SELF_SERVE_PLANS.find(
    (plan) => plan.limits.monthlyPurchaseOrders === null,
  )!;
  const limit = capped.limits.monthlyPurchaseOrders!;

  it("fails closed without a recognized plan", () => {
    expect(checkLimit(NONE, "locations", 0)).toEqual({
      allowed: false,
      reason: "no_active_plan",
    });
  });

  it("allows usage up to the limit", () => {
    expect(
      checkLimit(activeOn(capped.handle), "monthlyPurchaseOrders", limit - 1),
    ).toEqual({ allowed: true, limit, remaining: 1 });
  });

  it("denies the request that would exceed the limit", () => {
    expect(
      checkLimit(activeOn(capped.handle), "monthlyPurchaseOrders", limit),
    ).toEqual({ allowed: false, reason: "limit_reached", limit, remaining: 0 });
    expect(
      checkLimit(activeOn(capped.handle), "monthlyPurchaseOrders", limit - 1, 2),
    ).toEqual({ allowed: false, reason: "limit_reached", limit, remaining: 1 });
  });

  it("reports zero remaining when already over the limit", () => {
    expect(
      checkLimit(activeOn(capped.handle), "monthlyPurchaseOrders", limit + 5, 0),
    ).toEqual({ allowed: false, reason: "limit_reached", limit, remaining: 0 });
  });

  it("allows any amount when the plan does not cap the dimension", () => {
    expect(
      checkLimit(activeOn(uncapped.handle), "monthlyPurchaseOrders", 1_000_000),
    ).toEqual({ allowed: true, limit: null, remaining: null });
  });

  it("rejects negative or fractional counts", () => {
    const entitlements = activeOn(capped.handle);
    expect(() => checkLimit(entitlements, "locations", -1)).toThrow(RangeError);
    expect(() => checkLimit(entitlements, "locations", 0.5)).toThrow(RangeError);
    expect(() => checkLimit(entitlements, "locations", 0, -1)).toThrow(
      RangeError,
    );
    expect(() => checkLimit(entitlements, "locations", Number.NaN)).toThrow(
      RangeError,
    );
  });
});

describe("trialEndsAt", () => {
  const trial = subscription({ trialEndsAt: "2026-11-15T12:00:00Z" });

  it("returns the trial end while the trial is running", () => {
    expect(trialEndsAt(trial, new Date("2026-11-10T00:00:00Z"))).toEqual(
      new Date("2026-11-15T12:00:00Z"),
    );
  });

  it("returns null once the trial is over", () => {
    expect(trialEndsAt(trial, new Date("2026-11-15T12:00:00Z"))).toBeNull();
  });

  it("returns null without a trial or a parseable trial end", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    expect(trialEndsAt(subscription(), now)).toBeNull();
    expect(
      trialEndsAt(subscription({ trialEndsAt: "not-a-date" }), now),
    ).toBeNull();
  });
});

describe("currentMonthlyBillingPeriod", () => {
  const monthly = subscription({ currentPeriodEnd: "2026-12-01T00:00:00Z" });

  it("returns the 30 days ending at currentPeriodEnd", () => {
    expect(
      currentMonthlyBillingPeriod(monthly, new Date("2026-11-10T00:00:00Z")),
    ).toEqual({
      start: new Date("2026-11-01T00:00:00Z"),
      end: new Date("2026-12-01T00:00:00Z"),
    });
  });

  it("returns null when now falls outside that period", () => {
    expect(
      currentMonthlyBillingPeriod(monthly, new Date("2026-10-31T23:59:59Z")),
    ).toBeNull();
    expect(
      currentMonthlyBillingPeriod(monthly, new Date("2026-12-01T00:00:00Z")),
    ).toBeNull();
  });

  it("returns null for annual billing or a missing period end", () => {
    const now = new Date("2026-11-10T00:00:00Z");
    expect(
      currentMonthlyBillingPeriod(
        subscription({ billingInterval: "ANNUAL" }),
        now,
      ),
    ).toBeNull();
    expect(
      currentMonthlyBillingPeriod(
        subscription({ currentPeriodEnd: null }),
        now,
      ),
    ).toBeNull();
  });
});
