import type { LandedCostMethod } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import type { TenantDb } from "../tenant/tenant-db.server";

export interface LandedCostLineInput {
  id: string;
  unitCost: Decimal;
  weight: Decimal | null;
  volume: Decimal | null;
  orderedQty: number;
}

export function allocateLandedCosts(
  lineItems: LandedCostLineInput[],
  freightCost: number,
  customsCost: number,
  method: LandedCostMethod,
): Map<string, Decimal> {
  const totalExtra = freightCost + customsCost;
  if (totalExtra <= 0 || lineItems.length === 0) {
    return new Map(lineItems.map((li) => [li.id, new Decimal(0)]));
  }

  const weights = lineItems.map((li) => {
    const qty = li.orderedQty;
    switch (method) {
      case "WEIGHT":
        return Number(li.weight ?? 0) * qty;
      case "VOLUME":
        return Number(li.volume ?? 0) * qty;
      case "COST":
      default:
        return Number(li.unitCost) * qty;
    }
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const allocations = new Map<string, Decimal>();

  if (totalWeight === 0) {
    const perLine = totalExtra / lineItems.length;
    for (const li of lineItems) {
      allocations.set(li.id, new Decimal(perLine / li.orderedQty));
    }
    return allocations;
  }

  lineItems.forEach((li, i) => {
    const share = (weights[i]! / totalWeight) * totalExtra;
    allocations.set(li.id, new Decimal(share / li.orderedQty));
  });

  return allocations;
}

export async function resolveTieredUnitCost(
  db: TenantDb,
  supplierId: string,
  variantId: string,
  quantity: number,
): Promise<Decimal | null> {
  const tiers = await db.volumePriceTier.findMany({
    where: { supplierId, variantId },
    orderBy: { minQty: "desc" },
  });

  for (const tier of tiers) {
    if (
      quantity >= tier.minQty &&
      (tier.maxQty === null || quantity <= tier.maxQty)
    ) {
      return tier.unitCost;
    }
  }
  return null;
}
