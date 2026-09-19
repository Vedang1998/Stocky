/**
 * D-owned Bulk A inner QUERY (PR6-D C3).
 *
 * Frozen B `ORDER_FACTS_BULK_A_ORDERS_LINES` is unchanged. This document is
 * the default submit/fingerprint payload for D import. Both B gates still
 * run. Do not select cancellation, priceAfterAllDiscountsBeforeTaxesSet, or
 * agreements. `confirmed` is Shopify inventory reservation, not provenance.
 */

const MONEY = `{
          shopMoney {
            amount
            currencyCode
          }
          presentmentMoney {
            amount
            currencyCode
          }
        }`;

export const ORDER_FACTS_D_BULK_A_QUERY_VERSION =
  "order-facts-d-bulk-a-v2" as const;

/** Historical import shape. Two Node connections (orders + lineItems). */
export const ORDER_FACTS_D_BULK_A_ORDERS_LINES = `{
  orders {
    edges {
      node {
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
        originalTotalPriceSet ${MONEY}
        currentTotalPriceSet ${MONEY}
        currentSubtotalPriceSet ${MONEY}
        currentTotalDiscountsSet ${MONEY}
        currentShippingPriceSet ${MONEY}
        currentTotalTaxSet ${MONEY}
        netPaymentSet ${MONEY}
        totalRefundedSet ${MONEY}
        refundDiscrepancySet ${MONEY}
        cartDiscountAmountSet ${MONEY}
        currentCartDiscountAmountSet ${MONEY}
        lineItems {
          edges {
            node {
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
              originalTotalSet ${MONEY}
              originalUnitPriceSet ${MONEY}
              discountedTotalSetWithCodeDiscounts: discountedTotalSet(withCodeDiscounts: true) ${MONEY}
              discountedTotalSet: discountedTotalSet(withCodeDiscounts: false) ${MONEY}
              discountedUnitPriceAfterAllDiscountsSet ${MONEY}
              totalDiscountSet ${MONEY}
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
          }
        }
      }
    }
  }
}`;
