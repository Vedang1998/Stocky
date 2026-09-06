export {
  CANONICAL_LOCK_VERSION,
  CATALOG_OBSERVATION_GEN_SEQ,
  CATALOG_OBSERVATION_LIFECYCLE_GUARD_FN,
  CATALOG_OBSERVATION_MAX_LEASE_DURATION_MS,
  CATALOG_OBSERVATION_MIN_LEASE_DURATION_MS,
  CATALOG_OBSERVATION_SET_LEASE_FN,
  CATALOG_RESOURCE_KINDS,
  PR5_CANONICAL_ADVISORY_LOCK_TIMEOUT_MS,
  PR5_DEFAULT_CANONICAL_IDENTITIES_PER_TRANSACTION,
  PR5_DEFAULT_WORST_CASE_CONCURRENT_CANONICAL_TRANSACTIONS,
  type CatalogResourceKind,
} from "./constants";
export {
  acquireCanonicalIdentityAdvisoryLock,
  CanonicalAdvisoryLockTenantError,
  CanonicalAdvisoryLockTimeoutError,
  type CanonicalLockQueryRaw,
} from "./advisory-lock";
export {
  CanonicalLockCapacityInsufficientError,
  evaluateCanonicalLockCapacity,
  readPostgresLockCapacitySettings,
  type LockCapacityEvaluation,
  type LockCapacityRequest,
  type LockCapacitySettings,
} from "./lock-capacity";
export {
  canonicalLockPreimage,
  compareCanonicalLockKeys,
  dedupeCanonicalLockKeys,
  deriveCanonicalLockKey,
  encodeCanonicalLockComponent,
  lockIdentityComponents,
  orderCanonicalLockKeysForAcquisition,
  sortCanonicalLockKeysAscending,
  type CanonicalLockIdentity,
  type CanonicalLockKey,
} from "./lock-key";
export { allocateCatalogObservationGeneration } from "./observation-generation";
export {
  writeCompatibilityProjectionState,
  type CompatibilityProjectionWriteState,
} from "./apply/projection-state";
export {
  applyCanonicalFacts,
  applyCanonicalFactsWithRetry,
  CANONICAL_APPLY_PHYSICAL_DELETE_OPERATIONS,
  denyCanonicalFactPhysicalDelete,
  type CanonicalApplyDb,
} from "./apply/index";
export {
  CanonicalApplyAbandonedTokenError,
  CanonicalApplyBatchExceedsCapacityError,
  CanonicalApplyError,
  CanonicalApplyExistenceKindError,
  CanonicalApplyLeaseInvalidError,
  CanonicalApplyMissingTokenError,
  CanonicalApplyMoneyError,
  CanonicalApplyPhysicalDeleteError,
  CanonicalApplyRequestGenerationMismatchError,
  CanonicalApplyUniqueConflictError,
  CanonicalApplyNumericScaleError,
  CanonicalApplyIncompleteFirstLiveError,
  CanonicalApplyIncompleteAuthoritativeAttributesError,
  CanonicalApplyQuantityDomainError,
} from "./apply/errors";
export type {
  CanonicalApplyBatchInput,
  CanonicalApplyBatchResult,
  CanonicalObservation,
  DirectCanonicalObservation,
  FullSyncCanonicalObservation,
} from "./apply/types";
