import { buildSetupGuide, type SetupGuide } from "../lib/setup-guide";
import type { TenantDb } from "../tenant/tenant-db.server";

const LIVE = { existenceState: "LIVE", deletedAt: null } as const;

export async function loadSetupGuide(db: TenantDb): Promise<SetupGuide> {
  const [liveVariant, locations, supplierCount, purchaseOrderCount]: [
    { shopifyGid: string } | null,
    Array<{ name: string }>,
    number,
    number,
  ] = await Promise.all([
    db.shopifyVariantFact.findFirst({
      where: LIVE,
      select: { shopifyGid: true },
    }),
    db.shopifyLocationFact.findMany({
      where: { ...LIVE, isActive: true },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    db.supplier.count({ where: {} }),
    db.purchaseOrder.count({ where: {} }),
  ]);

  return buildSetupGuide({
    catalogSynced: liveVariant !== null,
    locationNames: locations.map((location) => location.name),
    supplierCount,
    purchaseOrderCount,
  });
}
