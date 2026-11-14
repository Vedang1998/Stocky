import type { TenantDb } from "../tenant/tenant-db.server";

export type StockQuantities = {
  available: number | null;
  onHand: number | null;
  committed: number | null;
  incoming: number | null;
};

export type LocationStock = StockQuantities & {
  locationGid: string;
  locationName: string;
  /** Latest time Shopify reported any quantity for this location (ISO). */
  observedAt: string | null;
};

export type VariantStock = {
  variantGid: string;
  inventoryItemGid: string | null;
  /** False when Shopify does not track inventory for the item. */
  tracked: boolean | null;
  locations: LocationStock[];
  totals: StockQuantities;
};

type LevelRow = {
  locationGid: string;
  availableQuantity: number | null;
  onHandQuantity: number | null;
  committedQuantity: number | null;
  incomingQuantity: number | null;
  availableQuantityUpdatedAt: Date | null;
  onHandQuantityUpdatedAt: Date | null;
  committedQuantityUpdatedAt: Date | null;
  incomingQuantityUpdatedAt: Date | null;
};

const QUANTITY_FIELDS = [
  "available",
  "onHand",
  "committed",
  "incoming",
] as const satisfies ReadonlyArray<keyof StockQuantities>;

function latest(...dates: Array<Date | null>): string | null {
  let max: Date | null = null;
  for (const date of dates) {
    if (date && (!max || date > max)) max = date;
  }
  return max ? max.toISOString() : null;
}

function sumKnown(locations: LocationStock[]): StockQuantities {
  const totals: StockQuantities = {
    available: null,
    onHand: null,
    committed: null,
    incoming: null,
  };
  for (const location of locations) {
    for (const field of QUANTITY_FIELDS) {
      const value = location[field];
      if (value !== null) totals[field] = (totals[field] ?? 0) + value;
    }
  }
  return totals;
}

/**
 * Per-location stock for one variant from the shop's synchronized Shopify
 * inventory facts. Only live, active locations and inventory levels are
 * included. Quantities Shopify has not reported stay null instead of 0, so
 * screens can tell "unknown" from "none".
 *
 * Returns null when the variant is not a live variant of this shop.
 */
export async function getVariantStock(
  db: TenantDb,
  variantGid: string,
  options: { preferredLocationGid?: string | null } = {},
): Promise<VariantStock | null> {
  const variant = await db.shopifyVariantFact.findFirst({
    where: { shopifyGid: variantGid, existenceState: "LIVE", deletedAt: null },
    select: { shopifyGid: true },
  });
  if (!variant) return null;

  const item: { shopifyGid: string; tracked: boolean } | null =
    await db.shopifyInventoryItemFact.findFirst({
      where: {
        shopifyVariantGid: variantGid,
        existenceState: "LIVE",
        deletedAt: null,
      },
      select: { shopifyGid: true, tracked: true },
      orderBy: { shopifyGid: "asc" },
    });

  if (!item) {
    return {
      variantGid,
      inventoryItemGid: null,
      tracked: null,
      locations: [],
      totals: sumKnown([]),
    };
  }

  const levels: LevelRow[] = await db.shopifyInventoryLevelFact.findMany({
    where: {
      inventoryItemGid: item.shopifyGid,
      existenceState: "LIVE",
      deletedAt: null,
      isActive: true,
    },
    select: {
      locationGid: true,
      availableQuantity: true,
      onHandQuantity: true,
      committedQuantity: true,
      incomingQuantity: true,
      availableQuantityUpdatedAt: true,
      onHandQuantityUpdatedAt: true,
      committedQuantityUpdatedAt: true,
      incomingQuantityUpdatedAt: true,
    },
  });

  const locationRows: Array<{ shopifyGid: string; name: string }> =
    levels.length
      ? await db.shopifyLocationFact.findMany({
          where: {
            shopifyGid: { in: levels.map((level) => level.locationGid) },
            existenceState: "LIVE",
            deletedAt: null,
            isActive: true,
          },
          select: { shopifyGid: true, name: true },
        })
      : [];
  const locationName = new Map(locationRows.map((l) => [l.shopifyGid, l.name]));

  const preferred = options.preferredLocationGid ?? null;
  const locations: LocationStock[] = levels
    .filter((level) => locationName.has(level.locationGid))
    .map((level) => ({
      locationGid: level.locationGid,
      locationName: locationName.get(level.locationGid)!,
      available: level.availableQuantity,
      onHand: level.onHandQuantity,
      committed: level.committedQuantity,
      incoming: level.incomingQuantity,
      observedAt: latest(
        level.availableQuantityUpdatedAt,
        level.onHandQuantityUpdatedAt,
        level.committedQuantityUpdatedAt,
        level.incomingQuantityUpdatedAt,
      ),
    }))
    .sort((a, b) => {
      if (a.locationGid === preferred) return -1;
      if (b.locationGid === preferred) return 1;
      return a.locationName.localeCompare(b.locationName);
    });

  return {
    variantGid,
    inventoryItemGid: item.shopifyGid,
    tracked: item.tracked,
    locations,
    totals: sumKnown(locations),
  };
}
