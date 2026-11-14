import { describe, expect, it } from "vitest";
import { variantLabel } from "./catalog.server";

describe("variantLabel", () => {
  it("joins product and variant titles the way Shopify's displayName does", () => {
    expect(variantLabel({ productTitle: "Trail Shoe", variantTitle: "Size 9" })).toBe(
      "Trail Shoe - Size 9",
    );
  });

  it("shows only the product for Shopify's default single variant", () => {
    expect(variantLabel({ productTitle: "Gift Box", variantTitle: "Default Title" })).toBe(
      "Gift Box",
    );
    expect(variantLabel({ productTitle: "Gift Box", variantTitle: "" })).toBe("Gift Box");
  });
});
