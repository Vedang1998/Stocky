import type { Prisma } from "@prisma/client";
import type { TenantAuthority } from "../../../tenant/authority.server";
import type {
  CANONICAL_HEALTH_DECISION,
  CANONICAL_PROJECTION_STATE_WRITE,
} from "./constants";

export type CompatibilityProjectionStatus =
  | "SUCCEEDED"
  | "FAILED"
  | "DENIED_PROCESSING_DISABLED";

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

/**
 * Isolated-core halt-on-poison contract. Present only on non-retryable
 * FAILED results. `cursor` / `remainingIdentities` still point at the poison
 * identity so retry cannot falsely claim progress.
 *
 * `resumeAfterQuarantineCursor` is NOT the shop_rebuild retry cursor and is
 * not safe to use until a later worker/integration durably records (quarantines
 * or repairs) the poison identity. F2C itself never advances past corruption.
 */
export type PoisonHaltDisposition = {
  contract: "halt_on_poison";
  durableQuarantineRequired: true;
  resumeAfterQuarantineCursor: ShopRebuildCursor | null;
  remainingIdentitiesAfterQuarantine: CompatibilityProjectionIdentity[];
};

export type CompatibilityProjectionResult = {
  status: CompatibilityProjectionStatus;
  retryable: boolean;
  /** This lane never writes canonical fact rows or projection-state columns. */
  canonicalFactsUnchanged: true;
  canonicalCompatibilityProjectionStateWrite: typeof CANONICAL_PROJECTION_STATE_WRITE;
  /**
   * Always `deferred_to_integration`. F2C does not recommend HEALTHY or
   * DEGRADED and does not authorize a health-state write.
   * `status: "SUCCEEDED"` means only that this invocation's requested work
   * completed; it is not merchant-global health, not proof a partial page is
   * globally current, and not certification of shop-rebuild convergence.
   */
  canonicalHealthDecision: typeof CANONICAL_HEALTH_DECISION;
  processedVariantCount: number;
  processedInventoryLevelCount: number;
  skippedTombstoneCount: number;
  hasMore: boolean;
  cursor: ShopRebuildCursor | null;
  remainingIdentities: CompatibilityProjectionIdentity[];
  failure?: CompatibilityProjectionFailure;
  poisonHalt?: PoisonHaltDisposition;
};

export type CompatibilityProjectionRequest = {
  authority: TenantAuthority;
  /**
   * Caller-supplied uninstall/disable gate. Acceptable ONLY for this isolated
   * core. Later F2B/worker integration MUST read the LIVE authoritative
   * control-plane `Shop.processingEnabled` immediately before projection work.
   * A cached caller boolean is not sufficient for production. This core does
   * not read Shop / control-plane.
   */
  processingEnabled: boolean;
  now?: Date;
  limit?: number;
  writer?: LegacyCompatibilityWriter;
} & (
  | { mode: "identities"; identities: CompatibilityProjectionIdentity[] }
  | {
      /**
       * Bounded replay/projection FROM canonical rows (variants by GID, then
       * inventory levels by item+location). It is not proof of complete
       * merchant compatibility convergence, not authority to delete a legacy
       * row merely because no canonical counterpart was found, and not
       * authority to mark `compatibilityProjectionState` HEALTHY.
       */
      mode: "shop_rebuild";
      cursor?: ShopRebuildCursor | null;
    }
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
  /**
   * Nested canonical ProductVariant existence, or null when that relation is
   * not currently known. Null is not ABSENT.
   */
  variantExistenceState: CanonicalExistenceState | null;
};
