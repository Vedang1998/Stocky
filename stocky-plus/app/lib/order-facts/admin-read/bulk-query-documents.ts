/**
 * Bulk Operation inner QUERY documents for PR6-B (not submitted).
 *
 * These strings are not `#graphql`-tagged. graphql-codegen covers tagged Admin
 * QUERY documents in `documents.ts`. Untagged bulk inner queries are validated
 * by two local gates:
 * 1. graphql-js `specifiedRules` against the generated Admin 2026-07 schema;
 * 2. Shopify bulk-operation connection rules (Node, nesting, counts).
 *
 * Do not wrap them in the bulk-operation submit mutation.
 * Do not select Order.cancellation or priceAfterAllDiscountsBeforeTaxesSet.
 */

/** Historical import shape. Two Node connections (orders + lineItems). */
export const ORDER_FACTS_BULK_A_ORDERS_LINES = `{
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
        edited
        test
        currencyCode
        presentmentCurrencyCode
        taxesIncluded
        displayFinancialStatus
        sourceName
        currentSubtotalLineItemsQuantity
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
              discountedTotalSet {
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

/**
 * Candidate refund nest. `Order.refunds` is a LIST, not a connection.
 * RefundLineItem does not implement Node. Production path is disabled.
 */
export const ORDER_FACTS_BULK_B_REFUNDS_CANDIDATE = `{
  orders {
    edges {
      node {
        id
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
        refunds {
          id
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
          refundLineItems {
            edges {
              node {
                id
                quantity
                restockType
                restocked
                location {
                  id
                }
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
        }
      }
    }
  }
}`;

/**
 * Illegal three-level agreements/sales document. T53 must reject this via the
 * bulk-rule validator, not graphql-js `validate` alone.
 */
export const ORDER_FACTS_BULK_C_AGREEMENTS_SALES_ILLEGAL = `{
  orders {
    edges {
      node {
        id
        agreements {
          edges {
            node {
              id
              happenedAt
              reason
              sales {
                edges {
                  node {
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
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

export const ORDER_FACTS_BULK_QUERY_DOCUMENTS = [
  ORDER_FACTS_BULK_A_ORDERS_LINES,
  ORDER_FACTS_BULK_B_REFUNDS_CANDIDATE,
  ORDER_FACTS_BULK_C_AGREEMENTS_SALES_ILLEGAL,
] as const;
