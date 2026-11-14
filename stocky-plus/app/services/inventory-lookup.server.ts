import { isProductVariantGid } from "../lib/shopify-gid";
import type { TenantDb } from "../tenant/tenant-db.server";
import {
  MIN_SEARCH_LENGTH,
  findLiveVariant,
  resolveScannedCode,
  searchLiveVariants,
  type ResolvedVariant,
} from "./barcode-lookup.server";
import { getVariantStock, type VariantStock } from "./stock-lookup.server";

/** Longest raw query accepted before any normalization or database work. */
export const MAX_LOOKUP_QUERY_LENGTH = 1024;

export type InventoryLookup =
  | { kind: "idle"; catalogSynced: boolean }
  | { kind: "too_long" }
  | { kind: "not_found"; query: string; catalogSynced: boolean }
  | {
      kind: "choose";
      query: string;
      /** How the candidates were found: a shared code, or a text search. */
      matchedOn: "barcode" | "sku" | "text";
      candidates: ResolvedVariant[];
      truncated: boolean;
    }
  | { kind: "stock"; variant: ResolvedVariant; stock: VariantStock }
  | { kind: "variant_missing" };

async function hasLiveCatalog(db: TenantDb): Promise<boolean> {
  const any = await db.shopifyVariantFact.findFirst({
    where: { existenceState: "LIVE", deletedAt: null },
    select: { shopifyGid: true },
  });
  return any !== null;
}

async function stockFor(
  db: TenantDb,
  variant: ResolvedVariant,
): Promise<InventoryLookup> {
  const stock = await getVariantStock(db, variant.variantGid);
  // The variant can be deleted between the two reads.
  return stock ? { kind: "stock", variant, stock } : { kind: "variant_missing" };
}

/**
 * Stock lookup for the admin Inventory page. A scanned or typed code is
 * resolved exactly first (barcode across GTIN spellings, then SKU); only when
 * that finds nothing is the input treated as a product-name search.
 */
export async function lookupInventory(
  db: TenantDb,
  input: { query: string | null; variantGid: string | null },
): Promise<InventoryLookup> {
  if (input.variantGid !== null) {
    if (!isProductVariantGid(input.variantGid)) return { kind: "variant_missing" };
    const variant = await findLiveVariant(db, input.variantGid);
    return variant ? stockFor(db, variant) : { kind: "variant_missing" };
  }

  const raw = input.query ?? "";
  if (raw.length > MAX_LOOKUP_QUERY_LENGTH) return { kind: "too_long" };
  const query = raw.trim();
  if (query === "") return { kind: "idle", catalogSynced: await hasLiveCatalog(db) };

  const resolution = await resolveScannedCode(db, query);
  switch (resolution.status) {
    case "matched":
      return stockFor(db, resolution.variant);
    case "ambiguous":
      return {
        kind: "choose",
        query,
        matchedOn: resolution.matchedOn,
        candidates: resolution.candidates,
        truncated: resolution.truncated,
      };
    case "invalid":
      if (resolution.reason === "too_long") return { kind: "too_long" };
      break;
    case "unknown":
      break;
  }

  if (query.length >= MIN_SEARCH_LENGTH) {
    const { variants, truncated } = await searchLiveVariants(db, query);
    if (variants.length === 1) return stockFor(db, variants[0]);
    if (variants.length > 1) {
      return { kind: "choose", query, matchedOn: "text", candidates: variants, truncated };
    }
  }

  return { kind: "not_found", query, catalogSynced: await hasLiveCatalog(db) };
}
