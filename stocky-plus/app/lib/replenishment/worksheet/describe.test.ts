import { describe, expect, it } from "vitest";
import {
  describeMethod,
  describeSelection,
  formatInstant,
  formatLocalDate,
  marginAndMarkup,
  revenuePerDay,
} from "./describe";

describe("describeMethod", () => {
  it.each([
    [
      { method: "LAST_X_DAYS", sampleDays: 30, suggestDays: 1 } as const,
      "Sales from the last 30 days, to cover 1 day",
    ],
    [
      {
        method: "CUSTOM_RANGE",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        suggestDays: 21,
      } as const,
      "Sales from Oct 1, 2026 to Oct 31, 2026, to cover 21 days",
    ],
    [
      { method: "SAME_PERIOD_LAST_YEAR", suggestDays: 45 } as const,
      "Sales from the same 45 days last year",
    ],
    [{ method: "FILL_SHELVES" } as const, "Fill shelves to each variant's shelf limit"],
    [
      { method: "TARGET_STOCK_LEVEL", targetQuantity: 1200 } as const,
      "Bring every variant to 1,200 in stock",
    ],
  ])("describes %o", (params, text) => {
    expect(describeMethod(params)).toBe(text);
  });
});

describe("describeSelection", () => {
  it("names each restriction, or says there is none", () => {
    expect(describeSelection({ vendor: null, productType: null }, null)).toBe("All products");
    expect(describeSelection({ vendor: "Acme", productType: "Wine" }, "Acme Wines")).toBe(
      "Vendor: Acme, Type: Wine, Supplier: Acme Wines",
    );
  });
});

describe("dates", () => {
  it("shows a shop-local date without shifting it by the server's zone", () => {
    expect(formatLocalDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(formatLocalDate("2026-12-31")).toBe("Dec 31, 2026");
  });

  it("shows an instant in the shop's time zone", () => {
    const instant = new Date("2026-11-10T03:30:00Z");
    expect(formatInstant(instant, "America/New_York")).toMatch(/^Nov 9, 2026, 10:30\sPM$/);
    expect(formatInstant(instant, "Asia/Tokyo")).toMatch(/^Nov 10, 2026, 12:30\sPM$/);
  });
});

describe("marginAndMarkup", () => {
  it("computes both from price and cost", () => {
    expect(marginAndMarkup("20", "8.5")).toEqual({ margin: "57.5", markup: "135.3" });
    expect(marginAndMarkup("19.99", "19.99")).toEqual({ margin: "0.0", markup: "0.0" });
  });

  it("shows a loss as negative", () => {
    expect(marginAndMarkup("8", "10")).toEqual({ margin: "-25.0", markup: "-20.0" });
  });

  it("leaves out a percentage whose base is zero", () => {
    expect(marginAndMarkup("0", "5")).toEqual({ margin: null, markup: "-100.0" });
    expect(marginAndMarkup("5", "0")).toEqual({ margin: "100.0", markup: null });
  });

  it("returns nothing when either amount is missing or not a number", () => {
    expect(marginAndMarkup(null, "5")).toEqual({ margin: null, markup: null });
    expect(marginAndMarkup("5", "1e3")).toEqual({ margin: null, markup: null });
  });
});

describe("revenuePerDay", () => {
  it("divides net sales by the days in the sales period, to the cent", () => {
    expect(revenuePerDay("600", 30)).toBe("20.00");
    expect(revenuePerDay("1199.40", 7)).toBe("171.34");
    expect(revenuePerDay("-12.5", 5)).toBe("-2.50");
  });

  it("returns nothing without a sales figure or a usable period", () => {
    expect(revenuePerDay(null, 30)).toBeNull();
    expect(revenuePerDay("600", null)).toBeNull();
    expect(revenuePerDay("600", 0)).toBeNull();
    expect(revenuePerDay("600", 1.5)).toBeNull();
  });
});
