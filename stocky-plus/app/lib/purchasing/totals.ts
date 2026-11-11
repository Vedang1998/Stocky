/**
 * Purchase-order line, total and landed-cost arithmetic.
 *
 * Rules (documented in docs/purchasing/PURCHASING_LEDGER.md):
 * - Line amounts are rounded to cents per line, half away from zero.
 * - Line discount percent reduces the line before tax; tax is computed on the
 *   discounted line and is excluded from landed cost.
 * - Header charges flagged `allocate` are spread across lines so that the line
 *   shares add up to the charge total exactly (largest-remainder on cents,
 *   ties broken by line position). DISCOUNT charges reduce the amount spread.
 * - WEIGHT / VOLUME / COST allocation falls back to QUANTITY when every line has
 *   a zero basis; the fallback is reported, never hidden.
 */
import { Prisma } from "@prisma/client";
import {
  dec,
  HUNDRED,
  ONE,
  roundMoney,
  roundTo,
  sum,
  UNIT_COST_SCALE,
  ZERO,
  type DecimalInput,
} from "./decimal";

export const CHARGE_KINDS = [
  "SHIPPING",
  "DUTY",
  "FEE",
  "DISCOUNT",
  "OTHER",
] as const;
export type ChargeKind = (typeof CHARGE_KINDS)[number];

export const CHARGE_KIND_LABELS: Record<ChargeKind, string> = {
  SHIPPING: "Shipping",
  DUTY: "Duties and customs",
  FEE: "Fee",
  DISCOUNT: "Discount",
  OTHER: "Other charge",
};

export const ALLOCATION_METHODS = [
  "COST",
  "QUANTITY",
  "WEIGHT",
  "VOLUME",
] as const;
export type AllocationMethod = (typeof ALLOCATION_METHODS)[number];

export const ALLOCATION_METHOD_LABELS: Record<AllocationMethod, string> = {
  COST: "By line cost",
  QUANTITY: "By quantity",
  WEIGHT: "By weight",
  VOLUME: "By volume",
};

export type LineCostInput = {
  id: string;
  position: number;
  orderedQty: number;
  cancelledQty: number;
  unitCost: DecimalInput;
  discountPercent: DecimalInput | null;
  taxRatePercent: DecimalInput | null;
  /** Per-unit weight in grams. */
  weightGrams: DecimalInput | null;
  /** Per-unit volume in the merchant's chosen unit. */
  volume: DecimalInput | null;
};

export type ChargeInput = {
  kind: ChargeKind;
  amount: DecimalInput;
  allocate: boolean;
};

export type LineCostResult = {
  id: string;
  /** Ordered minus cancelled; the quantity the PO is still worth. */
  effectiveQty: number;
  grossAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  netAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  netUnitCost: Prisma.Decimal;
  allocatedCharges: Prisma.Decimal;
  allocatedPerUnit: Prisma.Decimal;
  landedUnitCost: Prisma.Decimal;
};

export type PurchaseOrderTotals = {
  lines: LineCostResult[];
  units: number;
  grossAmount: Prisma.Decimal;
  lineDiscountAmount: Prisma.Decimal;
  merchandiseAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  chargesAmount: Prisma.Decimal;
  allocatableChargesAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  allocation: {
    requested: AllocationMethod;
    applied: AllocationMethod | null;
    /** Charges that could not be spread because the PO has no units. */
    unallocatedAmount: Prisma.Decimal;
  };
};

export function signedChargeAmount(charge: ChargeInput): Prisma.Decimal {
  const amount = roundMoney(dec(charge.amount));
  return charge.kind === "DISCOUNT" ? amount.negated() : amount;
}

function lineBasis(
  line: LineCostInput,
  result: Pick<LineCostResult, "effectiveQty" | "netAmount">,
  method: AllocationMethod,
): Prisma.Decimal {
  switch (method) {
    case "COST":
      return result.netAmount.abs();
    case "QUANTITY":
      return dec(result.effectiveQty);
    case "WEIGHT":
      return dec(line.weightGrams).times(result.effectiveQty);
    case "VOLUME":
      return dec(line.volume).times(result.effectiveQty);
  }
}

/**
 * Split `totalCents` (an integer) across `weights` so the parts are integers
 * that add up exactly to the total. Largest fractional remainder wins the
 * leftover cents; equal remainders go to the earlier index.
 */
export function distributeCents(
  totalCents: Prisma.Decimal,
  weights: Prisma.Decimal[],
): Prisma.Decimal[] {
  if (!totalCents.isInteger()) {
    throw new RangeError("distributeCents requires an integer number of cents");
  }
  const weightTotal = sum(weights);
  if (weightTotal.lte(0) || weights.length === 0) {
    throw new RangeError("distributeCents requires a positive weight total");
  }
  const negative = totalCents.isNegative();
  const magnitude = totalCents.abs();
  const raw = weights.map((w) => magnitude.times(w).dividedBy(weightTotal));
  const floors = raw.map((r) =>
    r.toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN),
  );
  let leftover = magnitude.minus(sum(floors)).toNumber();
  const order = raw
    .map((r, index) => ({ index, fraction: r.minus(floors[index]!) }))
    .sort((a, b) => {
      const cmp = b.fraction.comparedTo(a.fraction);
      return cmp !== 0 ? cmp : a.index - b.index;
    });
  const parts = [...floors];
  for (const { index } of order) {
    if (leftover <= 0) break;
    parts[index] = parts[index]!.plus(1);
    leftover -= 1;
  }
  return negative ? parts.map((p) => p.negated()) : parts;
}

export function computePurchaseOrderTotals(
  lineInputs: LineCostInput[],
  charges: ChargeInput[],
  method: AllocationMethod,
): PurchaseOrderTotals {
  const ordered = [...lineInputs].sort((a, b) =>
    a.position !== b.position
      ? a.position - b.position
      : a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0,
  );

  const lines: LineCostResult[] = ordered.map((line) => {
    const effectiveQty = Math.max(0, line.orderedQty - line.cancelledQty);
    const unitCost = dec(line.unitCost);
    const discountFactor = ONE.minus(dec(line.discountPercent).dividedBy(HUNDRED));
    const grossAmount = roundMoney(unitCost.times(effectiveQty));
    const netAmount = roundMoney(unitCost.times(effectiveQty).times(discountFactor));
    const taxAmount = roundMoney(
      netAmount.times(dec(line.taxRatePercent)).dividedBy(HUNDRED),
    );
    const netUnitCost = roundTo(unitCost.times(discountFactor), UNIT_COST_SCALE);
    return {
      id: line.id,
      effectiveQty,
      grossAmount,
      discountAmount: grossAmount.minus(netAmount),
      netAmount,
      taxAmount,
      netUnitCost,
      allocatedCharges: ZERO,
      allocatedPerUnit: ZERO,
      landedUnitCost: netUnitCost,
    };
  });

  const chargesAmount = sum(charges.map(signedChargeAmount));
  const allocatableChargesAmount = sum(
    charges.filter((c) => c.allocate).map(signedChargeAmount),
  );

  let applied: AllocationMethod | null = null;
  let unallocatedAmount = ZERO;
  if (!allocatableChargesAmount.isZero()) {
    const candidates: AllocationMethod[] =
      method === "QUANTITY" ? ["QUANTITY"] : [method, "QUANTITY"];
    for (const candidate of candidates) {
      const weights = ordered.map((line, i) => lineBasis(line, lines[i]!, candidate));
      if (sum(weights).gt(0)) {
        applied = candidate;
        const cents = distributeCents(allocatableChargesAmount.times(100), weights);
        cents.forEach((c, i) => {
          const line = lines[i]!;
          line.allocatedCharges = c.dividedBy(100);
          line.allocatedPerUnit =
            line.effectiveQty > 0
              ? roundTo(line.allocatedCharges.dividedBy(line.effectiveQty), UNIT_COST_SCALE)
              : ZERO;
          line.landedUnitCost = line.netUnitCost.plus(line.allocatedPerUnit);
        });
        break;
      }
    }
    if (applied === null) unallocatedAmount = allocatableChargesAmount;
  }

  const merchandiseAmount = sum(lines.map((l) => l.netAmount));
  const taxAmount = sum(lines.map((l) => l.taxAmount));
  return {
    lines,
    units: lines.reduce((n, l) => n + l.effectiveQty, 0),
    grossAmount: sum(lines.map((l) => l.grossAmount)),
    lineDiscountAmount: sum(lines.map((l) => l.discountAmount)),
    merchandiseAmount,
    taxAmount,
    chargesAmount,
    allocatableChargesAmount,
    totalAmount: merchandiseAmount.plus(taxAmount).plus(chargesAmount),
    allocation: { requested: method, applied, unallocatedAmount },
  };
}

/**
 * Projected margin of a retail price over a landed unit cost, both in shop
 * currency. Null when either side is unknown or the price is not positive.
 */
export function projectedMarginPercent(
  retailPrice: DecimalInput | null,
  landedUnitCostShopCurrency: DecimalInput | null,
): Prisma.Decimal | null {
  if (retailPrice === null || landedUnitCostShopCurrency === null) return null;
  const price = dec(retailPrice);
  if (price.lte(0)) return null;
  return roundTo(
    price.minus(dec(landedUnitCostShopCurrency)).dividedBy(price).times(HUNDRED),
    1,
  );
}

/** Convert a PO-currency amount to shop currency with the frozen PO rate. */
export function toShopCurrency(
  amount: Prisma.Decimal,
  exchangeRate: DecimalInput | null,
  sameCurrency: boolean,
): Prisma.Decimal | null {
  if (sameCurrency) return amount;
  if (exchangeRate === null) return null;
  return amount.times(dec(exchangeRate));
}
