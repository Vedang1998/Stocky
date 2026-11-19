/**
 * Development plan override.
 *
 * Without App Pricing plans on the Partner Dashboard (R-195) a development
 * store has no subscription, and every call to getShopEntitlements stores
 * "no plan" on ShopSettings, so a plan set by hand does not survive the next
 * page that reads entitlements. STOCKY_DEV_PLAN_OVERRIDE names a self-serve
 * plan that every shop is treated as subscribed to, in place of the real
 * subscription source.
 *
 * It is honoured only when NODE_ENV is "development" or "test". Anywhere
 * else, including an unset NODE_ENV, it is ignored and logged, so a copied
 * .env cannot give a production store a free plan.
 */
import type { SubscriptionRecord } from "./entitlements";
import { findSelfServePlan, type SelfServePlan } from "./plans";
import type { SubscriptionSource } from "./subscription-source.server";

const ALLOWED_NODE_ENVS = new Set(["development", "test"]);

let warnedIgnored = false;
let warnedActive = false;

/** The plan to pretend every shop is on, or null when there is none. */
export function devPlanOverride(
  env: NodeJS.ProcessEnv = process.env,
): SelfServePlan | null {
  const raw = env.STOCKY_DEV_PLAN_OVERRIDE?.trim();
  if (!raw) return null;

  if (!ALLOWED_NODE_ENVS.has(env.NODE_ENV ?? "")) {
    if (!warnedIgnored) {
      warnedIgnored = true;
      console.error(
        `[billing] STOCKY_DEV_PLAN_OVERRIDE is set but ignored: it works only when NODE_ENV is development or test (NODE_ENV=${env.NODE_ENV ?? "unset"})`,
      );
    }
    return null;
  }

  const plan = findSelfServePlan(raw);
  if (!plan) {
    throw new Error(
      `STOCKY_DEV_PLAN_OVERRIDE must name a self-serve plan (essentials, growth or pro), not "${raw}"`,
    );
  }
  if (!warnedActive) {
    warnedActive = true;
    console.warn(
      `[billing] Development plan override: every shop is treated as subscribed to ${plan.displayName}`,
    );
  }
  return plan;
}

/** A source that reports one active subscription to `plan`. */
export function devPlanOverrideSource(plan: SelfServePlan): SubscriptionSource {
  const subscription: SubscriptionRecord = {
    id: `dev-plan-override:${plan.handle}`,
    name: plan.displayName,
    status: "ACTIVE",
    planHandle: plan.handle,
    createdAt: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
    endsAtPeriodEnd: false,
    billingInterval: "EVERY_30_DAYS",
    // Nothing is charged, so no price is stated.
    price: null,
  };
  return {
    kind: "dev_override",
    listSubscriptions: async () => [subscription],
  };
}

/** For tests: show the one-time log lines again. */
export function resetDevPlanOverrideWarningsForTests(): void {
  warnedIgnored = false;
  warnedActive = false;
}
