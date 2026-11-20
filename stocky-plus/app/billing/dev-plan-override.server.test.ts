import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminGraphQLClient } from "../services/shopify-gql.server";
import {
  devPlanOverride,
  devPlanOverrideSource,
  resetDevPlanOverrideWarningsForTests,
} from "./dev-plan-override.server";
import { entitlementSnapshot, resolveEntitlements } from "./entitlements";
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

  it.each(["development", "test"])(
    "replaces the subscription source when NODE_ENV is %s",
    async (nodeEnv) => {
      const source = subscriptionSourceFor(admin, {
        NODE_ENV: nodeEnv,
        STOCKY_DEV_PLAN_OVERRIDE: "Growth",
      });

      expect(source.kind).toBe("dev_override");
      const entitlements = resolveEntitlements(
        await source.listSubscriptions(),
      );
      expect(entitlements.state).toBe("active");
      expect(entitlementSnapshot(entitlements)).toEqual({
        subscriptionActive: true,
        subscriptionPlan: "growth",
      });
      expect(admin.graphql).not.toHaveBeenCalled();
    },
  );

  it("states no price, period or trial for the plan it reports", async () => {
    const plan = devPlanOverride({
      NODE_ENV: "test",
      STOCKY_DEV_PLAN_OVERRIDE: "essentials",
    });
    const [subscription] = await devPlanOverrideSource(
      plan!,
    ).listSubscriptions();

    expect(subscription).toMatchObject({
      status: "ACTIVE",
      planHandle: "essentials",
      price: null,
      currentPeriodEnd: null,
      trialEndsAt: null,
      endsAtPeriodEnd: false,
    });
  });
});
