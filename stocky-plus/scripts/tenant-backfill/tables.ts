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

/** Frozen allowlist for SQL identifier interpolation (F-PR1-15). */
export const APPROVED_MERCHANT_TABLES: ReadonlySet<string> = new Set([
  ...BACKFILL_TABLE_ORDER,
  "Shop",
]);

export function assertApprovedTable(name: string): void {
  if (!APPROVED_MERCHANT_TABLES.has(name)) {
    throw new Error(`Table not approved for tenant backfill SQL: ${name}`);
  }
}

export function assertApprovedParentRelation(
  parentTable: string,
  parentIdColumn: string,
): void {
  assertApprovedTable(parentTable);
  for (const child of CHILD_OWNER_TABLES) {
    const meta = CHILD_PARENT[child];
    if (meta.parentTable === parentTable && meta.parentIdColumn === parentIdColumn) {
      return;
    }
  }
  throw new Error(
    `Parent relation not approved: ${parentTable}.${parentIdColumn}`,
  );
}

export const DIAGNOSTIC_PHASES = [
  "diagnostic:po_supplier",
  "diagnostic:lead_time",
  "diagnostic:duplicate_shop_settings",
] as const;

export type DiagnosticPhaseName = (typeof DIAGNOSTIC_PHASES)[number];

/** Prisma model → quoted SQL table name (same for these models). */
export function sqlTable(name: BackfillTableName | "Session" | "Shop"): string {
  return `"${name}"`;
}

/** Advisory lock key namespace for concurrent apply prevention. */
export const TENANT_BACKFILL_ADVISORY_LOCK_KEY = 0x53544b31; // 'STK1'
