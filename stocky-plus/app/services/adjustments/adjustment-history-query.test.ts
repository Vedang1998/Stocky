import { describe, expect, it } from "vitest";
import {
  formatAdjustmentCursor,
  parseAdjustmentCursor,
  parseDay,
  readAdjustmentHistoryQuery,
} from "./adjustment-history-query";

describe("parseDay", () => {
  const edges = (day: string, timeZone: string | null) =>
    (["start", "end"] as const).map((edge) =>
      parseDay(day, edge, timeZone)?.toISOString(),
    );

  it("gives the first and last instant of the day in UTC when the shop's zone is not known", () => {
    expect(edges("2026-11-11", null)).toEqual([
      "2026-11-11T00:00:00.000Z",
      "2026-11-11T23:59:59.999Z",
    ]);
  });

  it("gives the first and last instant of the day on the shop's clock", () => {
    // Toronto is five hours behind UTC in November.
    expect(edges("2026-11-11", "America/Toronto")).toEqual([
      "2026-11-11T05:00:00.000Z",
      "2026-11-12T04:59:59.999Z",
    ]);
    // Tokyo is nine hours ahead, so its day starts on the UTC day before.
    expect(edges("2026-11-11", "Asia/Tokyo")).toEqual([
      "2026-11-10T15:00:00.000Z",
      "2026-11-11T14:59:59.999Z",
    ]);
  });

  it("follows the clock change: a 25-hour and a 23-hour day", () => {
    // Clocks go back in Toronto on 1 November 2026 and forward on 8 March.
    expect(edges("2026-11-01", "America/Toronto")).toEqual([
      "2026-11-01T04:00:00.000Z",
      "2026-11-02T04:59:59.999Z",
    ]);
    expect(edges("2026-03-08", "America/Toronto")).toEqual([
      "2026-03-08T05:00:00.000Z",
      "2026-03-09T03:59:59.999Z",
    ]);
  });

  it("accepts a leap day only in a leap year", () => {
    for (const timeZone of [null, "America/Toronto"]) {
      expect(parseDay("2028-02-29", "start", timeZone)).not.toBeNull();
      expect(parseDay("2026-02-29", "start", timeZone)).toBeNull();
    }
  });

  it.each([
    null,
    "",
    "2026-13-01",
    "2026-02-31",
    "2026-1-1",
    "11/11/2026",
    "2026-11-11T00:00:00Z",
    "2026-11-11'; DROP TABLE x;--",
  ])("refuses %j", (value) => {
    expect(parseDay(value, "start", null)).toBeNull();
    expect(parseDay(value, "end", "America/Toronto")).toBeNull();
  });
});

describe("adjustment cursor", () => {
  const cursor = {
    createdAt: new Date("2026-11-11T21:40:05.123Z"),
    operationId: "cmabc123",
  };

  it("survives a round trip through a URL", () => {
    const params = new URLSearchParams({
      after: formatAdjustmentCursor(cursor),
    });
    expect(parseAdjustmentCursor(params.get("after"))).toEqual(cursor);
  });

  it.each([null, "", "garbage", "~id", "2026-11-11T21:40:05.123Z~", "nope~id"])(
    "refuses %j",
    (value) => {
      expect(parseAdjustmentCursor(value)).toBeNull();
    },
  );

  it("refuses an identifier longer than any the app issues", () => {
    expect(
      parseAdjustmentCursor(`2026-11-11T21:40:05.123Z~${"x".repeat(65)}`),
    ).toBeNull();
  });
});

describe("readAdjustmentHistoryQuery", () => {
  it("reads the period and the cursor", () => {
    const query = readAdjustmentHistoryQuery(
      new URLSearchParams(
        "from=2026-11-01&to=2026-11-30&after=2026-11-11T21:40:05.123Z~cmabc",
      ),
      null,
    );
    expect(query).toEqual({
      fromDay: "2026-11-01",
      toDay: "2026-11-30",
      from: new Date("2026-11-01T00:00:00.000Z"),
      to: new Date("2026-11-30T23:59:59.999Z"),
      after: {
        createdAt: new Date("2026-11-11T21:40:05.123Z"),
        operationId: "cmabc",
      },
    });
  });

  it("drops values it cannot read instead of echoing them back", () => {
    expect(
      readAdjustmentHistoryQuery(
        new URLSearchParams('from="><script>&to=tomorrow&after=x'),
        "America/Toronto",
      ),
    ).toEqual({ fromDay: "", toDay: "", from: null, to: null, after: null });
  });

  it("reads the period as days on the shop's clock", () => {
    const query = readAdjustmentHistoryQuery(
      new URLSearchParams("from=2026-11-01&to=2026-11-30"),
      "America/Toronto",
    );

    expect(query).toMatchObject({
      fromDay: "2026-11-01",
      toDay: "2026-11-30",
      from: new Date("2026-11-01T04:00:00.000Z"),
      to: new Date("2026-12-01T04:59:59.999Z"),
    });
  });
});
