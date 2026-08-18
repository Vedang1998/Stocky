/**
 * Bulk Operation QUERY documents (inner bulk query shape).
 *
 * These are NOT submitted in this lane. They are the with-unitCost /
 * no-unitCost catalog shapes and the inventory-level shape later workers
 * will pass to bulkOperationRunQuery.
 *
 * Do not wrap them in bulkOperationRunQuery here (that is a mutation).
 *
 * These strings are not `#graphql`-tagged. graphql-codegen covers tagged
 * Admin QUERY documents in `documents.ts`. Untagged bulk inner queries are
 * validated by the dedicated Admin 2026-07 schema gate
 * (`bulk-query-schema.ts` / `bulk-query-schema.test.ts`) using graphql-js
 * `validate`, with Shopify bulk pagination arguments treated as optional.
 *
 * Official bulk guidance: `first` is optional and ignored if present. It is
 * not required for schema validity and is omitted here because bulk
 * operations ignore pagination arguments. Connection types MUST be
 * traversed with `edges { node { … } }`. Top-level `node` / `nodes` fields
 * are forbidden.
 *
 * Official bulk limits: one top-level connection, ≤5 connections, ≤2 nested
 * connection levels, groupObjects remains false at submit time (later lane).
 *
 * Keep these as no-substitution template literals so the canonical-read
 * scanner can statically review them.
 */

export const CATALOG_BULK_QUERY_WITH_UNIT_COST = `{
  products {
    edges {
      node {
        id
        legacyResourceId
        title
        handle
        vendor
        productType
        tags
        status
        featuredMedia {
          preview {
            image {
              url
            }
          }
        }
        createdAt
        updatedAt
        variants {
          edges {
            node {
              id
              legacyResourceId
              title
              displayName
              sku
              barcode
              position
              price
              compareAtPrice
              selectedOptions {
                name
                value
              }
              createdAt
              updatedAt
              inventoryItem {
                id
                sku
                tracked
                requiresShipping
                measurement {
                  weight {
                    value
                    unit
                  }
                }
                createdAt
                updatedAt
                unitCost {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
        collections {
          edges {
            node {
              id
              title
            }
          }
        }
      }
    }
  }
}`;

export const CATALOG_BULK_QUERY_NO_UNIT_COST = `{
  products {
    edges {
      node {
        id
        legacyResourceId
        title
        handle
        vendor
        productType
        tags
        status
        featuredMedia {
          preview {
            image {
              url
            }
          }
        }
        createdAt
        updatedAt
        variants {
          edges {
            node {
              id
              legacyResourceId
              title
              displayName
              sku
              barcode
              position
              price
              compareAtPrice
              selectedOptions {
                name
                value
              }
              createdAt
              updatedAt
              inventoryItem {
                id
                sku
                tracked
                requiresShipping
                measurement {
                  weight {
                    value
                    unit
                  }
                }
                createdAt
                updatedAt
              }
            }
          }
        }
        collections {
          edges {
            node {
              id
              title
            }
          }
        }
      }
    }
  }
}`;

export const INVENTORY_LEVEL_BULK_QUERY = `{
  inventoryItems {
    edges {
      node {
        id
        inventoryLevels(includeInactive: true) {
          edges {
            node {
              id
              isActive
              createdAt
              updatedAt
              location {
                id
              }
              item {
                id
              }
              quantities(
                names: [
                  "available"
                  "on_hand"
                  "incoming"
                  "committed"
                  "reserved"
                  "damaged"
                  "safety_stock"
                  "quality_control"
                ]
              ) {
                name
                quantity
                updatedAt
              }
            }
          }
        }
      }
    }
  }
}`;

export const CANONICAL_BULK_QUERY_DOCUMENTS = [
  CATALOG_BULK_QUERY_WITH_UNIT_COST,
  CATALOG_BULK_QUERY_NO_UNIT_COST,
  INVENTORY_LEVEL_BULK_QUERY,
] as const;
