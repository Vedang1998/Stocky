/**
 * Static per-table subject-evidence manifest (phase1-tenant-subject-v2).
 *
 * Fingerprints identify the starting run subject without including nullable
 * `shopId` (intentionally mutated by PR 1 backfill) or other backfill-mutated
 * fields. Field lists are derived from prisma/schema.prisma.
 */
import {
  BACKFILL_TABLE_ORDER,
  type BackfillTableName,
} from "./tables";

export const TENANT_SUBJECT_EVIDENCE_VERSION = "phase1-tenant-subject-v2" as const;

/** Session evidence capture only — does not make Session a merchant-owned runtime model. */
export const SESSION_SUBJECT_EVIDENCE_COLUMNS = ["id", "shop"] as const;

/**
 * Ordered evidence columns per approved merchant-owned table.
 * Do not include nullable shopId.
 */
export const TABLE_SUBJECT_EVIDENCE_COLUMNS: Record<
  BackfillTableName,
  readonly string[]
> = {
  // Direct-owner
  Supplier: ["id", "shop", "createdAt"],
  PurchaseOrder: ["id", "shop", "supplierId", "createdAt"],
  ShopifyVariantCache: ["id", "shop"],
  InventorySnapshot: ["id", "shop"],
  VariantAbcClass: ["id", "shop", "calculatedAt"],
  ForecastOverride: ["id", "shop"],
  SalesDailyAggregate: ["id", "shop"],
  ShopSettings: ["id", "shop"],
  TransferOrder: ["id", "shop", "createdAt"],
  Stocktake: ["id", "shop", "createdAt"],
  BomComponent: ["id", "shop"],
  LowStockAlert: ["id", "shop", "createdAt"],
  // Child-owner
  SupplierSkuMapping: ["id", "supplierId"],
  VolumePriceTier: ["id", "supplierId"],
  LeadTimeSnapshot: ["id", "supplierId", "purchaseOrderId", "recordedAt"],
  POLineItem: ["id", "purchaseOrderId"],
  TransferLineItem: ["id", "transferOrderId"],
  StocktakeLineItem: ["id", "stocktakeId"],
};

export function subjectEvidenceColumnsFor(
  table: BackfillTableName,
): readonly string[] {
  const cols = TABLE_SUBJECT_EVIDENCE_COLUMNS[table];
  if (!cols || cols.length === 0 || cols[0] !== "id") {
    throw new Error(
      `Subject evidence manifest invalid for ${table}: must start with id`,
    );
  }
  return cols;
}

/** Fail closed if any approved table is missing from the manifest. */
export function assertSubjectManifestComplete(): void {
  for (const table of BACKFILL_TABLE_ORDER) {
    subjectEvidenceColumnsFor(table);
  }
}

assertSubjectManifestComplete();
