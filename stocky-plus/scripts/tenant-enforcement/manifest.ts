/**
 * Phase 1 PR 3 — database enforcement inventory (mechanical source of truth).
 *
 * Derived from approved PR 1/PR 2 merchant models, compatibility indexes, and
 * parent-ownership rules. Do not silently expand.
 */

export const ENFORCEMENT_CONTEXT_VERSION = "phase1-db-tenant-context-v1";
export const GUC_SHOP_ID = "stocky.current_shop_id";
export const GUC_CONTEXT_VERSION = "stocky.tenant_context_version";
export const GUC_CORRELATION_ID = "stocky.correlation_id";

export const TENANT_CONTEXT_HELPER_FN = "stocky_current_tenant_id";
export const TENANT_CONTEXT_VERSION_FN = "stocky_current_tenant_context_version";
export const IMMUTABILITY_TRIGGER_FN = "stocky_prevent_shop_id_mutation";
/** Merchant RLS gate — false when Shop.processingEnabled is false. */
export const SHOP_PROCESSING_ENABLED_FN = "stocky_shop_processing_enabled";

/** Advisory lock namespace for enforcement apply ('STK3'). */
export const TENANT_ENFORCEMENT_ADVISORY_LOCK_KEY = 0x53544b33;

export type TableClassification =
  | "merchant_domain"
  | "bootstrap"
  | "control_maintenance"
  | "platform_control_plane";

export type MerchantKind = "direct" | "child";

export type CompositeForeignKey = {
  name: string;
  childTable: string;
  childColumns: [string, string];
  parentTable: string;
  parentColumns: [string, string];
  /** Matches existing Prisma single-column FK semantics where applicable. */
  onDelete: "CASCADE" | "NO ACTION" | "RESTRICT";
  onUpdate: "NO ACTION" | "CASCADE" | "RESTRICT";
  purpose: "child_parent" | "cross_domain" | "secondary_lineage";
};

export type MerchantTableSpec = {
  prismaModel: string;
  sqlTable: string;
  classification: "merchant_domain";
  kind: MerchantKind;
  shopIdNullableInPrisma: true;
  legacyShopField: boolean;
  parentRelationships: string[];
  childRelationships: string[];
  crossDomainRelationships: string[];
  existingShopIdIdUnique: boolean;
  requiredCompositeKey: boolean;
  rlsRequired: true;
  immutabilityTriggerRequired: true;
  bootstrapExemption: false;
  expectedRuntimePrivileges: ("SELECT" | "INSERT" | "UPDATE" | "DELETE")[];
  enforcementStepGroup: string;
};

export type NonMerchantTableSpec = {
  prismaModel: string;
  sqlTable: string;
  classification: "bootstrap" | "control_maintenance" | "platform_control_plane";
  shopIdNullableInPrisma: null | false;
  legacyShopField: boolean;
  rlsRequired: false;
  immutabilityTriggerRequired: false;
  bootstrapExemption: boolean;
  expectedRuntimePrivileges: ("SELECT" | "INSERT" | "UPDATE" | "DELETE")[];
  notes: string;
};

const DML: ("SELECT" | "INSERT" | "UPDATE" | "DELETE")[] = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
];

export const MERCHANT_TABLES: readonly MerchantTableSpec[] = [
  {
    prismaModel: "Supplier",
    sqlTable: "Supplier",
    classification: "merchant_domain",
    kind: "direct",
    shopIdNullableInPrisma: true,
    legacyShopField: true,
    parentRelationships: [],
    childRelationships: [
      "SupplierSkuMapping",
      "VolumePriceTier",
      "LeadTimeSnapshot",
      "PurchaseOrder",
    ],
    crossDomainRelationships: [],
    existingShopIdIdUnique: true,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_direct",
  },
  {
    prismaModel: "PurchaseOrder",
    sqlTable: "PurchaseOrder",
    classification: "merchant_domain",
    kind: "direct",
    shopIdNullableInPrisma: true,
    legacyShopField: true,
    parentRelationships: ["Supplier"],
    childRelationships: ["POLineItem", "LeadTimeSnapshot"],
    crossDomainRelationships: ["Supplier"],
    existingShopIdIdUnique: true,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_direct",
  },
  {
    prismaModel: "ShopifyVariantCache",
    sqlTable: "ShopifyVariantCache",
    classification: "merchant_domain",
    kind: "direct",
    shopIdNullableInPrisma: true,
    legacyShopField: true,
    parentRelationships: [],
    childRelationships: [],
    crossDomainRelationships: [],
    existingShopIdIdUnique: false,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_direct",
  },
  {
    prismaModel: "InventorySnapshot",
    sqlTable: "InventorySnapshot",
    classification: "merchant_domain",
    kind: "direct",
    shopIdNullableInPrisma: true,
    legacyShopField: true,
    parentRelationships: [],
    childRelationships: [],
    crossDomainRelationships: [],
    existingShopIdIdUnique: false,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_direct",
  },
  {
    prismaModel: "VariantAbcClass",
    sqlTable: "VariantAbcClass",
    classification: "merchant_domain",
    kind: "direct",
    shopIdNullableInPrisma: true,
    legacyShopField: true,
    parentRelationships: [],
    childRelationships: [],
    crossDomainRelationships: [],
    existingShopIdIdUnique: false,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_direct",
  },
  {
    prismaModel: "ForecastOverride",
    sqlTable: "ForecastOverride",
    classification: "merchant_domain",
    kind: "direct",
    shopIdNullableInPrisma: true,
    legacyShopField: true,
    parentRelationships: [],
    childRelationships: [],
    crossDomainRelationships: [],
    existingShopIdIdUnique: false,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_direct",
  },
  {
    prismaModel: "SalesDailyAggregate",
    sqlTable: "SalesDailyAggregate",
    classification: "merchant_domain",
    kind: "direct",
    shopIdNullableInPrisma: true,
    legacyShopField: true,
    parentRelationships: [],
    childRelationships: [],
    crossDomainRelationships: [],
    existingShopIdIdUnique: false,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_direct",
  },
  {
    prismaModel: "ShopSettings",
    sqlTable: "ShopSettings",
    classification: "merchant_domain",
    kind: "direct",
    shopIdNullableInPrisma: true,
    legacyShopField: true,
    parentRelationships: [],
    childRelationships: [],
    crossDomainRelationships: [],
    existingShopIdIdUnique: false,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_direct",
  },
  {
    prismaModel: "TransferOrder",
    sqlTable: "TransferOrder",
    classification: "merchant_domain",
    kind: "direct",
    shopIdNullableInPrisma: true,
    legacyShopField: true,
    parentRelationships: [],
    childRelationships: ["TransferLineItem"],
    crossDomainRelationships: [],
    existingShopIdIdUnique: true,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_direct",
  },
  {
    prismaModel: "Stocktake",
    sqlTable: "Stocktake",
    classification: "merchant_domain",
    kind: "direct",
    shopIdNullableInPrisma: true,
    legacyShopField: true,
    parentRelationships: [],
    childRelationships: ["StocktakeLineItem"],
    crossDomainRelationships: [],
    existingShopIdIdUnique: true,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_direct",
  },
  {
    prismaModel: "BomComponent",
    sqlTable: "BomComponent",
    classification: "merchant_domain",
    kind: "direct",
    shopIdNullableInPrisma: true,
    legacyShopField: true,
    parentRelationships: [],
    childRelationships: [],
    crossDomainRelationships: [],
    existingShopIdIdUnique: false,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_direct",
  },
  {
    prismaModel: "LowStockAlert",
    sqlTable: "LowStockAlert",
    classification: "merchant_domain",
    kind: "direct",
    shopIdNullableInPrisma: true,
    legacyShopField: true,
    parentRelationships: [],
    childRelationships: [],
    crossDomainRelationships: [],
    existingShopIdIdUnique: false,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_direct",
  },
  {
    prismaModel: "SupplierSkuMapping",
    sqlTable: "SupplierSkuMapping",
    classification: "merchant_domain",
    kind: "child",
    shopIdNullableInPrisma: true,
    legacyShopField: false,
    parentRelationships: ["Supplier"],
    childRelationships: [],
    crossDomainRelationships: [],
    existingShopIdIdUnique: false,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_child",
  },
  {
    prismaModel: "VolumePriceTier",
    sqlTable: "VolumePriceTier",
    classification: "merchant_domain",
    kind: "child",
    shopIdNullableInPrisma: true,
    legacyShopField: false,
    parentRelationships: ["Supplier"],
    childRelationships: [],
    crossDomainRelationships: [],
    existingShopIdIdUnique: false,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_child",
  },
  {
    prismaModel: "LeadTimeSnapshot",
    sqlTable: "LeadTimeSnapshot",
    classification: "merchant_domain",
    kind: "child",
    shopIdNullableInPrisma: true,
    legacyShopField: false,
    parentRelationships: ["Supplier"],
    childRelationships: [],
    crossDomainRelationships: ["PurchaseOrder"],
    existingShopIdIdUnique: false,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_child",
  },
  {
    prismaModel: "POLineItem",
    sqlTable: "POLineItem",
    classification: "merchant_domain",
    kind: "child",
    shopIdNullableInPrisma: true,
    legacyShopField: false,
    parentRelationships: ["PurchaseOrder"],
    childRelationships: [],
    crossDomainRelationships: [],
    existingShopIdIdUnique: false,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_child",
  },
  {
    prismaModel: "TransferLineItem",
    sqlTable: "TransferLineItem",
    classification: "merchant_domain",
    kind: "child",
    shopIdNullableInPrisma: true,
    legacyShopField: false,
    parentRelationships: ["TransferOrder"],
    childRelationships: [],
    crossDomainRelationships: [],
    existingShopIdIdUnique: false,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_child",
  },
  {
    prismaModel: "StocktakeLineItem",
    sqlTable: "StocktakeLineItem",
    classification: "merchant_domain",
    kind: "child",
    shopIdNullableInPrisma: true,
    legacyShopField: false,
    parentRelationships: ["Stocktake"],
    childRelationships: [],
    crossDomainRelationships: [],
    existingShopIdIdUnique: false,
    requiredCompositeKey: true,
    rlsRequired: true,
    immutabilityTriggerRequired: true,
    bootstrapExemption: false,
    expectedRuntimePrivileges: DML,
    enforcementStepGroup: "merchant_child",
  },
] as const;

export const BOOTSTRAP_TABLES: readonly NonMerchantTableSpec[] = [
  {
    prismaModel: "Session",
    sqlTable: "Session",
    classification: "bootstrap",
    shopIdNullableInPrisma: null,
    legacyShopField: true,
    rlsRequired: false,
    immutabilityTriggerRequired: false,
    bootstrapExemption: true,
    expectedRuntimePrivileges: DML,
    notes:
      "Shopify Prisma session-storage adapter; no shopId; no merchant RLS",
  },
  {
    prismaModel: "Shop",
    sqlTable: "Shop",
    classification: "bootstrap",
    shopIdNullableInPrisma: null,
    legacyShopField: false,
    rlsRequired: false,
    immutabilityTriggerRequired: false,
    bootstrapExemption: true,
    expectedRuntimePrivileges: ["SELECT", "INSERT", "UPDATE"],
    notes:
      "Canonical tenant identity; bootstrap lookup/upsert; not merchant-domain RLS",
  },
] as const;

export const CONTROL_TABLES: readonly NonMerchantTableSpec[] = [
  {
    prismaModel: "TenantBackfillRun",
    sqlTable: "TenantBackfillRun",
    classification: "control_maintenance",
    shopIdNullableInPrisma: null,
    legacyShopField: false,
    rlsRequired: false,
    immutabilityTriggerRequired: false,
    bootstrapExemption: false,
    expectedRuntimePrivileges: [],
    notes: "PR 1 backfill journal — migration/maintenance only",
  },
  {
    prismaModel: "TenantBackfillCheckpoint",
    sqlTable: "TenantBackfillCheckpoint",
    classification: "control_maintenance",
    shopIdNullableInPrisma: null,
    legacyShopField: false,
    rlsRequired: false,
    immutabilityTriggerRequired: false,
    bootstrapExemption: false,
    expectedRuntimePrivileges: [],
    notes: "PR 1 backfill checkpoints — migration/maintenance only",
  },
  {
    prismaModel: "TenantOwnershipIssue",
    sqlTable: "TenantOwnershipIssue",
    classification: "control_maintenance",
    shopIdNullableInPrisma: null,
    legacyShopField: false,
    rlsRequired: false,
    immutabilityTriggerRequired: false,
    bootstrapExemption: false,
    expectedRuntimePrivileges: [],
    notes: "Ownership quarantine — migration/maintenance only",
  },
  {
    prismaModel: "TenantOwnershipIssueDetection",
    sqlTable: "TenantOwnershipIssueDetection",
    classification: "control_maintenance",
    shopIdNullableInPrisma: null,
    legacyShopField: false,
    rlsRequired: false,
    immutabilityTriggerRequired: false,
    bootstrapExemption: false,
    expectedRuntimePrivileges: [],
    notes: "Immutable detection history — migration/maintenance only",
  },
] as const;

export function compositeKeyName(table: string): string {
  return `${table}_shopId_id_key`;
}

export function shopIdNotNullCheckName(table: string): string {
  return `${table}_shopId_not_null`;
}

export function shopIdFkToShopName(table: string): string {
  return `${table}_shopId_fkey_shop`;
}

export function immutabilityTriggerName(table: string): string {
  return `trg_${table}_shopId_immutable`;
}

export function rlsPolicyName(
  table: string,
  command: "select" | "insert" | "update" | "delete",
): string {
  return `${table}_tenant_${command}`;
}

/** Supporting unique (shopId, id) for every merchant table (parent composite targets). */
export const COMPOSITE_PARENT_KEYS: readonly {
  name: string;
  table: string;
  columns: ["shopId", "id"];
}[] = MERCHANT_TABLES.map((t) => ({
  name: compositeKeyName(t.sqlTable),
  table: t.sqlTable,
  columns: ["shopId", "id"] as ["shopId", "id"],
}));

/**
 * Composite tenant foreign keys.
 * Existing single-column Prisma FKs remain; these add tenant co-ownership.
 */
export const COMPOSITE_FOREIGN_KEYS: readonly CompositeForeignKey[] = [
  {
    name: "SupplierSkuMapping_shopId_supplierId_fkey",
    childTable: "SupplierSkuMapping",
    childColumns: ["shopId", "supplierId"],
    parentTable: "Supplier",
    parentColumns: ["shopId", "id"],
    onDelete: "CASCADE",
    onUpdate: "NO ACTION",
    purpose: "child_parent",
  },
  {
    name: "VolumePriceTier_shopId_supplierId_fkey",
    childTable: "VolumePriceTier",
    childColumns: ["shopId", "supplierId"],
    parentTable: "Supplier",
    parentColumns: ["shopId", "id"],
    onDelete: "CASCADE",
    onUpdate: "NO ACTION",
    purpose: "child_parent",
  },
  {
    name: "LeadTimeSnapshot_shopId_supplierId_fkey",
    childTable: "LeadTimeSnapshot",
    childColumns: ["shopId", "supplierId"],
    parentTable: "Supplier",
    parentColumns: ["shopId", "id"],
    onDelete: "CASCADE",
    onUpdate: "NO ACTION",
    purpose: "child_parent",
  },
  {
    name: "POLineItem_shopId_purchaseOrderId_fkey",
    childTable: "POLineItem",
    childColumns: ["shopId", "purchaseOrderId"],
    parentTable: "PurchaseOrder",
    parentColumns: ["shopId", "id"],
    onDelete: "CASCADE",
    onUpdate: "NO ACTION",
    purpose: "child_parent",
  },
  {
    name: "TransferLineItem_shopId_transferOrderId_fkey",
    childTable: "TransferLineItem",
    childColumns: ["shopId", "transferOrderId"],
    parentTable: "TransferOrder",
    parentColumns: ["shopId", "id"],
    onDelete: "CASCADE",
    onUpdate: "NO ACTION",
    purpose: "child_parent",
  },
  {
    name: "StocktakeLineItem_shopId_stocktakeId_fkey",
    childTable: "StocktakeLineItem",
    childColumns: ["shopId", "stocktakeId"],
    parentTable: "Stocktake",
    parentColumns: ["shopId", "id"],
    onDelete: "CASCADE",
    onUpdate: "NO ACTION",
    purpose: "child_parent",
  },
  {
    name: "PurchaseOrder_shopId_supplierId_fkey",
    childTable: "PurchaseOrder",
    childColumns: ["shopId", "supplierId"],
    parentTable: "Supplier",
    parentColumns: ["shopId", "id"],
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
    purpose: "cross_domain",
  },
  {
    name: "LeadTimeSnapshot_shopId_purchaseOrderId_fkey",
    childTable: "LeadTimeSnapshot",
    childColumns: ["shopId", "purchaseOrderId"],
    parentTable: "PurchaseOrder",
    parentColumns: ["shopId", "id"],
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
    purpose: "secondary_lineage",
  },
] as const;

/** Supporting indexes required before composite FK validation. */
export const COMPOSITE_FK_SUPPORTING_INDEXES: readonly {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
}[] = [
  {
    name: "LeadTimeSnapshot_shopId_purchaseOrderId_idx",
    table: "LeadTimeSnapshot",
    columns: ["shopId", "purchaseOrderId"],
    unique: false,
  },
  {
    name: "PurchaseOrder_shopId_supplierId_idx",
    table: "PurchaseOrder",
    columns: ["shopId", "supplierId"],
    unique: false,
  },
];

export const MERCHANT_SQL_TABLES = MERCHANT_TABLES.map((t) => t.sqlTable);

const CONTROL_PLANE_DML: ("SELECT" | "INSERT" | "UPDATE" | "DELETE")[] = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
];

/** Phase 1 PR 4 platform sync control-plane tables (tenant-owned, no merchant RLS). */
export const PLATFORM_CONTROL_PLANE_TABLES: readonly NonMerchantTableSpec[] = [
  {
    prismaModel: "WebhookDelivery",
    sqlTable: "WebhookDelivery",
    classification: "platform_control_plane",
    shopIdNullableInPrisma: false,
    legacyShopField: false,
    rlsRequired: false,
    immutabilityTriggerRequired: false,
    bootstrapExemption: false,
    expectedRuntimePrivileges: [],
    notes: "Durable webhook inbox — control-plane DML only",
  },
  {
    prismaModel: "DurableJob",
    sqlTable: "DurableJob",
    classification: "platform_control_plane",
    shopIdNullableInPrisma: false,
    legacyShopField: false,
    rlsRequired: false,
    immutabilityTriggerRequired: false,
    bootstrapExemption: false,
    expectedRuntimePrivileges: [],
    notes: "Logical control-plane job — control-plane DML only",
  },
  {
    prismaModel: "JobAttempt",
    sqlTable: "JobAttempt",
    classification: "platform_control_plane",
    shopIdNullableInPrisma: false,
    legacyShopField: false,
    rlsRequired: false,
    immutabilityTriggerRequired: false,
    bootstrapExemption: false,
    expectedRuntimePrivileges: [],
    notes: "Append-only attempt ledger",
  },
  {
    prismaModel: "DeadLetter",
    sqlTable: "DeadLetter",
    classification: "platform_control_plane",
    shopIdNullableInPrisma: false,
    legacyShopField: false,
    rlsRequired: false,
    immutabilityTriggerRequired: false,
    bootstrapExemption: false,
    expectedRuntimePrivileges: [],
    notes: "Terminal dead-letter disposition",
  },
  {
    prismaModel: "JobReplay",
    sqlTable: "JobReplay",
    classification: "platform_control_plane",
    shopIdNullableInPrisma: false,
    legacyShopField: false,
    rlsRequired: false,
    immutabilityTriggerRequired: false,
    bootstrapExemption: false,
    expectedRuntimePrivileges: [],
    notes: "Auditable replay lineage",
  },
  {
    prismaModel: "SyncRun",
    sqlTable: "SyncRun",
    classification: "platform_control_plane",
    shopIdNullableInPrisma: false,
    legacyShopField: false,
    rlsRequired: false,
    immutabilityTriggerRequired: false,
    bootstrapExemption: false,
    expectedRuntimePrivileges: [],
    notes: "PR5/PR6 sync-run scaffolding",
  },
  {
    prismaModel: "SyncCursor",
    sqlTable: "SyncCursor",
    classification: "platform_control_plane",
    shopIdNullableInPrisma: false,
    legacyShopField: false,
    rlsRequired: false,
    immutabilityTriggerRequired: false,
    bootstrapExemption: false,
    expectedRuntimePrivileges: [],
    notes: "Domain watermarks",
  },
  {
    prismaModel: "ReconciliationRun",
    sqlTable: "ReconciliationRun",
    classification: "platform_control_plane",
    shopIdNullableInPrisma: false,
    legacyShopField: false,
    rlsRequired: false,
    immutabilityTriggerRequired: false,
    bootstrapExemption: false,
    expectedRuntimePrivileges: [],
    notes: "PR8 reconciliation scaffolding",
  },
  {
    prismaModel: "DataIssue",
    sqlTable: "DataIssue",
    classification: "platform_control_plane",
    shopIdNullableInPrisma: false,
    legacyShopField: false,
    rlsRequired: false,
    immutabilityTriggerRequired: false,
    bootstrapExemption: false,
    expectedRuntimePrivileges: [],
    notes: "Discrepancy scaffolding",
  },
  {
    prismaModel: "SyncHealth",
    sqlTable: "SyncHealth",
    classification: "platform_control_plane",
    shopIdNullableInPrisma: false,
    legacyShopField: false,
    rlsRequired: false,
    immutabilityTriggerRequired: false,
    bootstrapExemption: false,
    expectedRuntimePrivileges: [],
    notes: "Deterministic health per domain",
  },
] as const;

/** SQL table names for control-plane privilege grants. */
export const PLATFORM_CONTROL_PLANE_SQL_TABLES =
  PLATFORM_CONTROL_PLANE_TABLES.map((t) => t.sqlTable);

// Silence unused — DML list documents intended control-plane privileges.
void CONTROL_PLANE_DML;

export function assertMerchantTableCount(): void {
  if (MERCHANT_TABLES.length !== 18) {
    throw new Error(
      `Expected 18 merchant tables, found ${MERCHANT_TABLES.length}`,
    );
  }
}
