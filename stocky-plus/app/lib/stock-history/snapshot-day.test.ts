import { describe, expect, it } from "vitest";
import {
  CAPTURE_WINDOW_MS,
  RETENTION_DAYS,
  oldestRetainedDate,
  snapshotDayDue,
} from "./snapshot-day";

const NEW_YORK = "America/New_York";
const AUCKLAND = "Pacific/Auckland";

describe("snapshotDayDue", () => {
  it("is due for the day that just ended in the shop's time zone", () => {
    // 00:05 on 20 Nov in New York (UTC-5).
    expect(snapshotDayDue(new Date("2026-11-20T05:05:00Z"), NEW_YORK)).toEqual({
      localDate: "2026-11-19",
      dayEndedAt: new Date("2026-11-20T05:00:00Z"),
    });
  });

  it("gives shops in different zones different days at the same instant", () => {
    const now = new Date("2026-11-19T11:30:00Z");
    // 00:30 on 20 Nov in Auckland (UTC+13): the 19th has just ended there.
    expect(snapshotDayDue(now, AUCKLAND)).toEqual({
      localDate: "2026-11-19",
      dayEndedAt: new Date("2026-11-19T11:00:00Z"),
    });
    // 06:30 on 19 Nov in New York: the 18th ended six and a half hours ago.
    expect(snapshotDayDue(now, NEW_YORK)).toBeNull();
  });

  it("is due at the instant the day ends and until the window closes", () => {
    const dayEnd = new Date("2026-11-20T05:00:00Z").getTime();
    expect(snapshotDayDue(new Date(dayEnd), NEW_YORK)?.localDate).toBe(
      "2026-11-19",
    );
    expect(
      snapshotDayDue(new Date(dayEnd + CAPTURE_WINDOW_MS), NEW_YORK)?.localDate,
    ).toBe("2026-11-19");
    expect(
      snapshotDayDue(new Date(dayEnd + CAPTURE_WINDOW_MS + 1), NEW_YORK),
    ).toBeNull();
  });

  it("is not due for the day still running", () => {
    // 23:59:59.999 on 19 Nov in New York: the 18th ended almost a day ago.
    expect(snapshotDayDue(new Date("2026-11-20T04:59:59.999Z"), NEW_YORK))
      .toBeNull();
  });

  it("follows daylight saving changes", () => {
    // Clocks went back on 1 Nov 2026 in New York; the 1st lasted 25 hours and
    // ended at 05:00 UTC, not 04:00.
    expect(snapshotDayDue(new Date("2026-11-02T04:30:00Z"), NEW_YORK))
      .toBeNull();
    expect(snapshotDayDue(new Date("2026-11-02T05:30:00Z"), NEW_YORK)).toEqual({
      localDate: "2026-11-01",
      dayEndedAt: new Date("2026-11-02T05:00:00Z"),
    });
    // Clocks went forward on 8 Mar 2026; the 8th lasted 23 hours.
    expect(snapshotDayDue(new Date("2026-03-09T04:10:00Z"), NEW_YORK)).toEqual({
      localDate: "2026-03-08",
      dayEndedAt: new Date("2026-03-09T04:00:00Z"),
    });
  });

  it("crosses month and year ends", () => {
    expect(
      snapshotDayDue(new Date("2027-01-01T05:10:00Z"), NEW_YORK)?.localDate,
    ).toBe("2026-12-31");
    expect(
      snapshotDayDue(new Date("2028-03-01T05:10:00Z"), NEW_YORK)?.localDate,
    ).toBe("2028-02-29");
  });
});

describe("oldestRetainedDate", () => {
  it("keeps the newest day and the days before it, 400 in all", () => {
    expect(RETENTION_DAYS).toBe(400);
    expect(oldestRetainedDate("2026-11-19")).toBe("2025-10-16");
  });
});
