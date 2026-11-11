/**
 * Current-catalog lookups for reports, from canonical PR5 catalog facts.
 *
 * Only LIVE facts are returned. Identity is always the Shopify GID; SKU,
 * barcode and titles are attributes, never join keys.
 */
import type { TenantDb } from "../../tenant/tenant-db.server";
import { toDecimalOrNull, type Decimal } from "./money";
import { localDateOf, type LocalDate } from "./shop-calendar";

const LIVE = "LIVE";
const PAGE_SIZE = 1000;
const IN_LIST_SIZE = 500;

export type CatalogVariant = {
  variantGid: string;
  productGid: string;
  productTitle: string;
  variantTitle: string;
  displayName: string | null;
  sku: string | null;
  barcode: string | null;
  vendor: string | null;
  productType: string | null;
  productStatus: string;
  priceAmount: Decimal;
  priceCurrencyCode: string;
  /** Shop-local creation date; null when Shopify did not report one. */
  createdLocalDate: LocalDate | null;
  inventoryItemGid: string | null;
  tracked: boolean | null;
  /** Shopify unit cost (`InventoryItem.unitCost`); null when absent or unreadable. */
  unitCost: Decimal | null;
  unitCostCurrencyCode: string | null;
  /** Why `unitCost` is null, from `CatalogUnitCostAccess`. */
  unitCostAccess: string | null;
};

type VariantRow = {
  id: string;
  shopifyGid: string;
  shopifyProductGid: string;
  title: string;
  displayName: string | null;
  sku: string | null;
  barcode: string | null;
  priceAmount: Decimal;
  currencyCode: string;
  shopifyCreatedAt: Date | null;
};

type ProductRow = {
  shopifyGid: string;
  title: string;
  vendor: string | null;
  productType: string | null;
  status: string;
};

type InventoryItemRow = {
  shopifyGid: string;
  shopifyVariantGid: string | null;
  tracked: boolean;
  unitCostAmount: Decimal | null;
  unitCostCurrencyCode: string | null;
  unitCostAccess: string;
};

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function loadVariantRows(
  db: TenantDb,
  variantGids: readonly string[] | undefined,
): Promise<VariantRow[]> {
  const select = {
    id: true,
    shopifyGid: true,
    shopifyProductGid: true,
    title: true,
    displayName: true,
    sku: true,
    barcode: true,
    priceAmount: true,
    currencyCode: true,
    shopifyCreatedAt: true,
  } as const;

  if (variantGids) {
    const rows: VariantRow[] = [];
    for (const batch of chunk([...new Set(variantGids)], IN_LIST_SIZE)) {
      rows.push(
        ...(await db.shopifyVariantFact.findMany({
          where: { existenceState: LIVE, shopifyGid: { in: batch } },
          select,
        })),
      );
    }
    return rows;
  }

  const rows: VariantRow[] = [];
  let afterId: string | null = null;
  for (;;) {
    const page: VariantRow[] = await db.shopifyVariantFact.findMany({
      where: {
        existenceState: LIVE,
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      select,
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
    });
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    afterId = page[page.length - 1].id;
  }
  return rows;
}

/**
 * LIVE variants with their product and inventory-item attributes. Pass
 * `variantGids` to restrict the lookup; omit it to load the whole catalog.
 * Variants whose product fact is not LIVE are omitted.
 */
export async function loadCatalogVariants(
  db: TenantDb,
  input: { timeZone: string; variantGids?: readonly string[] },
): Promise<CatalogVariant[]> {
  const variants = await loadVariantRows(db, input.variantGids);
  if (variants.length === 0) return [];

  const products = new Map<string, ProductRow>();
  const productGids = [...new Set(variants.map((v) => v.shopifyProductGid))];
  for (const batch of chunk(productGids, IN_LIST_SIZE)) {
    const rows: ProductRow[] = await db.shopifyProductFact.findMany({
      where: { existenceState: LIVE, shopifyGid: { in: batch } },
      select: {
        shopifyGid: true,
        title: true,
        vendor: true,
        productType: true,
        status: true,
      },
    });
    for (const row of rows) products.set(row.shopifyGid, row);
  }

  const items = new Map<string, InventoryItemRow>();
  for (const batch of chunk(
    variants.map((v) => v.shopifyGid),
    IN_LIST_SIZE,
  )) {
    const rows: InventoryItemRow[] = await db.shopifyInventoryItemFact.findMany({
      where: { existenceState: LIVE, shopifyVariantGid: { in: batch } },
      select: {
        shopifyGid: true,
        shopifyVariantGid: true,
        tracked: true,
        unitCostAmount: true,
        unitCostCurrencyCode: true,
        unitCostAccess: true,
      },
    });
    for (const row of rows) {
      if (row.shopifyVariantGid) items.set(row.shopifyVariantGid, row);
    }
  }

  const result: CatalogVariant[] = [];
  for (const variant of variants) {
    const product = products.get(variant.shopifyProductGid);
    if (!product) continue;
    const item = items.get(variant.shopifyGid);
    result.push({
      variantGid: variant.shopifyGid,
      productGid: variant.shopifyProductGid,
      productTitle: product.title,
      variantTitle: variant.title,
      displayName: variant.displayName,
      sku: variant.sku,
      barcode: variant.barcode,
      vendor: product.vendor,
      productType: product.productType,
      productStatus: product.status,
      priceAmount: variant.priceAmount,
      priceCurrencyCode: variant.currencyCode,
      createdLocalDate: variant.shopifyCreatedAt
        ? localDateOf(variant.shopifyCreatedAt, input.timeZone)
        : null,
      inventoryItemGid: item?.shopifyGid ?? null,
      tracked: item?.tracked ?? null,
      unitCost: toDecimalOrNull(item?.unitCostAmount ?? null),
      unitCostCurrencyCode: item?.unitCostCurrencyCode ?? null,
      unitCostAccess: item?.unitCostAccess ?? null,
    });
  }
  result.sort((a, b) =>
    a.variantGid < b.variantGid ? -1 : a.variantGid > b.variantGid ? 1 : 0,
  );
  return result;
}

/**
 * "Product - Variant", as Shopify's own `displayName` writes it; the default
 * single variant shows the product only.
 */
export function variantLabel(variant: {
  productTitle: string;
  variantTitle: string;
}): string {
  if (!variant.variantTitle || variant.variantTitle === "Default Title") {
    return variant.productTitle;
  }
  return `${variant.productTitle} - ${variant.variantTitle}`;
}
