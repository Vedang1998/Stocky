import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PartnerApiConfigError,
  PartnerApiError,
  loadPartnerApiConfig,
  partnerApiSubscriptionSource,
  partnerSubscriptionRecord,
  type PartnerActiveSubscription,
} from "./partner-subscription-source.server";
import { subscriptionSourceFor } from "./subscription-source.server";

const SHOP_GID = "gid://shopify/Shop/5678";
const TOKEN = "prtapi_fixture_token_value";
const config = {
  organizationId: "4242",
  accessToken: TOKEN,
  appGid: "gid://shopify/App/1234",
};
const partnerEnv = {
  SHOPIFY_PARTNER_ORG_ID: "4242",
  SHOPIFY_PARTNER_API_ACCESS_TOKEN: TOKEN,
  SHOPIFY_APP_GID: "gid://shopify/App/1234",
};

function activeSubscription(
  overrides: Partial<PartnerActiveSubscription> = {},
): PartnerActiveSubscription {
  return {
    shop: { id: SHOP_GID },
    billingPeriod: "EVERY_30_DAYS",
    cancelAtEndOfCycle: false,
    trialEndsAt: null,
    currentBillingCycle: { endTime: "2026-12-01T00:00:00Z" },
    items: [
      {
        handle: "growth",
        description: "Growth",
        price: { __typename: "FlatRatePrice", currency: "USD", amount: "79.00" },
        discount: null,
      },
    ],
    legacySubscriptionId: null,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sourceReturning(response: () => Response | Promise<Response>) {
  const fetchImpl = vi.fn(async () => response());
  const source = partnerApiSubscriptionSource({
    config,
    resolveShopGid: async () => SHOP_GID,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { source, fetchImpl };
}

async function failure(run: Promise<unknown>): Promise<PartnerApiError> {
  try {
    await run;
  } catch (error) {
    if (error instanceof PartnerApiError) return error;
    throw error;
  }
  throw new Error("expected the Partner API source to throw");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadPartnerApiConfig", () => {
  it("is null when no Partner API setting is present", () => {
    expect(loadPartnerApiConfig({})).toBeNull();
    expect(
      loadPartnerApiConfig({ SHOPIFY_PARTNER_ORG_ID: "  " }),
    ).toBeNull();
  });

  it("reads a complete set", () => {
    expect(loadPartnerApiConfig(partnerEnv)).toEqual(config);
  });

  it("refuses a partial set and names what is missing, not what is set", () => {
    const run = () =>
      loadPartnerApiConfig({ SHOPIFY_PARTNER_API_ACCESS_TOKEN: TOKEN });
    expect(run).toThrow(PartnerApiConfigError);
    expect(run).toThrow(/SHOPIFY_PARTNER_ORG_ID, SHOPIFY_APP_GID not set/);
    expect(run).not.toThrow(new RegExp(TOKEN));
  });

  it("refuses an organization id or app id of the wrong form", () => {
    expect(() =>
      loadPartnerApiConfig({ ...partnerEnv, SHOPIFY_PARTNER_ORG_ID: "42/x" }),
    ).toThrow(/SHOPIFY_PARTNER_ORG_ID/);
    expect(() =>
      loadPartnerApiConfig({ ...partnerEnv, SHOPIFY_APP_GID: "1234" }),
    ).toThrow(/SHOPIFY_APP_GID/);
  });
});

describe("partnerSubscriptionRecord", () => {
  it("maps a flat-rate subscription", () => {
    expect(partnerSubscriptionRecord(activeSubscription())).toEqual({
      id: `${SHOP_GID}/ActiveSubscription`,
      name: "Growth",
      status: "ACTIVE",
      planHandle: "growth",
      createdAt: null,
      trialEndsAt: null,
      currentPeriodEnd: "2026-12-01T00:00:00Z",
      endsAtPeriodEnd: false,
      billingInterval: "EVERY_30_DAYS",
      price: { amount: "79.00", currencyCode: "USD" },
    });
  });

  it("carries the trial end, which has no billing cycle yet", () => {
    const record = partnerSubscriptionRecord(
      activeSubscription({
        trialEndsAt: "2026-11-26T00:00:00Z",
        currentBillingCycle: null,
      }),
    );
    expect(record.trialEndsAt).toBe("2026-11-26T00:00:00Z");
    expect(record.currentPeriodEnd).toBeNull();
  });

  it("marks a subscription that stops at the end of its cycle", () => {
    expect(
      partnerSubscriptionRecord(
        activeSubscription({ cancelAtEndOfCycle: true }),
      ).endsAtPeriodEnd,
    ).toBe(true);
  });

  it("takes the plan from the flat-rate item, not a usage item", () => {
    const record = partnerSubscriptionRecord(
      activeSubscription({
        items: [
          {
            handle: "orders-usage",
            description: "Orders",
            price: { __typename: "TieredPrice", currency: "USD" },
            discount: null,
          },
          {
            handle: "pro",
            description: null,
            price: {
              __typename: "FlatRatePrice",
              currency: "USD",
              amount: "149.00",
            },
            discount: null,
          },
        ],
      }),
    );
    expect(record.planHandle).toBe("pro");
    expect(record.name).toBe("pro");
    expect(record.price).toEqual({ amount: "149.00", currencyCode: "USD" });
  });

  it("leaves the charge unstated while a discount applies", () => {
    const [item] = activeSubscription().items;
    const record = partnerSubscriptionRecord(
      activeSubscription({
        items: [{ ...item, discount: { remainingDiscountCycles: 2 } }],
      }),
    );
    expect(record.price).toBeNull();
    expect(record.planHandle).toBe("growth");
  });

  it("does not pass through a billing period it does not know", () => {
    expect(
      partnerSubscriptionRecord(activeSubscription({ billingPeriod: "WEEKLY" }))
        .billingInterval,
    ).toBeNull();
  });

  it("ignores an item without a handle when choosing the plan", () => {
    const [plan] = activeSubscription().items;
    const record = partnerSubscriptionRecord(
      activeSubscription({
        items: [
          {
            handle: null,
            description: "Setup",
            price: { __typename: "FlatRatePrice", currency: "USD", amount: "5.00" },
            discount: null,
          },
          plan,
        ],
      }),
    );
    expect(record.planHandle).toBe("growth");
    expect(record.price).toEqual({ amount: "79.00", currencyCode: "USD" });
  });

  it("reports no plan handle for a subscription without items", () => {
    const record = partnerSubscriptionRecord(activeSubscription({ items: [] }));
    expect(record).toMatchObject({ planHandle: null, name: "", price: null });
  });

  it("uses the Billing API id of a migrated subscription", () => {
    expect(
      partnerSubscriptionRecord(
        activeSubscription({
          legacySubscriptionId: "gid://shopify/AppSubscription/987",
        }),
      ).id,
    ).toBe("gid://shopify/AppSubscription/987");
  });
});

describe("partnerApiSubscriptionSource", () => {
  it("asks the organization's endpoint about this app and shop only", async () => {
    const { source, fetchImpl } = sourceReturning(() =>
      jsonResponse({ data: { activeSubscription: activeSubscription() } }),
    );

    const records = await source.listSubscriptions();

    expect(source.kind).toBe("partner_api");
    expect(records.map((record) => record.planHandle)).toEqual(["growth"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://partners.shopify.com/4242/api/2026-07/graphql.json",
    );
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": TOKEN,
    });
    const body = JSON.parse(init.body as string);
    expect(body.variables).toEqual({
      appId: "gid://shopify/App/1234",
      shopId: SHOP_GID,
    });
    expect(body.query).toContain("activeSubscription(");
    expect(body.query).not.toMatch(/\bmutation\b/);
  });

  it("returns an empty list when the shop has no active subscription", async () => {
    const { source } = sourceReturning(() =>
      jsonResponse({ data: { activeSubscription: null } }),
    );
    await expect(source.listSubscriptions()).resolves.toEqual([]);
  });

  it("throws on GraphQL errors instead of reporting no subscription", async () => {
    const { source } = sourceReturning(() =>
      jsonResponse({
        data: { activeSubscription: null },
        errors: [{ message: "Throttled" }],
      }),
    );
    const error = await failure(source.listSubscriptions());
    expect(error.code).toBe("graphql_error");
    expect(error.message).toContain("Throttled");
  });

  it("throws on an HTTP failure", async () => {
    const { source } = sourceReturning(() => jsonResponse({}, 429));
    const error = await failure(source.listSubscriptions());
    expect(error.code).toBe("http_error");
    expect(error.message).toBe("Partner API responded with HTTP 429");
  });

  it("throws when the answer lacks the activeSubscription field", async () => {
    const { source } = sourceReturning(() => jsonResponse({ data: {} }));
    expect((await failure(source.listSubscriptions())).code).toBe(
      "malformed_response",
    );
  });

  it("throws on a body that is not JSON or not a subscription", async () => {
    const notJson = sourceReturning(() => new Response("<html>", { status: 200 }));
    expect((await failure(notJson.source.listSubscriptions())).code).toBe(
      "malformed_response",
    );

    const wrongShape = sourceReturning(() =>
      jsonResponse({ data: { activeSubscription: { items: "none" } } }),
    );
    expect((await failure(wrongShape.source.listSubscriptions())).code).toBe(
      "malformed_response",
    );
  });

  it("accepts a response with an item whose handle is null", async () => {
    const subscription = activeSubscription();
    const { source } = sourceReturning(() =>
      jsonResponse({
        data: {
          activeSubscription: {
            ...subscription,
            items: [
              { handle: null, description: null, price: null, discount: null },
              ...subscription.items,
            ],
          },
        },
      }),
    );
    const [record] = await source.listSubscriptions();
    expect(record.planHandle).toBe("growth");
  });

  it("refuses a subscription that belongs to another shop", async () => {
    const { source } = sourceReturning(() =>
      jsonResponse({
        data: {
          activeSubscription: activeSubscription({
            shop: { id: "gid://shopify/Shop/9999" },
          }),
        },
      }),
    );
    expect((await failure(source.listSubscriptions())).code).toBe(
      "shop_mismatch",
    );
  });

  it("sends nothing when the shop id is not a Shop GID", async () => {
    const fetchImpl = vi.fn();
    const source = partnerApiSubscriptionSource({
      config,
      resolveShopGid: async () => "fixture-shop.myshopify.com",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect((await failure(source.listSubscriptions())).code).toBe(
      "malformed_response",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("keeps the access token out of a failed request's error", async () => {
    const source = partnerApiSubscriptionSource({
      config,
      resolveShopGid: async () => SHOP_GID,
      fetchImpl: (async () => {
        throw new TypeError(`fetch failed for token ${TOKEN}`);
      }) as unknown as typeof fetch,
    });
    const error = await failure(source.listSubscriptions());
    expect(error.code).toBe("request_failed");
    expect(error.message).toBe("Partner API request could not be sent");
    expect(error.cause).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain(TOKEN);
  });
});

describe("subscriptionSourceFor", () => {
  const admin = {
    graphql: vi.fn(async () => ({
      json: async () => ({ data: { shop: { id: SHOP_GID } } }),
    })),
  };

  it("uses the Admin API when no Partner API setting is present", () => {
    expect(subscriptionSourceFor(admin, {}).kind).toBe("admin_api");
  });

  it("uses the Partner API when its settings are present", () => {
    expect(subscriptionSourceFor(admin, partnerEnv).kind).toBe("partner_api");
  });

  it("does not fall back to the Admin API on a partial Partner API set", () => {
    expect(() =>
      subscriptionSourceFor(admin, { SHOPIFY_APP_GID: partnerEnv.SHOPIFY_APP_GID }),
    ).toThrow(PartnerApiConfigError);
  });

  it("says once, in production, that the Admin API is being read", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    subscriptionSourceFor(admin, { NODE_ENV: "production" });
    subscriptionSourceFor(admin, { NODE_ENV: "production" });
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain("Partner API credentials");
  });
});
