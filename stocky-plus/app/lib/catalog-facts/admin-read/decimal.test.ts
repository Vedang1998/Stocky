import { describe, expect, it } from "vitest";
import {
  optionalIsoTimestamp,
  requireIsoTimestamp,
} from "./decimal";

const SHOPIFY_EXAMPLE = "2019-07-16T19:20:30Z";
const OFFSET_EXAMPLE = "2026-08-17T12:00:00-04:00";
const FRACTIONAL_EXAMPLE = "2026-01-01T00:00:00.123Z";

describe("PR5-F2A Shopify DateTime mapping", () => {
  it("accepts RFC3339 / Shopify DateTime strings without rewriting them", () => {
    expect(requireIsoTimestamp(SHOPIFY_EXAMPLE, "createdAt")).toBe(
      SHOPIFY_EXAMPLE,
    );
    expect(requireIsoTimestamp(OFFSET_EXAMPLE, "createdAt")).toBe(OFFSET_EXAMPLE);
    expect(requireIsoTimestamp(FRACTIONAL_EXAMPLE, "createdAt")).toBe(
      FRACTIONAL_EXAMPLE,
    );
    expect(optionalIsoTimestamp(null, "createdAt")).toBeNull();
    expect(optionalIsoTimestamp(SHOPIFY_EXAMPLE, "createdAt")).toBe(
      SHOPIFY_EXAMPLE,
    );
  });

  it("rejects malformed timestamps instead of accepting any string", () => {
    expect(() => requireIsoTimestamp("not-a-date", "product.createdAt")).toThrow(
      /product.createdAt must be a Shopify DateTime \/ RFC3339 timestamp/,
    );
    expect(() => requireIsoTimestamp("2026-01-01", "product.createdAt")).toThrow(
      /Shopify DateTime \/ RFC3339/,
    );
    expect(() => requireIsoTimestamp("2026-02-30T00:00:00Z", "createdAt")).toThrow(
      /Shopify DateTime \/ RFC3339/,
    );
    expect(() => requireIsoTimestamp("", "createdAt")).toThrow(
      /Shopify DateTime \/ RFC3339/,
    );
    expect(() => requireIsoTimestamp(20260101, "createdAt")).toThrow(
      /createdAt must be a string/,
    );
    expect(() => optionalIsoTimestamp({ iso: true }, "createdAt")).toThrow(
      /createdAt must be a string/,
    );
    expect(() => optionalIsoTimestamp(["2026-01-01T00:00:00Z"], "createdAt")).toThrow(
      /createdAt must be a string/,
    );
  });
});
