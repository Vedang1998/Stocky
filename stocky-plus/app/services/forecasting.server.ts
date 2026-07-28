import prisma from "../db.server";
import type { AbcClass, AbcMetric } from "@prisma/client";

export interface ForecastInput {
  shop: string;
  variantId: string;
  locationId: string;
  lookbackDays?: number;
  lookbackStart?: Date;
  lookbackEnd?: Date;
  leadTimeDays?: number;
  safetyStock?: number;
  targetDaysOfStock?: number;
}

export interface ForecastResult {
  dailySalesVelocity: number;
  outOfStockDays: number;
  effectiveLookbackDays: number;
  reorderPoint: number;
  toBuy: number;
  onHand: number;
  incoming: number;
}

export function calculateDailySalesVelocity(
  unitsSold: number,
  lookbackDays: number,
  outOfStockDays: number,
): number {
  const effectiveDays = lookbackDays - outOfStockDays;
  if (effectiveDays <= 0 || unitsSold <= 0) return 0;
  return unitsSold / effectiveDays;
}

export function calculateReorderPoint(
  dailyVelocity: number,
  leadTimeDays: number,
  safetyStock: number,
): number {
  return Math.ceil(dailyVelocity * leadTimeDays + safetyStock);
}

export function calculateToBuy(
  reorderPoint: number,
  targetDaysOfStock: number,
  dailyVelocity: number,
  onHand: number,
  incoming: number,
): number {
  const target = reorderPoint + Math.ceil(dailyVelocity * targetDaysOfStock);
  const need = target - (onHand + incoming);
  return Math.max(0, need);
}

async function countOutOfStockDays(
  shop: string,
  variantId: string,
  locationId: string,
  start: Date,
  end: Date,
): Promise<number> {
  const snapshots = await prisma.inventorySnapshot.findMany({
    where: {
      shop,
      shopifyVariantId: variantId,
      locationId,
      snapshotDate: { gte: start, lte: end },
    },
  });

  if (snapshots.length === 0) return 0;

  return snapshots.filter((s) => s.quantityAvailable <= 0).length;
}

async function getUnitsSold(
  shop: string,
  variantId: string,
  locationId: string,
  start: Date,
  end: Date,
): Promise<number> {
  const aggregates = await prisma.salesDailyAggregate.findMany({
    where: {
      shop,
      shopifyVariantId: variantId,
      locationId,
      date: { gte: start, lte: end },
    },
  });
  return aggregates.reduce((sum, a) => sum + a.unitsSold, 0);
}

async function getIncomingQty(
  shop: string,
  variantId: string,
): Promise<number> {
  const openPOs = await prisma.purchaseOrder.findMany({
    where: {
      shop,
      status: { in: ["ORDERED", "PARTIAL"] },
    },
    include: { lineItems: true },
  });

  return openPOs.reduce((sum, po) => {
    const line = po.lineItems.find((l) => l.shopifyVariantId === variantId);
    if (!line) return sum;
    return sum + (line.orderedQty - line.receivedQty);
  }, 0);
}

export async function computeForecast(
  input: ForecastInput,
): Promise<ForecastResult> {
  const settings = await prisma.shopSettings.findUnique({
    where: { shop: input.shop },
  });

  const lookbackDays =
    input.lookbackDays ?? settings?.defaultLookbackDays ?? 30;
  const safetyStock =
    input.safetyStock ?? settings?.defaultSafetyStock ?? 0;
  const targetDaysOfStock =
    input.targetDaysOfStock ?? settings?.targetDaysOfStock ?? 14;

  const end = input.lookbackEnd ?? new Date();
  const start =
    input.lookbackStart ??
    new Date(end.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  const override = await prisma.forecastOverride.findUnique({
    where: {
      shop_variantId_locationId: {
        shop: input.shop,
        variantId: input.variantId,
        locationId: input.locationId,
      },
    },
  });

  const effectiveStart = override?.lookbackStart ?? start;
  const effectiveEnd = override?.lookbackEnd ?? end;
  const effectiveDays = Math.ceil(
    (effectiveEnd.getTime() - effectiveStart.getTime()) /
      (1000 * 60 * 60 * 24),
  );

  const [unitsSold, outOfStockDays, incoming] = await Promise.all([
    getUnitsSold(
      input.shop,
      input.variantId,
      input.locationId,
      effectiveStart,
      effectiveEnd,
    ),
    countOutOfStockDays(
      input.shop,
      input.variantId,
      input.locationId,
      effectiveStart,
      effectiveEnd,
    ),
    getIncomingQty(input.shop, input.variantId),
  ]);

  const dailySalesVelocity = calculateDailySalesVelocity(
    unitsSold,
    effectiveDays,
    outOfStockDays,
  );

  const mapping = await prisma.supplierSkuMapping.findFirst({
    where: { shopifyVariantId: input.variantId },
    include: { supplier: true },
  });
  const leadTimeDays =
    input.leadTimeDays ?? mapping?.supplier.leadTimeDays ?? 7;

  const reorderPoint = calculateReorderPoint(
    dailySalesVelocity,
    leadTimeDays,
    safetyStock,
  );

  const onHand = await prisma.inventorySnapshot.findFirst({
    where: {
      shop: input.shop,
      shopifyVariantId: input.variantId,
      locationId: input.locationId,
    },
    orderBy: { snapshotDate: "desc" },
  });

  const toBuy = calculateToBuy(
    reorderPoint,
    targetDaysOfStock,
    dailySalesVelocity,
    onHand?.quantityAvailable ?? 0,
    incoming,
  );

  return {
    dailySalesVelocity,
    outOfStockDays,
    effectiveLookbackDays: effectiveDays - outOfStockDays,
    reorderPoint,
    toBuy,
    onHand: onHand?.quantityAvailable ?? 0,
    incoming,
  };
}

export async function runAbcAnalysis(
  shop: string,
  metric: AbcMetric = "REVENUE",
  locationId = "all",
): Promise<void> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const aggregates = await prisma.salesDailyAggregate.groupBy({
    by: ["shopifyVariantId"],
    where: {
      shop,
      ...(locationId !== "all" ? { locationId } : {}),
      date: { gte: ninetyDaysAgo },
    },
    _sum: { unitsSold: true, revenue: true },
  });

  if (aggregates.length === 0) return;

  const sorted = [...aggregates].sort((a, b) => {
    if (metric === "VOLUME") {
      return (b._sum.unitsSold ?? 0) - (a._sum.unitsSold ?? 0);
    }
    return Number(b._sum.revenue ?? 0) - Number(a._sum.revenue ?? 0);
  });

  const total = sorted.reduce((sum, item) => {
    return (
      sum +
      (metric === "VOLUME"
        ? (item._sum.unitsSold ?? 0)
        : Number(item._sum.revenue ?? 0))
    );
  }, 0);

  let cumulative = 0;
  const classifications: Array<{
    variantId: string;
    abcClass: AbcClass;
    revenue: number;
    unitsSold: number;
  }> = [];

  for (const item of sorted) {
    const value =
      metric === "VOLUME"
        ? (item._sum.unitsSold ?? 0)
        : Number(item._sum.revenue ?? 0);
    cumulative += value;
    const pct = total > 0 ? cumulative / total : 0;

    let abcClass: AbcClass;
    if (pct <= 0.8) abcClass = "A";
    else if (pct <= 0.95) abcClass = "B";
    else abcClass = "C";

    classifications.push({
      variantId: item.shopifyVariantId,
      abcClass,
      revenue: Number(item._sum.revenue ?? 0),
      unitsSold: item._sum.unitsSold ?? 0,
    });
  }

  await Promise.all(
    classifications.map((c) =>
      prisma.variantAbcClass.upsert({
        where: {
          shop_shopifyVariantId_locationId_metric: {
            shop,
            shopifyVariantId: c.variantId,
            locationId,
            metric,
          },
        },
        create: {
          shop,
          shopifyVariantId: c.variantId,
          locationId,
          metric,
          abcClass: c.abcClass,
          revenue: c.revenue,
          unitsSold: c.unitsSold,
        },
        update: {
          abcClass: c.abcClass,
          revenue: c.revenue,
          unitsSold: c.unitsSold,
          calculatedAt: new Date(),
        },
      }),
    ),
  );
}

export async function getDeadStock(
  shop: string,
  days = 120,
): Promise<
  Array<{
    variantId: string;
    title: string;
    quantity: number;
    avgCost: number;
    tiedUpCapital: number;
  }>
> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const variantsWithStock = await prisma.inventorySnapshot.findMany({
    where: {
      shop,
      quantityAvailable: { gt: 0 },
      snapshotDate: { gte: cutoff },
    },
    distinct: ["shopifyVariantId"],
  });

  const deadStock = [];

  for (const snap of variantsWithStock) {
    const sales = await prisma.salesDailyAggregate.aggregate({
      where: {
        shop,
        shopifyVariantId: snap.shopifyVariantId,
        date: { gte: cutoff },
      },
      _sum: { unitsSold: true },
    });

    if ((sales._sum.unitsSold ?? 0) === 0) {
      const cache = await prisma.shopifyVariantCache.findUnique({
        where: {
          shop_shopifyVariantId: {
            shop,
            shopifyVariantId: snap.shopifyVariantId,
          },
        },
      });

      const latestPO = await prisma.pOLineItem.findFirst({
        where: { shopifyVariantId: snap.shopifyVariantId },
        orderBy: { id: "desc" },
      });

      const avgCost = latestPO
        ? Number(latestPO.unitCost) + Number(latestPO.allocatedLandedCost ?? 0)
        : 0;

      deadStock.push({
        variantId: snap.shopifyVariantId,
        title: cache?.title ?? snap.shopifyVariantId,
        quantity: snap.quantityAvailable,
        avgCost,
        tiedUpCapital: snap.quantityAvailable * avgCost,
      });
    }
  }

  return deadStock.sort((a, b) => b.tiedUpCapital - a.tiedUpCapital);
}

export async function getInventoryValuation(shop: string) {
  const latestSnapshots = await prisma.inventorySnapshot.findMany({
    where: { shop },
    orderBy: { snapshotDate: "desc" },
    distinct: ["shopifyVariantId", "locationId"],
  });

  let totalValue = 0;
  const lines = [];

  for (const snap of latestSnapshots) {
    const latestPO = await prisma.pOLineItem.findFirst({
      where: { shopifyVariantId: snap.shopifyVariantId },
      orderBy: { id: "desc" },
    });

    const unitCost = latestPO
      ? Number(latestPO.unitCost) + Number(latestPO.allocatedLandedCost ?? 0)
      : 0;
    const value = snap.quantityAvailable * unitCost;
    totalValue += value;

    const cache = await prisma.shopifyVariantCache.findUnique({
      where: {
        shop_shopifyVariantId: {
          shop,
          shopifyVariantId: snap.shopifyVariantId,
        },
      },
    });

    lines.push({
      variantId: snap.shopifyVariantId,
      title: cache?.title ?? snap.shopifyVariantId,
      locationId: snap.locationId,
      quantity: snap.quantityAvailable,
      unitCost,
      value,
    });
  }

  return { totalValue, lines };
}

export async function getLowStockAlerts(shop: string) {
  return prisma.lowStockAlert.findMany({
    where: { shop, acknowledged: false },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
