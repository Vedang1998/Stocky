/**
 * Phase 1 PR 2 — approved merchant-owned and bootstrap model inventories.
 * Do not silently expand these lists.
 */

export const DIRECT_MERCHANT_MODELS = [
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
  "SyncApplicationReceipt",
  "ShopifyProductFact",
  "ShopifyProductCollectionMembership",
  "ShopifyVariantFact",
  "ShopifyInventoryItemFact",
  "ShopifyLocationFact",
  "ShopifyInventoryLevelFact",
  "CatalogObservationInFlight",
] as const;

export const CHILD_MERCHANT_MODELS = [
  "SupplierSkuMapping",
  "VolumePriceTier",
  "LeadTimeSnapshot",
  "POLineItem",
  "TransferLineItem",
  "StocktakeLineItem",
] as const;

export const MERCHANT_OWNED_MODELS = [
  ...DIRECT_MERCHANT_MODELS,
  ...CHILD_MERCHANT_MODELS,
] as const;

export type DirectMerchantModel = (typeof DIRECT_MERCHANT_MODELS)[number];
export type ChildMerchantModel = (typeof CHILD_MERCHANT_MODELS)[number];
export type MerchantOwnedModel = (typeof MERCHANT_OWNED_MODELS)[number];

export const BOOTSTRAP_MODELS = ["Session", "Shop"] as const;
export type BootstrapModel = (typeof BOOTSTRAP_MODELS)[number];

export const PRIVILEGED_MAINTENANCE_MODELS = [
  "TenantBackfillRun",
  "TenantBackfillCheckpoint",
  "TenantOwnershipIssue",
  "TenantOwnershipIssueDetection",
] as const;

/** Prisma client delegate property names for merchant models. */
export const MERCHANT_DELEGATE_NAMES = {
  Supplier: "supplier",
  PurchaseOrder: "purchaseOrder",
  ShopifyVariantCache: "shopifyVariantCache",
  InventorySnapshot: "inventorySnapshot",
  VariantAbcClass: "variantAbcClass",
  ForecastOverride: "forecastOverride",
  SalesDailyAggregate: "salesDailyAggregate",
  ShopSettings: "shopSettings",
  TransferOrder: "transferOrder",
  Stocktake: "stocktake",
  BomComponent: "bomComponent",
  LowStockAlert: "lowStockAlert",
  SyncApplicationReceipt: "syncApplicationReceipt",
  ShopifyProductFact: "shopifyProductFact",
  ShopifyProductCollectionMembership: "shopifyProductCollectionMembership",
  ShopifyVariantFact: "shopifyVariantFact",
  ShopifyInventoryItemFact: "shopifyInventoryItemFact",
  ShopifyLocationFact: "shopifyLocationFact",
  ShopifyInventoryLevelFact: "shopifyInventoryLevelFact",
  CatalogObservationInFlight: "catalogObservationInFlight",
  SupplierSkuMapping: "supplierSkuMapping",
  VolumePriceTier: "volumePriceTier",
  LeadTimeSnapshot: "leadTimeSnapshot",
  POLineItem: "pOLineItem",
  TransferLineItem: "transferLineItem",
  StocktakeLineItem: "stocktakeLineItem",
} as const satisfies Record<MerchantOwnedModel, string>;

export const DIRECT_MODEL_SET = new Set<string>(DIRECT_MERCHANT_MODELS);
export const CHILD_MODEL_SET = new Set<string>(CHILD_MERCHANT_MODELS);
export const MERCHANT_MODEL_SET = new Set<string>(MERCHANT_OWNED_MODELS);

/** Child/cross-domain parent foreign keys that must be same-tenant before PR 3. */
export const PARENT_OWNERSHIP_RULES: Record<
  string,
  { parentModel: MerchantOwnedModel; foreignKey: string }
> = {
  SupplierSkuMapping: { parentModel: "Supplier", foreignKey: "supplierId" },
  VolumePriceTier: { parentModel: "Supplier", foreignKey: "supplierId" },
  LeadTimeSnapshot: { parentModel: "Supplier", foreignKey: "supplierId" },
  POLineItem: { parentModel: "PurchaseOrder", foreignKey: "purchaseOrderId" },
  TransferLineItem: {
    parentModel: "TransferOrder",
    foreignKey: "transferOrderId",
  },
  StocktakeLineItem: { parentModel: "Stocktake", foreignKey: "stocktakeId" },
  PurchaseOrder: { parentModel: "Supplier", foreignKey: "supplierId" },
};
