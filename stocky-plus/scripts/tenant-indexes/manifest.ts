export type IndexPurpose =
  | "direct_ownership"
  | "parent_composite"
  | "child_compatibility";

export type TenantCompatibilityIndex = {
  name: string;
  table: string;
  unique: boolean;
  columns: string[];
  purpose: IndexPurpose;
  expectedDefNormalized: string;
};

export function normalizeIndexDef(def: string): string {
  return def.trim().replace(/\s+/g, " ").toLowerCase();
}

function formatIndexDefColumn(column: string): string {
  // pg_get_indexdef omits quotes on simple lowercase identifiers (e.g. id).
  if (/^[a-z][a-z0-9_]*$/.test(column)) {
    return column;
  }
  return `"${column}"`;
}

function expectedDef(
  name: string,
  table: string,
  unique: boolean,
  columns: string[],
): string {
  const columnList = columns.map(formatIndexDefColumn).join(", ");
  const uniquePrefix = unique ? "unique " : "";
  return normalizeIndexDef(
    `CREATE ${uniquePrefix}INDEX "${name}" ON public."${table}" USING btree (${columnList})`,
  );
}

function shopIdDirect(table: string): TenantCompatibilityIndex {
  const name = `${table}_shopId_idx`;
  return {
    name,
    table,
    unique: false,
    columns: ["shopId"],
    purpose: "direct_ownership",
    expectedDefNormalized: expectedDef(name, table, false, ["shopId"]),
  };
}

function parentComposite(table: string): TenantCompatibilityIndex {
  const name = `${table}_shopId_id_key`;
  return {
    name,
    table,
    unique: true,
    columns: ["shopId", "id"],
    purpose: "parent_composite",
    expectedDefNormalized: expectedDef(name, table, true, ["shopId", "id"]),
  };
}

function childComposite(
  table: string,
  secondColumn: string,
): TenantCompatibilityIndex {
  const name = `${table}_shopId_${secondColumn}_idx`;
  return {
    name,
    table,
    unique: false,
    columns: ["shopId", secondColumn],
    purpose: "child_compatibility",
    expectedDefNormalized: expectedDef(name, table, false, [
      "shopId",
      secondColumn,
    ]),
  };
}

const DIRECT_OWNERSHIP_TABLES = [
  "Supplier",
  "SupplierSkuMapping",
  "VolumePriceTier",
  "LeadTimeSnapshot",
  "PurchaseOrder",
  "POLineItem",
  "ShopifyVariantCache",
  "InventorySnapshot",
  "VariantAbcClass",
  "ForecastOverride",
  "SalesDailyAggregate",
  "ShopSettings",
  "TransferOrder",
  "TransferLineItem",
  "Stocktake",
  "StocktakeLineItem",
  "BomComponent",
  "LowStockAlert",
] as const;

export const TENANT_COMPATIBILITY_INDEXES: readonly TenantCompatibilityIndex[] =
  [
    ...DIRECT_OWNERSHIP_TABLES.map(shopIdDirect),
    parentComposite("Supplier"),
    parentComposite("PurchaseOrder"),
    parentComposite("TransferOrder"),
    parentComposite("Stocktake"),
    childComposite("SupplierSkuMapping", "supplierId"),
    childComposite("VolumePriceTier", "supplierId"),
    childComposite("LeadTimeSnapshot", "supplierId"),
    childComposite("POLineItem", "purchaseOrderId"),
    childComposite("TransferLineItem", "transferOrderId"),
    childComposite("StocktakeLineItem", "stocktakeId"),
  ];
