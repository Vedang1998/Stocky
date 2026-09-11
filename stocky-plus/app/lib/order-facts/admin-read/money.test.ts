import { describe, expect, it } from "vitest";
import { optionalMoneyBag, requireMoneyBag } from "./money";
import { OrderFactReadWalkError } from "./errors";
import { ORDER_OPTIONAL_MONEY_BAGS, ORDER_REQUIRED_MONEY_BAGS } from "../types";
import { moneyBag } from "./__tests__/fixtures";

describe("PR6-B money mapping", () => {
  it("T30 rejects Number money amounts", () => {
    expect(() =>
      requireMoneyBag(
        {
          shopMoney: { amount: 10.5, currencyCode: "USD" },
          presentmentMoney: { amount: "10.50", currencyCode: "USD" },
        },
        "order.originalTotalPriceSet",
        "USD",
      ),
    ).toThrow(OrderFactReadWalkError);
    try {
      requireMoneyBag(
        {
          shopMoney: { amount: 10.5, currencyCode: "USD" },
          presentmentMoney: { amount: "10.50", currencyCode: "USD" },
        },
        "order.originalTotalPriceSet",
        "USD",
      );
    } catch (error) {
      expect(error).toBeInstanceOf(OrderFactReadWalkError);
      if (error instanceof OrderFactReadWalkError) {
        expect(error.kind).toBe("MALFORMED_MONEY");
      }
    }
  });

  it("preserves exact decimal strings including sub-cent fractions and zero", () => {
    const bag = requireMoneyBag(moneyBag("0.123456"), "sale.totalAmount", "USD");
    expect(bag.shopAmount).toBe("0.123456");
    expect(bag.shopCurrencyCode).toBe("USD");
    const zero = requireMoneyBag(moneyBag("0.00"), "line.originalTotalSet", "USD");
    expect(zero.shopAmount).toBe("0.00");
  });

  it("fails the snapshot when required shop currency mismatches the order", () => {
    expect(() =>
      requireMoneyBag(moneyBag("10.00", "EUR"), "order.netPaymentSet", "USD"),
    ).toThrow(/MONEY_CURRENCY_MISMATCH|does not match order currencyCode/);
  });

  it("optional bags may be absent and still fail when present-but-invalid", () => {
    expect(optionalMoneyBag(null, "order.cartDiscountAmountSet", "USD")).toBeNull();
    expect(() =>
      optionalMoneyBag(
        {
          shopMoney: { amount: 1, currencyCode: "USD" },
          presentmentMoney: { amount: "1.00", currencyCode: "USD" },
        },
        "order.currentShippingPriceSet",
        "USD",
      ),
    ).toThrow(OrderFactReadWalkError);
  });

  it("covers all eight required money-bag groups from A without redefining them", () => {
    expect(Object.keys(ORDER_REQUIRED_MONEY_BAGS)).toEqual([
      "order",
      "line",
      "refund",
      "refundLine",
      "refundShippingLine",
      "orderAdjustment",
      "sale",
      "orderTransaction",
    ]);
    for (const bags of Object.values(ORDER_REQUIRED_MONEY_BAGS)) {
      expect(bags.length).toBeGreaterThan(0);
      for (const bagName of bags) {
        const mapped = requireMoneyBag(
          moneyBag("1.00"),
          `group.${bagName}`,
          "USD",
        );
        expect(mapped.shopAmount).toBe("1.00");
      }
    }
    expect(ORDER_OPTIONAL_MONEY_BAGS.order).toContain("currentShippingPriceSet");
    expect(ORDER_REQUIRED_MONEY_BAGS.refundLine).toContain("priceSet");
  });
});
