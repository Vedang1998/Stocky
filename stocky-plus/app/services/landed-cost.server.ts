import prisma from "../db.server";
import type { LandedCostMethod } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

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

export async function applyLandedCostsToPO(purchaseOrderId: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { lineItems: true },
  });
  if (!po) throw new Error("Purchase order not found");

  const freight = Number(po.freightCost ?? 0);
  const customs = Number(po.customsCost ?? 0);

  const allocations = allocateLandedCosts(
    po.lineItems.map((li) => ({
      id: li.id,
      unitCost: li.unitCost,
      weight: li.weight,
      volume: li.volume,
      orderedQty: li.orderedQty,
    })),
    freight,
    customs,
    po.landedCostMethod,
  );

  await Promise.all(
    po.lineItems.map((li) =>
      prisma.pOLineItem.update({
        where: { id: li.id },
        data: { allocatedLandedCost: allocations.get(li.id) ?? new Decimal(0) },
      }),
    ),
  );
}

export function getTrueUnitCost(
  unitCost: Decimal,
  allocatedLandedCost: Decimal | null,
): number {
  return Number(unitCost) + Number(allocatedLandedCost ?? 0);
}

export async function resolveTieredUnitCost(
  supplierId: string,
  variantId: string,
  quantity: number,
): Promise<Decimal | null> {
  const tiers = await prisma.volumePriceTier.findMany({
    where: { supplierId, variantId },
    orderBy: { minQty: "desc" },
  });

  for (const tier of tiers) {
    if (quantity >= tier.minQty && (tier.maxQty === null || quantity <= tier.maxQty)) {
      return tier.unitCost;
    }
  }
  return null;
}

export async function recalculatePOLineCost(
  lineItemId: string,
  newQty: number,
): Promise<void> {
  const line = await prisma.pOLineItem.findUnique({
    where: { id: lineItemId },
    include: { purchaseOrder: true },
  });
  if (!line || line.manualCostOverride) return;

  const tierCost = await resolveTieredUnitCost(
    line.purchaseOrder.supplierId,
    line.shopifyVariantId,
    newQty,
  );
  if (tierCost) {
    await prisma.pOLineItem.update({
      where: { id: lineItemId },
      data: { unitCost: tierCost, orderedQty: newQty },
    });
  } else {
    await prisma.pOLineItem.update({
      where: { id: lineItemId },
      data: { orderedQty: newQty },
    });
  }
}

export async function receivePartialPO(
  purchaseOrderId: string,
  receivedItems: Array<{ lineItemId: string; receivedQty: number }>,
) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { lineItems: true },
  });
  if (!po) throw new Error("Purchase order not found");

  for (const item of receivedItems) {
    const line = po.lineItems.find((l) => l.id === item.lineItemId);
    if (!line) continue;
    const newReceived = Math.min(
      line.receivedQty + item.receivedQty,
      line.orderedQty,
    );
    await prisma.pOLineItem.update({
      where: { id: item.lineItemId },
      data: { receivedQty: newReceived },
    });
  }

  const updated = await prisma.pOLineItem.findMany({
    where: { purchaseOrderId },
  });

  const allReceived = updated.every((l) => l.receivedQty >= l.orderedQty);
  const anyReceived = updated.some((l) => l.receivedQty > 0);

  await prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: {
      status: allReceived ? "RECEIVED" : anyReceived ? "PARTIAL" : po.status,
      fullyReceivedAt: allReceived ? new Date() : undefined,
    },
  });

  return updated;
}

export async function recordLeadTimeSnapshot(
  supplierId: string,
  purchaseOrderId: string,
) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
  });
  if (!po?.orderedAt || !po.fullyReceivedAt) return;

  const leadTimeDays =
    (po.fullyReceivedAt.getTime() - po.orderedAt.getTime()) /
    (1000 * 60 * 60 * 24);

  await prisma.leadTimeSnapshot.create({
    data: { supplierId, purchaseOrderId, leadTimeDays },
  });

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const snapshots = await prisma.leadTimeSnapshot.findMany({
    where: { supplierId, recordedAt: { gte: ninetyDaysAgo } },
  });

  if (snapshots.length > 0) {
    const avg =
      snapshots.reduce((s, snap) => s + snap.leadTimeDays, 0) / snapshots.length;
    await prisma.supplier.update({
      where: { id: supplierId },
      data: { leadTimeDays: avg },
    });
  }
}
