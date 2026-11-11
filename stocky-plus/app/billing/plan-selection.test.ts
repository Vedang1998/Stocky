import { describe, expect, it } from "vitest";
import { buildPlanSelectionUrl } from "./plan-selection";

describe("buildPlanSelectionUrl", () => {
  it("builds the hosted plan selection URL for a canonical shop domain", () => {
    expect(buildPlanSelectionUrl("acme-store.myshopify.com", "propo")).toEqual({
      ok: true,
      url: "https://admin.shopify.com/store/acme-store/charges/propo/pricing_plans",
    });
  });

  it("accepts every character Shopify allows in an app handle", () => {
    const result = buildPlanSelectionUrl(
      "acme.myshopify.com",
      "ProPo_inventory-2",
    );
    expect(result).toEqual({
      ok: true,
      url: "https://admin.shopify.com/store/acme/charges/ProPo_inventory-2/pricing_plans",
    });
  });

  it("keeps both handles as single path segments on admin.shopify.com", () => {
    const result = buildPlanSelectionUrl("acme-1.myshopify.com", "pro-po");
    if (!result.ok) throw new Error(result.reason);

    const url = new URL(result.url);
    expect(url.origin).toBe("https://admin.shopify.com");
    expect(url.pathname.split("/")).toEqual([
      "",
      "store",
      "acme-1",
      "charges",
      "pro-po",
      "pricing_plans",
    ]);
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
  });

  it.each([
    "acme.example.com",
    "myshopify.com",
    ".myshopify.com",
    "acme.myshopify.com.evil.example",
    "evil.example/acme.myshopify.com",
    "sub.acme.myshopify.com",
    "admin.shopify.com",
    "",
  ])("rejects non-myshopify domain %j", (domain) => {
    expect(buildPlanSelectionUrl(domain, "propo")).toEqual({
      ok: false,
      reason: "invalid_shop_domain",
    });
  });

  it.each([
    "https://acme.myshopify.com",
    "acme.myshopify.com/admin",
    "acme.myshopify.com/../../oauth/authorize",
    "acme.myshopify.com?redirect=//evil.example",
    "acme.myshopify.com#fragment",
    "acme.myshopify.com:8443",
    "user@acme.myshopify.com",
    "acme%2F..%2F.myshopify.com",
    "acme\\.myshopify.com",
    "acme.myshopify.com\n",
    " acme.myshopify.com",
    "Acme.myshopify.com",
    "-acme.myshopify.com",
    "ácme.myshopify.com",
  ])("rejects injection attempt or non-canonical domain %j", (domain) => {
    expect(buildPlanSelectionUrl(domain, "propo")).toEqual({
      ok: false,
      reason: "invalid_shop_domain",
    });
  });

  it.each([
    "",
    ".",
    "..",
    "../../settings",
    "propo/pricing_plans",
    "propo?plan=free",
    "propo#x",
    "pro po",
    "propo%2F..",
    "propo\n",
    "própo",
    "a".repeat(257),
  ])("rejects app handle %j", (handle) => {
    expect(buildPlanSelectionUrl("acme.myshopify.com", handle)).toEqual({
      ok: false,
      reason: "invalid_app_handle",
    });
  });
});
