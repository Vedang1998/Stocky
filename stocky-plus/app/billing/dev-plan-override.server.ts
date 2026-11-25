/**
 * Development plan override.
 *
 * Without App Pricing plans on the Partner Dashboard (R-195) a development
 * store has no subscription, and every call to getShopEntitlements stores
 * "no plan" on ShopSettings, so a plan set by hand does not survive the next
 * page that reads entitlements. STOCKY_DEV_PLAN_OVERRIDE names a self-serve
 * plan that replaces the real subscription source whenever a shop's
 * entitlements are read (Billing and Replenishment read them). Other plan
 * gates read the stored snapshot, so they see the override only after that.
 *
 * It is honoured only when NODE_ENV is "development". Anywhere else, including
 * an unset NODE_ENV and "test", it is ignored and logged, so a copied .env
 * cannot give a production store a free plan and cannot change a test run.
 *
 * The granted plan is stored on ShopSettings like any other, and the stored
 * snapshot outlives the override until the shop's entitlements are read again,
 * so a process with the override must never serve a production database
 * (RISK_REGISTER R-205).
 */
import type { SubscriptionRecord } from "./entitlements";
import {
  findSelfServePlan,
  SELF_SERVE_PLANS,
  type SelfServePlan,
} from "./plans";
import type { SubscriptionSource } from "./subscription-source.server";

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_MS = 30 * DAY_MS;

let warnedIgnored = false;
let warnedActive = false;

/** The plan to pretend every shop is on, or null when there is none. */
export function devPlanOverride(
  env: NodeJS.ProcessEnv = process.env,
): SelfServePlan | null {
  const raw = env.STOCKY_DEV_PLAN_OVERRIDE?.trim();
  if (!raw) return null;

  if (env.NODE_ENV !== "development") {
    if (!warnedIgnored) {
      warnedIgnored = true;
      console.error(
        `[billing] STOCKY_DEV_PLAN_OVERRIDE is set but ignored: it works only when NODE_ENV is development (NODE_ENV=${env.NODE_ENV ?? "unset"})`,
      );
    }
    return null;
  }

  const plan = findSelfServePlan(raw);
  if (!plan) {
    const handles = SELF_SERVE_PLANS.map((p) => p.handle).join(", ");
    throw new Error(
      `STOCKY_DEV_PLAN_OVERRIDE must name a self-serve plan (${handles}), not "${raw}"`,
    );
  }
  if (!warnedActive) {
    warnedActive = true;
    console.warn(
      `[billing] Development plan override: a shop is treated as subscribed to ${plan.displayName} once its plan is read again (open Billing)`,
    );
  }
  return plan;
}

/**
 * A source that reports one active subscription to `plan`. Its 30-day periods
 * are counted from the Unix epoch, so every read in the same period agrees and
 * the plan's monthly limits are enforced as for a real subscription.
 */
export function devPlanOverrideSource(
  plan: SelfServePlan,
  now: () => Date = () => new Date(),
): SubscriptionSource {
  return {
    kind: "dev_override",
    listSubscriptions: async () => {
      const periodEnd =
        (Math.floor(now().getTime() / PERIOD_MS) + 1) * PERIOD_MS;
      const subscription: SubscriptionRecord = {
        id: `dev-plan-override:${plan.handle}`,
        name: plan.displayName,
        status: "ACTIVE",
        planHandle: plan.handle,
        createdAt: null,
        trialEndsAt: null,
        currentPeriodEnd: new Date(periodEnd).toISOString(),
        endsAtPeriodEnd: false,
        billingInterval: "EVERY_30_DAYS",
        // Nothing is charged, so no price is stated.
        price: null,
      };
      return [subscription];
    },
  };
}

/** For tests: show the one-time log lines again. */
export function resetDevPlanOverrideWarningsForTests(): void {
  warnedIgnored = false;
  warnedActive = false;
}
