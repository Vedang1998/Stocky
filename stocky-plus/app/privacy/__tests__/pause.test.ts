import { describe, expect, it } from "vitest";
import { isPrivacyPauseEnabled } from "../pause.server";

describe("FEATURE_PR7_PRIVACY_PAUSE", () => {
  it("defaults off", () => {
    expect(isPrivacyPauseEnabled({})).toBe(false);
  });

  it("honors true/1/yes", () => {
    expect(isPrivacyPauseEnabled({ FEATURE_PR7_PRIVACY_PAUSE: "true" })).toBe(
      true,
    );
    expect(isPrivacyPauseEnabled({ FEATURE_PR7_PRIVACY_PAUSE: "1" })).toBe(true);
    expect(isPrivacyPauseEnabled({ FEATURE_PR7_PRIVACY_PAUSE: "yes" })).toBe(
      true,
    );
  });

  it("does not treat other values as enabled (negative)", () => {
    expect(isPrivacyPauseEnabled({ FEATURE_PR7_PRIVACY_PAUSE: "on" })).toBe(
      false,
    );
  });
});
