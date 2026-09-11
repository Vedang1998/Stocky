/**
 * Snapshot money/shape validation. Fail-apply the entire resource snapshot
 * when a required bag is missing/invalid or required currency mismatches.
 */
import type { MoneyBagSides, OptionalMoneyBagSides } from "../types";
import {
  parseOptionalMoneyBag,
  parseRequiredMoneyBag,
  rejectMixedShopCurrencySum,
  sumExactMoney,
  exactNumericEqual,
} from "./money";
import type {
  AdjustmentSnapshot,
  OrderLineSnapshot,
  OrderSnapshot,
  RefundShippingLineInput,
  RefundSnapshot,
  SaleSnapshot,
} from "./types";
import { DIAGNOSTIC } from "./types";

export type ParsedOrderMoney = {
  originalTotalPriceSet: MoneyBagSides;
  currentTotalPriceSet: MoneyBagSides;
  currentSubtotalPriceSet: MoneyBagSides;
  currentTotalDiscountsSet: MoneyBagSides;
  currentTotalTaxSet: MoneyBagSides;
  totalRefundedSet: MoneyBagSides;
  netPaymentSet: MoneyBagSides;
  refundDiscrepancySet: OptionalMoneyBagSides | null;
  cartDiscountAmountSet: OptionalMoneyBagSides | null;
  currentCartDiscountAmountSet: OptionalMoneyBagSides | null;
  currentShippingPriceSet: OptionalMoneyBagSides | null;
};

export type ParsedLineMoney = {
  originalTotalSet: MoneyBagSides;
  originalUnitPriceSet: MoneyBagSides;
  discountedTotalSet: MoneyBagSides;
  totalDiscountSet: MoneyBagSides;
  discountedUnitPriceAfterAllDiscountsSet: OptionalMoneyBagSides | null;
};

export type ParsedRefundMoney = {
  totalRefundedSet: MoneyBagSides;
  shippingLineCount: number;
  shippingSubtotal: MoneyBagSides | null;
  shippingTax: MoneyBagSides | null;
  moneyDiagnosticState: string | null;
};

/**
 * Fail-apply the entire order snapshot before any merchant DML (T48).
 * Required bags on the order, every line, and every sale must parse.
 */
export function parseCompleteOrderSnapshot(order: OrderSnapshot): ParsedOrderMoney {
  const parsed = parseOrderMoney(order);
  for (const line of order.lines) {
    parseLineMoney(line, order.shopCurrencyCode);
  }
  for (const agreement of order.agreements) {
    for (const sale of agreement.sales) {
      parseSaleMoney(sale, order.shopCurrencyCode);
    }
  }
  return parsed;
}

export function parseOrderMoney(order: OrderSnapshot): ParsedOrderMoney {
  const ccy = order.shopCurrencyCode;
  return {
    originalTotalPriceSet: parseRequiredMoneyBag(
      order.originalTotalPriceSet,
      "originalTotalPriceSet",
      ccy,
    ),
    currentTotalPriceSet: parseRequiredMoneyBag(
      order.currentTotalPriceSet,
      "currentTotalPriceSet",
      ccy,
    ),
    currentSubtotalPriceSet: parseRequiredMoneyBag(
      order.currentSubtotalPriceSet,
      "currentSubtotalPriceSet",
      ccy,
    ),
    currentTotalDiscountsSet: parseRequiredMoneyBag(
      order.currentTotalDiscountsSet,
      "currentTotalDiscountsSet",
      ccy,
    ),
    currentTotalTaxSet: parseRequiredMoneyBag(
      order.currentTotalTaxSet,
      "currentTotalTaxSet",
      ccy,
    ),
    totalRefundedSet: parseRequiredMoneyBag(
      order.totalRefundedSet,
      "totalRefundedSet",
      ccy,
    ),
    netPaymentSet: parseRequiredMoneyBag(order.netPaymentSet, "netPaymentSet", ccy),
    refundDiscrepancySet: parseOptionalMoneyBag(
      order.refundDiscrepancySet,
      "refundDiscrepancySet",
      ccy,
    ),
    cartDiscountAmountSet: parseOptionalMoneyBag(
      order.cartDiscountAmountSet,
      "cartDiscountAmountSet",
      ccy,
    ),
    currentCartDiscountAmountSet: parseOptionalMoneyBag(
      order.currentCartDiscountAmountSet,
      "currentCartDiscountAmountSet",
      ccy,
    ),
    currentShippingPriceSet: parseOptionalMoneyBag(
      order.currentShippingPriceSet,
      "currentShippingPriceSet",
      ccy,
    ),
  };
}

export function parseLineMoney(
  line: OrderLineSnapshot,
  shopCurrencyCode: string,
): ParsedLineMoney {
  return {
    originalTotalSet: parseRequiredMoneyBag(
      line.originalTotalSet,
      "originalTotalSet",
      shopCurrencyCode,
    ),
    originalUnitPriceSet: parseRequiredMoneyBag(
      line.originalUnitPriceSet,
      "originalUnitPriceSet",
      shopCurrencyCode,
    ),
    discountedTotalSet: parseRequiredMoneyBag(
      line.discountedTotalSet,
      "discountedTotalSet",
      shopCurrencyCode,
    ),
    totalDiscountSet: parseRequiredMoneyBag(
      line.totalDiscountSet,
      "totalDiscountSet",
      shopCurrencyCode,
    ),
    discountedUnitPriceAfterAllDiscountsSet: parseOptionalMoneyBag(
      line.discountedUnitPriceAfterAllDiscountsSet,
      "discountedUnitPriceAfterAllDiscountsSet",
      shopCurrencyCode,
    ),
  };
}

export function parseSaleMoney(
  sale: SaleSnapshot,
  shopCurrencyCode: string,
): MoneyBagSides {
  return parseRequiredMoneyBag(sale.totalAmount, "totalAmount", shopCurrencyCode);
}

function sumBags(
  bags: MoneyBagSides[],
  field: string,
): MoneyBagSides | null {
  if (bags.length === 0) return null;
  rejectMixedShopCurrencySum(bags.map((bag) => bag.shopCurrencyCode), field);
  rejectMixedShopCurrencySum(
    bags.map((bag) => bag.presentmentCurrencyCode),
    `${field}.presentment`,
  );
  return {
    shopAmount: sumExactMoney(
      bags.map((bag) => bag.shopAmount),
      field,
    ),
    shopCurrencyCode: bags[0].shopCurrencyCode,
    presentmentAmount: sumExactMoney(
      bags.map((bag) => bag.presentmentAmount),
      `${field}.presentment`,
    ),
    presentmentCurrencyCode: bags[0].presentmentCurrencyCode,
  };
}

export function parseRefundMoney(
  refund: RefundSnapshot,
  shopCurrencyCode: string,
): ParsedRefundMoney {
  const totalRefundedSet = parseRequiredMoneyBag(
    refund.totalRefundedSet,
    "totalRefundedSet",
    shopCurrencyCode,
  );
  const shippingShop: MoneyBagSides[] = [];
  const shippingTax: MoneyBagSides[] = [];
  for (const [index, line] of refund.shippingLines.entries()) {
    shippingShop.push(
      parseRequiredMoneyBag(
        line.subtotal,
        `refundShippingLine[${index}].subtotalAmountSet`,
        shopCurrencyCode,
      ),
    );
    shippingTax.push(
      parseRequiredMoneyBag(
        line.tax,
        `refundShippingLine[${index}].taxAmountSet`,
        shopCurrencyCode,
      ),
    );
  }
  const lineSubtotals: MoneyBagSides[] = [];
  const lineTaxes: MoneyBagSides[] = [];
  for (const [index, line] of refund.lines.entries()) {
    lineSubtotals.push(
      parseRequiredMoneyBag(
        line.subtotalSet,
        `refundLine[${index}].subtotalSet`,
        shopCurrencyCode,
      ),
    );
    lineTaxes.push(
      parseRequiredMoneyBag(
        line.totalTaxSet,
        `refundLine[${index}].totalTaxSet`,
        shopCurrencyCode,
      ),
    );
    parseRequiredMoneyBag(
      line.priceSet,
      `refundLine[${index}].priceSet`,
      shopCurrencyCode,
    );
  }
  const adjAmounts: MoneyBagSides[] = [];
  const adjTaxes: MoneyBagSides[] = [];
  for (const [index, adj] of refund.adjustments.entries()) {
    adjAmounts.push(
      parseRequiredMoneyBag(
        adj.amountSet,
        `orderAdjustment[${index}].amountSet`,
        shopCurrencyCode,
      ),
    );
    adjTaxes.push(
      parseRequiredMoneyBag(
        adj.taxAmountSet,
        `orderAdjustment[${index}].taxAmountSet`,
        shopCurrencyCode,
      ),
    );
  }
  for (const [index, txn] of refund.transactions.entries()) {
    parseRequiredMoneyBag(
      txn.amountSet,
      `orderTransaction[${index}].amountSet`,
      shopCurrencyCode,
    );
  }

  const shippingSubtotal = sumBags(shippingShop, "refundShippingSubtotal");
  const shippingTaxSum = sumBags(shippingTax, "refundShippingTax");
  const identityTerms = [
    ...lineSubtotals,
    ...lineTaxes,
    ...(shippingSubtotal ? [shippingSubtotal] : []),
    ...(shippingTaxSum ? [shippingTaxSum] : []),
    ...adjAmounts,
    ...adjTaxes,
  ];
  const identitySum = sumBags(identityTerms, "refundMoneyIdentity");
  let moneyDiagnosticState: string | null = null;
  if (
    identitySum &&
    !exactNumericEqual(
      identitySum.shopAmount,
      totalRefundedSet.shopAmount,
      "refundMoneyIdentity",
    )
  ) {
    moneyDiagnosticState = DIAGNOSTIC.REFUND_UNBALANCED;
  }

  return {
    totalRefundedSet,
    shippingLineCount: refund.shippingLines.length,
    shippingSubtotal,
    shippingTax: shippingTaxSum,
    moneyDiagnosticState,
  };
}

export function parseAdjustmentMoney(
  adj: AdjustmentSnapshot,
  shopCurrencyCode: string,
): { amountSet: MoneyBagSides; taxAmountSet: MoneyBagSides } {
  return {
    amountSet: parseRequiredMoneyBag(adj.amountSet, "amountSet", shopCurrencyCode),
    taxAmountSet: parseRequiredMoneyBag(
      adj.taxAmountSet,
      "taxAmountSet",
      shopCurrencyCode,
    ),
  };
}

export function refundShopCurrency(
  refund: RefundSnapshot,
  localOrderCurrency: string | null,
): string {
  const fromBag = refund.totalRefundedSet?.shopCurrencyCode;
  if (typeof fromBag === "string" && fromBag.trim() !== "") {
    return fromBag.trim();
  }
  if (localOrderCurrency) return localOrderCurrency;
  throw new Error("Refund snapshot is missing shop currency");
}
