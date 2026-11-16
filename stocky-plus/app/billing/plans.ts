/**
 * ProPo plan catalog: the single source for plan handles, prices, limits and
 * capability packaging (docs/product/11_PRICING_AND_PACKAGING_STRATEGY.md).
 *
 * Prices and limits are pre-pilot hypotheses (§13). Plans, prices and the
 * trial are configured for Shopify App Pricing in the Partner Dashboard; the
 * plan handles and prices there must match this file. Bump
 * PLAN_CATALOG_VERSION whenever a value here changes.
 *
 * Client-safe: no server or database imports.
 */

export const PLAN_CATALOG_VERSION = "plan-catalog-v1";

export const TRIAL_DAYS = 14;

/** Stable entitlement keys (§6). Never rename a key; add new ones. */
export const CAPABILITY_KEYS = [
  "core.replenishment",
  "core.purchase_orders",
  "core.receiving",
  "core.stocktakes",
  "core.transfers",
  "pos.receiving",
  "cost.landed",
  "workflow.approvals",
  "automation.flow",
  "forecast.smart",
  "analytics.natural_language",
  "integration.accounting",
  "platform.api_access",
] as const;

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

/** The essential workflow every paid plan includes (§2.1). */
export const CORE_CAPABILITIES = [
  "core.replenishment",
  "core.purchase_orders",
  "core.receiving",
  "core.stocktakes",
  "core.transfers",
] as const satisfies readonly CapabilityKey[];

export type SelfServePlanHandle = "essentials" | "growth" | "pro";

export type SelfServeSupportLevel =
  | "standard_email"
  | "priority_email"
  | "priority_onboarding";

/** `null` means the plan does not cap that dimension. */
export interface PlanLimits {
  locations: number | null;
  activeVariants: number | null;
  users: number | null;
  /** Purchase orders created per billing month. `null` = fair use only. */
  monthlyPurchaseOrders: number | null;
}

export type LimitKey = keyof PlanLimits;

export interface SelfServePlan {
  handle: SelfServePlanHandle;
  displayName: string;
  recommended: boolean;
  /** USD cents. */
  monthlyPriceCents: number;
  /** USD cents. */
  annualPriceCents: number;
  limits: PlanLimits;
  /** Every plan has a finite AI allowance; AI is never unlimited (§7.2). */
  aiCreditsPerMonth: number;
  reportingHistoryMonths: number;
  supportLevel: SelfServeSupportLevel;
  capabilities: readonly CapabilityKey[];
}

/**
 * Custom-contract plan. Limits, AI allowance and retention are negotiated per
 * contract (§3, Enterprise), so it is never resolved from a self-serve
 * subscription.
 */
export interface ContractPlan {
  handle: "enterprise";
  displayName: string;
  /** USD cents; the actual price is set per contract. */
  startingMonthlyPriceCents: number;
  supportLevel: "contractual";
  capabilities: readonly CapabilityKey[];
}

const GROWTH_ADDITIONS = [
  "pos.receiving",
  "cost.landed",
  "workflow.approvals",
  "automation.flow",
] as const satisfies readonly CapabilityKey[];

const PRO_ADDITIONS = [
  "forecast.smart",
  "analytics.natural_language",
  "integration.accounting",
] as const satisfies readonly CapabilityKey[];

export const SELF_SERVE_PLANS: readonly SelfServePlan[] = [
  {
    handle: "essentials",
    displayName: "Essentials",
    recommended: false,
    monthlyPriceCents: 2_900,
    annualPriceCents: 29_000,
    limits: {
      locations: 1,
      activeVariants: 2_500,
      users: 3,
      monthlyPurchaseOrders: 50,
    },
    aiCreditsPerMonth: 100,
    reportingHistoryMonths: 24,
    supportLevel: "standard_email",
    capabilities: [...CORE_CAPABILITIES],
  },
  {
    handle: "growth",
    displayName: "Growth",
    recommended: true,
    monthlyPriceCents: 7_900,
    annualPriceCents: 79_000,
    limits: {
      locations: 5,
      activeVariants: 15_000,
      users: 10,
      monthlyPurchaseOrders: null,
    },
    aiCreditsPerMonth: 500,
    reportingHistoryMonths: 36,
    supportLevel: "priority_email",
    capabilities: [...CORE_CAPABILITIES, ...GROWTH_ADDITIONS],
  },
  {
    handle: "pro",
    displayName: "Pro",
    recommended: false,
    monthlyPriceCents: 14_900,
    annualPriceCents: 149_000,
    limits: {
      locations: 15,
      activeVariants: 50_000,
      users: null,
      monthlyPurchaseOrders: null,
    },
    aiCreditsPerMonth: 1_500,
    reportingHistoryMonths: 60,
    supportLevel: "priority_onboarding",
    capabilities: [...CORE_CAPABILITIES, ...GROWTH_ADDITIONS, ...PRO_ADDITIONS],
  },
];

export const ENTERPRISE_PLAN: ContractPlan = {
  handle: "enterprise",
  displayName: "Enterprise",
  startingMonthlyPriceCents: 29_900,
  supportLevel: "contractual",
  capabilities: [...CAPABILITY_KEYS],
};

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Match a Shopify plan handle or subscription name to a self-serve plan by
 * handle or display name, ignoring case and surrounding whitespace. Contract
 * plans never match.
 */
export function findSelfServePlan(
  identifier: string | null | undefined,
): SelfServePlan | null {
  if (!identifier) return null;
  const wanted = normalizeIdentifier(identifier);
  if (wanted.length === 0) return null;
  return (
    SELF_SERVE_PLANS.find(
      (plan) =>
        plan.handle === wanted ||
        normalizeIdentifier(plan.displayName) === wanted,
    ) ?? null
  );
}

export function annualSavingsCents(plan: SelfServePlan): number {
  return plan.monthlyPriceCents * 12 - plan.annualPriceCents;
}
