/**
 * PR5-F2A canonical Shopify Admin READ types.
 *
 * This lane maps Shopify JSON into typed read models. It does not persist
 * canonical facts, ingest JSONL, or issue Shopify mutations.
 */

export const APPROVED_INVENTORY_QUANTITY_NAMES = [
  "available",
  "on_hand",
  "incoming",
  "committed",
  "reserved",
  "damaged",
  "safety_stock",
  "quality_control",
] as const;

export type ApprovedInventoryQuantityName =
  (typeof APPROVED_INVENTORY_QUANTITY_NAMES)[number];

export const APPROVED_INVENTORY_QUANTITY_NAME_SET: ReadonlySet<string> =
  new Set(APPROVED_INVENTORY_QUANTITY_NAMES);

export const LOCATION_PAGE_SIZE = 50;

/** Structural Admin GraphQL client used by web and worker Shopify contexts. */
export interface CatalogAdminReadClient {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<{ json: () => Promise<unknown> }>;
}

export type AdminGraphQLError = {
  message: string;
  path?: ReadonlyArray<string | number>;
  extensions?: {
    code?: string;
    [key: string]: unknown;
  };
};

export type AdminGraphQLResponse<T> = {
  data?: T;
  errors?: AdminGraphQLError[];
  extensions?: {
    cost?: {
      throttleStatus?: {
        maximumAvailable?: number;
        currentlyAvailable?: number;
        restoreRate?: number;
      };
      requestedQueryCost?: number;
    };
  };
};

export type InventoryLevelPairIdentity = {
  inventoryItemGid: string;
  locationGid: string;
};

export type InventoryQuantityRead = {
  name: string;
  quantity: number;
  /** Official InventoryQuantity.updatedAt — nullable; preserve null. */
  updatedAt: string | null;
};

export type MalformedInventoryQuantityRow = {
  /**
   * Non-persisted diagnostic. A quantity row whose `name` was not a
   * non-empty string. Does not invent a synthetic name.
   */
  reason: "malformed_name";
  observedNameKind: string;
};

export type InventoryQuantitiesRead = {
  byName: Partial<Record<ApprovedInventoryQuantityName, InventoryQuantityRead>>;
  missingApprovedNames: ApprovedInventoryQuantityName[];
  unexpectedNames: string[];
  /**
   * Non-persisted read-boundary diagnostic. Names whose quantity value was
   * present but not a JSON integer. Distinct from a genuinely absent name.
   * Only populated for valid non-empty string names.
   */
  malformedQuantityNames: string[];
  /**
   * Non-persisted diagnostic for rows whose name is null, empty, or not a
   * string. Not a canonical/database field.
   */
  malformedRows: MalformedInventoryQuantityRow[];
};

export type LocationRead = {
  id: string;
  legacyResourceId: string | null;
  name: string;
  isActive: boolean;
  deactivatedAt: string | null;
  fulfillsOnlineOrders: boolean;
  shipsInventory: boolean;
  hasActiveInventory: boolean;
  isFulfillmentService: boolean;
  address1: string | null;
  city: string | null;
  provinceCode: string | null;
  countryCode: string | null;
  zip: string | null;
  shopifyCreatedAt: string;
  shopifyUpdatedAt: string;
};

export type ProductRead = {
  id: string;
  legacyResourceId: string | null;
  title: string;
  handle: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: string;
  featuredMediaUrl: string | null;
  shopifyCreatedAt: string;
  shopifyUpdatedAt: string;
};

export type ProductVariantRead = {
  id: string;
  legacyResourceId: string | null;
  productGid: string;
  title: string;
  displayName: string | null;
  sku: string | null;
  barcode: string | null;
  position: number;
  /** Money scalar — exact decimal string, never JS Number. */
  priceAmount: string;
  compareAtPriceAmount: string | null;
  selectedOptions: Array<{ name: string; value: string }>;
  inventoryItemGid: string | null;
  shopifyCreatedAt: string;
  shopifyUpdatedAt: string;
};

export type InventoryItemRead = {
  id: string;
  legacyResourceId: string | null;
  sku: string | null;
  tracked: boolean;
  requiresShipping: boolean;
  weightValue: number | null;
  weightUnit: string | null;
  variantGid: string | null;
  unitCostAmount: string | null;
  unitCostCurrencyCode: string | null;
  unitCostSelected: boolean;
  shopifyCreatedAt: string;
  shopifyUpdatedAt: string;
};

export type InventoryLevelRead = {
  shopifyLevelGid: string | null;
  identity: InventoryLevelPairIdentity;
  isActive: boolean | null;
  shopifyCreatedAt: string | null;
  shopifyUpdatedAt: string | null;
  quantities: InventoryQuantitiesRead;
};

export type UnitCostAccess =
  | "PRESENT"
  | "NULL"
  | "OMITTED_NO_PERMISSION"
  | "QUERY_ERROR_ISOLATED";

export type UnitCostPreflightDecision = "ALLOWED" | "DENIED" | "UNAVAILABLE";

/**
 * Non-persisted preflight diagnostic. Not a canonical/database enum.
 * Distinguishes GraphQL errors, transport/network failures, and mapping
 * integrity failures without changing the approved unitCostAccess contract.
 */
export type UnitCostPreflightFailureKind =
  | "GRAPHQL"
  | "TRANSPORT"
  | "MAPPING_INTEGRITY";

export type CatalogBulkQueryShape = "with-unitCost" | "no-unitCost";

export type UnitCostPreflightResult = {
  decision: UnitCostPreflightDecision;
  unitCostAccess: UnitCostAccess;
  catalogBulkQueryShape: CatalogBulkQueryShape;
  /** Exact source amount when present; never coerced through Number. */
  unitCostAmount: string | null;
  unitCostCurrencyCode: string | null;
  /** Non-persisted diagnostic; null when the preflight succeeded. */
  failureKind: UnitCostPreflightFailureKind | null;
};

export type BulkOperationGid = string & {
  readonly __brand: "BulkOperationGid";
};

export type BulkOperationStatus =
  | "CANCELED"
  | "CANCELING"
  | "COMPLETED"
  | "CREATED"
  | "EXPIRED"
  | "FAILED"
  | "RUNNING";

export type BulkOperationSnapshot = {
  id: BulkOperationGid;
  status: string;
  errorCode: string | null;
  objectCount: string | null;
  rootObjectCount: string | null;
  url: string | null;
  partialDataUrl: string | null;
  createdAt: string | null;
  completedAt: string | null;
};

export type BulkOperationReadClassification = {
  snapshot: BulkOperationSnapshot;
  /**
   * Canonical success requires COMPLETED + url and treats partialDataUrl as
   * incomplete. This lane never downloads JSONL.
   */
  canonicalSuccessEligible: boolean;
  partialDataUrlIsNotCanonicalSuccess: true;
};

export type ProductCollectionMembershipRead = {
  collectionGid: string;
  title: string;
};
