/**
 * Names for the variants a report shows. Today's catalog wins; a variant that
 * has since been deleted falls back to what its most recent order line called
 * it, so historical sales never show up as a bare ID.
 */
import type { CatalogVariant } from "../analytics/catalog.server";
import type { SalesHistory } from "../analytics/sales-history.server";

export type VariantInfo = {
  variantGid: string;
  product: string;
  /** Empty for Shopify's default single variant. */
  variant: string;
  sku: string | null;
  vendor: string | null;
  productType: string | null;
  inCatalog: boolean;
};

const DEFAULT_VARIANT_TITLE = "Default Title";

function variantTitle(title: string | null): string {
  return !title || title === DEFAULT_VARIANT_TITLE ? "" : title;
}

function fromCatalog(variant: CatalogVariant): VariantInfo {
  return {
    variantGid: variant.variantGid,
    product: variant.productTitle,
    variant: variantTitle(variant.variantTitle),
    sku: variant.sku,
    vendor: variant.vendor,
    productType: variant.productType,
    inCatalog: true,
  };
}

export type VariantDirectory = (variantGid: string) => VariantInfo;

export function buildVariantDirectory(
  catalog: ReadonlyMap<string, CatalogVariant>,
  history?: Pick<SalesHistory, "events" | "lines">,
): VariantDirectory {
  const sold = new Map<string, VariantInfo>();
  // Events are in date order, so the last write is the most recent sale.
  for (const event of history?.events ?? []) {
    if (catalog.has(event.variantGid)) continue;
    const line = history?.lines.get(event.lineGid);
    if (!line) continue;
    sold.set(event.variantGid, {
      variantGid: event.variantGid,
      product: line.title,
      variant: variantTitle(line.variantTitle),
      sku: line.sku,
      vendor: line.vendor,
      productType: null,
      inCatalog: false,
    });
  }

  return (variantGid) => {
    const current = catalog.get(variantGid);
    if (current) return fromCatalog(current);
    return (
      sold.get(variantGid) ?? {
        variantGid,
        product: `Deleted variant ${variantGid.split("/").pop() ?? ""}`.trim(),
        variant: "",
        sku: null,
        vendor: null,
        productType: null,
        inCatalog: false,
      }
    );
  };
}
