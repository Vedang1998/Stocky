/**
 * Direct Admin GraphQL QUERY documents for PR6-B.
 *
 * Every document is a QUERY. Mutations are rejected by GraphQL AST inspection
 * before any Admin network call. API target: Shopify Admin API 2026-07.
 *
 * Documents are static `#graphql` templates with no interpolation so the
 * production-module scanner can review them.
 */

export const ORDER_FACT_BY_ID_QUERY = `#graphql
  query OrderFactById(
    $id: ID!
    $lineFirst: Int!
    $lineAfter: String
    $agrFirst: Int!
    $agrAfter: String
    $saleFirst: Int!
    $refundLineFirst: Int!
    $adjFirst: Int!
    $shipRefundFirst: Int!
    $txnFirst: Int!
  ) {
    order(id: $id) {
      id
      legacyResourceId
      name
      createdAt
      updatedAt
      processedAt
      cancelledAt
      cancelReason
      closed
      closedAt
      edited
      test
      confirmed
      currencyCode
      presentmentCurrencyCode
      taxesIncluded
      displayFinancialStatus
      displayFulfillmentStatus
      sourceName
      currentSubtotalLineItemsQuantity
      subtotalLineItemsQuantity
      retailLocation {
        id
      }
      originalTotalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
        presentmentMoney {
          amount
          currencyCode
        }
      }
      currentTotalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
        presentmentMoney {
          amount
          currencyCode
        }
      }
      currentSubtotalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
        presentmentMoney {
          amount
          currencyCode
        }
      }
      currentTotalDiscountsSet {
        shopMoney {
          amount
          currencyCode
        }
        presentmentMoney {
          amount
          currencyCode
        }
      }
      currentShippingPriceSet {
        shopMoney {
          amount
          currencyCode
        }
        presentmentMoney {
          amount
          currencyCode
        }
      }
      currentTotalTaxSet {
        shopMoney {
          amount
          currencyCode
        }
        presentmentMoney {
          amount
          currencyCode
        }
      }
      netPaymentSet {
        shopMoney {
          amount
          currencyCode
        }
        presentmentMoney {
          amount
          currencyCode
        }
      }
      totalRefundedSet {
        shopMoney {
          amount
          currencyCode
        }
        presentmentMoney {
          amount
          currencyCode
        }
      }
      refundDiscrepancySet {
        shopMoney {
          amount
          currencyCode
        }
        presentmentMoney {
          amount
          currencyCode
        }
      }
      cartDiscountAmountSet {
        shopMoney {
          amount
          currencyCode
        }
        presentmentMoney {
          amount
          currencyCode
        }
      }
      currentCartDiscountAmountSet {
        shopMoney {
          amount
          currencyCode
        }
        presentmentMoney {
          amount
          currencyCode
        }
      }
      lineItems(first: $lineFirst, after: $lineAfter) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          cursor
          node {
            ...OrderLineFactFields
          }
        }
      }
      refunds {
        id
        legacyResourceId
        createdAt
        updatedAt
        processedAt
        totalRefundedSet {
          shopMoney {
            amount
            currencyCode
          }
          presentmentMoney {
            amount
            currencyCode
          }
        }
        refundLineItems(first: $refundLineFirst) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            cursor
            node {
              ...RefundLineFactFields
            }
          }
        }
        orderAdjustments(first: $adjFirst) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            cursor
            node {
              ...OrderAdjustmentFactFields
            }
          }
        }
        refundShippingLines(first: $shipRefundFirst) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            cursor
            node {
              ...RefundShippingLineFactFields
            }
          }
        }
        transactions(first: $txnFirst) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            cursor
            node {
              ...OrderTransactionFactFields
            }
          }
        }
      }
      agreements(first: $agrFirst, after: $agrAfter) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          cursor
          node {
            __typename
            id
            happenedAt
            reason
            ... on OrderAgreement {
              id
              happenedAt
              reason
            }
            ... on OrderEditAgreement {
              id
              happenedAt
              reason
            }
            ... on RefundAgreement {
              id
              happenedAt
              reason
              refund {
                id
              }
            }
            ... on ReturnAgreement {
              id
              happenedAt
              reason
            }
            sales(first: $saleFirst) {
              pageInfo {
                hasNextPage
                endCursor
              }
              edges {
                cursor
                node {
                  ...SaleFactFields
                }
              }
            }
          }
        }
      }
    }
  }

  fragment OrderLineFactFields on LineItem {
    id
    sku
    title
    variantTitle
    vendor
    name
    isGiftCard
    quantity
    currentQuantity
    refundableQuantity
    unfulfilledQuantity
    nonFulfillableQuantity
    originalTotalSet {
      shopMoney {
        amount
        currencyCode
      }
      presentmentMoney {
        amount
        currencyCode
      }
    }
    originalUnitPriceSet {
      shopMoney {
        amount
        currencyCode
      }
      presentmentMoney {
        amount
        currencyCode
      }
    }
    discountedTotalSetWithCodeDiscounts: discountedTotalSet(
      withCodeDiscounts: true
    ) {
      shopMoney {
        amount
        currencyCode
      }
      presentmentMoney {
        amount
        currencyCode
      }
    }
    discountedTotalSetWithoutCodeDiscounts: discountedTotalSet(
      withCodeDiscounts: false
    ) {
      shopMoney {
        amount
        currencyCode
      }
      presentmentMoney {
        amount
        currencyCode
      }
    }
    totalDiscountSet {
      shopMoney {
        amount
        currencyCode
      }
      presentmentMoney {
        amount
        currencyCode
      }
    }
    discountedUnitPriceAfterAllDiscountsSet {
      shopMoney {
        amount
        currencyCode
      }
      presentmentMoney {
        amount
        currencyCode
      }
    }
    variant {
      id
      legacyResourceId
      sku
      title
    }
    product {
      id
      legacyResourceId
      title
      handle
    }
  }

  fragment RefundLineFactFields on RefundLineItem {
    id
    quantity
    restockType
    lineItem {
      id
    }
    subtotalSet {
      shopMoney {
        amount
        currencyCode
      }
      presentmentMoney {
        amount
        currencyCode
      }
    }
    totalTaxSet {
      shopMoney {
        amount
        currencyCode
      }
      presentmentMoney {
        amount
        currencyCode
      }
    }
    priceSet {
      shopMoney {
        amount
        currencyCode
      }
      presentmentMoney {
        amount
        currencyCode
      }
    }
  }

  fragment OrderAdjustmentFactFields on OrderAdjustment {
    id
    reason
    amountSet {
      shopMoney {
        amount
        currencyCode
      }
      presentmentMoney {
        amount
        currencyCode
      }
    }
    taxAmountSet {
      shopMoney {
        amount
        currencyCode
      }
      presentmentMoney {
        amount
        currencyCode
      }
    }
  }

  fragment RefundShippingLineFactFields on RefundShippingLine {
    id
    shippingLine {
      id
    }
    subtotalAmountSet {
      shopMoney {
        amount
        currencyCode
      }
      presentmentMoney {
        amount
        currencyCode
      }
    }
    taxAmountSet {
      shopMoney {
        amount
        currencyCode
      }
      presentmentMoney {
        amount
        currencyCode
      }
    }
  }

  fragment OrderTransactionFactFields on OrderTransaction {
    id
    status
    kind
    createdAt
    processedAt
    amountSet {
      shopMoney {
        amount
        currencyCode
      }
      presentmentMoney {
        amount
        currencyCode
      }
    }
  }

  fragment SaleFactFields on Sale {
    __typename
    id
    quantity
    lineType
    actionType
    totalAmount {
      shopMoney {
        amount
        currencyCode
      }
      presentmentMoney {
        amount
        currencyCode
      }
    }
    ... on ProductSale {
      lineItem {
        id
      }
    }
    ... on GiftCardSale {
      lineItem {
        id
      }
    }
    ... on TipSale {
      lineItem {
        id
      }
    }
  }
`;

export const ORDER_AGREEMENT_SALES_PAGE_QUERY = `#graphql
  query OrderAgreementSalesPage(
    $orderId: ID!
    $agreementAfter: String
    $saleFirst: Int!
    $saleAfter: String
  ) {
    order(id: $orderId) {
      id
      agreements(first: 1, after: $agreementAfter) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          cursor
          node {
            __typename
            id
            happenedAt
            reason
            ... on OrderAgreement {
              id
              happenedAt
              reason
            }
            ... on OrderEditAgreement {
              id
              happenedAt
              reason
            }
            ... on RefundAgreement {
              id
              happenedAt
              reason
              refund {
                id
              }
            }
            ... on ReturnAgreement {
              id
              happenedAt
              reason
            }
            sales(first: $saleFirst, after: $saleAfter) {
              pageInfo {
                hasNextPage
                endCursor
              }
              edges {
                cursor
                node {
                  ...AgreementSalePageFields
                }
              }
            }
          }
        }
      }
    }
  }

  fragment AgreementSalePageFields on Sale {
    __typename
    id
    quantity
    lineType
    actionType
    totalAmount {
      shopMoney {
        amount
        currencyCode
      }
      presentmentMoney {
        amount
        currencyCode
      }
    }
    ... on ProductSale {
      lineItem {
        id
      }
    }
    ... on GiftCardSale {
      lineItem {
        id
      }
    }
    ... on TipSale {
      lineItem {
        id
      }
    }
  }
`;

export const REFUND_FACT_BY_ID_QUERY = `#graphql
  query RefundFactById(
    $id: ID!
    $refundLineFirst: Int!
    $refundLineAfter: String
    $adjFirst: Int!
    $adjAfter: String
    $shipRefundFirst: Int!
    $shipRefundAfter: String
    $txnFirst: Int!
    $txnAfter: String
  ) {
    refund(id: $id) {
      id
      legacyResourceId
      createdAt
      updatedAt
      processedAt
      order {
        id
      }
      totalRefundedSet {
        shopMoney {
          amount
          currencyCode
        }
        presentmentMoney {
          amount
          currencyCode
        }
      }
      refundLineItems(first: $refundLineFirst, after: $refundLineAfter) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          cursor
          node {
            id
            quantity
            restockType
            lineItem {
              id
            }
            subtotalSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
            totalTaxSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
            priceSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
          }
        }
      }
      orderAdjustments(first: $adjFirst, after: $adjAfter) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          cursor
          node {
            id
            reason
            amountSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
            taxAmountSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
          }
        }
      }
      refundShippingLines(first: $shipRefundFirst, after: $shipRefundAfter) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          cursor
          node {
            id
            shippingLine {
              id
            }
            subtotalAmountSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
            taxAmountSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
          }
        }
      }
      transactions(first: $txnFirst, after: $txnAfter) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          cursor
          node {
            id
            status
            kind
            createdAt
            processedAt
            amountSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
`;

export const SHOP_TIMEZONE_CURRENCY_QUERY = `#graphql
  query ShopTimezoneCurrency {
    shop {
      id
      ianaTimezone
      currencyCode
    }
  }
`;

export const CURRENT_APP_INSTALLATION_ACCESS_SCOPES_QUERY = `#graphql
  query CurrentAppInstallationAccessScopes {
    currentAppInstallation {
      accessScopes {
        handle
      }
    }
  }
`;

export const CANONICAL_ORDER_ADMIN_READ_QUERY_DOCUMENTS = [
  ORDER_FACT_BY_ID_QUERY,
  ORDER_AGREEMENT_SALES_PAGE_QUERY,
  REFUND_FACT_BY_ID_QUERY,
  SHOP_TIMEZONE_CURRENCY_QUERY,
  CURRENT_APP_INSTALLATION_ACCESS_SCOPES_QUERY,
] as const;
