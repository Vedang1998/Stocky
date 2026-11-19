import type { TenantDb } from "../tenant/tenant-db.server";
import {
  barcodeLookupKeys,
  MAX_SCANNED_CODE_LENGTH,
  normalizeScannedCode,
  stripControlCharacters,
  type ScanNormalizationFailure,
} from "../lib/scanning/barcode";

/** Upper bound on candidates returned for one ambiguous scan. */
export const MAX_SCAN_CANDIDATES = 10;

export type ResolvedVariant = {
  variantGid: string;
  productGid: string;
  displayName: string;
  productTitle: string | null;
  variantTitle: string;
  sku: string | null;
  barcode: string | null;
  imageUrl: string | null;
};

export type ScanMatchField = "barcode" | "sku";

export type ScanResolution =
  | { status: "invalid"; reason: ScanNormalizationFailure }
  | { status: "unknown"; code: string }
  | {
      status: "matched";
      code: string;
      matchedOn: ScanMatchField;
      variant: ResolvedVariant;
    }
  | {
      status: "ambiguous";
      code: string;
      matchedOn: ScanMatchField;
      candidates: ResolvedVariant[];
      truncated: boolean;
    };

type VariantRow = {
  shopifyGid: string;
  shopifyProductGid: string;
  title: string;
  displayName: string | null;
  sku: string | null;
  barcode: string | null;
};

type ProductRow = {
  shopifyGid: string;
  title: string;
  featuredMediaUrl: string | null;
};

const VARIANT_SELECT = {
  shopifyGid: true,
  shopifyProductGid: true,
  title: true,
  displayName: true,
  sku: true,
  barcode: true,
} as const;

const LIVE = { existenceState: "LIVE", deletedAt: null } as const;

function composeDisplayName(variant: VariantRow, product: ProductRow | undefined) {
  if (variant.displayName) return variant.displayName;
  if (!product) return variant.title;
  return variant.title === "Default Title"
    ? product.title
    : `${product.title} - ${variant.title}`;
}

async function describeVariants(
  db: TenantDb,
  variants: VariantRow[],
): Promise<ResolvedVariant[]> {
  const productGids = [...new Set(variants.map((v) => v.shopifyProductGid))];
  const products: ProductRow[] = productGids.length
    ? await db.shopifyProductFact.findMany({
        where: { shopifyGid: { in: productGids } },
        select: { shopifyGid: true, title: true, featuredMediaUrl: true },
      })
    : [];
  const productByGid = new Map(products.map((p) => [p.shopifyGid, p]));

  return variants.map((variant) => {
    const product = productByGid.get(variant.shopifyProductGid);
    return {
      variantGid: variant.shopifyGid,
      productGid: variant.shopifyProductGid,
      displayName: composeDisplayName(variant, product),
      productTitle: product?.title ?? null,
      variantTitle: variant.title,
      sku: variant.sku,
      barcode: variant.barcode,
      imageUrl: product?.featuredMediaUrl ?? null,
    };
  });
}

function toResolution(
  code: string,
  matchedOn: ScanMatchField,
  rows: VariantRow[],
  described: ResolvedVariant[],
): ScanResolution {
  if (rows.length === 1) {
    return { status: "matched", code, matchedOn, variant: described[0] };
  }
  return {
    status: "ambiguous",
    code,
    matchedOn,
    candidates: described.slice(0, MAX_SCAN_CANDIDATES),
    truncated: rows.length > MAX_SCAN_CANDIDATES,
  };
}

/**
 * Resolve scanner or keyboard input to a live variant in the authenticated
 * shop's catalog facts.
 *
 * Barcodes are compared across equivalent GTIN spellings; when no barcode
 * matches, the code is tried as an exact SKU, since many merchants print SKU
 * labels. More than one hit is returned as `ambiguous` — the operator picks,
 * the system never guesses.
 */
export async function resolveScannedCode(
  db: TenantDb,
  raw: string,
): Promise<ScanResolution> {
  const normalized = normalizeScannedCode(raw);
  if (!normalized.ok) return { status: "invalid", reason: normalized.reason };
  const { code } = normalized;

  const keys = barcodeLookupKeys(code);
  const barcodeRows: VariantRow[] = await db.shopifyVariantFact.findMany({
    where: { ...LIVE, barcode: { in: keys } },
    select: VARIANT_SELECT,
    orderBy: { shopifyGid: "asc" },
    take: MAX_SCAN_CANDIDATES + 1,
  });

  if (barcodeRows.length > 0) {
    // Exact spelling first, then the other GTIN spellings in key order.
    const rank = (row: VariantRow) => keys.indexOf(row.barcode ?? "");
    barcodeRows.sort((a, b) => rank(a) - rank(b));
    const described = await describeVariants(db, barcodeRows);
    return toResolution(code, "barcode", barcodeRows, described);
  }

  const skuRows: VariantRow[] = await db.shopifyVariantFact.findMany({
    where: { ...LIVE, sku: code },
    select: VARIANT_SELECT,
    orderBy: { shopifyGid: "asc" },
    take: MAX_SCAN_CANDIDATES + 1,
  });
  if (skuRows.length === 0) return { status: "unknown", code };

  const described = await describeVariants(db, skuRows);
  return toResolution(code, "sku", skuRows, described);
}

/** Shortest text worth searching; a single character matches most of a catalog. */
export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_RESULTS = 20;

export type VariantSearchResult = {
  variants: ResolvedVariant[];
  truncated: boolean;
};

/** Prisma passes LIKE wildcards through, so escape them to match input literally. */
function likeLiteral(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}

/**
 * Find live variants whose name, SKU or barcode contains the typed text.
 * For people typing part of a product name; scans go through
 * resolveScannedCode, which matches whole codes only.
 */
export async function searchLiveVariants(
  db: TenantDb,
  text: string,
): Promise<VariantSearchResult> {
  const term = stripControlCharacters(text)
    .trim()
    .slice(0, MAX_SCANNED_CODE_LENGTH);
  if (term.length < MIN_SEARCH_LENGTH) return { variants: [], truncated: false };

  const contains = { contains: likeLiteral(term), mode: "insensitive" } as const;
  const rows: VariantRow[] = await db.shopifyVariantFact.findMany({
    where: {
      ...LIVE,
      OR: [{ displayName: contains }, { sku: contains }, { barcode: contains }],
    },
    select: VARIANT_SELECT,
    orderBy: [{ displayName: "asc" }, { shopifyGid: "asc" }],
    take: MAX_SEARCH_RESULTS + 1,
  });

  const variants = await describeVariants(db, rows.slice(0, MAX_SEARCH_RESULTS));
  return { variants, truncated: rows.length > MAX_SEARCH_RESULTS };
}

/** Describe one live variant by GID, e.g. after the operator picks a candidate. */
export async function findLiveVariant(
  db: TenantDb,
  variantGid: string,
): Promise<ResolvedVariant | null> {
  const row: VariantRow | null = await db.shopifyVariantFact.findFirst({
    where: { ...LIVE, shopifyGid: variantGid },
    select: VARIANT_SELECT,
  });
  if (!row) return null;
  const [described] = await describeVariants(db, [row]);
  return described;
}
