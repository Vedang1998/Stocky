import { describe, expect, it } from "vitest";
import {
  optionalIsoTimestamp,
  optionalSignedGraphqlInt,
  requireIsoTimestamp,
  requireNonnegativeGraphqlInt,
} from "./decimal";

const SHOPIFY_EXAMPLE = "2019-07-16T19:20:30Z";
const OFFSET_EXAMPLE = "2026-08-17T12:00:00-04:00";
const FRACTIONAL_EXAMPLE = "2026-01-01T00:00:00.123Z";

describe("PR6-B Shopify DateTime mapping", () => {
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

describe("PR6-B GraphQL Int mapping", () => {
  it("accepts nonnegative LineItem-style counts and rejects negatives", () => {
    expect(requireNonnegativeGraphqlInt(0, "lineItem.quantity")).toBe(0);
    expect(requireNonnegativeGraphqlInt(10, "lineItem.quantity")).toBe(10);
    expect(() => requireNonnegativeGraphqlInt(-1, "lineItem.quantity")).toThrow(
      /nonnegative GraphQL Int/,
    );
    expect(() =>
      requireNonnegativeGraphqlInt(2_147_483_648, "lineItem.quantity"),
    ).toThrow(/outside the GraphQL Int range/);
  });

  it("keeps Sale.quantity signed and nullable without abs()", () => {
    expect(optionalSignedGraphqlInt(null, "sale.quantity")).toBeNull();
    expect(optionalSignedGraphqlInt(-2, "sale.quantity")).toBe(-2);
    expect(optionalSignedGraphqlInt(3, "sale.quantity")).toBe(3);
  });
});
