import { describe, expect, it } from "vitest";
import type { TenantAuthority } from "../../../tenant/authority.server";
import { CANONICAL_PROJECTION_STATE_WRITE } from "./constants";
import { projectCompatibilityFromCanonicalFacts } from "./project";

const fakeAuthority = {
  shopId: "shop_placeholder",
  myshopifyDomain: "placeholder.myshopify.com",
  source: "verified_job",
  correlationId: "corr",
} as TenantAuthority;

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
    expect(result.canonicalCompatibilityProjectionStateWrite).toBe(
      CANONICAL_PROJECTION_STATE_WRITE,
    );
    expect(result.recommendedCanonicalProjectionState).toBe("DEGRADED");
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
    expect(result.canonicalCompatibilityProjectionStateWrite).toBe(
      CANONICAL_PROJECTION_STATE_WRITE,
    );
  });
});
