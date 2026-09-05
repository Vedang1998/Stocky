import { describe, expect, it } from "vitest";
import {
  compareUnsignedCountToken,
  validateUnsignedCountToken,
} from "./counts";

describe("F3 unsigned completeness count tokens", () => {
  it.each(["0", "1", "18446744073709551615"])(
    "accepts canonical digit token %s",
    (token) => {
      expect(validateUnsignedCountToken(token)).toEqual({ ok: true, token });
    },
  );

  it.each([null, undefined, "", " 1", "+1", "-1", "1.0", "1e3"])(
    "F-CLAUDE-PR5F3EC-02 fails closed on omitted/non-conforming token %s",
    (token) => {
      expect(validateUnsignedCountToken(token)).toMatchObject({
        ok: false,
        reason: "count_token_missing_or_malformed",
      });
    },
  );

  it("compares exact decimal strings without Number conversion", () => {
    expect(
      compareUnsignedCountToken("9007199254740993", 9007199254740993n),
    ).toEqual({ ok: true });
  });

  it("does not normalize a leading-zero drift token", () => {
    expect(compareUnsignedCountToken("01", 1n)).toEqual({
      ok: false,
      expected: "01",
      observed: "1",
    });
  });
});
