import { describe, expect, it } from "vitest";
import { erasureErrorCode, retryDelayMs } from "./erasure.server";

describe("erasure retry policy", () => {
  it("backs off from one minute to six hours", () => {
    expect([1, 2, 3, 4, 5, 6, 40].map(retryDelayMs)).toEqual([
      60_000,
      300_000,
      1_800_000,
      7_200_000,
      21_600_000,
      21_600_000,
      21_600_000,
    ]);
    expect(retryDelayMs(0)).toBe(60_000);
  });

  it("names database refusals and keeps other errors free of detail", () => {
    expect(
      erasureErrorCode(
        new Error("stocky_privacy_erasure_refused: shop is not marked REDACTED"),
      ),
    ).toBe("erasure_refused");
    expect(
      erasureErrorCode(
        new Error(
          'stocky_privacy_erasure_stalled: rows in "Supplier" are still referenced',
        ),
      ),
    ).toBe("erasure_stalled");
    expect(
      erasureErrorCode(Object.assign(new Error("timeout"), { code: "P2024" })),
    ).toBe("error_P2024");
    expect(
      erasureErrorCode(
        Object.assign(new Error("x"), { code: "postgres://user:pw@host/db" }),
      ),
    ).toBe("unexpected_error");
    expect(erasureErrorCode("connection lost")).toBe("unexpected_error");
  });
});
