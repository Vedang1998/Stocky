import { describe, expect, it } from "vitest";
import {
  DEFAULT_TENANT_INDEX_LOCK_TIMEOUT_MS,
  DEFAULT_TENANT_INDEX_STATEMENT_TIMEOUT_MS,
  formatPostgresTimeoutMs,
  parsePositiveBoundedTimeoutMs,
  resolveLockTimeoutMs,
  resolveStatementTimeoutMs,
} from "../timeouts";

describe("tenant index timeout configuration", () => {
  it("uses documented defaults when unset", () => {
    expect(resolveStatementTimeoutMs({})).toBe(
      DEFAULT_TENANT_INDEX_STATEMENT_TIMEOUT_MS,
    );
    expect(resolveLockTimeoutMs({})).toBe(DEFAULT_TENANT_INDEX_LOCK_TIMEOUT_MS);
  });

  it("accepts positive bounded integers", () => {
    expect(
      resolveStatementTimeoutMs({ TENANT_INDEX_STATEMENT_TIMEOUT_MS: "60000" }),
    ).toBe(60_000);
    expect(
      resolveLockTimeoutMs({ TENANT_INDEX_LOCK_TIMEOUT_MS: "3000" }),
    ).toBe(3_000);
  });

  it("rejects zero, negative, non-integer, and over-max values", () => {
    expect(() =>
      parsePositiveBoundedTimeoutMs("0", "TENANT_INDEX_STATEMENT_TIMEOUT_MS", 1, 10),
    ).toThrow(/positive integer/);
    expect(() =>
      parsePositiveBoundedTimeoutMs("-1", "TENANT_INDEX_STATEMENT_TIMEOUT_MS", 1, 10),
    ).toThrow(/positive integer/);
    expect(() =>
      parsePositiveBoundedTimeoutMs("1.5", "TENANT_INDEX_STATEMENT_TIMEOUT_MS", 1, 10),
    ).toThrow(/positive integer/);
    expect(() =>
      parsePositiveBoundedTimeoutMs("abc", "TENANT_INDEX_STATEMENT_TIMEOUT_MS", 1, 10),
    ).toThrow(/positive integer/);
    expect(() =>
      resolveStatementTimeoutMs({
        TENANT_INDEX_STATEMENT_TIMEOUT_MS: "999999999",
      }),
    ).toThrow(/exceeds maximum/);
  });

  it("formats PostgreSQL timeout literals", () => {
    expect(formatPostgresTimeoutMs(5000)).toBe("5000ms");
  });
});
