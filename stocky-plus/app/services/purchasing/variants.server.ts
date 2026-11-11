/**
 * Product details copied onto purchasing records.
 *
 * Purchase-order lines and supplier products keep a snapshot of the variant
 * (titles, SKU, barcode, weight, retail price) so documents stay readable when
 * the product later changes or is deleted in Shopify. The synced catalog is
 * read first; a variant the sync has not seen yet is read from Shopify.
 */
import { Prisma } from "@prisma/client";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { shopifyGraphQL, type AdminGraphQLClient } from "../shopify-gql.server";
import { invalidInput } from "./errors";

const VARIANT_GID_PATTERN = /^gid:\/\/shopify\/ProductVariant\/\d+$/;
const DEFAULT_VARIANT_TITLE = "Default Title";
const CATALOG_CHUNK = 500;
const SHOPIFY_NODES_CHUNK = 250;

const GRAMS_PER_UNIT: Record<string, Prisma.Decimal> = {
  GRAMS: new Prisma.Decimal(1),
  KILOGRAMS: new Prisma.Decimal(1000),
  OUNCES: new Prisma.Decimal("28.349523125"),
  POUNDS: new Prisma.Decimal("453.59237"),
};

export type VariantSnapshot = {
  variantGid: string;
  productGid: string | null;
  productTitle: string;
  /** Null for a product's only variant ("Default Title" in Shopify). */
  variantTitle: string | null;
  sku: string | null;
  barcode: string | null;
  vendor: string | null;
  inventoryItemGid: string | null;
  weightGrams: Prisma.Decimal | null;
  /** Shop-currency retail price. */
  retailPrice: Prisma.Decimal | null;
  /** Unit cost recorded in Shopify; null when unset or not readable. */
  shopifyUnitCost: Prisma.Decimal | null;
  shopifyUnitCostCurrency: string | null;
  source: "catalog" | "shopify";
};

export function isVariantGid(value: string): boolean {
  return VARIANT_GID_PATTERN.test(value);
}

export function assertVariantGids(variantGids: readonly string[]): void {
  const invalid = variantGids.find((gid) => !isVariantGid(gid));
  if (invalid !== undefined) {
    throw invalidInput("That product reference is not a Shopify variant.");
  }
}

export function weightInGrams(
  value: Prisma.Decimal | string | number | null | undefined,
  unit: string | null | undefined,
): Prisma.Decimal | null {
  if (value === null || value === undefined || !unit) return null;
  const factor = GRAMS_PER_UNIT[unit.toUpperCase()];
  if (!factor) return null;
  const grams = new Prisma.Decimal(value).times(factor);
  return grams.isNegative() ? null : grams.toDecimalPlaces(4);
}

/** "Product title" or "Product title - Variant title" for lists and documents. */
export function variantDisplayName(snapshot: {
  productTitle: string | null;
  variantTitle: string | null;
}): string {
  const product = snapshot.productTitle?.trim() || "Untitled product";
  const variant = snapshot.variantTitle?.trim();
  return variant ? `${product} - ${variant}` : product;
}

function normaliseVariantTitle(title: string | null | undefined): string | null {
  const trimmed = title?.trim();
  return !trimmed || trimmed === DEFAULT_VARIANT_TITLE ? null : trimmed;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

type CatalogVariantRow = {
  shopifyGid: string;
  shopifyProductGid: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  priceAmount: Prisma.Decimal;
  product: { title: string; vendor: string | null } | null;
  inventoryItems: Array<{
    shopifyGid: string;
    existenceState: string;
    weightValue: Prisma.Decimal | null;
    weightUnit: string | null;
    unitCostAmount: Prisma.Decimal | null;
    unitCostCurrencyCode: string | null;
    unitCostAccess: string;
  }>;
};

function fromCatalog(row: CatalogVariantRow): VariantSnapshot {
  const item =
    row.inventoryItems.find((i) => i.existenceState === "LIVE") ?? null;
  const hasCost = item !== null && item.unitCostAccess === "PRESENT";
  return {
    variantGid: row.shopifyGid,
    productGid: row.shopifyProductGid,
    productTitle: row.product?.title ?? row.title,
    variantTitle: normaliseVariantTitle(row.title),
    sku: row.sku || null,
    barcode: row.barcode || null,
    vendor: row.product?.vendor || null,
    inventoryItemGid: item?.shopifyGid ?? null,
    weightGrams: weightInGrams(item?.weightValue, item?.weightUnit),
    retailPrice: row.priceAmount,
    shopifyUnitCost: hasCost ? item.unitCostAmount : null,
    shopifyUnitCostCurrency: hasCost ? item.unitCostCurrencyCode : null,
    source: "catalog",
  };
}

type ShopifyVariantNode = {
  __typename?: string;
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: string;
  product: { id: string; title: string; vendor: string | null };
  inventoryItem: {
    id: string;
    measurement: { weight: { value: number; unit: string } | null } | null;
  } | null;
};

async function readFromShopify(
  admin: AdminGraphQLClient,
  variantGids: string[],
): Promise<VariantSnapshot[]> {
  const snapshots: VariantSnapshot[] = [];
  for (const ids of chunk(variantGids, SHOPIFY_NODES_CHUNK)) {
    const result = await shopifyGraphQL<{
      nodes: Array<ShopifyVariantNode | null>;
    }>(
      admin,
      `#graphql
        query StockyPurchasingVariants($ids: [ID!]!) {
          nodes(ids: $ids) {
            __typename
            ... on ProductVariant {
              id
              title
              sku
              barcode
              price
              product {
                id
                title
                vendor
              }
              inventoryItem {
                id
                measurement {
                  weight {
                    value
                    unit
                  }
                }
              }
            }
          }
        }`,
      { ids },
    );
    for (const node of result.data?.nodes ?? []) {
      if (!node || node.__typename !== "ProductVariant") continue;
      const weight = node.inventoryItem?.measurement?.weight ?? null;
      snapshots.push({
        variantGid: node.id,
        productGid: node.product.id,
        productTitle: node.product.title,
        variantTitle: normaliseVariantTitle(node.title),
        sku: node.sku || null,
        barcode: node.barcode || null,
        vendor: node.product.vendor || null,
        inventoryItemGid: node.inventoryItem?.id ?? null,
        weightGrams: weight ? weightInGrams(weight.value, weight.unit) : null,
        retailPrice: new Prisma.Decimal(node.price),
        // Cost needs a staff permission the session may not have; the merchant
        // enters it on the line instead of the whole lookup failing.
        shopifyUnitCost: null,
        shopifyUnitCostCurrency: null,
        source: "shopify",
      });
    }
  }
  return snapshots;
}

/**
 * Snapshots for the given variants, keyed by variant GID. Variants that exist
 * neither in the synced catalog nor in Shopify are absent from the result.
 */
export async function resolveVariants(
  db: TenantDb,
  variantGids: readonly string[],
  options: { admin?: AdminGraphQLClient } = {},
): Promise<Map<string, VariantSnapshot>> {
  const unique = [...new Set(variantGids)];
  assertVariantGids(unique);
  const resolved = new Map<string, VariantSnapshot>();

  for (const gids of chunk(unique, CATALOG_CHUNK)) {
    const rows: CatalogVariantRow[] = await db.shopifyVariantFact.findMany({
      where: { shopifyGid: { in: gids }, existenceState: "LIVE" },
      include: { product: true, inventoryItems: true },
    });
    for (const row of rows) resolved.set(row.shopifyGid, fromCatalog(row));
  }

  const missing = unique.filter((gid) => !resolved.has(gid));
  if (missing.length > 0 && options.admin) {
    for (const snapshot of await readFromShopify(options.admin, missing)) {
      resolved.set(snapshot.variantGid, snapshot);
    }
  }
  return resolved;
}

/** Live variants whose SKU or barcode equals the scanned or typed code. */
export async function findVariantGidsByCode(
  db: TenantDb,
  code: string,
  limit = 20,
): Promise<string[]> {
  const trimmed = code.trim();
  if (!trimmed) return [];
  const rows: Array<{ shopifyGid: string }> =
    await db.shopifyVariantFact.findMany({
      where: {
        existenceState: "LIVE",
        OR: [{ sku: trimmed }, { barcode: trimmed }],
      },
      select: { shopifyGid: true },
      orderBy: { shopifyGid: "asc" },
      take: limit,
    });
  return rows.map((row) => row.shopifyGid);
}
