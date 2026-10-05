import { describe, expect, it } from "vitest";
import {
  decryptPrivacyArtifact,
  encryptPrivacyArtifact,
  parsePrivacyArtifactKey,
} from "../artifact-crypto.server";
import { PrivacyBoundaryError } from "../errors.server";
import { privacyRequestVisibleToShop } from "../fulfillment.server";

describe("data-request artifact AEAD (B0-03)", () => {
  it("round-trips plaintext and does not store it in the ciphertext (positive)", () => {
    const plaintext = JSON.stringify({ shop: "a.myshopify.com", keys: [1] });
    const stored = encryptPrivacyArtifact(plaintext);
    expect(stored[0]).toBe(1);
    expect(stored.subarray(1 + 12 + 16).equals(Buffer.from(plaintext, "utf8"))).toBe(
      false,
    );
    expect(decryptPrivacyArtifact(stored).toString("utf8")).toBe(plaintext);
  });

  it("tampered ciphertext fails closed (negative)", () => {
    const stored = encryptPrivacyArtifact("secret-payload");
    stored[stored.length - 1] ^= 0xff;
    expect(() => decryptPrivacyArtifact(stored)).toThrow(PrivacyBoundaryError);
  });

  it("missing key fails closed (bypass)", () => {
    const previous = process.env.STOCKY_PRIVACY_ARTIFACT_KEY;
    delete process.env.STOCKY_PRIVACY_ARTIFACT_KEY;
    try {
      let thrown: unknown;
      try {
        parsePrivacyArtifactKey();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toMatchObject({ code: "artifact_key_missing" });
    } finally {
      if (previous !== undefined) {
        process.env.STOCKY_PRIVACY_ARTIFACT_KEY = previous;
      }
    }
  });
});

describe("data-request shop bind (B0-02)", () => {
  const request = {
    targetShopId: "shop-a",
    canonicalDomain: "a.myshopify.com",
    topic: "customers/data_request",
  };

  it("same shop and domain are visible (positive)", () => {
    expect(
      privacyRequestVisibleToShop(request, {
        shopId: "shop-a",
        canonicalDomain: "a.myshopify.com",
      }),
    ).toBe(true);
  });

  it("foreign shop id is indistinguishable from missing (negative)", () => {
    expect(
      privacyRequestVisibleToShop(request, {
        shopId: "shop-b",
        canonicalDomain: "a.myshopify.com",
      }),
    ).toBe(false);
    expect(
      privacyRequestVisibleToShop(null, {
        shopId: "shop-a",
        canonicalDomain: "a.myshopify.com",
      }),
    ).toBe(false);
  });

  it("foreign domain or non-data_request topic is denied (bypass)", () => {
    expect(
      privacyRequestVisibleToShop(request, {
        shopId: "shop-a",
        canonicalDomain: "b.myshopify.com",
      }),
    ).toBe(false);
    expect(
      privacyRequestVisibleToShop(
        { ...request, topic: "customers/redact" },
        { shopId: "shop-a", canonicalDomain: "a.myshopify.com" },
      ),
    ).toBe(false);
  });
});
