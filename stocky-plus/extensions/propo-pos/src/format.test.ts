import { describe, expect, it } from "vitest";
import { STALE_AFTER_MS, formatObservedAt, formatQuantity, isStale } from "./format";

const now = Date.parse("2026-11-10T12:00:00.000Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

describe("formatQuantity", () => {
  it("shows unknown quantities as a dash and keeps zero and negatives", () => {
    expect(formatQuantity(null)).toBe("–");
    expect(formatQuantity(0)).toBe("0");
    expect(formatQuantity(-3)).toBe("-3");
  });
});

describe("formatObservedAt", () => {
  it("describes the age of a quantity", () => {
    expect(formatObservedAt(null, now)).toBeNull();
    expect(formatObservedAt("not a date", now)).toBeNull();
    expect(formatObservedAt(ago(20_000), now)).toBe("Updated just now");
    expect(formatObservedAt(ago(12 * 60_000), now)).toBe("Updated 12 min ago");
    expect(formatObservedAt(ago(3 * 3_600_000 + 1), now)).toBe("Updated 3 h ago");
    expect(formatObservedAt(ago(4 * 86_400_000), now)).toBe("Updated 4 d ago");
  });

  it("treats a timestamp slightly in the future as just now", () => {
    expect(formatObservedAt(ago(-5_000), now)).toBe("Updated just now");
  });
});

describe("isStale", () => {
  it("flags quantities older than the threshold only", () => {
    expect(isStale(ago(STALE_AFTER_MS + 1), now)).toBe(true);
    expect(isStale(ago(STALE_AFTER_MS - 1), now)).toBe(false);
    expect(isStale(null, now)).toBe(false);
  });
});
