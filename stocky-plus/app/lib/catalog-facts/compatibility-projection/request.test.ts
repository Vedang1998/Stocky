import { describe, expect, it } from "vitest";
import type { TenantAuthority } from "../../../tenant/authority.server";
import { CANONICAL_HEALTH_DECISION, CANONICAL_PROJECTION_STATE_WRITE } from "./constants";
import { projectCompatibilityFromCanonicalFacts } from "./project";
import type { CompatibilityProjectionResult } from "./types";

const fakeAuthority = {
  shopId: "shop_placeholder",
  myshopifyDomain: "placeholder.myshopify.com",
  source: "verified_job",
  correlationId: "corr",
} as TenantAuthority;

function assertNoMerchantHealthAuthorization(
  result: CompatibilityProjectionResult,
) {
  expect(result).not.toHaveProperty("recommendedCanonicalProjectionState");
  expect(result.canonicalHealthDecision).toBe(CANONICAL_HEALTH_DECISION);
  expect(result.canonicalHealthDecision).toBe("deferred_to_integration");
  expect(result.canonicalCompatibilityProjectionStateWrite).toBe(
    CANONICAL_PROJECTION_STATE_WRITE,
  );
  const json = JSON.stringify(result);
  expect(json).not.toMatch(/"HEALTHY"/);
  expect(json).not.toMatch(/recommendedCanonicalProjectionState/);
}

describe("compatibility projection request contract", () => {
  it("denies merchant writes without calling TenantDb when processingEnabled is false", async () => {
    const result = await projectCompatibilityFromCanonicalFacts({
      authority: fakeAuthority,
      processingEnabled: false,
      mode: "identities",
      identities: [{ kind: "ProductVariant", shopifyGid: "gid://shopify/ProductVariant/1" }],
    });
    expect(result.status).toBe("DENIED_PROCESSING_DISABLED");
    expect(result.retryable).toBe(false);
    expect(result.canonicalFactsUnchanged).toBe(true);
    assertNoMerchantHealthAuthorization(result);
    expect(result.failure?.retryable).toBe(false);
  });

  it("returns an explicit non-retryable failure for an out-of-range batch limit", async () => {
    const result = await projectCompatibilityFromCanonicalFacts({
      authority: fakeAuthority,
      processingEnabled: true,
      limit: 101,
      mode: "shop_rebuild",
    });
    expect(result.status).toBe("FAILED");
    expect(result.retryable).toBe(false);
    expect(result.failure?.code).toBe("invalid_batch_limit");
    expect(result.poisonHalt).toBeUndefined();
    assertNoMerchantHealthAuthorization(result);
  });

  it("rejects a malformed rebuild cursor before opening TenantDb", async () => {
    const result = await projectCompatibilityFromCanonicalFacts({
      authority: fakeAuthority,
      processingEnabled: true,
      mode: "shop_rebuild",
      cursor: { phase: "variants", afterGid: 123 } as never,
    });
    expect(result.status).toBe("FAILED");
    expect(result.retryable).toBe(false);
    expect(result.failure?.code).toBe("invalid_rebuild_cursor");
    expect(result.failure?.retryable).toBe(false);
    expect(result.poisonHalt).toBeUndefined();
    assertNoMerchantHealthAuthorization(result);
  });

  it("rejects a partial inventory_levels cursor as non-retryable", async () => {
    const result = await projectCompatibilityFromCanonicalFacts({
      authority: fakeAuthority,
      processingEnabled: true,
      mode: "shop_rebuild",
      cursor: {
        phase: "inventory_levels",
        afterItemGid: "gid://shopify/InventoryItem/1",
      } as never,
    });
    expect(result.status).toBe("FAILED");
    expect(result.retryable).toBe(false);
    expect(result.failure?.code).toBe("invalid_rebuild_cursor");
    assertNoMerchantHealthAuthorization(result);
  });
});
