/**
 * PR5-F2C compatibility-projection bounds.
 * Engineering limits for this isolated core — not merchant-visible product truth.
 */

/** Matches current `ingestBulkVariantCache` title composition. */
export const LEGACY_VARIANT_TITLE_SEPARATOR = " — " as const;

export const COMPATIBILITY_PROJECTION_DEFAULT_BATCH_SIZE = 32;

export const COMPATIBILITY_PROJECTION_MAX_BATCH_SIZE = 100;

/** Legacy `ShopifyVariantCache.weight` is DECIMAL(10, 4). */
export const LEGACY_WEIGHT_MAX_ABS = "1000000";

export const CANONICAL_PROJECTION_STATE_WRITE = "omitted_by_f2c_lane" as const;

/**
 * F2C core never decides merchant-durable compatibility health.
 * `status: "SUCCEEDED"` means only that this invocation's requested work
 * completed. Later F2B/worker integration owns `compatibilityProjectionState`
 * and must not mark HEALTHY until the projection matches canonical facts
 * under an accepted synchronization/fence contract.
 */
export const CANONICAL_HEALTH_DECISION = "deferred_to_integration" as const;
