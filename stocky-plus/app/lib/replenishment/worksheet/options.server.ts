/**
 * Choices offered when setting up a worksheet: the shop's active locations
 * and the vendors and product types that appear on its unarchived products.
 */
import type { TenantDb } from "../../../tenant/tenant-db.server";

const LIVE = "LIVE";
/** Longest list a picker shows; beyond this the merchant narrows by another field. */
const MAX_OPTIONS = 1000;

export type SetupOptions = {
  locations: Array<{ gid: string; name: string }>;
  vendors: string[];
  productTypes: string[];
};

async function distinctProductValues(
  db: TenantDb,
  column: "vendor" | "productType",
): Promise<string[]> {
  const rows: Array<Record<string, string | null>> = await db.shopifyProductFact.groupBy({
    by: [column],
    where: {
      existenceState: LIVE,
      status: { not: "ARCHIVED" },
      [column]: { not: null },
    },
    orderBy: { [column]: "asc" },
    take: MAX_OPTIONS,
  });
  return rows.flatMap((row) => {
    const value = row[column];
    return value ? [value] : [];
  });
}

export async function loadSetupOptions(db: TenantDb): Promise<SetupOptions> {
  const [locations, vendors, productTypes] = await Promise.all([
    db.shopifyLocationFact.findMany({
      where: { existenceState: LIVE, isActive: true },
      select: { shopifyGid: true, name: true },
      orderBy: { name: "asc" },
    }) as Promise<Array<{ shopifyGid: string; name: string }>>,
    distinctProductValues(db, "vendor"),
    distinctProductValues(db, "productType"),
  ]);
  return {
    locations: locations.map((location) => ({
      gid: location.shopifyGid,
      name: location.name,
    })),
    vendors,
    productTypes,
  };
}
