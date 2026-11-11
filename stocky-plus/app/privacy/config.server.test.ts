import { describe, expect, it } from "vitest";
import {
  resolvePrivacyIntervalMs,
  resolveUninstalledRetentionDays,
} from "./config.server";

describe("privacy configuration", () => {
  it("keeps uninstalled shops for 30 days unless configured", () => {
    expect(resolveUninstalledRetentionDays({})).toBe(30);
    expect(
      resolveUninstalledRetentionDays({
        PRIVACY_UNINSTALLED_RETENTION_DAYS: " ",
      }),
    ).toBe(30);
    expect(
      resolveUninstalledRetentionDays({
        PRIVACY_UNINSTALLED_RETENTION_DAYS: "7",
      }),
    ).toBe(7);
    expect(
      resolveUninstalledRetentionDays({
        PRIVACY_UNINSTALLED_RETENTION_DAYS: "365",
      }),
    ).toBe(365);
  });

  it("refuses a retention value it cannot honour instead of falling back", () => {
    for (const value of ["0", "366", "-5", "30.5", "thirty", "1e2", "30d"]) {
      expect(() =>
        resolveUninstalledRetentionDays({
          PRIVACY_UNINSTALLED_RETENTION_DAYS: value,
        }),
      ).toThrow(/PRIVACY_UNINSTALLED_RETENTION_DAYS/);
    }
  });

  it("runs every minute by default and can be switched off", () => {
    expect(resolvePrivacyIntervalMs({})).toBe(60_000);
    expect(resolvePrivacyIntervalMs({ STOCKY_PRIVACY_INTERVAL_MS: "0" })).toBe(
      0,
    );
    expect(() =>
      resolvePrivacyIntervalMs({ STOCKY_PRIVACY_INTERVAL_MS: "soon" }),
    ).toThrow(/STOCKY_PRIVACY_INTERVAL_MS/);
  });
});
