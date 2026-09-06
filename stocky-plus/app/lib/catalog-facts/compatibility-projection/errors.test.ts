import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  classifyProjectionFailure,
  CompatibilityProjectionError,
} from "./errors";

describe("classifyProjectionFailure", () => {
  it("preserves explicit CompatibilityProjectionError retryability and identity", () => {
    const retryable = classifyProjectionFailure(
      new CompatibilityProjectionError("canonical_variant_missing", "gone", {
        retryable: true,
        identity: {
          kind: "ProductVariant",
          shopifyGid: "gid://shopify/ProductVariant/1",
        },
      }),
    );
    expect(retryable).toMatchObject({
      code: "canonical_variant_missing",
      retryable: true,
      identity: {
        kind: "ProductVariant",
        shopifyGid: "gid://shopify/ProductVariant/1",
      },
    });

    const poison = classifyProjectionFailure(
      new CompatibilityProjectionError(
        "canonical_multiple_live_inventory_items",
        "ambiguous",
        { retryable: false },
      ),
    );
    expect(poison.retryable).toBe(false);
    expect(poison.code).toBe("canonical_multiple_live_inventory_items");
  });

  it("classifies Prisma validation errors as non-retryable permanent request defects", () => {
    const error = new Prisma.PrismaClientValidationError("invalid query", {
      clientVersion: "test",
    });
    expect(classifyProjectionFailure(error)).toEqual({
      code: "projection_permanent_request_failed",
      message: "invalid query",
      retryable: false,
    });
  });

  it("classifies Prisma unique-constraint errors as non-retryable permanent request defects", () => {
    const error = new Prisma.PrismaClientKnownRequestError("unique", {
      code: "P2002",
      clientVersion: "test",
    });
    expect(classifyProjectionFailure(error)).toEqual({
      code: "projection_permanent_request_failed",
      message: "unique",
      retryable: false,
    });
  });

  it("classifies reviewed Prisma connectivity codes as retryable transients", () => {
    const error = new Prisma.PrismaClientKnownRequestError("timeout", {
      code: "P2024",
      clientVersion: "test",
    });
    expect(classifyProjectionFailure(error)).toEqual({
      code: "projection_transient_write_failed",
      message: "timeout",
      retryable: true,
    });
  });

  it("defaults unknown errors to non-retryable", () => {
    expect(classifyProjectionFailure(new Error("boom"))).toEqual({
      code: "projection_unclassified_failure",
      message: "boom",
      retryable: false,
    });
    expect(classifyProjectionFailure("string-throw")).toEqual({
      code: "projection_unclassified_failure",
      message: "string-throw",
      retryable: false,
    });
  });
});
