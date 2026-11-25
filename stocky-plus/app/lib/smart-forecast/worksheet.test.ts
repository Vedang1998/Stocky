/**
 * The Smart Forecast column on a worksheet page: when it reads anything, and
 * that each row gets its own forecast from one history read.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveEntitlements } from "../../billing/entitlements";
import { addDays, type LocalDate } from "../replenishment/local-date";
import type { TenantDb } from "../../tenant/tenant-db.server";

const mocks = vi.hoisted(() => ({ loadDemandHistories: vi.fn() }));
vi.mock("./history.server", () => ({ loadDemandHistories: mocks.loadDemandHistories }));

import { smartForecastBasis, smartForecastColumn } from "./worksheet.server";

function plan(handle: string, name: string) {
  return resolveEntitlements([
    {
      id: "gid://shopify/AppSubscription/1",
      name,
      status: "ACTIVE",
      planHandle: handle,
      createdAt: "2026-10-02T00:00:00Z",
      trialEndsAt: null,
      currentPeriodEnd: "2026-12-01T00:00:00Z",
      endsAtPeriodEnd: false,
      billingInterval: "EVERY_30_DAYS",
      price: { amount: "149.0", currencyCode: "USD" },
    },
  ]);
}

const PRO = plan("pro", "Pro");
const ESSENTIALS = plan("essentials", "Essentials");
const db = {} as TenantDb;

const WORKSHEET = {
  asOfLocalDate: "2026-11-14",
  timeZone: "America/New_York",
  settings: { params: { method: "LAST_X_DAYS", sampleDays: 28, suggestDays: 14 } },
  summary: { currencyCode: "USD" },
} as unknown as Parameters<typeof smartForecastColumn>[1]["worksheet"];

const ROWS = [
  { id: "row-a", variantGid: "gid://shopify/ProductVariant/1", availableQuantity: 5, incomingQuantity: 0 },
  { id: "row-b", variantGid: "gid://shopify/ProductVariant/2", availableQuantity: 0, incomingQuantity: null },
];

/** `perDay` units every day for `length` days ending on Nov 13. */
function days(length: number, perDay: number) {
  const end = "2026-11-13" as LocalDate;
  return Array.from({ length }, (_, index) => ({
    date: addDays(end, index - length + 1),
    units: perDay,
    inStock: null,
  }));
}

function input(overrides: Partial<Parameters<typeof smartForecastColumn>[1]> = {}) {
  return {
    shown: true,
    entitlements: PRO,
    worksheet: WORKSHEET,
    rows: ROWS,
    shopCurrencyCode: "USD",
    installedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.loadDemandHistories.mockReset();
  mocks.loadDemandHistories.mockResolvedValue({
    startLocalDate: "2026-07-07",
    byVariant: new Map([
      [ROWS[0].variantGid, days(130, 2)],
      [ROWS[1].variantGid, days(130, 1)],
    ]),
  });
});

describe("smartForecastBasis", () => {
  it("measures a Last X days worksheet against its own period, up to the day before it", () => {
    expect(smartForecastBasis(WORKSHEET)).toEqual({
      horizonDays: 14,
      averageDays: 28,
      endLocalDate: "2026-11-13",
      timeZone: "America/New_York",
    });
  });

  it("has no basis for other methods", () => {
    expect(
      smartForecastBasis({ ...WORKSHEET, settings: { params: { method: "FILL_SHELVES" } } } as never),
    ).toBeNull();
    expect(smartForecastBasis({ ...WORKSHEET, settings: null })).toBeNull();
  });
});

describe("smartForecastColumn", () => {
  it("reads nothing when the column is not shown", async () => {
    expect(await smartForecastColumn(db, input({ shown: false }))).toEqual({ status: "OFF" });
    expect(mocks.loadDemandHistories).not.toHaveBeenCalled();
  });

  it("reads nothing for a shop without the Pro plan", async () => {
    expect(await smartForecastColumn(db, input({ entitlements: ESSENTIALS }))).toEqual({
      status: "PLAN",
    });
    expect(mocks.loadDemandHistories).not.toHaveBeenCalled();
  });

  it("reads nothing for a worksheet made with another method", async () => {
    const worksheet = { ...WORKSHEET, settings: { params: { method: "TARGET_STOCK_LEVEL" } } };
    expect(await smartForecastColumn(db, input({ worksheet: worksheet as never }))).toEqual({
      status: "METHOD",
    });
    expect(mocks.loadDemandHistories).not.toHaveBeenCalled();
  });

  it("forecasts every row on the page from one history read", async () => {
    const column = await smartForecastColumn(db, input());
    expect(mocks.loadDemandHistories).toHaveBeenCalledTimes(1);
    expect(mocks.loadDemandHistories).toHaveBeenCalledWith(db, {
      variantGids: [ROWS[0].variantGid, ROWS[1].variantGid],
      endLocalDate: "2026-11-13",
      horizonDays: 14,
      averageDays: 28,
      timeZone: "America/New_York",
      currencyCode: "USD",
      installedAt: null,
    });
    // Steady demand: nothing beats the recent average, so it is kept.
    expect(column).toEqual({
      status: "OK",
      byRow: {
        "row-a": {
          outcome: "KEPT_NO_IMPROVEMENT",
          label: "Recent average (the worksheet's method)",
          forecastUnits: "28.00",
        },
        "row-b": {
          outcome: "KEPT_NO_IMPROVEMENT",
          label: "Recent average (the worksheet's method)",
          forecastUnits: "14.00",
        },
      },
    });
  });
});
