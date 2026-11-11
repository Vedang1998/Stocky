import type { TenantDb } from "../../tenant/tenant-db.server";

export interface VariantInventoryItem {
  shopifyVariantId: string;
  title: string;
  /** null until a catalog sync has recorded the variant's inventory item. */
  inventoryItemId: string | null;
}

const VARIANT_GID_PREFIX = "gid://shopify/ProductVariant/";

/** The variant GID for ledger lines, or null for a legacy non-GID identifier. */
export function ledgerVariantId(shopifyVariantId: string): string | null {
  return shopifyVariantId.startsWith(VARIANT_GID_PREFIX)
    ? shopifyVariantId
    : null;
}

/**
 * Inventory items for a set of variants in one query. Variants the shop's
 * catalog cache does not know are absent from the result.
 */
export async function findVariantInventoryItems(
  db: TenantDb,
  shopifyVariantIds: readonly string[],
): Promise<Map<string, VariantInventoryItem>> {
  const ids = [...new Set(shopifyVariantIds)];
  if (ids.length === 0) return new Map();
  const rows = (await db.shopifyVariantCache.findMany({
    where: { shopifyVariantId: { in: ids } },
    select: { shopifyVariantId: true, title: true, inventoryItemId: true },
  })) as VariantInventoryItem[];
  return new Map(rows.map((row) => [row.shopifyVariantId, row]));
}
