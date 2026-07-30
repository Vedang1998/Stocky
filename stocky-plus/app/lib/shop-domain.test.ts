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
});
