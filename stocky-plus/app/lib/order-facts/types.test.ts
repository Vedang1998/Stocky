import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FROZEN_ORDER_NUMERIC_PRECISION,
  FROZEN_ORDER_NUMERIC_SCALE,
  ORDER_EXISTENCE_KINDS,
  ORDER_EXISTENCE_DIAGNOSTIC_STATES,
  ORDER_HISTORY_ACCESS_DIAGNOSTICS,
  ORDER_HISTORY_WINDOW_STATES,
  ORDER_LOCK_BEFORE_FIRST_INSERT,
  ORDER_MONEY_DIAGNOSTIC_STATES,
  ORDER_OBSERVATION_FAILURE_OUTCOMES,
  ORDER_OPTIONAL_MONEY_BAGS,
  ORDER_REQUIRED_MONEY_BAGS,
  ORDER_UNIT_DIAGNOSTIC_STATES,
  REFUND_SHIPPING_REQUIRED_SIDES_COMPILE_CHECK,
  type ExactMoneyText,
  type MoneyBagSides,
  type RefundShippingLineSnapshot,
} from "./types";

const DIR = path.dirname(fileURLToPath(import.meta.url));

describe("PR6-A order-facts types contract", () => {
  it("is types-only: no Prisma, GraphQL, network, or database I/O", () => {
    const text = readFileSync(path.join(DIR, "types.ts"), "utf8");
    expect(text).not.toMatch(/from ["']@prisma\/client["']/);
    expect(text).not.toMatch(/from ["']\.prisma["']/);
    expect(text).not.toMatch(/graphql-codegen|@shopify\/api-codegen/);
    expect(text).not.toMatch(/\bfetch\s*\(/);
    expect(text).not.toMatch(/\$queryRaw|PrismaClient|pg\./);
  });

  it("freezes exact money as strings and Decimal(20,6) shape", () => {
    const sample: ExactMoneyText = "1.234567";
    expect(typeof sample).toBe("string");
    expect(FROZEN_ORDER_NUMERIC_PRECISION).toBe(20);
    expect(FROZEN_ORDER_NUMERIC_SCALE).toBe(6);
    expect(ORDER_REQUIRED_MONEY_BAGS.refundLine).toContain("priceSet");
  });

  it("includes window/unverified existence kinds and lock-before-first-insert", () => {
    expect(ORDER_EXISTENCE_KINDS).toContain("INACCESSIBLE_HISTORY_WINDOW");
    expect(ORDER_EXISTENCE_KINDS).toContain(
      "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
    );
    expect(ORDER_LOCK_BEFORE_FIRST_INSERT).toBe(true);
  });

  it("matches the frozen §6.3 required and optional money-bag tables literally", () => {
    expect(ORDER_REQUIRED_MONEY_BAGS).toEqual({
      order: [
        "originalTotalPriceSet",
        "currentTotalPriceSet",
        "currentSubtotalPriceSet",
        "currentTotalDiscountsSet",
        "currentTotalTaxSet",
        "totalRefundedSet",
        "netPaymentSet",
      ],
      line: [
        "originalTotalSet",
        "originalUnitPriceSet",
        "discountedTotalSet",
        "totalDiscountSet",
      ],
      refund: ["totalRefundedSet"],
      refundLine: ["subtotalSet", "totalTaxSet", "priceSet"],
      refundShippingLine: ["subtotalAmountSet", "taxAmountSet"],
      orderAdjustment: ["amountSet", "taxAmountSet"],
      sale: ["totalAmount"],
      orderTransaction: ["amountSet"],
    });
    expect(ORDER_OPTIONAL_MONEY_BAGS).toEqual({
      order: [
        "refundDiscrepancySet",
        "cartDiscountAmountSet",
        "currentCartDiscountAmountSet",
        "currentShippingPriceSet",
      ],
      line: ["discountedUnitPriceAfterAllDiscountsSet"],
    });
    expect(ORDER_REQUIRED_MONEY_BAGS.refundShippingLine).not.toEqual(
      ORDER_OPTIONAL_MONEY_BAGS.order,
    );
  });

  it("requires MoneyBagSides on refund-shipping snapshots (null sides are not validated)", () => {
    expect(REFUND_SHIPPING_REQUIRED_SIDES_COMPILE_CHECK).toBe(true);
    const required: MoneyBagSides = {
      shopAmount: "1.00",
      shopCurrencyCode: "USD",
      presentmentAmount: "1.00",
      presentmentCurrencyCode: "USD",
    };
    const snapshot: RefundShippingLineSnapshot = {
      shopifyGid: null,
      subtotal: required,
      tax: required,
    };
    expect(snapshot.subtotal.shopAmount).toBe("1.00");
    expect(snapshot.tax.shopAmount).toBe("1.00");
    const typesText = readFileSync(path.join(DIR, "types.ts"), "utf8");
    expect(typesText).toMatch(/subtotal: MoneyBagSides/);
    expect(typesText).toMatch(/tax: MoneyBagSides/);
    expect(typesText).not.toMatch(/subtotal: OptionalMoneyBagSides/);
    expect(typesText).not.toMatch(/as MoneyBagSides/);
    expect(typesText).not.toMatch(/as OptionalMoneyBagSides/);
    const schema = readFileSync(
      path.join(DIR, "../../../prisma/schema.prisma"),
      "utf8",
    );
    expect(schema).not.toMatch(/model ShopifyOrderShippingLineFact/);
  });

  it("distinguishes existence kinds, unit diagnostics, history/access diagnostics, and observation outcomes", () => {
    expect([...ORDER_EXISTENCE_KINDS]).toEqual([
      "LIVE_REFETCH",
      "LIVE_FULL_SYNC_PRESENT",
      "ABSENT_CONFIRMED_QUERY",
      "INACCESSIBLE_HISTORY_WINDOW",
      "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
    ]);
    expect([...ORDER_UNIT_DIAGNOSTIC_STATES]).toEqual([
      "LINE_UNIT_IDENTITY_INCONSISTENT",
      "UNIT_SALE_SIGN_INCONSISTENT",
    ]);
    expect([...ORDER_HISTORY_WINDOW_STATES]).toEqual([
      "ORDER_HISTORY_WINDOW_TRUNCATED",
      "REFUND_OUTSIDE_ACCESSIBLE_WINDOW",
    ]);
    expect([...ORDER_EXISTENCE_DIAGNOSTIC_STATES]).toEqual([
      "ORDER_EXISTENCE_UNVERIFIABLE_WINDOW",
    ]);
    expect([...ORDER_HISTORY_ACCESS_DIAGNOSTICS]).toEqual([
      "ORDER_HISTORY_WINDOW_TRUNCATED",
      "ORDER_EXISTENCE_UNVERIFIABLE_WINDOW",
      "REFUND_OUTSIDE_ACCESSIBLE_WINDOW",
    ]);
    expect([...ORDER_MONEY_DIAGNOSTIC_STATES]).toEqual([
      "REFUND_MONEY_UNBALANCED",
      "MONEY_CURRENCY_MISMATCH",
    ]);
    expect([...ORDER_OBSERVATION_FAILURE_OUTCOMES]).toEqual([
      "SNAPSHOT_PAGINATION_INCOMPLETE",
    ]);
    expect(ORDER_HISTORY_ACCESS_DIAGNOSTICS).not.toContain(
      "INACCESSIBLE_HISTORY_WINDOW",
    );
    expect(ORDER_HISTORY_WINDOW_STATES).not.toContain(
      "INACCESSIBLE_HISTORY_WINDOW",
    );
    expect(ORDER_EXISTENCE_KINDS).toContain("INACCESSIBLE_HISTORY_WINDOW");
    expect(ORDER_OBSERVATION_FAILURE_OUTCOMES).not.toContain(
      "INACCESSIBLE_HISTORY_WINDOW",
    );
    expect(ORDER_UNIT_DIAGNOSTIC_STATES).not.toContain(
      "INACCESSIBLE_HISTORY_WINDOW",
    );
  });
});
