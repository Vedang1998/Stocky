import { describe, expect, it } from "vitest";

import {
  formatShopTime,
  shopDay,
  shopTimeCell,
  shopTimeStamp,
  timeColumn,
  usableTimeZone,
} from "./shop-time";

const AFTERNOON = new Date("2026-11-10T20:45:00.000Z");

describe("usableTimeZone", () => {
  it("keeps a zone this runtime knows", () => {
    expect(usableTimeZone("America/Toronto")).toBe("America/Toronto");
    expect(usableTimeZone(" Asia/Tokyo ")).toBe("Asia/Tokyo");
  });

  it.each([null, undefined, "", "   ", "Mars/Olympus", "not a zone"])(
    "has no zone for %j",
    (zone) => {
      expect(usableTimeZone(zone)).toBeNull();
    },
  );
});

describe("formatShopTime", () => {
  it("gives the time on the shop's clock and names the clock", () => {
    expect(formatShopTime(AFTERNOON, "America/Toronto")).toBe(
      "Nov 10, 2026, 3:45 PM EST",
    );
    expect(formatShopTime(AFTERNOON, "Europe/London")).toBe(
      "Nov 10, 2026, 8:45 PM GMT",
    );
  });

  it("follows the shop's clock through daylight saving time", () => {
    expect(
      formatShopTime(new Date("2026-07-10T20:45:00.000Z"), "America/Toronto"),
    ).toBe("Jul 10, 2026, 4:45 PM EDT");
  });

  it("gives the shop's day when it is not the UTC day", () => {
    expect(
      formatShopTime(new Date("2026-11-11T02:30:00.000Z"), "America/Toronto"),
    ).toBe("Nov 10, 2026, 9:30 PM EST");
    expect(formatShopTime(AFTERNOON, "Asia/Tokyo")).toBe(
      "Nov 11, 2026, 5:45 AM GMT+9",
    );
  });

  it("uses plain spaces only, so the server and the browser write the same text", () => {
    expect(formatShopTime(AFTERNOON, "America/Toronto")).toMatch(
      /^[\x20-\x7e]+$/,
    );
  });

  it("reads a time that arrives as text, as it does in the browser", () => {
    expect(formatShopTime("2026-11-10T20:45:00.000Z", "America/Toronto")).toBe(
      "Nov 10, 2026, 3:45 PM EST",
    );
  });

  it.each([null, undefined, "", "Mars/Olympus"])(
    "gives the time in UTC, and says so, for the zone %j",
    (zone) => {
      expect(formatShopTime(AFTERNOON, zone)).toBe("2026-11-10 20:45 UTC");
    },
  );

  it.each([null, undefined, "", "not a time"])(
    "is empty for the moment %j",
    (value) => {
      expect(formatShopTime(value, "America/Toronto")).toBe("");
      expect(formatShopTime(value, null)).toBe("");
    },
  );
});

describe("shopTimeStamp", () => {
  it("writes the shop's clock as a sortable stamp on a 24-hour clock", () => {
    expect(shopTimeStamp(AFTERNOON, "America/Toronto")).toBe(
      "2026-11-10 15:45",
    );
    expect(shopTimeStamp(AFTERNOON, "Asia/Tokyo")).toBe("2026-11-11 05:45");
  });

  it("writes midnight as 00, not 24", () => {
    expect(
      shopTimeStamp(new Date("2026-11-10T05:00:00.000Z"), "America/Toronto"),
    ).toBe("2026-11-10 00:00");
  });

  it("writes UTC without a usable zone", () => {
    expect(shopTimeStamp(AFTERNOON, null)).toBe("2026-11-10 20:45");
    expect(shopTimeStamp(AFTERNOON, "Mars/Olympus")).toBe("2026-11-10 20:45");
  });

  it("is empty for no moment", () => {
    expect(shopTimeStamp(null, "America/Toronto")).toBe("");
    expect(shopTimeStamp(undefined, null)).toBe("");
  });
});

describe("timeColumn", () => {
  it("names the clock the column's times are on", () => {
    expect(timeColumn("Shipped at", "America/Toronto")).toBe(
      "Shipped at (America/Toronto)",
    );
  });

  it.each([null, undefined, "", "Mars/Olympus"])(
    "says UTC for the zone %j",
    (zone) => {
      expect(timeColumn("Shipped at", zone)).toBe("Shipped at (UTC)");
    },
  );
});

describe("shopTimeCell", () => {
  it("is a stamp on the shop's clock", () => {
    expect(shopTimeCell(AFTERNOON, "America/Toronto")).toBe("2026-11-10 15:45");
  });

  it("is the instant itself without a usable zone, which a CSV file prints in full as UTC", () => {
    expect(shopTimeCell(AFTERNOON, null)).toBe(AFTERNOON);
    expect(shopTimeCell(AFTERNOON, "Mars/Olympus")).toBe(AFTERNOON);
  });

  it("is empty for no moment", () => {
    expect(shopTimeCell(null, "America/Toronto")).toBeNull();
    expect(shopTimeCell(undefined, null)).toBeNull();
  });
});

describe("shopDay", () => {
  const lateEvening = new Date("2026-11-11T02:30:00.000Z");

  it("is the shop's calendar day", () => {
    expect(shopDay(lateEvening, "America/Toronto")).toBe("2026-11-10");
    expect(shopDay(lateEvening, "Asia/Tokyo")).toBe("2026-11-11");
  });

  it("is the UTC day without a usable zone", () => {
    expect(shopDay(lateEvening, null)).toBe("2026-11-11");
  });
});
