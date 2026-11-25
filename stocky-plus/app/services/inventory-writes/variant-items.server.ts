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

/** A variant as the merchant identifies it on a count sheet or a pasted list. */
export interface CatalogVariant {
  shopifyVariantId: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  /** null until a catalog sync has recorded the variant's inventory item. */
  inventoryItemId: string | null;
}

const CATALOG_SELECT = {
  shopifyVariantId: true,
  title: true,
  sku: true,
  barcode: true,
  inventoryItemId: true,
} as const;

/** Lists longer than this are looked up in several queries. */
const LOOKUP_CHUNK = 2_000;

function chunked<T>(values: readonly T[], size = LOOKUP_CHUNK): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < values.length; start += size) {
    chunks.push(values.slice(start, start + size));
  }
  return chunks;
}

/** Variants whose SKU, barcode or variant GID is one of `codes`. */
export async function findVariantsByCode(
  db: TenantDb,
  codes: readonly string[],
): Promise<CatalogVariant[]> {
  const wanted = [...new Set(codes)];
  const found = new Map<string, CatalogVariant>();
  for (const part of chunked(wanted)) {
    const rows = (await db.shopifyVariantCache.findMany({
      where: {
        OR: [
          { sku: { in: part } },
          { barcode: { in: part } },
          { shopifyVariantId: { in: part } },
        ],
      },
      select: CATALOG_SELECT,
    })) as CatalogVariant[];
    for (const row of rows) found.set(row.shopifyVariantId, row);
  }
  return [...found.values()];
}

/** The variants in `catalog` that one scanned or typed code identifies. */
export function variantsMatchingCode(
  catalog: readonly CatalogVariant[],
  code: string,
): CatalogVariant[] {
  return catalog.filter(
    (v) => v.sku === code || v.barcode === code || v.shopifyVariantId === code,
  );
}

/** What to tell someone whose scanned or typed code names more than one item. */
export const ambiguousCodeMessage = (
  code: string,
  matches: readonly CatalogVariant[],
) =>
  `${code} matches ${matches.length} items (${matches
    .slice(0, 3)
    .map((v) => v.title)
    .join(
      ", ",
    )}${matches.length > 3 ? ", …" : ""}). Use a barcode or SKU that only one item has.`;

/** Catalog variants keyed by variant ID. Unknown IDs are absent. */
export async function findVariantsById(
  db: TenantDb,
  shopifyVariantIds: readonly string[],
): Promise<Map<string, CatalogVariant>> {
  const found = new Map<string, CatalogVariant>();
  for (const part of chunked([...new Set(shopifyVariantIds)])) {
    const rows = (await db.shopifyVariantCache.findMany({
      where: { shopifyVariantId: { in: part } },
      select: CATALOG_SELECT,
    })) as CatalogVariant[];
    for (const row of rows) found.set(row.shopifyVariantId, row);
  }
  return found;
}

/** Catalog variants keyed by inventory item GID. Unknown items are absent. */
export async function findVariantsByInventoryItem(
  db: TenantDb,
  inventoryItemIds: readonly string[],
): Promise<Map<string, CatalogVariant>> {
  const found = new Map<string, CatalogVariant>();
  for (const part of chunked([...new Set(inventoryItemIds)])) {
    const rows = (await db.shopifyVariantCache.findMany({
      where: { inventoryItemId: { in: part } },
      select: CATALOG_SELECT,
    })) as CatalogVariant[];
    for (const row of rows) found.set(row.inventoryItemId!, row);
  }
  return found;
}

/** The given inventory items that are live and tracked for inventory in Shopify. */
export async function findTrackedInventoryItemIds(
  db: TenantDb,
  inventoryItemIds: readonly string[],
): Promise<Set<string>> {
  const tracked = new Set<string>();
  for (const part of chunked([...new Set(inventoryItemIds)])) {
    const rows = (await db.shopifyInventoryItemFact.findMany({
      where: {
        shopifyGid: { in: part },
        tracked: true,
        existenceState: "LIVE",
      },
      select: { shopifyGid: true },
    })) as Array<{ shopifyGid: string }>;
    for (const row of rows) tracked.add(row.shopifyGid);
  }
  return tracked;
}
