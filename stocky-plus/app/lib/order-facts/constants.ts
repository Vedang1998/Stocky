/**
 * PR6-A order-domain foundation constants.
 * Sibling of catalog-facts; do not widen CatalogResourceKind.
 *
 * Observation request/response generations reuse the platform sequence
 * `stocky_catalog_observation_gen_seq` despite its historical catalog name.
 * Do not create a second sequence. Do not add a generation counter to Shop.
 */

export const ORDER_CANONICAL_LOCK_VERSION =
  "stocky-pr6-canonical-lock-v1" as const;

export const ORDER_OBSERVATION_GEN_SEQ =
  "stocky_catalog_observation_gen_seq" as const;

export const ORDER_OBSERVATION_LIFECYCLE_GUARD_FN =
  "stocky_order_observation_lifecycle_guard" as const;

export const ORDER_OBSERVATION_SET_LEASE_FN =
  "stocky_order_observation_set_lease" as const;

/** Minimum validated observation lease duration (test-configurable short values). */
export const ORDER_OBSERVATION_MIN_LEASE_DURATION_MS = 1;

/** Maximum validated observation lease duration (1 hour engineering bound). */
export const ORDER_OBSERVATION_MAX_LEASE_DURATION_MS = 3_600_000;

/** Transaction-local lock_timeout around order-domain advisory acquisition. */
export const PR6_CANONICAL_ADVISORY_LOCK_TIMEOUT_MS = 5000;

export const ORDER_RESOURCE_KINDS = [
  "Order",
  "OrderLine",
  "Refund",
  "RefundLine",
] as const;

export type OrderResourceKind = (typeof ORDER_RESOURCE_KINDS)[number];

export const ORDER_OBSERVATION_TERMINAL_OUTCOMES = [
  "SNAPSHOT_PAGINATION_INCOMPLETE",
] as const;

export type OrderObservationTerminalOutcome =
  (typeof ORDER_OBSERVATION_TERMINAL_OUTCOMES)[number];
