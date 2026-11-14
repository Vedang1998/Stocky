import { describe, expect, it } from "vitest";
import { AnalyticsPrerequisiteError } from "./errors";
import {
  MAX_LOCAL_RANGE_DAYS,
  ShopCalendarError,
  addLocalDays,
  assertLocalRange,
  diffLocalDays,
  enumerateLocalDates,
  isLocalDate,
  localDateOf,
  localRangeToUtc,
  requireShopTimeZone,
  startOfLocalDay,
} from "./shop-calendar";

const HOUR = 3_600_000;

describe("requireShopTimeZone", () => {
  it("accepts IANA zones and trims whitespace", () => {
    expect(requireShopTimeZone(" America/New_York ")).toBe("America/New_York");
    expect(requireShopTimeZone("Asia/Kolkata")).toBe("Asia/Kolkata");
  });

  it.each([null, undefined, "", "   "])("fails closed on a missing zone (%j)", (zone) => {
    expect(() => requireShopTimeZone(zone)).toThrowError(AnalyticsPrerequisiteError);
  });

  it("fails closed on an unknown zone instead of falling back to UTC", () => {
    try {
      requireShopTimeZone("Mars/Olympus_Mons");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AnalyticsPrerequisiteError);
      expect((error as AnalyticsPrerequisiteError).missing).toBe("shop_timezone");
    }
  });
});

describe("local dates", () => {
  it("validates real calendar dates only", () => {
    expect(isLocalDate("2026-02-28")).toBe(true);
    expect(isLocalDate("2028-02-29")).toBe(true);
    expect(isLocalDate("2026-02-29")).toBe(false);
    expect(isLocalDate("2026-13-01")).toBe(false);
    expect(isLocalDate("2026-1-01")).toBe(false);
    expect(isLocalDate(20260101)).toBe(false);
  });

  it("adds and diffs days across month, year and leap boundaries", () => {
    expect(addLocalDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addLocalDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addLocalDays("2026-11-10", -55)).toBe("2026-09-16");
    expect(diffLocalDays("2026-09-16", "2026-11-10")).toBe(55);
    expect(diffLocalDays("2026-11-10", "2026-09-16")).toBe(-55);
  });

  it("rejects fractional offsets and malformed input", () => {
    expect(() => addLocalDays("2026-01-01", 1.5)).toThrowError(ShopCalendarError);
    expect(() => addLocalDays("01/02/2026", 1)).toThrowError(ShopCalendarError);
  });

  it("enumerates inclusive ranges and bounds their length", () => {
    expect(enumerateLocalDates("2026-02-27", "2026-03-02")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
    expect(() => assertLocalRange("2026-03-02", "2026-03-01")).toThrowError(
      ShopCalendarError,
    );
    const tooLongEnd = addLocalDays("2020-01-01", MAX_LOCAL_RANGE_DAYS);
    try {
      assertLocalRange("2020-01-01", tooLongEnd);
      expect.unreachable();
    } catch (error) {
      expect((error as ShopCalendarError).code).toBe("range_too_long");
    }
  });
});

describe("localDateOf", () => {
  it("uses the shop zone, not UTC", () => {
    const instant = new Date("2026-03-01T04:30:00Z");
    expect(localDateOf(instant, "America/New_York")).toBe("2026-02-28");
    expect(localDateOf(instant, "UTC")).toBe("2026-03-01");
    expect(localDateOf(instant, "Asia/Tokyo")).toBe("2026-03-01");
  });

  it("handles half-hour and extreme offsets", () => {
    const instant = new Date("2026-06-30T18:45:00Z");
    expect(localDateOf(instant, "Asia/Kolkata")).toBe("2026-07-01");
    expect(localDateOf(instant, "Pacific/Kiritimati")).toBe("2026-07-01");
    expect(localDateOf(instant, "Pacific/Pago_Pago")).toBe("2026-06-30");
  });
});

describe("startOfLocalDay", () => {
  it("returns local midnight on an ordinary day", () => {
    expect(startOfLocalDay("2026-07-15", "America/New_York").toISOString()).toBe(
      "2026-07-15T04:00:00.000Z",
    );
    expect(startOfLocalDay("2026-07-15", "Asia/Kolkata").toISOString()).toBe(
      "2026-07-14T18:30:00.000Z",
    );
  });

  it("produces a 23-hour day at spring-forward and a 25-hour day at fall-back", () => {
    const zone = "America/New_York";
    const springLength =
      startOfLocalDay("2026-03-09", zone).getTime() -
      startOfLocalDay("2026-03-08", zone).getTime();
    expect(springLength).toBe(23 * HOUR);
    const fallLength =
      startOfLocalDay("2026-11-02", zone).getTime() -
      startOfLocalDay("2026-11-01", zone).getTime();
    expect(fallLength).toBe(25 * HOUR);
  });

  it("finds the first instant of a day whose local midnight does not exist", () => {
    // Cuba springs forward at 00:00 local, so 2026-03-08 begins at 01:00 CDT.
    const start = startOfLocalDay("2026-03-08", "America/Havana");
    expect(start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(localDateOf(new Date(start.getTime() - 1), "America/Havana")).toBe(
      "2026-03-07",
    );
    expect(localDateOf(start, "America/Havana")).toBe("2026-03-08");
  });

  it("handles a 30-minute DST shift", () => {
    const zone = "Australia/Lord_Howe";
    const length =
      startOfLocalDay("2026-10-05", zone).getTime() -
      startOfLocalDay("2026-10-04", zone).getTime();
    expect(length).toBe(23.5 * HOUR);
  });
});

describe("localRangeToUtc", () => {
  it("covers the inclusive local range with an exclusive UTC end", () => {
    const range = localRangeToUtc("2026-11-01", "2026-11-01", "America/New_York");
    expect(range.startUtc.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(range.endUtcExclusive.toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });

  it("assigns every instant in the range to a date inside it", () => {
    const zone = "Europe/London";
    const range = localRangeToUtc("2026-03-28", "2026-03-30", zone);
    for (
      let t = range.startUtc.getTime();
      t < range.endUtcExclusive.getTime();
      t += HOUR / 2
    ) {
      const date = localDateOf(new Date(t), zone);
      expect(date >= "2026-03-28" && date <= "2026-03-30").toBe(true);
    }
    expect(localDateOf(new Date(range.startUtc.getTime() - 1), zone)).toBe("2026-03-27");
    expect(localDateOf(range.endUtcExclusive, zone)).toBe("2026-03-31");
  });
});
