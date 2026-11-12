import { describe, expect, it, vi } from "vitest";
import {
  adminApiSubscriptionSource,
  toSubscriptionRecord,
} from "./subscription-source.server";

function recurringLineItem(overrides: Record<string, unknown> = {}) {
  return {
    plan: {
      pricingDetails: {
        __typename: "AppRecurringPricing",
        interval: "ANNUAL",
        planHandle: "pro",
        price: { amount: "1490.0", currencyCode: "USD" },
        discount: null,
        ...overrides,
      },
    },
  };
}

const base = {
  id: "gid://shopify/AppSubscription/2002",
  name: "Pro",
  status: "ACTIVE",
  trialDays: 14,
  currentPeriodEnd: "2027-11-01T00:00:00Z",
  createdAt: "2026-11-01T00:00:00Z",
};

describe("toSubscriptionRecord", () => {
  it("maps the recurring line item", () => {
    expect(
      toSubscriptionRecord({ ...base, lineItems: [recurringLineItem()] }),
    ).toEqual({
      id: base.id,
      name: "Pro",
      status: "ACTIVE",
      planHandle: "pro",
      createdAt: "2026-11-01T00:00:00Z",
      trialEndsAt: "2026-11-15T00:00:00.000Z",
      currentPeriodEnd: "2027-11-01T00:00:00Z",
      endsAtPeriodEnd: false,
      billingInterval: "ANNUAL",
      price: { amount: "1490.0", currencyCode: "USD" },
    });
  });

  it("reports no trial end without trial days or a parseable creation date", () => {
    const lineItems = [recurringLineItem()];
    expect(
      toSubscriptionRecord({ ...base, trialDays: 0, lineItems }).trialEndsAt,
    ).toBeNull();
    expect(
      toSubscriptionRecord({ ...base, createdAt: "not-a-date", lineItems })
        .trialEndsAt,
    ).toBeNull();
  });

  it("skips usage line items when looking for the recurring price", () => {
    const record = toSubscriptionRecord({
      ...base,
      lineItems: [
        { plan: { pricingDetails: { __typename: "AppUsagePricing" } } },
        recurringLineItem(),
      ],
    });
    expect(record.planHandle).toBe("pro");
    expect(record.billingInterval).toBe("ANNUAL");
  });

  it("leaves plan handle, interval and price empty without a recurring item", () => {
    expect(
      toSubscriptionRecord({
        ...base,
        lineItems: [
          { plan: { pricingDetails: { __typename: "AppUsagePricing" } } },
        ],
      }),
    ).toMatchObject({ planHandle: null, billingInterval: null, price: null });
  });

  it("leaves the charge unstated while a discount applies", () => {
    const record = toSubscriptionRecord({
      ...base,
      lineItems: [
        recurringLineItem({ discount: { remainingDurationInIntervals: 2 } }),
      ],
    });
    expect(record.price).toBeNull();
    expect(record.planHandle).toBe("pro");
    expect(record.billingInterval).toBe("ANNUAL");
  });

  it("does not pass through an interval it does not know", () => {
    const record = toSubscriptionRecord({
      ...base,
      lineItems: [recurringLineItem({ interval: "WEEKLY", planHandle: null })],
    });
    expect(record.billingInterval).toBeNull();
    expect(record.planHandle).toBeNull();
  });
});

describe("adminApiSubscriptionSource", () => {
  it("reads subscriptions with one query and never creates a charge", async () => {
    const graphql = vi.fn(async () => ({
      json: async () => ({
        data: {
          currentAppInstallation: {
            activeSubscriptions: [{ ...base, lineItems: [recurringLineItem()] }],
          },
        },
      }),
    }));

    const records = await adminApiSubscriptionSource({
      graphql,
    }).listSubscriptions();

    expect(records.map((record) => record.planHandle)).toEqual(["pro"]);
    expect(graphql).toHaveBeenCalledTimes(1);
    const [document] = graphql.mock.calls[0] as unknown as [string];
    expect(document).toContain("currentAppInstallation");
    expect(document).not.toMatch(/\bmutation\b|appSubscriptionCreate/);
    expect(document).not.toMatch(/\btest\b/);
  });

  it("returns an empty list when the shop has no subscriptions", async () => {
    const source = adminApiSubscriptionSource({
      graphql: async () => ({
        json: async () => ({
          data: { currentAppInstallation: { activeSubscriptions: [] } },
        }),
      }),
    });
    await expect(source.listSubscriptions()).resolves.toEqual([]);
  });

  it("throws instead of reporting no subscription when the installation is missing", async () => {
    const source = adminApiSubscriptionSource({
      graphql: async () => ({
        json: async () => ({ data: { currentAppInstallation: null } }),
      }),
    });
    await expect(source.listSubscriptions()).rejects.toThrow(
      /currentAppInstallation/,
    );
  });
});
