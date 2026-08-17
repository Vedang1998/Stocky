/**
 * Canonical applicator input/output types (PR5-F2B).
 *
 * Observations are already-authoritative. This lane performs no Shopify I/O.
 */
import type { CatalogResourceKind } from "../constants";
import type { CanonicalLockIdentity } from "../lock-key";

export const APPROVED_EXISTENCE_KINDS = [
  "LIVE_REFETCH",
  "LIVE_FULL_SYNC_PRESENT",
  "ABSENT_CONFIRMED_QUERY",
] as const;

export type ApprovedExistenceKind = (typeof APPROVED_EXISTENCE_KINDS)[number];

export const FORBIDDEN_EXISTENCE_KINDS = ["ABSENT_FULL_SYNC_SWEEP"] as const;

export const QUANTITY_NAMES = [
  "available",
  "onHand",
  "incoming",
  "committed",
  "reserved",
  "damaged",
  "safetyStock",
  "qualityControl",
] as const;

export type QuantityName = (typeof QUANTITY_NAMES)[number];

export const QUANTITY_COLUMN_SPECS: ReadonlyArray<{
  name: QuantityName;
  value: string;
  updatedAt: string;
  requestGen: string;
  responseGen: string;
}> = [
  {
    name: "available",
    value: "availableQuantity",
    updatedAt: "availableQuantityUpdatedAt",
    requestGen: "availableQuantityRequestGen",
    responseGen: "availableQuantityResponseGen",
  },
  {
    name: "onHand",
    value: "onHandQuantity",
    updatedAt: "onHandQuantityUpdatedAt",
    requestGen: "onHandQuantityRequestGen",
    responseGen: "onHandQuantityResponseGen",
  },
  {
    name: "incoming",
    value: "incomingQuantity",
    updatedAt: "incomingQuantityUpdatedAt",
    requestGen: "incomingQuantityRequestGen",
    responseGen: "incomingQuantityResponseGen",
  },
  {
    name: "committed",
    value: "committedQuantity",
    updatedAt: "committedQuantityUpdatedAt",
    requestGen: "committedQuantityRequestGen",
    responseGen: "committedQuantityResponseGen",
  },
  {
    name: "reserved",
    value: "reservedQuantity",
    updatedAt: "reservedQuantityUpdatedAt",
    requestGen: "reservedQuantityRequestGen",
    responseGen: "reservedQuantityResponseGen",
  },
  {
    name: "damaged",
    value: "damagedQuantity",
    updatedAt: "damagedQuantityUpdatedAt",
    requestGen: "damagedQuantityRequestGen",
    responseGen: "damagedQuantityResponseGen",
  },
  {
    name: "safetyStock",
    value: "safetyStockQuantity",
    updatedAt: "safetyStockQuantityUpdatedAt",
    requestGen: "safetyStockQuantityRequestGen",
    responseGen: "safetyStockQuantityResponseGen",
  },
  {
    name: "qualityControl",
    value: "qualityControlQuantity",
    updatedAt: "qualityControlQuantityUpdatedAt",
    requestGen: "qualityControlQuantityRequestGen",
    responseGen: "qualityControlQuantityResponseGen",
  },
];

export const DIAGNOSTIC = {
  CONCURRENT_EXISTENCE: "CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT",
  CONCURRENT_ATTRIBUTE: "CONCURRENT_ATTRIBUTE_OBSERVATION_CONFLICT",
  TERMINAL_REVIVAL: "TERMINAL_IDENTITY_REVIVAL_CONFLICT",
  EQUAL_VERSION: "EQUAL_VERSION_CONFLICT",
  NULL_VERSION: "CATALOG_NULL_VERSION_OBSERVATION",
  STALE_DELETE: "STALE_DELETE_SIGNAL",
  STALE_DISCONNECT: "STALE_DISCONNECT_SIGNAL",
} as const;

export type CatalogSourceKind =
  | "FULL_SYNC"
  | "INCREMENTAL_REFETCH"
  | "DELETE_WEBHOOK"
  | "DISCONNECT_WEBHOOK"
  | "RECONCILE";

export type ExactMoney = string;

export type QuantityObservation = {
  name: QuantityName;
  quantity: number | null;
  shopifyUpdatedAt: Date | null;
};

export type ProductAttributes = {
  title: string;
  handle: string;
  vendor?: string | null;
  productType?: string | null;
  tags?: string[];
  status: "ACTIVE" | "ARCHIVED" | "DRAFT" | "UNLISTED";
  featuredMediaUrl?: string | null;
};

export type VariantAttributes = {
  shopifyProductGid: string;
  title: string;
  displayName?: string | null;
  selectedOptions: unknown;
  sku?: string | null;
  barcode?: string | null;
  priceAmount: ExactMoney;
  compareAtPriceAmount?: ExactMoney | null;
  currencyCode: string;
  position?: number | null;
};

export type InventoryItemAttributes = {
  shopifyVariantGid?: string | null;
  sku?: string | null;
  tracked: boolean;
  requiresShipping: boolean;
  weightValue?: ExactMoney | null;
  weightUnit?: string | null;
  unitCostAmount?: ExactMoney | null;
  unitCostCurrencyCode?: string | null;
  unitCostAccess: "PRESENT" | "NULL" | "OMITTED_NO_PERMISSION" | "QUERY_ERROR_ISOLATED";
};

export type LocationAttributes = {
  name: string;
  isActive: boolean;
  deactivatedAt?: Date | null;
  fulfillsOnlineOrders: boolean;
  shipsInventory: boolean;
  isFulfillmentService: boolean;
  hasActiveInventory: boolean;
  address1?: string | null;
  city?: string | null;
  provinceCode?: string | null;
  countryCode?: string | null;
  zip?: string | null;
};

export type InventoryLevelAttributes = {
  shopifyInventoryLevelGid?: string | null;
  isActive?: boolean;
  quantities?: QuantityObservation[];
};

export type CanonicalGidIdentity = {
  shopId: string;
  resourceKind: Exclude<CatalogResourceKind, "InventoryLevel">;
  shopifyGid: string;
};

export type CanonicalLevelIdentity = {
  shopId: string;
  resourceKind: "InventoryLevel";
  inventoryItemGid: string;
  locationGid: string;
};

export type CanonicalFactIdentity = CanonicalGidIdentity | CanonicalLevelIdentity;

type ObservationBase = {
  identity: CanonicalFactIdentity;
  existenceKind: ApprovedExistenceKind;
  existenceObservedAt: Date;
  shopifyCreatedAt?: Date | null;
  shopifyUpdatedAt?: Date | null;
  shopifyLegacyResourceId?: string | null;
  sourceKind: CatalogSourceKind;
  ingestBatchId?: string | null;
  lastDurableJobId?: string | null;
  lastSyncRunId?: string | null;
  signalReceivedAt?: Date | null;
  lastSignalTopic?: string | null;
  lastSignalDeliveryId?: string | null;
  lastSignalTriggeredAt?: Date | null;
  attributes?:
    | ProductAttributes
    | VariantAttributes
    | InventoryItemAttributes
    | LocationAttributes
    | InventoryLevelAttributes;
};

/** Direct authoritative observation. Token is mandatory; missing fails closed. */
export type DirectCanonicalObservation = ObservationBase & {
  observationKind: "direct";
  observationToken: string;
  observationRequestGen: bigint;
  observationResponseGen: bigint;
};

/**
 * Complete full-sync presence observation. Uses the committed fence generation
 * as the conservative bulk epoch marker. No per-line observation token.
 */
export type FullSyncCanonicalObservation = ObservationBase & {
  observationKind: "full_sync";
  fenceGeneration: bigint;
  epochId: string;
};

export type CanonicalObservation =
  | DirectCanonicalObservation
  | FullSyncCanonicalObservation;

export type CanonicalApplyBatchInput = {
  shopId: string;
  observations: CanonicalObservation[];
  requestedCanonicalIdentitiesPerTransaction?: number;
  configuredWorstCaseConcurrentCanonicalTransactions?: number;
};

export type CanonicalApplyObservationResult = {
  identity: CanonicalFactIdentity;
  outcome:
    | "applied"
    | "noop"
    | "blocked"
    | "conflict"
    | "lease_invalid"
    | "abandoned_token"
    | "missing_token"
    | "rejected";
  existenceMutated: boolean;
  attributesApplied: boolean;
  presenceUpdated: boolean;
  diagnosticState: string | null;
  factId: string | null;
};

export type CanonicalApplyBatchResult = {
  results: CanonicalApplyObservationResult[];
  identitiesLocked: number;
  abandonedBlockerTokens: string[];
};

export function observationLockIdentity(
  observation: CanonicalObservation,
): CanonicalLockIdentity {
  const identity = observation.identity;
  if (identity.resourceKind === "InventoryLevel") {
    return {
      shopId: identity.shopId,
      resourceKind: "InventoryLevel",
      inventoryItemGid: identity.inventoryItemGid,
      locationGid: identity.locationGid,
    };
  }
  return {
    shopId: identity.shopId,
    resourceKind: identity.resourceKind,
    shopifyGid: identity.shopifyGid,
  };
}

export function identityKey(identity: CanonicalFactIdentity): string {
  if (identity.resourceKind === "InventoryLevel") {
    return `${identity.shopId}|InventoryLevel|${identity.inventoryItemGid}|${identity.locationGid}`;
  }
  return `${identity.shopId}|${identity.resourceKind}|${identity.shopifyGid}`;
}

export function isTerminalResource(
  kind: CanonicalFactIdentity["resourceKind"],
): boolean {
  return kind !== "InventoryLevel";
}
