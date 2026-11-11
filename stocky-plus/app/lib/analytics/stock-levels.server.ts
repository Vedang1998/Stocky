/**
 * Current Shopify inventory quantities per inventory item and location, from
 * canonical PR5 catalog facts. Shopify is the authority for every quantity
 * here; a null means Shopify has not reported that quantity, never zero.
 */
import type { TenantDb } from "../../tenant/tenant-db.server";

const LIVE = "LIVE";
const PAGE_SIZE = 2000;
const IN_LIST_SIZE = 500;

export type StockLocation = {
  locationGid: string;
  name: string;
  isActive: boolean;
};

export type StockLevel = {
  inventoryItemGid: string;
  locationGid: string;
  available: number | null;
  onHand: number | null;
  committed: number | null;
  incoming: number | null;
  /** When Shopify last changed the level. */
  shopifyUpdatedAt: Date | null;
};

type LevelRow = {
  id: string;
  inventoryItemGid: string;
  locationGid: string;
  availableQuantity: number | null;
  onHandQuantity: number | null;
  committedQuantity: number | null;
  incomingQuantity: number | null;
  shopifyUpdatedAt: Date | null;
};

const LEVEL_SELECT = {
  id: true,
  inventoryItemGid: true,
  locationGid: true,
  availableQuantity: true,
  onHandQuantity: true,
  committedQuantity: true,
  incomingQuantity: true,
  shopifyUpdatedAt: true,
} as const;

function toLevel(row: LevelRow): StockLevel {
  return {
    inventoryItemGid: row.inventoryItemGid,
    locationGid: row.locationGid,
    available: row.availableQuantity,
    onHand: row.onHandQuantity,
    committed: row.committedQuantity,
    incoming: row.incomingQuantity,
    shopifyUpdatedAt: row.shopifyUpdatedAt,
  };
}

/** Every LIVE location, active or not, sorted by name. */
export async function loadStockLocations(
  db: TenantDb,
): Promise<StockLocation[]> {
  const rows: Array<{ shopifyGid: string; name: string; isActive: boolean }> =
    await db.shopifyLocationFact.findMany({
      where: { existenceState: LIVE },
      select: { shopifyGid: true, name: true, isActive: true },
    });
  return rows
    .map((row) => ({
      locationGid: row.shopifyGid,
      name: row.name,
      isActive: row.isActive,
    }))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        (a.locationGid < b.locationGid ? -1 : 1),
    );
}

/**
 * LIVE, active inventory levels. Pass `inventoryItemGids` to restrict the
 * lookup, or `locationGid` to read one location; omit both for every level.
 */
export async function loadStockLevels(
  db: TenantDb,
  input: { inventoryItemGids?: readonly string[]; locationGid?: string } = {},
): Promise<StockLevel[]> {
  const base = {
    existenceState: LIVE,
    isActive: true,
    ...(input.locationGid ? { locationGid: input.locationGid } : {}),
  };

  if (input.inventoryItemGids) {
    const levels: StockLevel[] = [];
    const unique = [...new Set(input.inventoryItemGids)];
    for (let i = 0; i < unique.length; i += IN_LIST_SIZE) {
      const rows: LevelRow[] = await db.shopifyInventoryLevelFact.findMany({
        where: {
          ...base,
          inventoryItemGid: { in: unique.slice(i, i + IN_LIST_SIZE) },
        },
        select: LEVEL_SELECT,
      });
      levels.push(...rows.map(toLevel));
    }
    return levels;
  }

  const levels: StockLevel[] = [];
  let afterId: string | null = null;
  for (;;) {
    const page: LevelRow[] = await db.shopifyInventoryLevelFact.findMany({
      where: { ...base, ...(afterId ? { id: { gt: afterId } } : {}) },
      select: LEVEL_SELECT,
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
    });
    levels.push(...page.map(toLevel));
    if (page.length < PAGE_SIZE) break;
    afterId = page[page.length - 1].id;
  }
  return levels;
}

/**
 * Orders Shopify no longer reports. Their line facts stay LIVE, so anything
 * read from lines alone has to leave them out. Shopify only lets a merchant
 * delete cancelled, archived or test orders, which keeps this list short.
 */
async function loadAbsentOrderGids(db: TenantDb): Promise<string[]> {
  const gids: string[] = [];
  let afterId: string | null = null;
  for (;;) {
    const page: Array<{ id: string; shopifyGid: string }> =
      await db.shopifyOrderFact.findMany({
        where: {
          existenceState: { not: LIVE },
          ...(afterId ? { id: { gt: afterId } } : {}),
        },
        select: { id: true, shopifyGid: true },
        orderBy: { id: "asc" },
        take: PAGE_SIZE,
      });
    for (const row of page) gids.push(row.shopifyGid);
    if (page.length < PAGE_SIZE) break;
    afterId = page[page.length - 1].id;
  }
  return gids;
}

/**
 * When each variant was last on an order; test, cancelled and deleted orders
 * excluded. Refunds and edits do not move it: it answers "when was this last
 * ordered", not "when did it last have net sales". Variants never ordered are
 * absent.
 */
export async function loadLastOrderedAt(
  db: TenantDb,
  variantGids: readonly string[],
): Promise<Map<string, Date>> {
  const lastOrdered = new Map<string, Date>();
  const unique = [...new Set(variantGids)];
  if (unique.length === 0) return lastOrdered;
  const absentOrderGids = await loadAbsentOrderGids(db);

  for (let i = 0; i < unique.length; i += IN_LIST_SIZE) {
    const groups: Array<{
      variantGidAtSale: string | null;
      _max: { orderProcessedAt: Date | null };
    }> = await db.shopifyOrderLineFact.groupBy({
      by: ["variantGidAtSale"],
      where: {
        existenceState: LIVE,
        orderTest: false,
        orderCancelledAt: null,
        isGiftCard: false,
        orderProcessedAt: { not: null },
        variantGidAtSale: { in: unique.slice(i, i + IN_LIST_SIZE) },
        ...(absentOrderGids.length > 0
          ? { shopifyOrderGid: { notIn: absentOrderGids } }
          : {}),
      },
      _max: { orderProcessedAt: true },
    });
    for (const group of groups) {
      if (group.variantGidAtSale && group._max.orderProcessedAt) {
        lastOrdered.set(group.variantGidAtSale, group._max.orderProcessedAt);
      }
    }
  }
  return lastOrdered;
}
