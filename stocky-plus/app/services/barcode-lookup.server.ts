import type { TenantDb } from "../tenant/tenant-db.server";
import {
  barcodeLookupKeys,
  normalizeScannedCode,
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
