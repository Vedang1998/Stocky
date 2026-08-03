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

export async function applyLandedCostsToPO(
  db: TenantDb,
  purchaseOrderId: string,
) {
  const po = await db.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { lineItems: true },
  });
  if (!po) throw new Error("Purchase order not found");

  const freight = Number(po.freightCost ?? 0);
  const customs = Number(po.customsCost ?? 0);

  const allocations = allocateLandedCosts(
    po.lineItems.map(
      (li: {
        id: string;
        unitCost: Decimal;
        weight: Decimal | null;
        volume: Decimal | null;
        orderedQty: number;
      }) => ({
        id: li.id,
        unitCost: li.unitCost,
        weight: li.weight,
        volume: li.volume,
        orderedQty: li.orderedQty,
      }),
    ),
    freight,
    customs,
    po.landedCostMethod,
  );

  await Promise.all(
    po.lineItems.map((li: { id: string }) =>
      db.pOLineItem.update({
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

export async function recalculatePOLineCost(
  db: TenantDb,
  lineItemId: string,
  newQty: number,
): Promise<void> {
  const line = await db.pOLineItem.findUnique({
    where: { id: lineItemId },
    include: { purchaseOrder: true },
  });
  if (!line || line.manualCostOverride) return;

  const tierCost = await resolveTieredUnitCost(
    db,
    line.purchaseOrder.supplierId,
    line.shopifyVariantId,
    newQty,
  );
  if (tierCost) {
    await db.pOLineItem.update({
      where: { id: lineItemId },
      data: { unitCost: tierCost, orderedQty: newQty },
    });
  } else {
    await db.pOLineItem.update({
      where: { id: lineItemId },
      data: { orderedQty: newQty },
    });
  }
}

export async function receivePartialPO(
  db: TenantDb,
  purchaseOrderId: string,
  receivedItems: Array<{ lineItemId: string; receivedQty: number }>,
) {
  const po = await db.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { lineItems: true },
  });
  if (!po) throw new Error("Purchase order not found");

  for (const item of receivedItems) {
    const line = po.lineItems.find(
      (l: { id: string }) => l.id === item.lineItemId,
    );
    if (!line) continue;
    const newReceived = Math.min(
      line.receivedQty + item.receivedQty,
      line.orderedQty,
    );
    await db.pOLineItem.update({
      where: { id: item.lineItemId },
      data: { receivedQty: newReceived },
    });
  }

  const updated = await db.pOLineItem.findMany({
    where: { purchaseOrderId },
  });

  const allReceived = updated.every(
    (l: { receivedQty: number; orderedQty: number }) =>
      l.receivedQty >= l.orderedQty,
  );
  const anyReceived = updated.some(
    (l: { receivedQty: number }) => l.receivedQty > 0,
  );

  await db.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: {
      status: allReceived ? "RECEIVED" : anyReceived ? "PARTIAL" : po.status,
      fullyReceivedAt: allReceived ? new Date() : undefined,
    },
  });

  return updated;
}

export async function recordLeadTimeSnapshot(
  db: TenantDb,
  supplierId: string,
  purchaseOrderId: string,
) {
  const po = await db.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
  });
  if (!po?.orderedAt || !po.fullyReceivedAt) return;

  const leadTimeDays =
    (po.fullyReceivedAt.getTime() - po.orderedAt.getTime()) /
    (1000 * 60 * 60 * 24);

  await db.leadTimeSnapshot.create({
    data: { supplierId, purchaseOrderId, leadTimeDays },
  });

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const snapshots = await db.leadTimeSnapshot.findMany({
    where: { supplierId, recordedAt: { gte: ninetyDaysAgo } },
  });

  if (snapshots.length > 0) {
    const avg =
      snapshots.reduce(
        (s: number, snap: { leadTimeDays: number }) => s + snap.leadTimeDays,
        0,
      ) / snapshots.length;
    await db.supplier.update({
      where: { id: supplierId },
      data: { leadTimeDays: avg },
    });
  }
}
