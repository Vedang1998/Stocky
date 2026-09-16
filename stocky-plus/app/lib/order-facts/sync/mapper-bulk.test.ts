import { describe, expect, it } from "vitest";
import { moneyBag } from "../admin-read/__tests__/fixtures";
import {
  bulkRootNeedsAgreementRefundFollowUp,
  mapBulkAAssemblyToOrderSnapshot,
} from "./mapper-bulk";

describe("PR6-D Bulk A snapshot mapper", () => {
  it("uses selected discountedTotalSet and empty complete agreements for baseline orders", () => {
    const snapshot = mapBulkAAssemblyToOrderSnapshot(
      {
        id: "gid://shopify/Order/1",
        name: "#1001",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        processedAt: "2026-01-01T00:00:00Z",
        closed: false,
        edited: false,
        test: false,
        currencyCode: "USD",
        presentmentCurrencyCode: "USD",
        taxesIncluded: false,
        currentSubtotalLineItemsQuantity: 1,
        originalTotalPriceSet: moneyBag("10.00"),
        currentTotalPriceSet: moneyBag("10.00"),
        currentSubtotalPriceSet: moneyBag("10.00"),
        currentTotalDiscountsSet: moneyBag("0.00"),
        currentTotalTaxSet: moneyBag("0.00"),
        netPaymentSet: moneyBag("10.00"),
        totalRefundedSet: moneyBag("0.00"),
        currentShippingPriceSet: moneyBag("0.00"),
      },
      [
        {
          id: "gid://shopify/LineItem/1",
          __parentId: "gid://shopify/Order/1",
          quantity: 1,
          currentQuantity: 1,
          refundableQuantity: 1,
          isGiftCard: false,
          title: "Line",
          originalTotalSet: moneyBag("10.00"),
          originalUnitPriceSet: moneyBag("10.00"),
          discountedTotalSet: moneyBag("9.00"),
          totalDiscountSet: moneyBag("1.00"),
        },
      ],
    );
    expect(snapshot.lines[0]?.discountedTotalSet.shopAmount).toBe("9.00");
    expect(snapshot.agreements).toEqual([]);
    expect(snapshot.agreementsComplete).toBe(true);
    expect(snapshot.confirmed).toBe(true);
  });

  it("classifies edited or refund-bearing roots for counted B follow-up", () => {
    expect(
      bulkRootNeedsAgreementRefundFollowUp({
        edited: true,
        totalRefundedSet: moneyBag("0.00"),
      }),
    ).toBe(true);
    expect(
      bulkRootNeedsAgreementRefundFollowUp({
        edited: false,
        totalRefundedSet: moneyBag("1.00"),
      }),
    ).toBe(true);
    expect(
      bulkRootNeedsAgreementRefundFollowUp({
        edited: false,
        totalRefundedSet: moneyBag("0.00"),
      }),
    ).toBe(false);
    expect(bulkRootNeedsAgreementRefundFollowUp({ edited: false })).toBe(true);
  });
});
