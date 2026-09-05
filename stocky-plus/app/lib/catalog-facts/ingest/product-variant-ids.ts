import {
  executeAdminReadQuery,
  type CatalogAdminReadClient,
} from "../admin-read";
import {
  paginateCursorConnection,
  type CursorConnection,
} from "../admin-read/cursor-pagination";

export const PRODUCT_VARIANT_IDS_PAGE_SIZE = 100;

export const CATALOG_FACT_PRODUCT_VARIANT_IDS_QUERY = `#graphql
  query CatalogFactProductVariantIds($id: ID!, $first: Int!, $after: String) {
    product(id: $id) {
      id
      variants(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          cursor
          node {
            id
          }
        }
      }
    }
  }
`;

export class ProductVariantIdsPaginationError extends Error {
  readonly code = "PRODUCT_VARIANT_IDS_PAGINATION_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "ProductVariantIdsPaginationError";
  }
}

type VariantIdNode = { id?: unknown };

/**
 * Authoritative ProductVariant GID listing for webhook refetch.
 *
 * Product webhook bodies include at most the first 100 variants and are never
 * treated as a complete identity set (FX-WH-001).
 */
export async function listProductVariantGids(
  admin: CatalogAdminReadClient,
  productGid: string,
  options?: { pageSize?: number },
): Promise<string[]> {
  const pageSize = options?.pageSize ?? PRODUCT_VARIANT_IDS_PAGE_SIZE;
  return paginateCursorConnection({
    noun: "product variant",
    connectionName: "product.variants",
    pageSize,
    createError: (message) => new ProductVariantIdsPaginationError(message),
    fetchConnection: async (after) => {
      const result = await executeAdminReadQuery<{
        product?: {
          variants?: CursorConnection<VariantIdNode>;
        } | null;
      }>(admin, CATALOG_FACT_PRODUCT_VARIANT_IDS_QUERY, {
        id: productGid,
        first: pageSize,
        after,
      });
      if (result.data?.product == null) {
        throw new ProductVariantIdsPaginationError(
          "product.variants cannot be listed because the product read is null",
        );
      }
      return result.data.product.variants;
    },
    mapNode: (node) => {
      if (typeof node.id !== "string" || node.id.length === 0) {
        throw new ProductVariantIdsPaginationError(
          "product.variants edge node is missing id",
        );
      }
      if (!node.id.startsWith("gid://shopify/ProductVariant/")) {
        throw new ProductVariantIdsPaginationError(
          `product.variants edge node id ${node.id} is not a ProductVariant GID`,
        );
      }
      return node.id;
    },
    identityOf: (mapped) => mapped,
    nodeIdentity: (node) => node.id,
  });
}
