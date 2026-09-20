import { describe, expect, it } from "vitest";
import { moneyBag } from "../admin-read/__tests__/fixtures";
import { mapBulkAAssemblyToOrderSnapshot } from "./mapper-bulk";

function root(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "gid://shopify/Order/1",
    name: "#1001",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    processedAt: "2026-01-01T00:00:00Z",
    cancelledAt: null,
    cancelReason: null,
    closed: false,
    closedAt: null,
    edited: false,
    test: false,
    confirmed: true,
    currencyCode: "USD",
    presentmentCurrencyCode: "USD",
    taxesIncluded: false,
    displayFinancialStatus: null,
    displayFulfillmentStatus: "UNFULFILLED",
    sourceName: null,
    currentSubtotalLineItemsQuantity: 1,
    subtotalLineItemsQuantity: 1,
    legacyResourceId: null,
    originalTotalPriceSet: moneyBag("10.00"),
    currentTotalPriceSet: moneyBag("10.00"),
    currentSubtotalPriceSet: moneyBag("10.00"),
    currentTotalDiscountsSet: moneyBag("0.00"),
    currentTotalTaxSet: moneyBag("0.00"),
    netPaymentSet: moneyBag("10.00"),
    totalRefundedSet: moneyBag("0.00"),
    refundDiscrepancySet: moneyBag("0.00"),
    cartDiscountAmountSet: moneyBag("0.00"),
    currentCartDiscountAmountSet: moneyBag("0.00"),
    currentShippingPriceSet: moneyBag("0.00"),
    ...overrides,
  };
}

function line(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "gid://shopify/LineItem/1",
    __parentId: "gid://shopify/Order/1",
    quantity: 1,
    currentQuantity: 1,
    refundableQuantity: 1,
    unfulfilledQuantity: 0,
    isGiftCard: false,
    title: "Line",
    variantTitle: null,
    vendor: null,
    sku: null,
    name: "Line",
    originalTotalSet: moneyBag("10.00"),
    originalUnitPriceSet: moneyBag("10.00"),
    discountedTotalSetWithCodeDiscounts: moneyBag("9.00"),
    discountedTotalSet: moneyBag("9.50"),
    totalDiscountSet: moneyBag("1.00"),
    discountedUnitPriceAfterAllDiscountsSet: moneyBag("9.00"),
    ...overrides,
  };
}

describe("PR6-D Bulk A snapshot mapper", () => {
  it("uses selected with-code discounts and actual confirmed; agreements stay incomplete until ledger", () => {
    const snapshot = mapBulkAAssemblyToOrderSnapshot(root(), [line()]);
    expect(snapshot.lines[0]?.discountedTotalSet.shopAmount).toBe("9.00");
    expect(snapshot.confirmed).toBe(true);
    expect(snapshot.agreements).toEqual([]);
    expect(snapshot.agreementsComplete).toBe(false);
    expect(snapshot.displayFulfillmentStatus).toBe("UNFULFILLED");
    expect(snapshot.closedAt).toBeNull();
  });

  it("persists selected-null closedAt without inventing a timestamp", () => {
    const snapshot = mapBulkAAssemblyToOrderSnapshot(root({ closedAt: null }), [
      line(),
    ]);
    expect(snapshot.closedAt).toBeNull();
  });

  it("fails closed when confirmed is omitted rather than writing true", () => {
    const omitted = root();
    delete omitted.confirmed;
    expect(() => mapBulkAAssemblyToOrderSnapshot(omitted, [line()])).toThrow(
      /confirmed omitted/,
    );
  });

  it("maps confirmed false from the selected Bulk A field", () => {
    const snapshot = mapBulkAAssemblyToOrderSnapshot(root({ confirmed: false }), [
      line(),
    ]);
    expect(snapshot.confirmed).toBe(false);
  });

  it("fails closed when with-code discountedTotalSet is omitted", () => {
    const without = line();
    delete without.discountedTotalSetWithCodeDiscounts;
    expect(() => mapBulkAAssemblyToOrderSnapshot(root(), [without])).toThrow(
      /withCodeDiscounts/,
    );
  });

  it("fails closed when closedAt is omitted rather than inventing null", () => {
    const omitted = root();
    delete omitted.closedAt;
    expect(() => mapBulkAAssemblyToOrderSnapshot(omitted, [line()])).toThrow(
      /closedAt omitted/,
    );
  });

  it("does not treat a JSONL agreements bag as a manufactured complete ledger", () => {
    const snapshot = mapBulkAAssemblyToOrderSnapshot(
      root({ agreements: [{ id: "gid://shopify/OrderAgreement/1" }] }),
      [line()],
    );
    expect(snapshot.agreements).toEqual([]);
    expect(snapshot.agreementsComplete).toBe(false);
  });
});
