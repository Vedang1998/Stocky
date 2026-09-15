import { describe, expect, it } from "vitest";
import {
  OrderApplyCurrencyMismatchError,
  OrderApplyMoneyError,
} from "./errors";
import {
  canonicalizeExactDecimalText,
  exactNumericEqual,
  parseOptionalMoneyBag,
  parseRequiredMoneyBag,
  rejectMixedShopCurrencySum,
} from "./money";
import {
  parseCompleteOrderSnapshot,
  parseRefundMoney,
} from "./parse";
import type { RefundSnapshot } from "./types";

const bag = (amount: string, currency = "USD") => ({
  shopAmount: amount,
  shopCurrencyCode: currency,
  presentmentAmount: amount,
  presentmentCurrencyCode: currency,
});

describe("PR6-C exact money", () => {
  it("rejects Number / parseFloat inputs (T26/T30 analog)", () => {
    expect(() =>
      parseRequiredMoneyBag(
        {
          shopAmount: 19.99,
          shopCurrencyCode: "USD",
          presentmentAmount: "19.99",
          presentmentCurrencyCode: "USD",
        },
        "originalTotalPriceSet",
        "USD",
      ),
    ).toThrow(OrderApplyMoneyError);
  });

  it("persists sub-cent precision without 2dp rounding (T15)", () => {
    const parsed = parseRequiredMoneyBag(
      bag("0.123456"),
      "originalTotalPriceSet",
      "USD",
    );
    expect(parsed.shopAmount).toBe("0.123456");
    expect(canonicalizeExactDecimalText("0.123456")).toBe("0.123456");
  });

  it("treats optional absence as ok and present-but-invalid as fail-apply", () => {
    expect(parseOptionalMoneyBag(null, "refundDiscrepancySet", "USD")).toBeNull();
    expect(() =>
      parseOptionalMoneyBag(
        {
          shopAmount: "not-decimal",
          shopCurrencyCode: "USD",
          presentmentAmount: "1.00",
          presentmentCurrencyCode: "USD",
        },
        "refundDiscrepancySet",
        "USD",
      ),
    ).toThrow(OrderApplyMoneyError);
  });

  it("fails the whole resource on required currency mismatch", () => {
    expect(() =>
      parseRequiredMoneyBag(bag("10.00", "EUR"), "currentTotalPriceSet", "USD"),
    ).toThrow(OrderApplyCurrencyMismatchError);
  });

  it("rejects mixed shop-currency sums (T28)", () => {
    expect(() => rejectMixedShopCurrencySum(["USD", "EUR"])).toThrow(
      OrderApplyMoneyError,
    );
    expect(() => rejectMixedShopCurrencySum(["USD", "USD"])).not.toThrow();
  });

  it("flags unbalanced refund money identity without rewriting bags (T49)", () => {
    const refund: RefundSnapshot = {
      shopifyGid: "gid://shopify/Refund/1",
      shopifyOrderGid: "gid://shopify/Order/1",
      shopifyCreatedAt: null,
      shopifyUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
      processedAt: null,
      processedAtShopify: null,
      shopifyLegacyResourceId: null,
      totalRefundedSet: bag("10.00"),
      shippingLines: [],
      lines: [
        {
          shopifyGid: null,
          shopifyLineItemGid: "gid://shopify/LineItem/1",
          refundLineOrdinal: 0,
          quantity: 1,
          restockType: null,
          restocked: null,
          restockLocationGid: null,
          subtotalSet: bag("4.00"),
          totalTaxSet: bag("0.00"),
          priceSet: bag("4.00"),
        },
      ],
      linesComplete: true,
      adjustments: [],
      adjustmentsComplete: true,
      transactions: [],
      transactionsComplete: true,
    };
    const parsed = parseRefundMoney(refund, "USD");
    expect(parsed.moneyDiagnosticState).toBe("REFUND_MONEY_UNBALANCED");
    expect(exactNumericEqual(parsed.totalRefundedSet.shopAmount, "10.00")).toBe(
      true,
    );
  });

  it("fails the whole order snapshot when a required line bag is invalid (T48)", () => {
    expect(() =>
      parseCompleteOrderSnapshot({
        shopifyGid: "gid://shopify/Order/1",
        name: "#1",
        shopifyCreatedAt: null,
        shopifyUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
        processedAt: null,
        processedAtShopify: null,
        cancelledAt: null,
        cancelReason: null,
        closed: false,
        closedAt: null,
        edited: false,
        test: false,
        confirmed: true,
        shopCurrencyCode: "USD",
        presentmentCurrencyCode: "USD",
        taxesIncluded: true,
        displayFinancialStatus: null,
        displayFulfillmentStatus: null,
        sourceName: null,
        retailLocationGid: null,
        currentSubtotalLineItemsQuantity: 1,
        subtotalLineItemsQuantity: 1,
        shopifyLegacyResourceId: null,
        originalTotalPriceSet: bag("10.00"),
        currentTotalPriceSet: bag("10.00"),
        currentSubtotalPriceSet: bag("10.00"),
        currentTotalDiscountsSet: bag("0.00"),
        currentTotalTaxSet: bag("0.00"),
        totalRefundedSet: bag("0.00"),
        netPaymentSet: bag("10.00"),
        lines: [
          {
            shopifyGid: "gid://shopify/LineItem/1",
            quantity: 1,
            currentQuantity: 1,
            refundableQuantity: 1,
            unfulfilledQuantity: 1,
            isGiftCard: false,
            title: "Widget",
            variantTitle: null,
            vendor: null,
            sku: "SKU-1",
            name: "Widget",
            variantGidAtSale: "gid://shopify/ProductVariant/1",
            productGidAtSale: "gid://shopify/Product/1",
            currentVariantGid: "gid://shopify/ProductVariant/1",
            currentProductGid: "gid://shopify/Product/1",
            shopifyLegacyResourceId: null,
            originalTotalSet: {
              shopAmount: "not-decimal",
              shopCurrencyCode: "USD",
              presentmentAmount: "10.00",
              presentmentCurrencyCode: "USD",
            },
            originalUnitPriceSet: bag("10.00"),
            discountedTotalSet: bag("10.00"),
            totalDiscountSet: bag("0.00"),
          },
        ],
        linesComplete: true,
        agreements: [],
        agreementsComplete: true,
      }),
    ).toThrow(OrderApplyMoneyError);
  });

  it("accepts a balanced refund identity", () => {
    const refund: RefundSnapshot = {
      shopifyGid: "gid://shopify/Refund/2",
      shopifyOrderGid: "gid://shopify/Order/1",
      shopifyCreatedAt: null,
      shopifyUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
      processedAt: null,
      processedAtShopify: null,
      shopifyLegacyResourceId: null,
      totalRefundedSet: bag("5.50"),
      shippingLines: [
        { shopifyGid: null, subtotal: bag("1.00"), tax: bag("0.50") },
      ],
      lines: [
        {
          shopifyGid: null,
          shopifyLineItemGid: "gid://shopify/LineItem/1",
          refundLineOrdinal: 0,
          quantity: 1,
          restockType: null,
          restocked: null,
          restockLocationGid: null,
          subtotalSet: bag("3.00"),
          totalTaxSet: bag("1.00"),
          priceSet: bag("3.00"),
        },
      ],
      linesComplete: true,
      adjustments: [],
      adjustmentsComplete: true,
      transactions: [],
      transactionsComplete: true,
    };
    expect(parseRefundMoney(refund, "USD").moneyDiagnosticState).toBeNull();
  });
});
