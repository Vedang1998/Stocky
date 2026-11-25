import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminGraphQLClient } from "../services/shopify-gql.server";
import {
  devPlanOverride,
  devPlanOverrideSource,
  resetDevPlanOverrideWarningsForTests,
} from "./dev-plan-override.server";
import {
  checkLimit,
  currentMonthlyBillingPeriod,
  entitlementSnapshot,
  resolveEntitlements,
} from "./entitlements";
import { subscriptionSourceFor } from "./subscription-source.server";

const admin = {
  graphql: vi.fn(async () => {
    throw new Error("Shopify must not be read while the override is active");
  }),
} as unknown as AdminGraphQLClient;

describe("development plan override", () => {
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetDevPlanOverrideWarningsForTests();
    error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is off when the variable is unset or blank", () => {
    expect(devPlanOverride({ NODE_ENV: "development" })).toBeNull();
    expect(
      devPlanOverride({
        NODE_ENV: "development",
        STOCKY_DEV_PLAN_OVERRIDE: " ",
      }),
    ).toBeNull();
  });

  it.each([
    ["production", "production"],
    ["unset", undefined],
    ["staging", "staging"],
    ["test", "test"],
  ])("is ignored, and says so, when NODE_ENV is %s", (_label, nodeEnv) => {
    const env = { NODE_ENV: nodeEnv, STOCKY_DEV_PLAN_OVERRIDE: "growth" };

    expect(devPlanOverride(env)).toBeNull();
    expect(subscriptionSourceFor(admin, env).kind).toBe("admin_api");
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("STOCKY_DEV_PLAN_OVERRIDE is set but ignored"),
    );
  });

  it("refuses a name that is not a self-serve plan", () => {
    for (const name of ["enterprise", "dev", "free"]) {
      expect(() =>
        devPlanOverride({
          NODE_ENV: "development",
          STOCKY_DEV_PLAN_OVERRIDE: name,
        }),
      ).toThrow(/must name a self-serve plan/);
    }
  });

  it("replaces the subscription source when NODE_ENV is development", async () => {
    const source = subscriptionSourceFor(admin, {
      NODE_ENV: "development",
      STOCKY_DEV_PLAN_OVERRIDE: "Growth",
    });

    expect(source.kind).toBe("dev_override");
    const entitlements = resolveEntitlements(await source.listSubscriptions());
    expect(entitlements.state).toBe("active");
    expect(entitlementSnapshot(entitlements)).toEqual({
      subscriptionActive: true,
      subscriptionPlan: "growth",
    });
    expect(admin.graphql).not.toHaveBeenCalled();
  });

  it("names every self-serve plan when it refuses a value", () => {
    expect(() =>
      devPlanOverride({
        NODE_ENV: "development",
        STOCKY_DEV_PLAN_OVERRIDE: "enterprise",
      }),
    ).toThrow("(essentials, growth, pro)");
  });

  it("states no price or trial for the plan it reports", async () => {
    const plan = devPlanOverride({
      NODE_ENV: "development",
      STOCKY_DEV_PLAN_OVERRIDE: "essentials",
    });
    const [subscription] = await devPlanOverrideSource(
      plan!,
    ).listSubscriptions();

    expect(subscription).toMatchObject({
      status: "ACTIVE",
      planHandle: "essentials",
      price: null,
      trialEndsAt: null,
      endsAtPeriodEnd: false,
    });
  });

  it("enforces the plan's monthly purchase order limit", async () => {
    const now = new Date("2026-11-25T17:00:00Z");
    const plan = devPlanOverride({
      NODE_ENV: "development",
      STOCKY_DEV_PLAN_OVERRIDE: "essentials",
    });
    const source = devPlanOverrideSource(plan!, () => now);
    const [subscription] = await source.listSubscriptions();
    const entitlements = resolveEntitlements([subscription]);

    const period = currentMonthlyBillingPeriod(subscription, now);
    expect(period).not.toBeNull();
    expect(period!.end.getTime() - period!.start.getTime()).toBe(
      30 * 24 * 60 * 60 * 1000,
    );
    // A later read in the same period reports the same period.
    const [again] = await devPlanOverrideSource(
      plan!,
      () => new Date(now.getTime() + 60_000),
    ).listSubscriptions();
    expect(again.currentPeriodEnd).toBe(subscription.currentPeriodEnd);

    expect(checkLimit(entitlements, "monthlyPurchaseOrders", 49).allowed).toBe(
      true,
    );
    expect(checkLimit(entitlements, "monthlyPurchaseOrders", 50)).toMatchObject(
      { allowed: false, reason: "limit_reached" },
    );
  });
});
