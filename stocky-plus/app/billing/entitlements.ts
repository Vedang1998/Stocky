/**
 * Pure entitlement logic: subscription selection, plan mapping, capability
 * lookup and limit evaluation. I/O lives in entitlements.server.ts.
 */
import {
  PLAN_CATALOG_VERSION,
  findSelfServePlan,
  type CapabilityKey,
  type LimitKey,
  type SelfServePlan,
} from "./plans";

const DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAY_PERIOD_MS = 30 * DAY_MS;

/**
 * Source-independent view of one Shopify app subscription. `status` is kept
 * as the raw string so an unexpected value can never be treated as active.
 */
export interface SubscriptionRecord {
  id: string;
  name: string;
  status: string;
  /** App Pricing plan handle from the recurring line item, when present. */
  planHandle: string | null;
  /** ISO-8601. */
  createdAt: string;
  /** ISO-8601; Shopify returns null when the subscription isn't active. */
  currentPeriodEnd: string | null;
  trialDays: number;
  billingInterval: "EVERY_30_DAYS" | "ANNUAL" | null;
  /** Amount charged each interval; null when it cannot be stated exactly. */
  price: { amount: string; currencyCode: string } | null;
}

export type ShopEntitlements =
  | {
      state: "active";
      catalogVersion: string;
      plan: SelfServePlan;
      subscription: SubscriptionRecord;
    }
  | {
      /** An ACTIVE subscription exists but matches no self-serve plan. */
      state: "unrecognized_plan";
      catalogVersion: string;
      subscription: SubscriptionRecord;
    }
  | { state: "no_subscription"; catalogVersion: string };

export interface EntitlementSnapshot {
  subscriptionActive: boolean;
  subscriptionPlan: string | null;
}

function timestamp(iso: string | null): number {
  if (!iso) return Number.NEGATIVE_INFINITY;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

/**
 * Shopify keeps at most one ACTIVE recurring subscription per app install,
 * but a plan change can briefly report two. The newest ACTIVE one wins; ties
 * break on id so the choice never depends on response order.
 */
export function selectActiveSubscription(
  subscriptions: readonly SubscriptionRecord[],
): SubscriptionRecord | null {
  const active = subscriptions.filter((s) => s.status === "ACTIVE");
  if (active.length === 0) return null;
  return active.reduce((best, candidate) => {
    const diff = timestamp(candidate.createdAt) - timestamp(best.createdAt);
    if (diff !== 0) return diff > 0 ? candidate : best;
    return candidate.id > best.id ? candidate : best;
  });
}

/** The plan handle is authoritative; the subscription name is the fallback. */
export function planForSubscription(
  subscription: SubscriptionRecord,
): SelfServePlan | null {
  return (
    findSelfServePlan(subscription.planHandle) ??
    findSelfServePlan(subscription.name)
  );
}

export function resolveEntitlements(
  subscriptions: readonly SubscriptionRecord[],
): ShopEntitlements {
  const catalogVersion = PLAN_CATALOG_VERSION;
  const subscription = selectActiveSubscription(subscriptions);
  if (!subscription) return { state: "no_subscription", catalogVersion };

  const plan = planForSubscription(subscription);
  if (!plan) {
    return { state: "unrecognized_plan", catalogVersion, subscription };
  }
  return { state: "active", catalogVersion, plan, subscription };
}

export function hasCapability(
  entitlements: ShopEntitlements,
  capability: CapabilityKey,
): boolean {
  return (
    entitlements.state === "active" &&
    entitlements.plan.capabilities.includes(capability)
  );
}

export function entitlementSnapshot(
  entitlements: ShopEntitlements,
): EntitlementSnapshot {
  return entitlements.state === "active"
    ? { subscriptionActive: true, subscriptionPlan: entitlements.plan.handle }
    : { subscriptionActive: false, subscriptionPlan: null };
}

/** Measured usage; a value is null when it cannot be established. */
export interface PlanUsage {
  /** Active Shopify locations from synced catalog facts. */
  locations: number | null;
  /** Purchase orders created in the current 30-day billing period. */
  monthlyPurchaseOrders: number | null;
}

export type LimitCheck =
  | { allowed: true; limit: number | null; remaining: number | null }
  | { allowed: false; reason: "no_active_plan" }
  | { allowed: false; reason: "limit_reached"; limit: number; remaining: number };

function assertCount(name: string, value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

/**
 * Whether `requested` more units fit within the plan limit given `used`.
 * Fails closed when the shop has no recognized active plan.
 */
export function checkLimit(
  entitlements: ShopEntitlements,
  key: LimitKey,
  used: number,
  requested = 1,
): LimitCheck {
  assertCount("used", used);
  assertCount("requested", requested);

  if (entitlements.state !== "active") {
    return { allowed: false, reason: "no_active_plan" };
  }

  const limit = entitlements.plan.limits[key];
  if (limit === null) return { allowed: true, limit: null, remaining: null };

  const remaining = Math.max(limit - used, 0);
  if (used + requested > limit) {
    return { allowed: false, reason: "limit_reached", limit, remaining };
  }
  return { allowed: true, limit, remaining };
}

/** End of the free trial, or null when the trial is over or never existed. */
export function trialEndsAt(
  subscription: SubscriptionRecord,
  now: Date,
): Date | null {
  if (subscription.trialDays <= 0) return null;
  const start = timestamp(subscription.createdAt);
  if (!Number.isFinite(start)) return null;
  const end = new Date(start + subscription.trialDays * DAY_MS);
  return end.getTime() > now.getTime() ? end : null;
}

/**
 * The 30-day billing period containing `now`, derived from Shopify's
 * currentPeriodEnd. Returns null for annual billing (Shopify has no monthly
 * period to anchor on) or when the period cannot be established.
 */
export function currentMonthlyBillingPeriod(
  subscription: SubscriptionRecord,
  now: Date,
): { start: Date; end: Date } | null {
  if (subscription.billingInterval !== "EVERY_30_DAYS") return null;
  const endMs = timestamp(subscription.currentPeriodEnd);
  if (!Number.isFinite(endMs)) return null;

  const startMs = endMs - THIRTY_DAY_PERIOD_MS;
  const nowMs = now.getTime();
  if (nowMs < startMs || nowMs >= endMs) return null;
  return { start: new Date(startMs), end: new Date(endMs) };
}
