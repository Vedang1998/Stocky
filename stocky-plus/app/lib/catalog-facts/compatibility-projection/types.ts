import type { Prisma } from "@prisma/client";
import type { TenantAuthority } from "../../../tenant/authority.server";
import type { CANONICAL_PROJECTION_STATE_WRITE } from "./constants";

export type CompatibilityProjectionStatus =
  | "SUCCEEDED"
  | "FAILED"
  | "DENIED_PROCESSING_DISABLED";

export type RecommendedCompatibilityProjectionState = "HEALTHY" | "DEGRADED";

export type CompatibilityProjectionIdentity =
  | { kind: "ProductVariant"; shopifyGid: string }
  | {
      kind: "InventoryLevel";
      inventoryItemGid: string;
      locationGid: string;
    };

export type ShopRebuildCursor =
  | { phase: "variants"; afterGid?: string }
  | {
      phase: "inventory_levels";
      afterItemGid?: string;
      afterLocationGid?: string;
    };

export type CompatibilityProjectionFailure = {
  code: string;
  message: string;
  retryable: boolean;
  identity?: CompatibilityProjectionIdentity;
};

export type CompatibilityProjectionResult = {
  status: CompatibilityProjectionStatus;
  retryable: boolean;
  /** This lane never writes canonical fact rows or projection-state columns. */
  canonicalFactsUnchanged: true;
  canonicalCompatibilityProjectionStateWrite: typeof CANONICAL_PROJECTION_STATE_WRITE;
  recommendedCanonicalProjectionState: RecommendedCompatibilityProjectionState;
  processedVariantCount: number;
  processedInventoryLevelCount: number;
  skippedTombstoneCount: number;
  hasMore: boolean;
  cursor: ShopRebuildCursor | null;
  remainingIdentities: CompatibilityProjectionIdentity[];
  failure?: CompatibilityProjectionFailure;
};

export type CompatibilityProjectionRequest = {
  authority: TenantAuthority;
  /**
   * Caller-supplied uninstall/disable gate. This core does not read Shop
   * (control-plane). Later F2B/worker integration must pass the live flag.
   */
  processingEnabled: boolean;
  now?: Date;
  limit?: number;
  writer?: LegacyCompatibilityWriter;
} & (
  | { mode: "identities"; identities: CompatibilityProjectionIdentity[] }
  | { mode: "shop_rebuild"; cursor?: ShopRebuildCursor | null }
);

export type LegacyVariantCacheFields = {
  shopifyVariantId: string;
  shopifyProductId: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  imageUrl: string | null;
  inventoryItemId: string | null;
  weight: Prisma.Decimal | null;
  weightUnit: string | null;
};

export type LegacySnapshotFields = {
  shopifyVariantId: string;
  locationId: string;
  snapshotDate: Date;
  quantityAvailable: number;
};

export type VariantProjectionPlan =
  | { action: "upsert"; fields: LegacyVariantCacheFields }
  | {
      action: "tombstone";
      shopifyVariantId: string;
      snapshotDate: Date;
    };

export type SnapshotProjectionPlan = {
  action: "upsert";
  fields: LegacySnapshotFields;
};

export interface LegacyCompatibilityWriter {
  applyVariantPlan(plan: VariantProjectionPlan): Promise<void>;
  applySnapshotPlan(plan: SnapshotProjectionPlan): Promise<void>;
}

export type CanonicalExistenceState = "LIVE" | "ABSENT";

export type CanonicalProductRead = {
  shopifyGid: string;
  title: string;
  featuredMediaUrl: string | null;
  existenceState: CanonicalExistenceState;
};

export type CanonicalInventoryItemRead = {
  shopifyGid: string;
  shopifyVariantGid: string | null;
  weightValue: Prisma.Decimal | null;
  weightUnit: string | null;
  existenceState: CanonicalExistenceState;
};

export type CanonicalVariantRead = {
  shopifyGid: string;
  shopifyProductGid: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  existenceState: CanonicalExistenceState;
  product: CanonicalProductRead | null;
  inventoryItems: CanonicalInventoryItemRead[];
};

export type CanonicalLocationRead = {
  shopifyGid: string;
  existenceState: CanonicalExistenceState;
};

export type CanonicalInventoryLevelRead = {
  inventoryItemGid: string;
  locationGid: string;
  availableQuantity: number | null;
  existenceState: CanonicalExistenceState;
  inventoryItem: CanonicalInventoryItemRead | null;
  location: CanonicalLocationRead | null;
  variantExistenceState: CanonicalExistenceState | null;
};
