import { formatLabelMoney } from "../../lib/labels/money";
import { isProductVariantGid } from "../../lib/shopify-gid";
import type { TenantDb } from "../../tenant/tenant-db.server";
import {
  MIN_SEARCH_LENGTH,
  resolveScannedCode,
  searchLiveVariants,
  type ResolvedVariant,
} from "../barcode-lookup.server";
import { MAX_LOOKUP_QUERY_LENGTH } from "../inventory-lookup.server";

/** What the Labels page needs to know about one variant. Safe to send to the browser. */
export type LabelProduct = {
  variantGid: string;
  /** Product and variant name as the merchant sees them, for the list. */
  displayName: string;
  productTitle: string;
  /** Null for a product with a single default variant. */
  variantTitle: string | null;
  sku: string | null;
  barcode: string | null;
  price: string | null;
  /** Only set when it is higher than the price. */
  compareAtPrice: string | null;
  /** The product's vendor in Shopify. */
  vendor: string | null;
};

export type LabelLocation = { locationGid: string; name: string };

const DEFAULT_VARIANT_TITLE = "Default Title";
/** Variants one request may ask about; the page and the label route cap lower. */
export const MAX_LABEL_PRODUCT_LOOKUP = 200;

type VariantRow = {
  shopifyGid: string;
  shopifyProductGid: string;
  title: string;
  displayName: string | null;
  sku: string | null;
  barcode: string | null;
  priceAmount: { toString(): string };
  compareAtPriceAmount: { toString(): string } | null;
  currencyCode: string;
};

type ProductRow = { shopifyGid: string; title: string; vendor: string | null };

function clean(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/**
 * Live variants of the authenticated shop for the given GIDs, in the order
 * asked. GIDs that are malformed, deleted or not in this shop's catalog come
 * back in `missing`, so the page can say so instead of printing fewer labels
 * than requested.
 */
export async function loadLabelProducts(
  db: TenantDb,
  variantGids: readonly string[],
): Promise<{ products: LabelProduct[]; missing: string[] }> {
  const wanted = [...new Set(variantGids)].slice(0, MAX_LABEL_PRODUCT_LOOKUP);
  const valid = wanted.filter(isProductVariantGid);
  const variants: VariantRow[] = valid.length
    ? await db.shopifyVariantFact.findMany({
        where: { existenceState: "LIVE", deletedAt: null, shopifyGid: { in: valid } },
        select: {
          shopifyGid: true,
          shopifyProductGid: true,
          title: true,
          displayName: true,
          sku: true,
          barcode: true,
          priceAmount: true,
          compareAtPriceAmount: true,
          currencyCode: true,
        },
      })
    : [];

  const productGids = [...new Set(variants.map((v) => v.shopifyProductGid))];
  const productRows: ProductRow[] = productGids.length
    ? await db.shopifyProductFact.findMany({
        where: { shopifyGid: { in: productGids } },
        select: { shopifyGid: true, title: true, vendor: true },
      })
    : [];
  const productByGid = new Map(productRows.map((p) => [p.shopifyGid, p]));
  const variantByGid = new Map(variants.map((v) => [v.shopifyGid, v]));

  const products: LabelProduct[] = [];
  const missing: string[] = [];
  for (const gid of wanted) {
    const variant = variantByGid.get(gid);
    if (!variant) {
      missing.push(gid);
      continue;
    }
    const product = productByGid.get(variant.shopifyProductGid);
    const productTitle = product?.title ?? variant.title;
    const variantTitle =
      variant.title === DEFAULT_VARIANT_TITLE || variant.title === productTitle
        ? null
        : variant.title;
    const price = formatLabelMoney(variant.priceAmount.toString(), variant.currencyCode);
    const compareAt = variant.compareAtPriceAmount
      ? formatLabelMoney(variant.compareAtPriceAmount.toString(), variant.currencyCode)
      : null;
    const higher =
      variant.compareAtPriceAmount !== null &&
      Number(variant.compareAtPriceAmount.toString()) > Number(variant.priceAmount.toString());
    products.push({
      variantGid: gid,
      displayName:
        clean(variant.displayName) ??
        (variantTitle ? `${productTitle} - ${variantTitle}` : productTitle),
      productTitle,
      variantTitle,
      sku: clean(variant.sku),
      barcode: clean(variant.barcode),
      price,
      compareAtPrice: higher ? compareAt : null,
      vendor: clean(product?.vendor ?? null),
    });
  }
  return { products, missing };
}

/** Active locations of the authenticated shop, for the label's location line. */
export async function listLabelLocations(db: TenantDb): Promise<LabelLocation[]> {
  const rows: Array<{ shopifyGid: string; name: string }> =
    await db.shopifyLocationFact.findMany({
      where: { existenceState: "LIVE", deletedAt: null, isActive: true },
      select: { shopifyGid: true, name: true },
      orderBy: { name: "asc" },
    });
  return rows.map((row) => ({ locationGid: row.shopifyGid, name: row.name }));
}

export type LabelLookup =
  | { kind: "empty" }
  | { kind: "too_long" }
  | { kind: "not_found"; query: string }
  /** Exactly one product: it can be added without asking. */
  | { kind: "match"; product: LabelProduct }
  /** Several products share the code, or the text matches several names. */
  | { kind: "choose"; query: string; products: LabelProduct[]; truncated: boolean };

/**
 * Find the product a scan or typed text names. A whole code is tried first
 * (barcode, then SKU); only when it matches nothing is the text searched as
 * part of a name, SKU or barcode. More than one match is returned for the
 * person to pick; the system never guesses.
 */
export async function lookupLabelProducts(
  db: TenantDb,
  rawQuery: string,
): Promise<LabelLookup> {
  if (rawQuery.length > MAX_LOOKUP_QUERY_LENGTH) return { kind: "too_long" };
  const query = rawQuery.trim();
  if (query === "") return { kind: "empty" };

  const describe = async (variants: ResolvedVariant[]) =>
    (await loadLabelProducts(db, variants.map((variant) => variant.variantGid))).products;

  const resolution = await resolveScannedCode(db, query);
  if (resolution.status === "invalid" && resolution.reason === "too_long") {
    return { kind: "too_long" };
  }
  if (resolution.status === "matched") {
    const [product] = await describe([resolution.variant]);
    return product ? { kind: "match", product } : { kind: "not_found", query };
  }
  if (resolution.status === "ambiguous") {
    const products = await describe(resolution.candidates);
    return { kind: "choose", query, products, truncated: resolution.truncated };
  }

  if (query.length >= MIN_SEARCH_LENGTH) {
    const { variants, truncated } = await searchLiveVariants(db, query);
    const products = await describe(variants);
    if (products.length === 1) return { kind: "match", product: products[0] };
    if (products.length > 1) return { kind: "choose", query, products, truncated };
  }
  return { kind: "not_found", query };
}
