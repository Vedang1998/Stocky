import { describe, expect, it } from "vitest";
import {
  SHOP_DOMAIN_NORMALIZATION_VERSION,
  normalizeShopDomain,
} from "./shop-domain";

describe("phase1-shop-domain-v1 normalization", () => {
  it("identifies normalization version", () => {
    expect(SHOP_DOMAIN_NORMALIZATION_VERSION).toBe("phase1-shop-domain-v1");
  });

  it("normalizes valid domains (trim + lowercase)", () => {
    expect(normalizeShopDomain("  Acme-Store.MyShopify.COM  ")).toEqual({
      ok: true,
      normalized: "acme-store.myshopify.com",
    });
  });

  it("maps case/whitespace equivalents to one canonical domain", () => {
    const a = normalizeShopDomain("Shop-One.myshopify.com");
    const b = normalizeShopDomain("  SHOP-ONE.MYSHOPIFY.COM ");
    expect(a.ok && b.ok && a.normalized === b.normalized).toBe(true);
  });

  it("rejects schemes without stripping", () => {
    expect(normalizeShopDomain("https://acme.myshopify.com").ok).toBe(false);
    expect(normalizeShopDomain("http://acme.myshopify.com").ok).toBe(false);
  });

  it("rejects ports, paths, query, fragment, credentials", () => {
    expect(normalizeShopDomain("acme.myshopify.com:443").ok).toBe(false);
    expect(normalizeShopDomain("acme.myshopify.com/admin").ok).toBe(false);
    expect(normalizeShopDomain("acme.myshopify.com?x=1").ok).toBe(false);
    expect(normalizeShopDomain("acme.myshopify.com#frag").ok).toBe(false);
    expect(normalizeShopDomain("user:pass@acme.myshopify.com").ok).toBe(false);
  });

  it("rejects custom domains, blanks, malformed labels", () => {
    expect(normalizeShopDomain("acme.example.com").ok).toBe(false);
    expect(normalizeShopDomain("").ok).toBe(false);
    expect(normalizeShopDomain("   ").ok).toBe(false);
    expect(normalizeShopDomain("-acme.myshopify.com").ok).toBe(false);
    expect(normalizeShopDomain("acme-.myshopify.com").ok).toBe(false);
    expect(normalizeShopDomain("acme_store.myshopify.com").ok).toBe(false);
    expect(normalizeShopDomain("a.b.myshopify.com").ok).toBe(false);
  });

  it("allows internal hyphens and alphanumerics", () => {
    expect(normalizeShopDomain("a1-b2.myshopify.com")).toEqual({
      ok: true,
      normalized: "a1-b2.myshopify.com",
    });
  });

  it("accepts 63-character store label and rejects 64", () => {
    const label63 = "a".repeat(63);
    const label64 = "a".repeat(64);
    expect(normalizeShopDomain(`${label63}.myshopify.com`)).toEqual({
      ok: true,
      normalized: `${label63}.myshopify.com`,
    });
    expect(normalizeShopDomain(`${label64}.myshopify.com`)).toEqual({
      ok: false,
      reason: "store_label_too_long",
    });
  });

  it("enforces hostname length bound of 253", () => {
    // 253 - ".myshopify.com".length = 253 - 14 = 239 label chars would be max
    // but label max is 63, so hostname max for valid myshopify hosts is 63+14=77.
    // Still reject any pre-normalized trimmed string over 253.
    const overlong = `${"a".repeat(240)}.myshopify.com`;
    expect(overlong.length).toBeGreaterThan(253);
    expect(normalizeShopDomain(overlong)).toEqual({
      ok: false,
      reason: "hostname_too_long",
    });
  });

  it("rejects non-ASCII before lowercasing (Kelvin, Turkish I, controls)", () => {
    expect(normalizeShopDomain("\u212Ashop.myshopify.com")).toEqual({
      ok: false,
      reason: "non_ascii",
    });
    expect(normalizeShopDomain("İstanbul.myshopify.com")).toEqual({
      ok: false,
      reason: "non_ascii",
    });
    expect(normalizeShopDomain("ıstanbul.myshopify.com")).toEqual({
      ok: false,
      reason: "non_ascii",
    });
    expect(normalizeShopDomain("café.myshopify.com")).toEqual({
      ok: false,
      reason: "non_ascii",
    });
    expect(normalizeShopDomain("shop\u0000.myshopify.com").ok).toBe(false);
  });
});
