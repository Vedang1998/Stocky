/**
 * Supplier ordering rules a merchant can choose to apply to a quantity:
 * raise it to the supplier's minimum order, then round up to whole packs.
 *
 * Nothing here runs unless the caller passes the merchant's choice for this
 * run. A quantity of zero is left alone, so opting in never creates an order
 * line the merchant didn't ask for.
 */
import type { RoundingOptions, RuleAdjustment } from "./types";

export type SupplierRuleName = RuleAdjustment["rule"];

export type SupplierRuleResult = {
  quantity: number;
  adjustments: RuleAdjustment[];
  /** Rules the merchant asked for that had no usable supplier value. */
  missing: SupplierRuleName[];
};

function positiveOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

export function applySupplierRules(
  quantity: number,
  supplier: {
    minimumOrderQuantity: number | null | undefined;
    packSize: number | null | undefined;
  },
  options: RoundingOptions,
): SupplierRuleResult {
  const adjustments: RuleAdjustment[] = [];
  const missing: SupplierRuleName[] = [];
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    return { quantity, adjustments, missing };
  }

  let result = quantity;
  if (options.applyMinimumOrderQuantity) {
    const minimumOrder = positiveOrNull(supplier.minimumOrderQuantity);
    if (minimumOrder == null) {
      missing.push("MINIMUM_ORDER_QUANTITY");
    } else if (result < minimumOrder) {
      adjustments.push({
        rule: "MINIMUM_ORDER_QUANTITY",
        before: result,
        after: minimumOrder,
      });
      result = minimumOrder;
    }
  }

  if (options.roundUpToPackSize) {
    const pack = positiveOrNull(supplier.packSize);
    if (pack == null) {
      missing.push("PACK_SIZE");
    } else if (result % pack !== 0) {
      const rounded = Math.ceil(result / pack) * pack;
      adjustments.push({ rule: "PACK_SIZE", before: result, after: rounded });
      result = rounded;
    }
  }

  return { quantity: result, adjustments, missing };
}
