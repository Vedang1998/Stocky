import { describe, expect, it } from "vitest";
import type { AgreementSnapshot, OrderLineSnapshot } from "./types";
import {
  evaluateUnits,
  isExcludedFromVariantDemand,
} from "./units";

function line(overrides: Partial<OrderLineSnapshot>): OrderLineSnapshot {
  return {
    shopifyGid: "gid://shopify/LineItem/1",
    quantity: 6,
    currentQuantity: 3,
    refundableQuantity: 3,
    unfulfilledQuantity: 0,
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
      shopAmount: "60.00",
      shopCurrencyCode: "USD",
      presentmentAmount: "60.00",
      presentmentCurrencyCode: "USD",
    },
    originalUnitPriceSet: {
      shopAmount: "10.00",
      shopCurrencyCode: "USD",
      presentmentAmount: "10.00",
      presentmentCurrencyCode: "USD",
    },
    discountedTotalSet: {
      shopAmount: "60.00",
      shopCurrencyCode: "USD",
      presentmentAmount: "60.00",
      presentmentCurrencyCode: "USD",
    },
    totalDiscountSet: {
      shopAmount: "0.00",
      shopCurrencyCode: "USD",
      presentmentAmount: "0.00",
      presentmentCurrencyCode: "USD",
    },
    ...overrides,
  };
}

function agreement(
  reason: string,
  sales: AgreementSnapshot["sales"],
): AgreementSnapshot {
  return {
    shopifyGid: `gid://shopify/SalesAgreement/${reason}`,
    happenedAt: new Date("2026-08-02T00:00:00.000Z"),
    agreementTypename: "RefundAgreement",
    reason,
    refundGid: null,
    sales,
    salesComplete: true,
  };
}

const saleMoney = {
  shopAmount: "-10.00",
  shopCurrencyCode: "USD",
  presentmentAmount: "-10.00",
  presentmentCurrencyCode: "USD",
};

describe("PR6-C unit ledger (PO-10)", () => {
  it("stores RETURN -1 as refunded_units 1, not 2 (T47)", () => {
    const result = evaluateUnits({
      lines: [line({ quantity: 3, currentQuantity: 2 })],
      agreements: [
        agreement("REFUND", [
          {
            shopifyGid: "gid://shopify/Sale/ret",
            quantity: -1,
            lineType: "PRODUCT",
            actionType: "RETURN",
            saleTypename: "ProductSale",
            shopifyLineItemGid: "gid://shopify/LineItem/1",
            totalAmount: saleMoney,
          },
        ]),
      ],
    });
    expect(result.signInconsistent).toBe(false);
    expect(result.lines[0]?.refundedUnits).toBe(1);
    expect(result.diagnostic).toBeNull();
  });

  it("pins documented RETURN quantity -2 as refunded magnitude 2 (T55)", () => {
    const result = evaluateUnits({
      lines: [line({ quantity: 2, currentQuantity: 0 })],
      agreements: [
        agreement("RETURN", [
          {
            shopifyGid: "gid://shopify/Sale/ret2",
            quantity: -2,
            lineType: "PRODUCT",
            actionType: "RETURN",
            saleTypename: "ProductSale",
            shopifyLineItemGid: "gid://shopify/LineItem/1",
            totalAmount: {
              shopAmount: "-20.7",
              shopCurrencyCode: "USD",
              presentmentAmount: "-20.7",
              presentmentCurrencyCode: "USD",
            },
          },
        ]),
      ],
    });
    expect(result.lines[0]?.refundedUnits).toBe(2);
    expect(result.diagnostic).toBeNull();
  });

  it("does not fire UNIT_SALE_SIGN_INCONSISTENT for mixed ORDER+RETURN (T58)", () => {
    const result = evaluateUnits({
      lines: [line({ quantity: 6, currentQuantity: 6 })],
      agreements: [
        agreement("ORDER", [
          {
            shopifyGid: "gid://shopify/Sale/plus",
            quantity: 1,
            lineType: "PRODUCT",
            actionType: "ORDER",
            saleTypename: "ProductSale",
            shopifyLineItemGid: "gid://shopify/LineItem/1",
            totalAmount: {
              shopAmount: "10.00",
              shopCurrencyCode: "USD",
              presentmentAmount: "10.00",
              presentmentCurrencyCode: "USD",
            },
          },
          {
            shopifyGid: "gid://shopify/Sale/minus",
            quantity: -1,
            lineType: "PRODUCT",
            actionType: "RETURN",
            saleTypename: "ProductSale",
            shopifyLineItemGid: "gid://shopify/LineItem/1",
            totalAmount: saleMoney,
          },
        ]),
      ],
    });
    expect(result.signInconsistent).toBe(false);
    expect(result.diagnostic).not.toBe("UNIT_SALE_SIGN_INCONSISTENT");
  });

  it("detects a contradictory valid-sign identity (T29/T54 injected)", () => {
    const result = evaluateUnits({
      lines: [line({ quantity: 5, currentQuantity: 3 })],
      agreements: [
        agreement("RETURN", [
          {
            shopifyGid: "gid://shopify/Sale/ret3",
            quantity: -3,
            lineType: "PRODUCT",
            actionType: "RETURN",
            saleTypename: "ProductSale",
            shopifyLineItemGid: "gid://shopify/LineItem/1",
            totalAmount: saleMoney,
          },
        ]),
      ],
    });
    expect(result.identityInconsistent).toBe(true);
    expect(result.diagnostic).toBe("LINE_UNIT_IDENTITY_INCONSISTENT");
  });

  it("accepts ordered 6 / current 3 / returned 3 / removed 0 (T54 clean)", () => {
    const result = evaluateUnits({
      lines: [line({ quantity: 6, currentQuantity: 3 })],
      agreements: [
        agreement("RETURN", [
          {
            shopifyGid: "gid://shopify/Sale/ret3",
            quantity: -3,
            lineType: "PRODUCT",
            actionType: "RETURN",
            saleTypename: "ProductSale",
            shopifyLineItemGid: "gid://shopify/LineItem/1",
            totalAmount: saleMoney,
          },
        ]),
      ],
    });
    expect(result.lines[0]?.refundedUnits).toBe(3);
    expect(result.lines[0]?.removedUnits).toBe(0);
    expect(result.identityInconsistent).toBe(false);
  });

  it("excludes test orders, gift cards, and non-variant lines from demand", () => {
    expect(
      isExcludedFromVariantDemand({
        orderTest: true,
        isGiftCard: false,
        variantGidAtSale: "gid://shopify/ProductVariant/1",
      }),
    ).toBe(true);
    expect(
      isExcludedFromVariantDemand({
        orderTest: false,
        isGiftCard: true,
        variantGidAtSale: "gid://shopify/ProductVariant/1",
      }),
    ).toBe(true);
    expect(
      isExcludedFromVariantDemand({
        orderTest: false,
        isGiftCard: false,
        variantGidAtSale: null,
      }),
    ).toBe(true);
  });
});
