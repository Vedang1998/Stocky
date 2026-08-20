/**
 * Direct Admin GraphQL QUERY documents for PR5-F2A.
 *
 * Every document is a QUERY. Mutations are rejected by GraphQL AST inspection.
 * API target: Shopify Admin API 2026-07. Do not bump the version.
 */

import { APPROVED_INVENTORY_QUANTITY_NAMES } from "./types";

export const INVENTORY_QUANTITY_NAMES_ARGUMENT = [
  ...APPROVED_INVENTORY_QUANTITY_NAMES,
];

export const CATALOG_FACT_LOCATIONS_QUERY = `#graphql
  query CatalogFactLocations(
    $first: Int!
    $after: String
    $includeInactive: Boolean
    $includeLegacy: Boolean
  ) {
    locations(
      first: $first
      after: $after
      includeInactive: $includeInactive
      includeLegacy: $includeLegacy
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          id
          legacyResourceId
          name
          isActive
          deactivatedAt
          fulfillsOnlineOrders
          shipsInventory
          hasActiveInventory
          fulfillmentService {
            id
          }
          address {
            address1
            city
            provinceCode
            countryCode
            zip
          }
          createdAt
          updatedAt
        }
      }
    }
  }
`;

export const CATALOG_FACT_LOCATION_QUERY = `#graphql
  query CatalogFactLocation($id: ID!) {
    location(id: $id) {
      id
      legacyResourceId
      name
      isActive
      deactivatedAt
      fulfillsOnlineOrders
      shipsInventory
      hasActiveInventory
      fulfillmentService {
        id
      }
      address {
        address1
        city
        provinceCode
        countryCode
        zip
      }
      createdAt
      updatedAt
    }
  }
`;

export const CATALOG_FACT_PRODUCT_QUERY = `#graphql
  query CatalogFactProduct($id: ID!) {
    product(id: $id) {
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
    }
  }
`;

export const CATALOG_FACT_PRODUCT_COLLECTIONS_QUERY = `#graphql
  query CatalogFactProductCollections($id: ID!, $first: Int!, $after: String) {
    product(id: $id) {
      id
      collections(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          cursor
          node {
            id
            title
          }
        }
      }
    }
  }
`;

export const CATALOG_FACT_PRODUCT_VARIANT_QUERY = `#graphql
  query CatalogFactProductVariant($id: ID!) {
    productVariant(id: $id) {
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
      product {
        id
      }
      inventoryItem {
        id
      }
      createdAt
      updatedAt
    }
  }
`;

export const CATALOG_FACT_INVENTORY_ITEM_QUERY = `#graphql
  query CatalogFactInventoryItem($id: ID!, $includeUnitCost: Boolean!) {
    inventoryItem(id: $id) {
      id
      legacyResourceId
      sku
      tracked
      requiresShipping
      measurement {
        weight {
          value
          unit
        }
      }
      unitCost @include(if: $includeUnitCost) {
        amount
        currencyCode
      }
      variants(first: 1) {
        nodes {
          id
        }
      }
      createdAt
      updatedAt
    }
  }
`;

export const CATALOG_FACT_UNIT_COST_PREFLIGHT_QUERY = `#graphql
  query CatalogFactUnitCostPreflight($id: ID!) {
    inventoryItem(id: $id) {
      id
      unitCost {
        amount
        currencyCode
      }
    }
  }
`;

export const CATALOG_FACT_INVENTORY_LEVEL_BY_PAIR_QUERY = `#graphql
  query CatalogFactInventoryLevelByPair(
    $inventoryItemId: ID!
    $locationId: ID!
    $includeInactive: Boolean
    $quantityNames: [String!]!
  ) {
    inventoryItem(id: $inventoryItemId) {
      id
      inventoryLevel(locationId: $locationId, includeInactive: $includeInactive) {
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
        quantities(names: $quantityNames) {
          name
          quantity
          updatedAt
        }
      }
    }
  }
`;

export const CATALOG_FACT_INVENTORY_LEVEL_BY_ID_QUERY = `#graphql
  query CatalogFactInventoryLevelById($id: ID!, $quantityNames: [String!]!) {
    inventoryLevel(id: $id) {
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
      quantities(names: $quantityNames) {
        name
        quantity
        updatedAt
      }
    }
  }
`;

export const CATALOG_FACT_BULK_OPERATION_QUERY = `#graphql
  query CatalogFactBulkOperation($id: ID!) {
    bulkOperation(id: $id) {
      id
      status
      errorCode
      objectCount
      rootObjectCount
      url
      partialDataUrl
      createdAt
      completedAt
    }
  }
`;

export const CATALOG_FACT_SHOP_CURRENCY_QUERY = `#graphql
  query CatalogFactShopCurrency {
    shop {
      currencyCode
    }
  }
`;

export const CANONICAL_ADMIN_READ_QUERY_DOCUMENTS = [
  CATALOG_FACT_LOCATIONS_QUERY,
  CATALOG_FACT_LOCATION_QUERY,
  CATALOG_FACT_PRODUCT_QUERY,
  CATALOG_FACT_PRODUCT_COLLECTIONS_QUERY,
  CATALOG_FACT_PRODUCT_VARIANT_QUERY,
  CATALOG_FACT_INVENTORY_ITEM_QUERY,
  CATALOG_FACT_UNIT_COST_PREFLIGHT_QUERY,
  CATALOG_FACT_INVENTORY_LEVEL_BY_PAIR_QUERY,
  CATALOG_FACT_INVENTORY_LEVEL_BY_ID_QUERY,
  CATALOG_FACT_BULK_OPERATION_QUERY,
  CATALOG_FACT_SHOP_CURRENCY_QUERY,
] as const;
