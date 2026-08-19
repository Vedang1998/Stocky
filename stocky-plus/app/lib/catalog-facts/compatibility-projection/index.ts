export {
  CANONICAL_HEALTH_DECISION,
  CANONICAL_PROJECTION_STATE_WRITE,
  COMPATIBILITY_PROJECTION_DEFAULT_BATCH_SIZE,
  COMPATIBILITY_PROJECTION_MAX_BATCH_SIZE,
  LEGACY_VARIANT_TITLE_SEPARATOR,
  LEGACY_WEIGHT_DECIMAL_PLACES,
  TOMBSTONE_DISTINCT_LOCATION_PAGE_SIZE,
  TOMBSTONE_WRITE_CHUNK_SIZE,
} from "./constants";
export { normalizeRebuildCursor } from "./cursor";
export {
  classifyProjectionFailure,
  CompatibilityProjectionError,
  RETRYABLE_PRISMA_ERROR_CODES,
} from "./errors";
export { createTenantDbLegacyWriter } from "./legacy-writer";
export type { TombstoneLocationObserver } from "./legacy-writer";
export {
  mapInventoryLevelToLegacySnapshot,
  mapLegacyVariantTitle,
  mapLegacyWeight,
  mapVariantToLegacyCache,
  selectLiveInventoryItem,
} from "./mapping";
export {
  coerceCanonicalInventoryItem,
  projectCompatibilityFromCanonicalFacts,
} from "./project";
export { legacySnapshotDate } from "./snapshot-date";
export type {
  CompatibilityProjectionIdentity,
  CompatibilityProjectionRequest,
  CompatibilityProjectionResult,
  CompatibilityProjectionStatus,
  LegacyCompatibilityWriter,
  PoisonHaltDisposition,
  ShopRebuildCursor,
  SnapshotProjectionPlan,
  VariantProjectionPlan,
} from "./types";
