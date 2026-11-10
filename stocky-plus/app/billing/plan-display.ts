/**
 * Merchant-facing wording for plans, limits and billing dates.
 * Pure helpers safe for client and server bundles.
 */
import {
  trialEndsAt,
  type PlanUsage,
  type SubscriptionRecord,
} from "./entitlements";
import {
  annualSavingsCents,
  type SelfServePlan,
  type SelfServeSupportLevel,
} from "./plans";

const LOCALE = "en-US";
const count = new Intl.NumberFormat(LOCALE);

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function monthlyPriceLabel(plan: SelfServePlan): string {
  return `${formatUsd(plan.monthlyPriceCents)}/month`;
}

export function annualPriceLabel(plan: SelfServePlan): string {
  return (
    `${formatUsd(plan.annualPriceCents)}/year ` +
    `(save ${formatUsd(annualSavingsCents(plan))})`
  );
}

const SUPPORT_LABELS: Record<SelfServeSupportLevel, string> = {
  standard_email: "Standard email support",
  priority_email: "Priority email support",
  priority_onboarding: "Priority onboarding and support",
};

export interface PlanTermRow {
  key: string;
  label: string;
  value: string;
  /** Measured usage is above the plan limit. */
  overLimit: boolean;
}

function capped(limit: number | null, unit = ""): string {
  if (limit === null) return "Unlimited";
  const amount = count.format(limit);
  return `${limit === 1 ? amount : `Up to ${amount}`}${unit}`;
}

function metered(
  limit: number | null,
  used: number | null | undefined,
  usedSuffix: string,
  fallback: string,
): Pick<PlanTermRow, "value" | "overLimit"> {
  if (limit === null || used === null || used === undefined) {
    return { value: fallback, overLimit: false };
  }
  return {
    value: `${count.format(used)} of ${count.format(limit)} ${usedSuffix}`,
    overLimit: used > limit,
  };
}

/**
 * The limits and allowances a plan includes. When `usage` is given, measured
 * dimensions read "used of limit" instead of the bare limit.
 */
export function planTermRows(
  plan: SelfServePlan,
  usage?: PlanUsage,
): PlanTermRow[] {
  const { limits } = plan;
  return [
    {
      key: "locations",
      label: "Locations",
      ...metered(
        limits.locations,
        usage?.locations,
        "in use",
        capped(limits.locations),
      ),
    },
    {
      key: "activeVariants",
      label: "Active variants",
      value: capped(limits.activeVariants),
      overLimit: false,
    },
    {
      key: "users",
      label: "Users",
      value: capped(limits.users),
      overLimit: false,
    },
    {
      key: "monthlyPurchaseOrders",
      label: "Purchase orders",
      ...metered(
        limits.monthlyPurchaseOrders,
        usage?.monthlyPurchaseOrders,
        "created this billing month",
        limits.monthlyPurchaseOrders === null
          ? "Unlimited, subject to fair use"
          : capped(limits.monthlyPurchaseOrders, " per billing month"),
      ),
    },
    {
      key: "aiCredits",
      label: "AI credits",
      value: `${count.format(plan.aiCreditsPerMonth)} per month`,
      overLimit: false,
    },
    {
      key: "reportingHistory",
      label: "Reporting history",
      value: `${plan.reportingHistoryMonths} months`,
      overLimit: false,
    },
    {
      key: "support",
      label: "Support",
      value: SUPPORT_LABELS[plan.supportLevel],
      overLimit: false,
    },
  ];
}

export interface BillingTerms {
  /** The recurring charge with its cadence, e.g. "$79.00 every 30 days". */
  charge: string | null;
  /** Set while the free trial is running. */
  trialEndsOn: string | null;
  /** Set once the trial is over and Shopify reports a period end. */
  renewsOn: string | null;
}

const CADENCE: Record<
  NonNullable<SubscriptionRecord["billingInterval"]>,
  string
> = {
  EVERY_30_DAYS: "every 30 days",
  ANNUAL: "every year",
};

function formatCharge(subscription: SubscriptionRecord): string | null {
  const { price, billingInterval } = subscription;
  if (!price || !billingInterval) return null;
  const amount = Number(price.amount);
  if (!Number.isFinite(amount)) return null;
  try {
    const formatted = new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency: price.currencyCode,
    }).format(amount);
    return `${formatted} ${CADENCE[billingInterval]}`;
  } catch {
    return null;
  }
}

function dateFormatter(timeZone: string): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat(LOCALE, { dateStyle: "long", timeZone });
  } catch {
    return null;
  }
}

/**
 * Dates are rendered in the shop's IANA time zone. An unusable time zone
 * yields no dates rather than dates that could be a day off.
 */
export function describeBillingTerms(
  subscription: SubscriptionRecord,
  timeZone: string,
  now: Date,
): BillingTerms {
  const charge = formatCharge(subscription);
  const formatter = dateFormatter(timeZone);
  if (!formatter) return { charge, trialEndsOn: null, renewsOn: null };

  const trialEnd = trialEndsAt(subscription, now);
  if (trialEnd) {
    return { charge, trialEndsOn: formatter.format(trialEnd), renewsOn: null };
  }

  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;
  return {
    charge,
    trialEndsOn: null,
    renewsOn:
      periodEnd && !Number.isNaN(periodEnd.getTime())
        ? formatter.format(periodEnd)
        : null,
  };
}
