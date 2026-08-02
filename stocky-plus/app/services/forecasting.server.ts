import type { AbcClass, AbcMetric } from "@prisma/client";
import type { TenantDb } from "../tenant/tenant-db.server";

export interface ForecastInput {
  /** @deprecated Untrusted display/legacy field — authority comes from TenantDb. */
  shop?: string;
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
  db: TenantDb,
  variantId: string,
  locationId: string,
  start: Date,
  end: Date,
): Promise<number> {
  const snapshots = await db.inventorySnapshot.findMany({
    where: {
      shopifyVariantId: variantId,
      locationId,
      snapshotDate: { gte: start, lte: end },
    },
  });

  if (snapshots.length === 0) return 0;

  return snapshots.filter((s: { quantityAvailable: number }) => s.quantityAvailable <= 0)
    .length;
}

async function getUnitsSold(
  db: TenantDb,
  variantId: string,
  locationId: string,
  start: Date,
  end: Date,
): Promise<number> {
  const aggregates = await db.salesDailyAggregate.findMany({
    where: {
      shopifyVariantId: variantId,
      locationId,
      date: { gte: start, lte: end },
    },
  });
  return aggregates.reduce(
    (sum: number, a: { unitsSold: number }) => sum + a.unitsSold,
    0,
  );
}

async function getIncomingQty(
  db: TenantDb,
  variantId: string,
): Promise<number> {
  const openPOs = await db.purchaseOrder.findMany({
    where: {
      status: { in: ["ORDERED", "PARTIAL"] },
    },
    include: { lineItems: true },
  });

  return openPOs.reduce(
    (
      sum: number,
      po: {
        lineItems: Array<{
          shopifyVariantId: string;
          orderedQty: number;
          receivedQty: number;
        }>;
      },
    ) => {
      const line = po.lineItems.find((l) => l.shopifyVariantId === variantId);
      if (!line) return sum;
      return sum + (line.orderedQty - line.receivedQty);
    },
    0,
  );
}

export async function computeForecast(
  db: TenantDb,
  input: ForecastInput,
): Promise<ForecastResult> {
  const settings = await db.shopSettings.findUnique({
    where: { shop: db.authority.myshopifyDomain },
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

  const override = await db.forecastOverride.findUnique({
    where: {
      shop_variantId_locationId: {
        shop: db.authority.myshopifyDomain,
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
      db,
      input.variantId,
      input.locationId,
      effectiveStart,
      effectiveEnd,
    ),
    countOutOfStockDays(
      db,
      input.variantId,
      input.locationId,
      effectiveStart,
      effectiveEnd,
    ),
    getIncomingQty(db, input.variantId),
  ]);

  const dailySalesVelocity = calculateDailySalesVelocity(
    unitsSold,
    effectiveDays,
    outOfStockDays,
  );

  const mapping = await db.supplierSkuMapping.findFirst({
    where: { shopifyVariantId: input.variantId },
    include: { supplier: true },
  });
  const leadTimeDays =
    input.leadTimeDays ?? mapping?.supplier?.leadTimeDays ?? 7;

  const reorderPoint = calculateReorderPoint(
    dailySalesVelocity,
    leadTimeDays,
    safetyStock,
  );

  const onHand = await db.inventorySnapshot.findFirst({
    where: {
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
  db: TenantDb,
  metric: AbcMetric = "REVENUE",
  locationId = "all",
): Promise<void> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const aggregates = await db.salesDailyAggregate.groupBy({
    by: ["shopifyVariantId"],
    where: {
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

  const shop = db.authority.myshopifyDomain;

  await Promise.all(
    classifications.map((c) =>
      db.variantAbcClass.upsert({
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
  db: TenantDb,
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
  const shop = db.authority.myshopifyDomain;

  const variantsWithStock = await db.inventorySnapshot.findMany({
    where: {
      quantityAvailable: { gt: 0 },
      snapshotDate: { gte: cutoff },
    },
    distinct: ["shopifyVariantId"],
  });

  const deadStock = [];

  for (const snap of variantsWithStock) {
    const sales = await db.salesDailyAggregate.aggregate({
      where: {
        shopifyVariantId: snap.shopifyVariantId,
        date: { gte: cutoff },
      },
      _sum: { unitsSold: true },
    });

    if ((sales._sum.unitsSold ?? 0) === 0) {
      const cache = await db.shopifyVariantCache.findUnique({
        where: {
          shop_shopifyVariantId: {
            shop,
            shopifyVariantId: snap.shopifyVariantId,
          },
        },
      });

      const latestPO = await db.pOLineItem.findFirst({
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

export async function getInventoryValuation(db: TenantDb) {
  const shop = db.authority.myshopifyDomain;

  const latestSnapshots = await db.inventorySnapshot.findMany({
    where: {},
    orderBy: { snapshotDate: "desc" },
    distinct: ["shopifyVariantId", "locationId"],
  });

  let totalValue = 0;
  const lines = [];

  for (const snap of latestSnapshots) {
    const latestPO = await db.pOLineItem.findFirst({
      where: { shopifyVariantId: snap.shopifyVariantId },
      orderBy: { id: "desc" },
    });

    const unitCost = latestPO
      ? Number(latestPO.unitCost) + Number(latestPO.allocatedLandedCost ?? 0)
      : 0;
    const value = snap.quantityAvailable * unitCost;
    totalValue += value;

    const cache = await db.shopifyVariantCache.findUnique({
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

export async function getLowStockAlerts(db: TenantDb) {
  return db.lowStockAlert.findMany({
    where: { acknowledged: false },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
