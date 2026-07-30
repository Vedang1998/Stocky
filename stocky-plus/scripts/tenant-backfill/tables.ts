/** Table processing order for Phase 1 PR 1 tenant ownership backfill. */

export const DIRECT_OWNER_TABLES = [
  "Supplier",
  "PurchaseOrder",
  "ShopifyVariantCache",
  "InventorySnapshot",
  "VariantAbcClass",
  "ForecastOverride",
  "SalesDailyAggregate",
  "ShopSettings",
  "TransferOrder",
  "Stocktake",
  "BomComponent",
  "LowStockAlert",
] as const;

export const CHILD_OWNER_TABLES = [
  "SupplierSkuMapping",
  "VolumePriceTier",
  "LeadTimeSnapshot",
  "POLineItem",
  "TransferLineItem",
  "StocktakeLineItem",
] as const;

/** Parents first, then children that depend on resolved parent shopId. */
export const BACKFILL_TABLE_ORDER = [
  ...DIRECT_OWNER_TABLES,
  ...CHILD_OWNER_TABLES,
] as const;

export type BackfillTableName = (typeof BACKFILL_TABLE_ORDER)[number];

export const CHILD_PARENT: Record<
  (typeof CHILD_OWNER_TABLES)[number],
  { parentTable: string; parentIdColumn: string }
> = {
  SupplierSkuMapping: { parentTable: "Supplier", parentIdColumn: "supplierId" },
  VolumePriceTier: { parentTable: "Supplier", parentIdColumn: "supplierId" },
  LeadTimeSnapshot: { parentTable: "Supplier", parentIdColumn: "supplierId" },
  POLineItem: { parentTable: "PurchaseOrder", parentIdColumn: "purchaseOrderId" },
  TransferLineItem: {
    parentTable: "TransferOrder",
    parentIdColumn: "transferOrderId",
  },
  StocktakeLineItem: {
    parentTable: "Stocktake",
    parentIdColumn: "stocktakeId",
  },
};

/** Prisma model → quoted SQL table name (same for these models). */
export function sqlTable(name: BackfillTableName | "Session" | "Shop"): string {
  return `"${name}"`;
}

/** Advisory lock key namespace for concurrent apply prevention. */
export const TENANT_BACKFILL_ADVISORY_LOCK_KEY = 0x53544b31; // 'STK1'
