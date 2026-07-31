/**
 * Phase 1 PR 1 — shop domain normalization (mirrors app/lib/shop-domain.test coverage).
 * Full unit suite lives in app/lib/shop-domain.test.ts; these assert PR1-critical edges.
 */
import { describe, expect, it } from "vitest";
import { normalizeShopDomain } from "../../../app/lib/shop-domain";

describe("tenant backfill — shop domain normalization (PR1 edges)", () => {
  it("accepts 63-char store label and rejects 64", () => {
    const label63 = "a".repeat(63);
    const label64 = "a".repeat(64);
    expect(normalizeShopDomain(`${label63}.myshopify.com`).ok).toBe(true);
    expect(normalizeShopDomain(`${label64}.myshopify.com`)).toEqual({
      ok: false,
      reason: "store_label_too_long",
    });
  });

  it("rejects non-ASCII (Kelvin sign) before lowercasing", () => {
    expect(normalizeShopDomain("acmeK.myshopify.com").ok).toBe(false);
  });

  it("rejects Turkish dotted capital I", () => {
    expect(normalizeShopDomain("acmeİ.myshopify.com").ok).toBe(false);
  });
});
