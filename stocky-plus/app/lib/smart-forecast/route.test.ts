/**
 * The Smart Forecast route with storage replaced: who may run it, which
 * worksheets it runs on, and that it only reads.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import { resolveEntitlements } from "../../billing/entitlements";
import { addDays, type LocalDate } from "../replenishment/local-date";

const mocks = vi.hoisted(() => ({
  entitlements: vi.fn(),
  getWorksheet: vi.fn(),
  getWorksheetLine: vi.fn(),
  loadDemandHistory: vi.fn(),
  profile: vi.fn(),
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
vi.mock("../replenishment/worksheet/store.server", () => ({
  getWorksheet: mocks.getWorksheet,
  getWorksheetLine: mocks.getWorksheetLine,
}));
vi.mock("./history.server", () => ({ loadDemandHistory: mocks.loadDemandHistory }));
vi.mock("../../tenant/bootstrap.server", () => ({
  readShopReportingProfile: mocks.profile,
}));

import { loader } from "../../routes/app.replenishment_.smart-forecast";

function plan(handle: string, name: string) {
  return resolveEntitlements([
    {
      id: "gid://shopify/AppSubscription/1",
      name,
      status: "ACTIVE",
      planHandle: handle,
      createdAt: "2026-10-02T00:00:00Z",
      currentPeriodEnd: "2026-12-01T00:00:00Z",
      trialDays: 0,
      billingInterval: "EVERY_30_DAYS",
      price: { amount: "149.0", currencyCode: "USD" },
    },
  ]);
}

const PRO = plan("pro", "Pro");
const ESSENTIALS = plan("essentials", "Essentials");

const WORKSHEET = {
  id: "ws-1",
  asOfLocalDate: "2026-11-14" as LocalDate,
  timeZone: "America/New_York",
  settings: { params: { method: "LAST_X_DAYS", sampleDays: 28, suggestDays: 14 } },
  summary: { currencyCode: "USD" },
};
const LINE = {
  id: "line-1",
  variantGid: "gid://shopify/ProductVariant/11",
  availableQuantity: 5,
  incomingQuantity: 2,
};

function get(query: Record<string, string>): LoaderFunctionArgs {
  return {
    request: new Request(
      `https://app.example/app/replenishment/smart-forecast?${new URLSearchParams(query)}`,
    ),
    params: {},
    context: {},
  } as unknown as LoaderFunctionArgs;
}

const QUERY = { worksheetId: "ws-1", lineId: "line-1" };

/** A steady two units a day for `length` days ending on Nov 13. */
function steadyDays(length: number) {
  const end = "2026-11-13" as LocalDate;
  return Array.from({ length }, (_, index) => ({
    date: addDays(end, index - length + 1),
    units: 2,
    inStock: null,
  }));
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.entitlements.mockResolvedValue(PRO);
  mocks.getWorksheet.mockResolvedValue(WORKSHEET);
  mocks.getWorksheetLine.mockResolvedValue(LINE);
  mocks.profile.mockResolvedValue({ currencyCode: "USD", installedAt: null });
  mocks.loadDemandHistory.mockResolvedValue({ days: steadyDays(130), startLocalDate: null });
});

describe("Smart Forecast route", () => {
  it("tells a shop without the Pro plan and reads nothing", async () => {
    mocks.entitlements.mockResolvedValue(ESSENTIALS);
    const result = await loader(get(QUERY));
    expect(result).toEqual({
      ok: false,
      reason: "PLAN",
      message: "Smart Forecast is included in the Pro plan.",
    });
    expect(mocks.getWorksheet).not.toHaveBeenCalled();
    expect(mocks.loadDemandHistory).not.toHaveBeenCalled();
  });

  it("says when the worksheet or the row is gone", async () => {
    mocks.getWorksheetLine.mockResolvedValue(null);
    expect(await loader(get(QUERY))).toMatchObject({ ok: false, reason: "UNAVAILABLE" });
    mocks.getWorksheet.mockResolvedValue(null);
    expect(await loader(get({}))).toMatchObject({ ok: false, reason: "UNAVAILABLE" });
    expect(mocks.getWorksheet).toHaveBeenLastCalledWith(context.db, "");
    expect(mocks.loadDemandHistory).not.toHaveBeenCalled();
  });

  it("looks the row up inside the requested worksheet", async () => {
    await loader(get(QUERY));
    expect(mocks.getWorksheet).toHaveBeenCalledWith(context.db, "ws-1");
    expect(mocks.getWorksheetLine).toHaveBeenCalledWith(context.db, "ws-1", "line-1");
  });

  it.each([
    { method: "CUSTOM_RANGE", startDate: "2026-10-01", endDate: "2026-10-31", suggestDays: 14 },
    { method: "SAME_PERIOD_LAST_YEAR", suggestDays: 14 },
    { method: "FILL_SHELVES" },
  ])("is not offered on a $method worksheet", async (params) => {
    mocks.getWorksheet.mockResolvedValue({ ...WORKSHEET, settings: { params } });
    expect(await loader(get(QUERY))).toMatchObject({ ok: false, reason: "METHOD" });
    expect(mocks.loadDemandHistory).not.toHaveBeenCalled();
  });

  it("forecasts from the worksheet's own days and stock", async () => {
    const result = await loader(get(QUERY));
    expect(mocks.loadDemandHistory).toHaveBeenCalledWith(context.db, {
      variantGid: LINE.variantGid,
      endLocalDate: "2026-11-13",
      horizonDays: 14,
      averageDays: 28,
      timeZone: "America/New_York",
      currencyCode: "USD",
      installedAt: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.historyDays).toBe(130);
    // Steady demand: nothing beats the recent average, so it is kept.
    expect(result.forecast.outcome).toBe("KEPT_NO_IMPROVEMENT");
    expect(result.forecast.forecastUnits).toBe("28.00");
    expect(result.forecast.suggestedQuantity).toBe(28 - 5 - 2);
  });
});
