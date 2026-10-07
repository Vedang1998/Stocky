import { describe, expect, it } from "vitest";
import { replayRequestDigestAgrees } from "../../rbac/replay-digest.server";

describe("platform replay digest (B0-05)", () => {
  it("identical digests agree (positive)", () => {
    expect(replayRequestDigestAgrees("abc123", "abc123")).toBe(true);
  });

  it("different digest of equal length is rejected (negative)", () => {
    expect(replayRequestDigestAgrees("abc123", "abc124")).toBe(false);
  });

  it("different lengths cannot be coerced into agreement (bypass)", () => {
    expect(replayRequestDigestAgrees("abc", "abcdef")).toBe(false);
    expect(replayRequestDigestAgrees("", "x")).toBe(false);
  });
});
