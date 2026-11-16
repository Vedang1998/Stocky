import { describe, expect, it } from "vitest";
import {
  formatAdjustmentCursor,
  parseAdjustmentCursor,
  parseUtcDay,
  readAdjustmentHistoryQuery,
} from "./adjustment-history-query";

describe("parseUtcDay", () => {
  it("gives the first and last instant of the day in UTC", () => {
    expect(parseUtcDay("2026-11-11", "start")?.toISOString()).toBe(
      "2026-11-11T00:00:00.000Z",
    );
    expect(parseUtcDay("2026-11-11", "end")?.toISOString()).toBe(
      "2026-11-11T23:59:59.999Z",
    );
  });

  it("accepts a leap day only in a leap year", () => {
    expect(parseUtcDay("2028-02-29", "start")).not.toBeNull();
    expect(parseUtcDay("2026-02-29", "start")).toBeNull();
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
    expect(parseUtcDay(value, "start")).toBeNull();
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
      ),
    ).toEqual({ fromDay: "", toDay: "", from: null, to: null, after: null });
  });
});
