import { describe, expect, it } from "vitest";
import {
  addDays,
  addYears,
  daysBetween,
  inclusiveDayCount,
  isLocalDate,
} from "./local-date";
import { ceil, compare, div, mul, rational, sub, toFixed } from "./rational";
import {
  sampleWindowFor,
  suggestDaysFor,
  validateMethodParameters,
} from "./windows";

describe("local dates", () => {
  it("accepts real calendar dates only", () => {
    expect(isLocalDate("2024-02-29")).toBe(true);
    expect(isLocalDate("2025-02-29")).toBe(false);
    expect(isLocalDate("2026-13-01")).toBe(false);
    expect(isLocalDate("2026-1-01")).toBe(false);
    expect(isLocalDate("2026-11-10T00:00:00Z")).toBe(false);
    expect(isLocalDate(20261110)).toBe(false);
  });

  it("adds days across month, year and DST boundaries", () => {
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09"); // US DST starts 2026-03-08
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02"); // US DST ends 2026-11-01
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(() => addDays("2026-03-01", 1.5)).toThrow();
  });

  it("counts days", () => {
    expect(daysBetween("2026-11-01", "2026-11-10")).toBe(9);
    expect(daysBetween("2026-11-10", "2026-11-01")).toBe(-9);
    expect(inclusiveDayCount("2026-11-10", "2026-11-10")).toBe(1);
    expect(inclusiveDayCount("2024-01-01", "2024-12-31")).toBe(366);
  });

  it("moves 29 February to 28 February in a non-leap year", () => {
    expect(addYears("2024-02-29", -1)).toBe("2023-02-28");
    expect(addYears("2024-02-29", 4)).toBe("2028-02-29");
    expect(addYears("2026-11-10", -1)).toBe("2025-11-10");
  });
});

describe("rational arithmetic", () => {
  it("stays exact", () => {
    const third = rational(1, 3);
    expect(compare(mul(third, rational(3)), rational(1))).toBe(0);
    expect(toFixed(sub(rational(1, 10), rational(3, 10)), 2)).toBe("-0.20");
    expect(div(rational(14), rational(7))).toEqual({ num: 2n, den: 1n });
  });

  it("normalizes sign into the numerator", () => {
    expect(rational(3, -6)).toEqual({ num: -1n, den: 2n });
    expect(() => rational(1, 0)).toThrow();
  });

  it("rounds up correctly for positive, negative and whole values", () => {
    expect(ceil(rational(5, 3))).toBe(2n);
    expect(ceil(rational(-5, 3))).toBe(-1n);
    expect(ceil(rational(6, 3))).toBe(2n);
    expect(ceil(rational(0))).toBe(0n);
  });

  it("formats half away from zero and never prints negative zero", () => {
    expect(toFixed(rational(1, 8), 2)).toBe("0.13");
    expect(toFixed(rational(-1, 8), 2)).toBe("-0.13");
    expect(toFixed(rational(-1, 1000), 2)).toBe("0.00");
    expect(toFixed(rational(2, 3), 4)).toBe("0.6667");
    expect(toFixed(rational(1234567, 1), 0)).toBe("1234567");
    expect(toFixed(rational(1, 3), 0)).toBe("0");
  });

  it("refuses unsafe inputs instead of losing precision", () => {
    expect(() => rational(Number.MAX_SAFE_INTEGER + 1)).toThrow(/safe integer/);
    expect(() => rational(0.5)).toThrow(/safe integer/);
  });
});

describe("sample windows", () => {
  it("uses the complete days before the run date for Last X days", () => {
    expect(
      sampleWindowFor(
        { method: "LAST_X_DAYS", sampleDays: 30, suggestDays: 14 },
        "2026-11-10",
      ),
    ).toEqual({
      start: "2026-10-11",
      end: "2026-11-09",
      days: 30,
    });
    expect(
      sampleWindowFor(
        { method: "LAST_X_DAYS", sampleDays: 1, suggestDays: 1 },
        "2026-01-01",
      ),
    ).toEqual({
      start: "2025-12-31",
      end: "2025-12-31",
      days: 1,
    });
  });

  it("starts same period last year on the run date a year earlier", () => {
    expect(
      sampleWindowFor(
        { method: "SAME_PERIOD_LAST_YEAR", suggestDays: 7 },
        "2024-02-29",
      ),
    ).toEqual({
      start: "2023-02-28",
      end: "2023-03-06",
      days: 7,
    });
  });

  it("has no window for stock-level methods", () => {
    expect(
      sampleWindowFor({ method: "FILL_SHELVES" }, "2026-11-10"),
    ).toBeNull();
    expect(
      sampleWindowFor(
        { method: "TARGET_STOCK_LEVEL", targetQuantity: 5 },
        "2026-11-10",
      ),
    ).toBeNull();
    expect(suggestDaysFor({ method: "FILL_SHELVES_IF_BELOW_MIN" })).toBeNull();
    expect(
      suggestDaysFor({
        method: "CUSTOM_RANGE",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
        suggestDays: 9,
      }),
    ).toBe(9);
  });
});

describe("parameter validation", () => {
  const asOf = "2026-11-10";

  it("accepts sensible parameters", () => {
    expect(
      validateMethodParameters(
        { method: "LAST_X_DAYS", sampleDays: 30, suggestDays: 14 },
        asOf,
      ),
    ).toEqual([]);
    expect(
      validateMethodParameters(
        {
          method: "CUSTOM_RANGE",
          startDate: "2026-11-01",
          endDate: "2026-11-10",
          suggestDays: 5,
        },
        asOf,
      ),
    ).toEqual([]);
    expect(
      validateMethodParameters(
        { method: "TARGET_STOCK_LEVEL", targetQuantity: 0 },
        asOf,
      ),
    ).toEqual([]);
  });

  it("rejects out-of-range and fractional day counts", () => {
    const errors = validateMethodParameters(
      { method: "LAST_X_DAYS", sampleDays: 0, suggestDays: 2.5 },
      asOf,
    );
    expect(errors.map((e) => e.field)).toEqual(["sampleDays", "suggestDays"]);
    expect(
      validateMethodParameters(
        { method: "SAME_PERIOD_LAST_YEAR", suggestDays: 366 },
        asOf,
      ),
    ).toHaveLength(1);
    expect(
      validateMethodParameters(
        { method: "LAST_X_DAYS", sampleDays: 731, suggestDays: 1 },
        asOf,
      ),
    ).toHaveLength(1);
  });

  it("rejects backwards, future and invalid custom ranges", () => {
    const backwards = validateMethodParameters(
      {
        method: "CUSTOM_RANGE",
        startDate: "2026-11-05",
        endDate: "2026-11-01",
        suggestDays: 5,
      },
      asOf,
    );
    expect(backwards).toEqual([
      {
        field: "endDate",
        message: "End date must be on or after the start date.",
      },
    ]);

    const future = validateMethodParameters(
      {
        method: "CUSTOM_RANGE",
        startDate: "2026-11-05",
        endDate: "2026-11-11",
        suggestDays: 5,
      },
      asOf,
    );
    expect(future).toEqual([
      { field: "endDate", message: "End date cannot be in the future." },
    ]);

    const invalid = validateMethodParameters(
      {
        method: "CUSTOM_RANGE",
        startDate: "2026-02-30",
        endDate: "x",
        suggestDays: 5,
      },
      asOf,
    );
    expect(invalid.map((e) => e.field)).toEqual(["startDate", "endDate"]);

    const tooLong = validateMethodParameters(
      {
        method: "CUSTOM_RANGE",
        startDate: "2024-01-01",
        endDate: "2026-11-10",
        suggestDays: 5,
      },
      asOf,
    );
    expect(tooLong.map((e) => e.field)).toEqual(["startDate"]);
  });

  it("rejects negative and fractional targets", () => {
    expect(
      validateMethodParameters(
        { method: "TARGET_STOCK_LEVEL", targetQuantity: -1 },
        asOf,
      ),
    ).toHaveLength(1);
    expect(
      validateMethodParameters(
        { method: "TARGET_STOCK_LEVEL", targetQuantity: 1.5 },
        asOf,
      ),
    ).toHaveLength(1);
  });
});
