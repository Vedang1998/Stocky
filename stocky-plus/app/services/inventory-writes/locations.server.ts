import type { TenantDb } from "../../tenant/tenant-db.server";

/**
 * The given location GIDs that are live, active locations of the shop. The
 * ledger refuses any other location, so documents check this before they are
 * created rather than failing when stock is about to move.
 */
export async function findActiveLocationIds(
  db: TenantDb,
  locationIds: string[],
): Promise<Set<string>> {
  const ids = [...new Set(locationIds)];
  if (ids.length === 0) return new Set();
  const rows = (await db.shopifyLocationFact.findMany({
    where: { shopifyGid: { in: ids }, existenceState: "LIVE", isActive: true },
    select: { shopifyGid: true },
  })) as Array<{ shopifyGid: string }>;
  return new Set(rows.map((r) => r.shopifyGid));
}

export interface SyncedLocation {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * The shop's synced locations by name, deactivated ones included so that
 * documents made at a location keep its name after it is deactivated.
 */
export async function listSyncedLocations(
  db: TenantDb,
): Promise<SyncedLocation[]> {
  const rows = (await db.shopifyLocationFact.findMany({
    where: { existenceState: "LIVE" },
    select: { shopifyGid: true, name: true, isActive: true },
    orderBy: { name: "asc" },
  })) as Array<{ shopifyGid: string; name: string; isActive: boolean }>;
  return rows.map((row) => ({
    id: row.shopifyGid,
    name: row.name,
    isActive: row.isActive,
  }));
}
