import { describe, expect, it } from "vitest";
import { signedShopMatches } from "./signed-webhook-shop";

const SHOP = "example-shop.myshopify.com";

describe("signedShopMatches", () => {
  it("accepts a body that names the header's shop", () => {
    expect(
      signedShopMatches({ id: 1, myshopify_domain: SHOP }, "myshopify_domain", SHOP),
    ).toBe(true);
    expect(
      signedShopMatches({ shop_id: 1, shop_domain: SHOP }, "shop_domain", SHOP),
    ).toBe(true);
  });

  it("compares normalized domains", () => {
    expect(
      signedShopMatches(
        { myshopify_domain: "Example-Shop.myshopify.com" },
        "myshopify_domain",
        SHOP,
      ),
    ).toBe(true);
  });

  it("rejects a body that names another shop", () => {
    expect(
      signedShopMatches(
        { myshopify_domain: "other-shop.myshopify.com" },
        "myshopify_domain",
        SHOP,
      ),
    ).toBe(false);
  });

  it("reads only the field it was asked for", () => {
    expect(
      signedShopMatches({ shop_domain: SHOP }, "myshopify_domain", SHOP),
    ).toBe(false);
    expect(
      signedShopMatches({ myshopify_domain: SHOP }, "shop_domain", SHOP),
    ).toBe(false);
  });

  it.each([
    ["no such field", { id: 7001, title: "A product" }],
    ["a null field", { myshopify_domain: null }],
    ["a non-string field", { myshopify_domain: [SHOP] }],
    ["an empty field", { myshopify_domain: "" }],
    ["a custom domain", { myshopify_domain: "shop.example.com" }],
    ["a URL", { myshopify_domain: `https://${SHOP}` }],
    ["an array body", [{ myshopify_domain: SHOP }]],
    ["a string body", SHOP],
    ["a null body", null],
    ["no body", undefined],
  ])("rejects %s", (_case, payload) => {
    expect(signedShopMatches(payload, "myshopify_domain", SHOP)).toBe(false);
  });

  it("rejects a header that is not a shop domain", () => {
    expect(
      signedShopMatches(
        { myshopify_domain: "shop.example.com" },
        "myshopify_domain",
        "shop.example.com",
      ),
    ).toBe(false);
  });
});
