/**
 * The settings page and the planning-levels route with storage replaced: who
 * may reach them, what they do with a form, and what the merchant is told.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { resolveEntitlements } from "../../billing/entitlements";
import { EMPTY_RULE, ReplenishmentRuleError } from "./rules.server";
import { INITIAL_DEFAULTS } from "./settings.server";

const mocks = vi.hoisted(() => ({
  entitlements: vi.fn(),
  getReplenishmentDefaults: vi.fn(),
  saveReplenishmentDefaults: vi.fn(),
  getVariantRule: vi.fn(),
  saveVariantRule: vi.fn(),
}));

const context = {
  admin: { graphql: vi.fn() },
  tenant: { shopId: "shop-a", myshopifyDomain: "shop-a.myshopify.com" },
  db: { authority: { shopId: "shop-a" } },
};

vi.mock("../../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => context),
}));
vi.mock("../../billing/entitlements.server", async (original) => ({
  ...(await original<typeof import("../../billing/entitlements.server")>()),
  getShopEntitlements: mocks.entitlements,
}));
vi.mock("./settings.server", async (original) => ({
  ...(await original<typeof import("./settings.server")>()),
  getReplenishmentDefaults: mocks.getReplenishmentDefaults,
  saveReplenishmentDefaults: mocks.saveReplenishmentDefaults,
}));
vi.mock("./rules.server", async (original) => ({
  ...(await original<typeof import("./rules.server")>()),
  getVariantRule: mocks.getVariantRule,
  saveVariantRule: mocks.saveVariantRule,
}));

import {
  action as levelsAction,
  loader as levelsLoader,
} from "../../routes/app.replenishment_.levels";
import {
  action as settingsAction,
  loader as settingsLoader,
} from "../../routes/app.replenishment_.settings";

const ACTIVE = resolveEntitlements([
  {
    id: "gid://shopify/AppSubscription/1",
    name: "Essentials",
    status: "ACTIVE",
    planHandle: "essentials",
    createdAt: "2026-10-02T00:00:00Z",
    currentPeriodEnd: "2026-12-01T00:00:00Z",
    trialDays: 0,
    billingInterval: "EVERY_30_DAYS",
    price: { amount: "29.0", currencyCode: "USD" },
  },
]);

const VARIANT = "gid://shopify/ProductVariant/11";
const LOCATION = "gid://shopify/Location/7";

function get(path: string): LoaderFunctionArgs {
  return {
    request: new Request(`https://app.example${path}`),
    params: {},
    context: {},
  } as unknown as LoaderFunctionArgs;
}

function post(path: string, fields: Record<string, string>): ActionFunctionArgs {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.set(name, value);
  return {
    request: new Request(`https://app.example${path}`, { method: "POST", body }),
    params: {},
    context: {},
  } as unknown as ActionFunctionArgs;
}

async function thrown(run: () => Promise<unknown>): Promise<Response> {
  try {
    await run();
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
  throw new Error("Expected a Response to be thrown");
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.entitlements.mockResolvedValue(ACTIVE);
  mocks.getReplenishmentDefaults.mockResolvedValue({ ...INITIAL_DEFAULTS, updatedAt: null });
  mocks.getVariantRule.mockResolvedValue({ ...EMPTY_RULE });
});

describe("replenishment settings page", () => {
  const SETTINGS = "/app/replenishment/settings";
  const VALID = {
    defaultMethod: "LAST_X_DAYS",
    sampleDays: "60",
    suggestDays: "21",
    targetQuantity: "",
    incomingSource: "APP_PURCHASE_ORDERS",
    defaultLeadTimeDays: "14",
    roundUpToPackSize: "on",
  };

  it("is refused without a plan that includes replenishment", async () => {
    mocks.entitlements.mockResolvedValue(resolveEntitlements([]));
    expect((await thrown(() => settingsLoader(get(SETTINGS)))).status).toBe(403);
    expect((await thrown(() => settingsAction(post(SETTINGS, VALID)))).status).toBe(403);
    expect(mocks.getReplenishmentDefaults).not.toHaveBeenCalled();
    expect(mocks.saveReplenishmentDefaults).not.toHaveBeenCalled();
  });

  it("opens with the stored defaults, and no custom date range to choose", async () => {
    mocks.getReplenishmentDefaults.mockResolvedValue({
      ...INITIAL_DEFAULTS,
      defaultMethod: "TARGET_STOCK_LEVEL",
      targetQuantity: 40,
      defaultLeadTimeDays: 10,
      applyMinimumOrderQuantity: true,
      updatedAt: new Date("2026-11-01T00:00:00Z"),
    });
    const data = await settingsLoader(get(SETTINGS));
    expect(data.form).toEqual({
      defaultMethod: "TARGET_STOCK_LEVEL",
      sampleDays: "30",
      suggestDays: "30",
      targetQuantity: "40",
      incomingSource: "SHOPIFY_INCOMING",
      defaultLeadTimeDays: "10",
      applyMinimumOrderQuantity: true,
      roundUpToPackSize: false,
    });
    expect(data.methods.map((method) => method.value)).not.toContain("CUSTOM_RANGE");
  });

  it("shows empty fields for the values a shop has not set", async () => {
    const data = await settingsLoader(get(SETTINGS));
    expect(data.form.targetQuantity).toBe("");
    expect(data.form.defaultLeadTimeDays).toBe("");
  });

  it("saves a valid form exactly as entered", async () => {
    await expect(settingsAction(post(SETTINGS, VALID))).resolves.toEqual({ ok: true });
    expect(mocks.saveReplenishmentDefaults).toHaveBeenCalledWith(context.db, {
      defaultMethod: "LAST_X_DAYS",
      sampleDays: 60,
      suggestDays: 21,
      targetQuantity: null,
      incomingSource: "APP_PURCHASE_ORDERS",
      defaultLeadTimeDays: 14,
      applyMinimumOrderQuantity: false,
      roundUpToPackSize: true,
    });
  });

  it("reports each invalid field and saves nothing", async () => {
    const result = await settingsAction(
      post(SETTINGS, {
        ...VALID,
        defaultMethod: "CUSTOM_RANGE",
        sampleDays: "0",
        suggestDays: "1.5",
        defaultLeadTimeDays: "-3",
      }),
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        defaultMethod: expect.any(String),
        sampleDays: expect.any(String),
        suggestDays: expect.any(String),
        defaultLeadTimeDays: expect.any(String),
      },
    });
    expect(mocks.saveReplenishmentDefaults).not.toHaveBeenCalled();
  });

  it("requires a target quantity when the default method is target stock level", async () => {
    const result = await settingsAction(
      post(SETTINGS, { ...VALID, defaultMethod: "TARGET_STOCK_LEVEL" }),
    );
    expect(result).toEqual({ ok: false, errors: { targetQuantity: expect.any(String) } });
  });
});

describe("planning levels route", () => {
  const LEVELS = "/app/replenishment/levels";
  const query = (variantGid: string, scopeKey: string) =>
    `${LEVELS}?${new URLSearchParams({ variantGid, scopeKey })}`;

  it("is refused without a plan that includes replenishment", async () => {
    mocks.entitlements.mockResolvedValue(resolveEntitlements([]));
    expect((await thrown(() => levelsLoader(get(query(VARIANT, "SHOP"))))).status).toBe(403);
    expect(
      (
        await thrown(() =>
          levelsAction(post(LEVELS, { variantGid: VARIANT, scopeKey: "SHOP", minimumQuantity: "4" })),
        )
      ).status,
    ).toBe(403);
    expect(mocks.getVariantRule).not.toHaveBeenCalled();
    expect(mocks.saveVariantRule).not.toHaveBeenCalled();
  });

  it("returns the stored levels for the variant and scope asked for", async () => {
    mocks.getVariantRule.mockResolvedValue({ ...EMPTY_RULE, minimumQuantity: 6, leadTimeDays: 9 });
    await expect(levelsLoader(get(query(VARIANT, LOCATION)))).resolves.toEqual({
      ok: true,
      values: { ...EMPTY_RULE, minimumQuantity: 6, leadTimeDays: 9 },
    });
    expect(mocks.getVariantRule).toHaveBeenCalledWith(context.db, VARIANT, LOCATION);
  });

  it("answers with a message, not an error page, for a variant it cannot read", async () => {
    mocks.getVariantRule.mockRejectedValue(
      new ReplenishmentRuleError("invalid_variant", "Unknown variant"),
    );
    await expect(levelsLoader(get(LEVELS))).resolves.toEqual({
      ok: false,
      message: expect.any(String),
    });
    expect(mocks.getVariantRule).toHaveBeenCalledWith(context.db, "", "");
  });

  it("saves the levels entered, with empty fields as not set", async () => {
    mocks.saveVariantRule.mockResolvedValue("saved");
    await expect(
      levelsAction(
        post(LEVELS, {
          variantGid: VARIANT,
          scopeKey: LOCATION,
          minimumQuantity: "4",
          shelfLimitQuantity: "24",
          reorderPointQuantity: "",
          safetyStockQuantity: "0",
          leadTimeDays: " 7 ",
        }),
      ),
    ).resolves.toEqual({ ok: true, outcome: "saved" });
    expect(mocks.saveVariantRule).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        variantGid: VARIANT,
        scopeKey: LOCATION,
        values: {
          minimumQuantity: 4,
          shelfLimitQuantity: 24,
          reorderPointQuantity: null,
          safetyStockQuantity: 0,
          leadTimeDays: 7,
        },
      }),
    );
  });

  it("reports clearing every level as cleared", async () => {
    mocks.saveVariantRule.mockResolvedValue("cleared");
    await expect(
      levelsAction(post(LEVELS, { variantGid: VARIANT, scopeKey: "SHOP" })),
    ).resolves.toEqual({ ok: true, outcome: "cleared" });
  });

  it("rejects values that are not whole numbers in range, and an unknown variant or scope", async () => {
    const result = await levelsAction(
      post(LEVELS, {
        variantGid: "gid://shopify/Product/11",
        scopeKey: "everywhere",
        minimumQuantity: "-1",
        shelfLimitQuantity: "2.5",
        leadTimeDays: "366",
      }),
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        variantGid: expect.any(String),
        scopeKey: expect.any(String),
        minimumQuantity: expect.any(String),
        shelfLimitQuantity: expect.any(String),
        leadTimeDays: expect.any(String),
      },
    });
    expect(mocks.saveVariantRule).not.toHaveBeenCalled();
  });

  it("tells the merchant when the variant or location has gone from the store", async () => {
    mocks.saveVariantRule.mockRejectedValue(
      new ReplenishmentRuleError("location_not_found", "This location isn't in your synced locations."),
    );
    await expect(
      levelsAction(post(LEVELS, { variantGid: VARIANT, scopeKey: LOCATION, minimumQuantity: "4" })),
    ).resolves.toEqual({
      ok: false,
      errors: {},
      message: "This location isn't in your synced locations.",
    });
  });

  it("lets an unexpected failure through", async () => {
    mocks.saveVariantRule.mockRejectedValue(new Error("connection lost"));
    await expect(
      levelsAction(post(LEVELS, { variantGid: VARIANT, scopeKey: "SHOP", minimumQuantity: "4" })),
    ).rejects.toThrow("connection lost");
  });
});
