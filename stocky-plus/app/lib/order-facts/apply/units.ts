/**
 * PO-10 unit ledger. Sole ledger is ShopifyOrderAgreementSaleFact.
 * Never abs(). Never agreement+refund-line double subtraction. Never BOM.
 */
import type { AgreementSnapshot, OrderLineSnapshot } from "./types";
import { DIAGNOSTIC } from "./types";

const RETURN_REASONS = new Set(["REFUND", "RETURN"]);

export type LineUnitTotals = {
  shopifyLineItemGid: string;
  orderedUnits: number;
  currentUnits: number;
  refundedUnits: number;
  removedUnits: number;
  signInconsistent: boolean;
  identityInconsistent: boolean;
};

export type UnitEvaluation = {
  signInconsistent: boolean;
  identityInconsistent: boolean;
  lines: LineUnitTotals[];
  diagnostic: string | null;
};

export function isVariantUnitEligibleSale(sale: {
  lineType: string | null;
  saleTypename: string;
}): boolean {
  const type = (sale.lineType ?? "").toUpperCase();
  const name = sale.saleTypename;
  if (type === "PRODUCT" || name === "ProductSale") return true;
  return false;
}

export function isExcludedFromVariantDemand(input: {
  orderTest: boolean;
  isGiftCard: boolean;
  variantGidAtSale: string | null;
  lineType?: string | null;
}): boolean {
  if (input.orderTest) return true;
  if (input.isGiftCard) return true;
  if (input.variantGidAtSale == null) return true;
  const type = (input.lineType ?? "").toUpperCase();
  if (type === "GIFT_CARD" || type === "TIP") return true;
  return false;
}

function validOrderSign(quantity: number): boolean {
  return quantity > 0;
}

function validReturnSign(quantity: number): boolean {
  return quantity < 0;
}

export function evaluateUnits(input: {
  lines: readonly OrderLineSnapshot[];
  agreements: readonly AgreementSnapshot[];
}): UnitEvaluation {
  const byLine = new Map<string, LineUnitTotals>();
  for (const line of input.lines) {
    byLine.set(line.shopifyGid, {
      shopifyLineItemGid: line.shopifyGid,
      orderedUnits: line.quantity,
      currentUnits: line.currentQuantity,
      refundedUnits: 0,
      removedUnits: 0,
      signInconsistent: false,
      identityInconsistent: false,
    });
  }

  let signInconsistent = false;

  for (const agreement of input.agreements) {
    const reason = agreement.reason ?? null;
    for (const sale of agreement.sales) {
      if (sale.quantity == null) continue;
      if (!isVariantUnitEligibleSale(sale)) continue;
      const action = (sale.actionType ?? "UNKNOWN").toUpperCase();
      const qty = sale.quantity;
      if (action === "UPDATE") continue;
      if (action === "UNKNOWN") continue;

      if (action === "ORDER") {
        if (!validOrderSign(qty)) {
          signInconsistent = true;
          const line = sale.shopifyLineItemGid
            ? byLine.get(sale.shopifyLineItemGid)
            : undefined;
          if (line) line.signInconsistent = true;
        }
        continue;
      }

      if (action === "RETURN") {
        if (!validReturnSign(qty)) {
          signInconsistent = true;
          const line = sale.shopifyLineItemGid
            ? byLine.get(sale.shopifyLineItemGid)
            : undefined;
          if (line) line.signInconsistent = true;
          continue;
        }
        const line = sale.shopifyLineItemGid
          ? byLine.get(sale.shopifyLineItemGid)
          : undefined;
        if (!line) continue;
        const magnitude = -qty;
        if (reason === "ORDER_EDIT") {
          line.removedUnits += magnitude;
        } else if (reason != null && RETURN_REASONS.has(reason)) {
          line.refundedUnits += magnitude;
        }
        continue;
      }

      signInconsistent = true;
      const line = sale.shopifyLineItemGid
        ? byLine.get(sale.shopifyLineItemGid)
        : undefined;
      if (line) line.signInconsistent = true;
    }
  }

  let identityInconsistent = false;
  if (!signInconsistent) {
    for (const line of byLine.values()) {
      const expectedRemoved =
        line.orderedUnits - line.currentUnits - line.refundedUnits;
      if (expectedRemoved !== line.removedUnits) {
        line.identityInconsistent = true;
        identityInconsistent = true;
      }
    }
  }

  let diagnostic: string | null = null;
  if (signInconsistent) diagnostic = DIAGNOSTIC.SALE_SIGN;
  else if (identityInconsistent) diagnostic = DIAGNOSTIC.LINE_UNIT;

  return {
    signInconsistent,
    identityInconsistent,
    lines: [...byLine.values()],
    diagnostic,
  };
}

/** Money metrics wait on SUCCESS; units follow the ledger regardless. */
export function moneyMetricEligibleStatuses(
  statuses: readonly string[],
): boolean {
  return statuses.some((status) => status.toUpperCase() === "SUCCESS");
}
