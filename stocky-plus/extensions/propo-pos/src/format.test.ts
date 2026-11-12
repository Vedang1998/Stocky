import { describe, expect, it } from "vitest";
import { formatLastChange, formatQuantity } from "./format";

const now = Date.parse("2026-11-10T12:00:00.000Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

describe("formatQuantity", () => {
  it("shows unknown quantities as a dash and keeps zero and negatives", () => {
    expect(formatQuantity(null)).toBe("–");
    expect(formatQuantity(0)).toBe("0");
    expect(formatQuantity(-3)).toBe("-3");
  });
});

describe("formatLastChange", () => {
  it("says how long ago the quantity changed", () => {
    expect(formatLastChange(null, now)).toBeNull();
    expect(formatLastChange("not a date", now)).toBeNull();
    expect(formatLastChange(ago(20_000), now)).toBe("Changed just now");
    expect(formatLastChange(ago(12 * 60_000), now)).toBe("Changed 12 min ago");
    expect(formatLastChange(ago(3 * 3_600_000 + 1), now)).toBe("Changed 3 h ago");
    expect(formatLastChange(ago(106 * 86_400_000), now)).toBe("Changed 106 d ago");
  });

  it("treats a timestamp slightly in the future as just now", () => {
    expect(formatLastChange(ago(-5_000), now)).toBe("Changed just now");
  });
});
