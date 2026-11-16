import { describe, expect, it } from "vitest";
import type { SubscriptionRecord } from "./entitlements";
import {
  annualPriceLabel,
  describeBillingTerms,
  formatUsd,
  monthlyPriceLabel,
  planTermRows,
} from "./plan-display";
import { SELF_SERVE_PLANS, findSelfServePlan } from "./plans";

const essentials = findSelfServePlan("essentials")!;
const growth = findSelfServePlan("growth")!;

function valueOf(rows: ReturnType<typeof planTermRows>, key: string) {
  const row = rows.find((candidate) => candidate.key === key);
  if (!row) throw new Error(`row ${key} missing`);
  return row;
}

function subscription(
  overrides: Partial<SubscriptionRecord> = {},
): SubscriptionRecord {
  return {
    id: "gid://shopify/AppSubscription/1001",
    name: "Growth",
    status: "ACTIVE",
    planHandle: "growth",
    createdAt: "2026-11-01T00:00:00Z",
    currentPeriodEnd: "2026-12-01T03:00:00Z",
    trialEndsAt: null,
    endsAtPeriodEnd: false,
    billingInterval: "EVERY_30_DAYS",
    price: { amount: "79.0", currencyCode: "USD" },
    ...overrides,
  };
}

describe("price labels", () => {
  it("drops cents for whole-dollar amounts only", () => {
    expect(formatUsd(2_900)).toBe("$29");
    expect(formatUsd(149_000)).toBe("$1,490");
    expect(formatUsd(2_950)).toBe("$29.50");
  });

  it("states the monthly price and the annual saving", () => {
    expect(monthlyPriceLabel(growth)).toBe("$79/month");
    expect(annualPriceLabel(growth)).toBe("$790/year (save $158)");
  });
});

describe("planTermRows", () => {
  it("lists the same terms, in the same order, for every plan", () => {
    const keys = planTermRows(essentials).map((row) => row.key);
    expect(keys).toEqual([
      "locations",
      "activeVariants",
      "users",
      "monthlyPurchaseOrders",
      "reportingHistory",
      "support",
    ]);
    for (const plan of SELF_SERVE_PLANS) {
      expect(planTermRows(plan).map((row) => row.key)).toEqual(keys);
    }
  });

  it("describes limits without usage", () => {
    const rows = planTermRows(essentials);
    expect(valueOf(rows, "locations").value).toBe("1");
    expect(valueOf(rows, "activeVariants").value).toBe("Up to 2,500");
    expect(valueOf(rows, "monthlyPurchaseOrders").value).toBe(
      "Up to 50 per billing month",
    );
    expect(valueOf(rows, "reportingHistory").value).toBe("24 months");
    expect(rows.every((row) => !row.overLimit)).toBe(true);
  });

  it("does not advertise AI credits before an AI feature exists", () => {
    for (const plan of SELF_SERVE_PLANS) {
      const rows = planTermRows(plan);
      expect(rows.some((row) => /\bAI\b/i.test(row.label))).toBe(false);
    }
  });

  it("shows measured usage against the limit", () => {
    const rows = planTermRows(essentials, {
      locations: 1,
      monthlyPurchaseOrders: 12,
    });
    expect(valueOf(rows, "locations")).toMatchObject({
      value: "1 of 1 in use",
      overLimit: false,
    });
    expect(valueOf(rows, "monthlyPurchaseOrders")).toMatchObject({
      value: "12 of 50 created this billing month",
      overLimit: false,
    });
  });

  it("flags usage above the limit", () => {
    const rows = planTermRows(essentials, {
      locations: 3,
      monthlyPurchaseOrders: 50,
    });
    expect(valueOf(rows, "locations")).toMatchObject({
      value: "3 of 1 in use",
      overLimit: true,
    });
    expect(valueOf(rows, "monthlyPurchaseOrders").overLimit).toBe(false);
  });

  it("falls back to the bare limit when usage is unknown", () => {
    const rows = planTermRows(essentials, {
      locations: null,
      monthlyPurchaseOrders: null,
    });
    expect(valueOf(rows, "locations").value).toBe("1");
    expect(valueOf(rows, "monthlyPurchaseOrders").value).toBe(
      "Up to 50 per billing month",
    );
  });

  it("does not report usage against an uncapped dimension", () => {
    const rows = planTermRows(growth, {
      locations: 2,
      monthlyPurchaseOrders: 400,
    });
    expect(valueOf(rows, "monthlyPurchaseOrders")).toMatchObject({
      value: "Unlimited, subject to fair use",
      overLimit: false,
    });
  });
});

describe("describeBillingTerms", () => {
  const now = new Date("2026-11-10T00:00:00Z");

  it("states the charge and renewal date in the shop's time zone", () => {
    expect(
      describeBillingTerms(subscription(), "America/Toronto", now),
    ).toEqual({
      charge: "$79.00 every 30 days",
      trialEndsOn: null,
      renewsOn: "November 30, 2026",
      endsOn: null,
    });
    expect(
      describeBillingTerms(subscription(), "Asia/Tokyo", now).renewsOn,
    ).toBe("December 1, 2026");
  });

  it("shows the trial end instead of a renewal date during the trial", () => {
    const trial = subscription({ trialEndsAt: "2026-11-19T00:00:00Z" });
    expect(describeBillingTerms(trial, "UTC", now)).toEqual({
      charge: "$79.00 every 30 days",
      trialEndsOn: "November 19, 2026",
      renewsOn: null,
      endsOn: null,
    });
  });

  it("shows an end date instead of a renewal when the plan will not renew", () => {
    const ending = subscription({ endsAtPeriodEnd: true });
    expect(describeBillingTerms(ending, "UTC", now)).toEqual({
      charge: "$79.00 every 30 days",
      trialEndsOn: null,
      renewsOn: null,
      endsOn: "December 1, 2026",
    });
  });

  it("describes annual billing", () => {
    const annual = subscription({
      billingInterval: "ANNUAL",
      price: { amount: "790.0", currencyCode: "USD" },
    });
    expect(describeBillingTerms(annual, "UTC", now).charge).toBe(
      "$790.00 every year",
    );
  });

  it("omits what it cannot state exactly", () => {
    expect(
      describeBillingTerms(
        subscription({ price: null, currentPeriodEnd: null }),
        "UTC",
        now,
      ),
    ).toEqual({ charge: null, trialEndsOn: null, renewsOn: null, endsOn: null });
    expect(
      describeBillingTerms(
        subscription({ price: { amount: "n/a", currencyCode: "USD" } }),
        "UTC",
        now,
      ).charge,
    ).toBeNull();
  });

  it("omits dates when the time zone is unusable", () => {
    expect(
      describeBillingTerms(subscription(), "Not/A_Zone", now),
    ).toEqual({
      charge: "$79.00 every 30 days",
      trialEndsOn: null,
      renewsOn: null,
      endsOn: null,
    });
  });
});
