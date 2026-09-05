import { describe, expect, it } from "vitest";
import { createMockAdmin } from "../admin-read/__tests__/mock-admin";
import {
  PRODUCT_VARIANT_IDS_PAGE_SIZE,
  listProductVariantGids,
  ProductVariantIdsPaginationError,
} from "./product-variant-ids";

function connection(
  ids: number[],
  hasNextPage: boolean,
  endCursor: string | null,
) {
  return {
    data: {
      product: {
        id: "gid://shopify/Product/1",
        variants: {
          pageInfo: { hasNextPage, endCursor },
          edges: ids.map((id) => ({
            cursor: `c${id}`,
            node: { id: `gid://shopify/ProductVariant/${id}` },
          })),
        },
      },
    },
  };
}

describe("F3 authoritative ProductVariant GID pagination (FX-WH-001)", () => {
  it("pages past the first 100 webhook body identities", async () => {
    const admin = createMockAdmin((_query, variables) => {
      if (variables?.after == null) {
        return connection(
          Array.from({ length: 100 }, (_, index) => index + 1),
          true,
          "c100",
        );
      }
      expect(variables?.after).toBe("c100");
      return connection([101], false, "c101");
    });
    const gids = await listProductVariantGids(
      admin,
      "gid://shopify/Product/1",
    );
    expect(PRODUCT_VARIANT_IDS_PAGE_SIZE).toBe(100);
    expect(gids).toHaveLength(101);
    expect(gids[0]).toBe("gid://shopify/ProductVariant/1");
    expect(gids[100]).toBe("gid://shopify/ProductVariant/101");
    expect(admin.calls).toHaveLength(2);
    expect(admin.calls[0]?.query).toContain("query CatalogFactProductVariantIds");
  });

  it("fails closed when the product read is null", async () => {
    const admin = createMockAdmin(() => ({ data: { product: null } }));
    await expect(
      listProductVariantGids(admin, "gid://shopify/Product/1"),
    ).rejects.toBeInstanceOf(ProductVariantIdsPaginationError);
  });

  it("fails closed on a non-ProductVariant GID", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        product: {
          id: "gid://shopify/Product/1",
          variants: {
            pageInfo: { hasNextPage: false, endCursor: null },
            edges: [{ cursor: "c1", node: { id: "gid://shopify/Product/1" } }],
          },
        },
      },
    }));
    await expect(
      listProductVariantGids(admin, "gid://shopify/Product/1"),
    ).rejects.toThrow(/not a ProductVariant GID/);
  });
});
