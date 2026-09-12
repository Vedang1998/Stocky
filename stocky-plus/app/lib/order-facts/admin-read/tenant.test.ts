import { describe, expect, it } from "vitest";
import { readOrderFact } from "./orders";
import { lineNode, orderHeader, TRUSTED_SHOP } from "./__tests__/fixtures";
import { createOrderStoreAdmin } from "./__tests__/order-store-admin";

describe("PR6-B T03 tenant identity", () => {
  it("denies a conflicting client shop header", async () => {
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [lineNode(1)],
      agreements: [],
      refunds: [],
    });
    const request = new Request("https://example.com/app", {
      headers: { "x-shopify-shop-domain": "other.myshopify.com" },
    });
    const result = await readOrderFact(
      { admin, shop: TRUSTED_SHOP, request },
      "gid://shopify/Order/1",
    );
    expect(result.status).toBe("failure");
    if (result.status !== "failure") return;
    expect(result.kind).toBe("TENANT_DENIED");
    expect(admin.calls).toHaveLength(0);
  });

  it("allows a matching client shop header without treating it as authority", async () => {
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [lineNode(1)],
      agreements: [],
      refunds: [],
    });
    const request = new Request("https://example.com/app", {
      headers: { "x-shopify-shop-domain": TRUSTED_SHOP.myshopifyDomain },
    });
    const result = await readOrderFact(
      { admin, shop: TRUSTED_SHOP, request },
      "gid://shopify/Order/1",
    );
    expect(result.status).toBe("complete");
  });
});
