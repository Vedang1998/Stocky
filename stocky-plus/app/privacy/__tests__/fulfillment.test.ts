import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptPrivacyArtifact,
  encryptPrivacyArtifact,
  parsePrivacyArtifactKey,
} from "../artifact-crypto.server";
import { PrivacyBoundaryError } from "../errors.server";
import { privacyRequestVisibleToShop } from "../fulfillment.server";

/** Synthetic fixture only. Default `npm test` does not inherit vitest.privacy.config env. */
const FIXTURE_ARTIFACT_KEY =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ZERO_ARTIFACT_KEY =
  "0000000000000000000000000000000000000000000000000000000000000000";
const BINDING = {
  shopId: "shop-a",
  canonicalDomain: "a.myshopify.com",
  requestId: "req-1",
};

describe("data-request artifact AEAD (B0-03)", () => {
  let previousKey: string | undefined;

  beforeEach(() => {
    previousKey = process.env.STOCKY_PRIVACY_ARTIFACT_KEY;
    process.env.STOCKY_PRIVACY_ARTIFACT_KEY = FIXTURE_ARTIFACT_KEY;
  });

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.STOCKY_PRIVACY_ARTIFACT_KEY;
    } else {
      process.env.STOCKY_PRIVACY_ARTIFACT_KEY = previousKey;
    }
  });

  it("round-trips plaintext and does not store it in the ciphertext (positive)", () => {
    const plaintext = JSON.stringify({ shop: "a.myshopify.com", keys: [1] });
    const stored = encryptPrivacyArtifact(plaintext, BINDING);
    expect(stored[0]).toBe(2);
    expect(stored.subarray(1 + 12 + 16).equals(Buffer.from(plaintext, "utf8"))).toBe(
      false,
    );
    expect(decryptPrivacyArtifact(stored, BINDING).toString("utf8")).toBe(
      plaintext,
    );
  });

  it("tampered ciphertext fails closed (negative)", () => {
    const stored = encryptPrivacyArtifact("secret-payload", BINDING);
    stored[stored.length - 1] ^= 0xff;
    expect(() => decryptPrivacyArtifact(stored, BINDING)).toThrow(
      PrivacyBoundaryError,
    );
  });

  it("foreign shop AAD fails closed (bypass)", () => {
    const stored = encryptPrivacyArtifact("secret-payload", BINDING);
    expect(() =>
      decryptPrivacyArtifact(stored, { ...BINDING, shopId: "shop-b" }),
    ).toThrow(PrivacyBoundaryError);
  });

  it("all-zero artifact key is rejected (bypass)", () => {
    process.env.STOCKY_PRIVACY_ARTIFACT_KEY = ZERO_ARTIFACT_KEY;
    expect(() => parsePrivacyArtifactKey()).toThrow(PrivacyBoundaryError);
  });

  it("missing key fails closed (bypass)", () => {
    delete process.env.STOCKY_PRIVACY_ARTIFACT_KEY;
    let thrown: unknown;
    try {
      parsePrivacyArtifactKey();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ code: "artifact_key_missing" });
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
