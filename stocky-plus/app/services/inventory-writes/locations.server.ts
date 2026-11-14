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
