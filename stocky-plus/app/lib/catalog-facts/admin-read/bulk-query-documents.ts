/**
 * Bulk Operation QUERY documents (inner bulk query shape).
 *
 * These are NOT submitted in this lane. They are the with-unitCost /
 * no-unitCost catalog shapes and the inventory-level shape later workers
 * will pass to bulkOperationRunQuery.
 *
 * Do not wrap them in bulkOperationRunQuery here (that is a mutation).
 * Do not tag them with `#graphql` — standalone Admin schema validation
 * requires `first` on connections, which bulk queries omit by design.
 *
 * Official bulk limits: one top-level connection, ≤5 connections, ≤2 nested
 * connection levels, groupObjects remains false at submit time (later lane).
 */

export const CATALOG_BULK_QUERY_WITH_UNIT_COST = `{
  products {
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
        unitCost {
          amount
          currencyCode
        }
        createdAt
        updatedAt
      }
    }
    collections {
      id
      title
    }
  }
}`;

export const CATALOG_BULK_QUERY_NO_UNIT_COST = `{
  products {
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
    collections {
      id
      title
    }
  }
}`;

export const INVENTORY_LEVEL_BULK_QUERY = `{
  inventoryItems {
    id
    inventoryLevels(includeInactive: true) {
      id
      isActive
      createdAt
      updatedAt
      location {
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
}`;

export const CANONICAL_BULK_QUERY_DOCUMENTS = [
  CATALOG_BULK_QUERY_WITH_UNIT_COST,
  CATALOG_BULK_QUERY_NO_UNIT_COST,
  INVENTORY_LEVEL_BULK_QUERY,
] as const;
