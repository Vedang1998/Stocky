import { describe, expect, it } from "vitest";
import * as pos from "../../extensions/propo-pos/src/format";
import { formatAge, formatQuantity } from "./stock-format";

const now = Date.parse("2026-11-10T12:00:00.000Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

describe("formatQuantity", () => {
  it("shows unknown quantities as a dash and keeps zero and negatives", () => {
    expect(formatQuantity(null)).toBe("–");
    expect(formatQuantity(0)).toBe("0");
    expect(formatQuantity(-3)).toBe("-3");
  });
});

describe("formatAge", () => {
  it("describes how long ago a time was", () => {
    expect(formatAge(ago(20_000), now)).toBe("just now");
    expect(formatAge(ago(12 * 60_000), now)).toBe("12 min ago");
    expect(formatAge(ago(3 * 3_600_000 + 1), now)).toBe("3 h ago");
    expect(formatAge(ago(106 * 86_400_000), now)).toBe("106 d ago");
  });

  it("treats a time slightly in the future as just now", () => {
    expect(formatAge(ago(-5_000), now)).toBe("just now");
  });

  it("returns nothing for a missing or unreadable time", () => {
    expect(formatAge(null, now)).toBeNull();
    expect(formatAge("not a date", now)).toBeNull();
  });
});

// The admin pages cannot import the POS extension's copy at run time (see
// the import rule in .eslintrc.cjs), so the two are held together here.
describe("admin and POS wording", () => {
  const times = [null, "not a date", ago(0), ago(59_999), ago(60_000), ago(3_600_000), ago(86_400_000 * 9)];

  it.each(times)("describes the age of %s the same way", (iso) => {
    const age = formatAge(iso, now);
    expect(pos.formatLastChange(iso, now)).toBe(age === null ? null : `Changed ${age}`);
  });

  it.each([null, 0, -3, 12])("shows quantity %s the same way", (quantity) => {
    expect(pos.formatQuantity(quantity)).toBe(formatQuantity(quantity));
  });
});
