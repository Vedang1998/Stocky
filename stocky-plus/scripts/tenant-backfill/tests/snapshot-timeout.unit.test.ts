/**
 * Starting-snapshot timeout configuration (F-F04).
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_STARTING_SNAPSHOT_TIMEOUT_MS,
  MAX_STARTING_SNAPSHOT_TIMEOUT_MS,
  MIN_STARTING_SNAPSHOT_TIMEOUT_MS,
  resolveStartingSnapshotTimeoutMs,
} from "../starting-snapshot";

describe("TENANT_STARTING_SNAPSHOT_TIMEOUT_MS (F-F04)", () => {
  it("returns the documented safe default when unset", () => {
    expect(resolveStartingSnapshotTimeoutMs({})).toBe(
      DEFAULT_STARTING_SNAPSHOT_TIMEOUT_MS,
    );
    expect(resolveStartingSnapshotTimeoutMs({ TENANT_STARTING_SNAPSHOT_TIMEOUT_MS: "" })).toBe(
      DEFAULT_STARTING_SNAPSHOT_TIMEOUT_MS,
    );
  });

  it("accepts strict integers within documented bounds", () => {
    expect(
      resolveStartingSnapshotTimeoutMs({
        TENANT_STARTING_SNAPSHOT_TIMEOUT_MS: String(MIN_STARTING_SNAPSHOT_TIMEOUT_MS),
      }),
    ).toBe(MIN_STARTING_SNAPSHOT_TIMEOUT_MS);
    expect(
      resolveStartingSnapshotTimeoutMs({
        TENANT_STARTING_SNAPSHOT_TIMEOUT_MS: String(MAX_STARTING_SNAPSHOT_TIMEOUT_MS),
      }),
    ).toBe(MAX_STARTING_SNAPSHOT_TIMEOUT_MS);
    expect(
      resolveStartingSnapshotTimeoutMs({
        TENANT_STARTING_SNAPSHOT_TIMEOUT_MS: "60000",
      }),
    ).toBe(60_000);
  });

  it("fails closed on non-integer values before any transaction opens", () => {
    expect(() =>
      resolveStartingSnapshotTimeoutMs({
        TENANT_STARTING_SNAPSHOT_TIMEOUT_MS: "180000.5",
      }),
    ).toThrow(/strict integer/);
    expect(() =>
      resolveStartingSnapshotTimeoutMs({
        TENANT_STARTING_SNAPSHOT_TIMEOUT_MS: "abc",
      }),
    ).toThrow(/strict integer/);
    expect(() =>
      resolveStartingSnapshotTimeoutMs({
        TENANT_STARTING_SNAPSHOT_TIMEOUT_MS: "-1",
      }),
    ).toThrow(/strict integer/);
  });

  it("fails closed when outside accepted bounds", () => {
    expect(() =>
      resolveStartingSnapshotTimeoutMs({
        TENANT_STARTING_SNAPSHOT_TIMEOUT_MS: String(
          MIN_STARTING_SNAPSHOT_TIMEOUT_MS - 1,
        ),
      }),
    ).toThrow(/outside accepted bounds/);
    expect(() =>
      resolveStartingSnapshotTimeoutMs({
        TENANT_STARTING_SNAPSHOT_TIMEOUT_MS: String(
          MAX_STARTING_SNAPSHOT_TIMEOUT_MS + 1,
        ),
      }),
    ).toThrow(/outside accepted bounds/);
  });
});
