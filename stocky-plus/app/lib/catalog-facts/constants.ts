/**
 * PR5-F1 shared catalog-fact foundation constants.
 * Infrastructure defaults — not merchant-visible product truth.
 */

export const CANONICAL_LOCK_VERSION = "stocky-pr5-canonical-lock-v1" as const;

export const CATALOG_OBSERVATION_GEN_SEQ =
  "stocky_catalog_observation_gen_seq" as const;

export const CATALOG_OBSERVATION_LIFECYCLE_GUARD_FN =
  "stocky_catalog_observation_lifecycle_guard" as const;

export const CATALOG_OBSERVATION_SET_LEASE_FN =
  "stocky_catalog_observation_set_lease" as const;

/** Minimum validated observation lease duration (test-configurable short values). */
export const CATALOG_OBSERVATION_MIN_LEASE_DURATION_MS = 1;

/** Maximum validated observation lease duration (1 hour engineering bound). */
export const CATALOG_OBSERVATION_MAX_LEASE_DURATION_MS = 3_600_000;

/** Transaction-local lock_timeout around canonical advisory acquisition. */
export const PR5_CANONICAL_ADVISORY_LOCK_TIMEOUT_MS = 5000;

export const PR5_DEFAULT_CANONICAL_IDENTITIES_PER_TRANSACTION = 32;

export const PR5_DEFAULT_WORST_CASE_CONCURRENT_CANONICAL_TRANSACTIONS = 4;

export const CATALOG_RESOURCE_KINDS = [
  "Product",
  "ProductVariant",
  "InventoryItem",
  "Location",
  "InventoryLevel",
] as const;

export type CatalogResourceKind = (typeof CATALOG_RESOURCE_KINDS)[number];
