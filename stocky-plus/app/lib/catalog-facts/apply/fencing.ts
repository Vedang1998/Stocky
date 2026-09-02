/**
 * Observation fencing: token fence, durable ACTIVE→ABANDONED, completion.
 * Lease validity uses PostgreSQL clock_timestamp() only.
 */
import {
  CanonicalApplyAbandonedTokenError,
  CanonicalApplyError,
  CanonicalApplyLeaseInvalidError,
  CanonicalApplyMissingTokenError,
  CanonicalApplyRequestGenerationMismatchError,
} from "./errors";
import {
  asBigInt,
  asBigIntOrNull,
  asBool,
  asDate,
  queryRows,
  type CanonicalApplyDb,
} from "./sql";
import type { CanonicalFactIdentity } from "./types";

export type ObservationRow = {
  id: string;
  lifecycleState: string;
  observationRequestGen: bigint;
  observationResponseGen: bigint | null;
  leaseExpiresAt: Date;
};

function identityPredicate(identity: CanonicalFactIdentity): {
  gid: string | null;
  item: string | null;
  location: string | null;
  kind: string;
} {
  if (identity.resourceKind === "InventoryLevel") {
    return {
      gid: null,
      item: identity.inventoryItemGid,
      location: identity.locationGid,
      kind: "InventoryLevel",
    };
  }
  return {
    gid: identity.shopifyGid,
    item: null,
    location: null,
    kind: identity.resourceKind,
  };
}

export async function lockObservationRows(
  db: CanonicalApplyDb,
  shopId: string,
  identity: CanonicalFactIdentity,
): Promise<ObservationRow[]> {
  const pred = identityPredicate(identity);
  const rows = await queryRows<{
    id: string;
    lifecycleState: string;
    observationRequestGen: unknown;
    observationResponseGen: unknown;
    leaseExpiresAt: unknown;
  }>(db)`SELECT id, "lifecycleState", "observationRequestGen", "observationResponseGen", "leaseExpiresAt"
     FROM "CatalogObservationInFlight"
     WHERE "shopId" = ${shopId}
       AND "resourceKind" = ${pred.kind}::"CatalogResourceKind"
       AND (
         (${pred.kind} <> 'InventoryLevel' AND "shopifyGid" = ${pred.gid})
         OR (${pred.kind} = 'InventoryLevel' AND "inventoryItemGid" = ${pred.item} AND "locationGid" = ${pred.location})
       )
     ORDER BY "observationRequestGen" ASC, id ASC
     FOR UPDATE`;
  return rows.map((row) => ({
    id: String(row.id),
    lifecycleState: String(row.lifecycleState),
    observationRequestGen: asBigInt(row.observationRequestGen, "observationRequestGen"),
    observationResponseGen: asBigIntOrNull(
      row.observationResponseGen,
      "observationResponseGen",
    ),
    leaseExpiresAt: asDate(row.leaseExpiresAt) ?? new Date(0),
  }));
}

export async function fenceDirectObservation(
  db: CanonicalApplyDb,
  shopId: string,
  token: string,
  identity: CanonicalFactIdentity,
  expectedRequestGen: bigint,
): Promise<ObservationRow> {
  if (!token) {
    throw new CanonicalApplyMissingTokenError();
  }
  const pred = identityPredicate(identity);
  const rows = await queryRows<{
    id: string;
    lifecycleState: string;
    observationRequestGen: unknown;
    observationResponseGen: unknown;
    leaseExpiresAt: unknown;
    leaseValid: boolean;
  }>(db)`SELECT id, "lifecycleState", "observationRequestGen", "observationResponseGen", "leaseExpiresAt",
            (clock_timestamp() < "leaseExpiresAt") AS "leaseValid"
     FROM "CatalogObservationInFlight"
     WHERE "shopId" = ${shopId}
       AND id = ${token}
       AND "resourceKind" = ${pred.kind}::"CatalogResourceKind"
       AND (
         (${pred.kind} <> 'InventoryLevel' AND "shopifyGid" = ${pred.gid})
         OR (${pred.kind} = 'InventoryLevel' AND "inventoryItemGid" = ${pred.item} AND "locationGid" = ${pred.location})
       )
     FOR UPDATE`;
  if (rows.length === 0) {
    throw new CanonicalApplyMissingTokenError(
      "Observation token is missing; fail closed",
    );
  }
  if (rows.length !== 1) {
    throw new CanonicalApplyMissingTokenError(
      "Observation token matched more than one row; fail closed",
    );
  }
  const row = rows[0];
  const mapped: ObservationRow = {
    id: String(row.id),
    lifecycleState: String(row.lifecycleState),
    observationRequestGen: asBigInt(row.observationRequestGen, "observationRequestGen"),
    observationResponseGen: asBigIntOrNull(
      row.observationResponseGen,
      "observationResponseGen",
    ),
    leaseExpiresAt: asDate(row.leaseExpiresAt) ?? new Date(0),
  };
  if (mapped.observationRequestGen !== expectedRequestGen) {
    throw new CanonicalApplyRequestGenerationMismatchError();
  }
  if (mapped.lifecycleState === "ABANDONED") {
    throw new CanonicalApplyAbandonedTokenError();
  }
  if (mapped.lifecycleState !== "ACTIVE") {
    throw new CanonicalApplyLeaseInvalidError(
      `Observation lifecycle ${mapped.lifecycleState} is not ACTIVE`,
    );
  }
  if (mapped.observationResponseGen != null) {
    throw new CanonicalApplyLeaseInvalidError(
      "ACTIVE observation must remain resultless",
    );
  }
  if (!asBool(row.leaseValid, false)) {
    throw new CanonicalApplyLeaseInvalidError();
  }
  return mapped;
}

async function abandonExpiredResultlessRow(
  db: CanonicalApplyDb,
  shopId: string,
  rowId: string,
): Promise<string | null> {
  const updated = await queryRows<{ id: string }>(db)`UPDATE "CatalogObservationInFlight"
     SET "lifecycleState" = 'ABANDONED',
         "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId}
       AND id = ${rowId}
       AND "lifecycleState" = 'ACTIVE'
       AND "observationResponseGen" IS NULL
       AND clock_timestamp() >= "leaseExpiresAt"
     RETURNING id`;
  return updated[0]?.id ? String(updated[0].id) : null;
}

/**
 * Classify expired ACTIVE resultless rows that would block if they were still
 * unexpired. Lease expiry uses PostgreSQL clock_timestamp() only.
 *
 * Direct: earlier-or-equal requestGen (same predicate as unexpired blockers).
 * Full-sync: any ACTIVE resultless direct for the identity.
 */
export async function loadExpiredActiveResultlessBlockers(
  db: CanonicalApplyDb,
  shopId: string,
  identity: CanonicalFactIdentity,
  options: {
    currentToken?: string | null;
    maxRequestGen?: bigint | null;
  } = {},
): Promise<ObservationRow[]> {
  const pred = identityPredicate(identity);
  const currentToken = options.currentToken ?? null;
  const maxRequestGen = options.maxRequestGen ?? null;
  const rows = await queryRows<{
    id: string;
    lifecycleState: string;
    observationRequestGen: unknown;
    observationResponseGen: unknown;
    leaseExpiresAt: unknown;
  }>(db)`SELECT id, "lifecycleState", "observationRequestGen", "observationResponseGen", "leaseExpiresAt"
     FROM "CatalogObservationInFlight"
     WHERE "shopId" = ${shopId}
       AND "resourceKind" = ${pred.kind}::"CatalogResourceKind"
       AND (
         (${pred.kind} <> 'InventoryLevel' AND "shopifyGid" = ${pred.gid})
         OR (${pred.kind} = 'InventoryLevel' AND "inventoryItemGid" = ${pred.item} AND "locationGid" = ${pred.location})
       )
       AND "lifecycleState" = 'ACTIVE'
       AND "observationResponseGen" IS NULL
       AND clock_timestamp() >= "leaseExpiresAt"
       AND (${currentToken}::text IS NULL OR id <> ${currentToken})
       AND (${maxRequestGen == null ? null : maxRequestGen.toString()}::bigint IS NULL
            OR "observationRequestGen" <= ${maxRequestGen == null ? null : maxRequestGen.toString()}::bigint)
     ORDER BY "observationRequestGen" ASC, id ASC`;
  return rows.map((row) => ({
    id: String(row.id),
    lifecycleState: String(row.lifecycleState),
    observationRequestGen: asBigInt(row.observationRequestGen, "observationRequestGen"),
    observationResponseGen: asBigIntOrNull(
      row.observationResponseGen,
      "observationResponseGen",
    ),
    leaseExpiresAt: asDate(row.leaseExpiresAt) ?? new Date(0),
  }));
}

/** Durable ACTIVE→ABANDONED for the exact expired rows a successor mutation relies on. */
export async function abandonExpiredResultlessRows(
  db: CanonicalApplyDb,
  shopId: string,
  rows: ObservationRow[],
): Promise<string[]> {
  const abandoned: string[] = [];
  for (const row of rows) {
    const abandonedId = await abandonExpiredResultlessRow(db, shopId, row.id);
    if (abandonedId) abandoned.push(abandonedId);
  }
  return abandoned;
}

export async function loadActiveUnexpiredBlockers(
  db: CanonicalApplyDb,
  shopId: string,
  identity: CanonicalFactIdentity,
  currentToken: string | null,
  currentInterval: { requestGen: bigint; responseGen: bigint },
): Promise<ObservationRow[]> {
  // Only earlier-or-equal ACTIVE rows block. Later ACTIVE waiters share this
  // advisory lock; treating them as blockers deadlocks first-insert (Race AT).
  const pred = identityPredicate(identity);
  const rows = await queryRows<{
    id: string;
    lifecycleState: string;
    observationRequestGen: unknown;
    observationResponseGen: unknown;
    leaseExpiresAt: unknown;
  }>(db)`SELECT id, "lifecycleState", "observationRequestGen", "observationResponseGen", "leaseExpiresAt"
     FROM "CatalogObservationInFlight"
     WHERE "shopId" = ${shopId}
       AND "resourceKind" = ${pred.kind}::"CatalogResourceKind"
       AND (
         (${pred.kind} <> 'InventoryLevel' AND "shopifyGid" = ${pred.gid})
         OR (${pred.kind} = 'InventoryLevel' AND "inventoryItemGid" = ${pred.item} AND "locationGid" = ${pred.location})
       )
       AND "lifecycleState" = 'ACTIVE'
       AND "observationResponseGen" IS NULL
       AND clock_timestamp() < "leaseExpiresAt"
       AND (${currentToken}::text IS NULL OR id <> ${currentToken})
       AND "observationRequestGen" <= ${currentInterval.requestGen.toString()}::bigint
     ORDER BY "observationRequestGen" ASC, id ASC`;
  return rows.map((row) => ({
    id: String(row.id),
    lifecycleState: String(row.lifecycleState),
    observationRequestGen: asBigInt(row.observationRequestGen, "observationRequestGen"),
    observationResponseGen: asBigIntOrNull(
      row.observationResponseGen,
      "observationResponseGen",
    ),
    leaseExpiresAt: asDate(row.leaseExpiresAt) ?? new Date(0),
  }));
}

/**
 * Any ACTIVE, unexpired, resultless direct for this identity blocks full-sync
 * existence mutation, including requests that started before, around, or after F.
 */
export async function loadActiveUnexpiredBlockersForFullSync(
  db: CanonicalApplyDb,
  shopId: string,
  identity: CanonicalFactIdentity,
): Promise<ObservationRow[]> {
  const pred = identityPredicate(identity);
  const rows = await queryRows<{
    id: string;
    lifecycleState: string;
    observationRequestGen: unknown;
    observationResponseGen: unknown;
    leaseExpiresAt: unknown;
  }>(db)`SELECT id, "lifecycleState", "observationRequestGen", "observationResponseGen", "leaseExpiresAt"
     FROM "CatalogObservationInFlight"
     WHERE "shopId" = ${shopId}
       AND "resourceKind" = ${pred.kind}::"CatalogResourceKind"
       AND (
         (${pred.kind} <> 'InventoryLevel' AND "shopifyGid" = ${pred.gid})
         OR (${pred.kind} = 'InventoryLevel' AND "inventoryItemGid" = ${pred.item} AND "locationGid" = ${pred.location})
       )
       AND "lifecycleState" = 'ACTIVE'
       AND "observationResponseGen" IS NULL
       AND clock_timestamp() < "leaseExpiresAt"
     ORDER BY "observationRequestGen" ASC, id ASC`;
  return rows.map((row) => ({
    id: String(row.id),
    lifecycleState: String(row.lifecycleState),
    observationRequestGen: asBigInt(row.observationRequestGen, "observationRequestGen"),
    observationResponseGen: asBigIntOrNull(
      row.observationResponseGen,
      "observationResponseGen",
    ),
    leaseExpiresAt: asDate(row.leaseExpiresAt) ?? new Date(0),
  }));
}

export async function loadCompletedOverlappingIntervals(
  db: CanonicalApplyDb,
  shopId: string,
  identity: CanonicalFactIdentity,
  currentToken: string | null,
  currentInterval: { requestGen: bigint; responseGen: bigint },
): Promise<Array<{ requestGen: bigint; responseGen: bigint }>> {
  const pred = identityPredicate(identity);
  const rows = await queryRows<{
    observationRequestGen: unknown;
    observationResponseGen: unknown;
  }>(db)`SELECT "observationRequestGen", "observationResponseGen"
     FROM "CatalogObservationInFlight"
     WHERE "shopId" = ${shopId}
       AND "resourceKind" = ${pred.kind}::"CatalogResourceKind"
       AND (
         (${pred.kind} <> 'InventoryLevel' AND "shopifyGid" = ${pred.gid})
         OR (${pred.kind} = 'InventoryLevel' AND "inventoryItemGid" = ${pred.item} AND "locationGid" = ${pred.location})
       )
       AND "lifecycleState" = 'COMPLETED'
       AND "observationResponseGen" IS NOT NULL
       AND (${currentToken}::text IS NULL OR id <> ${currentToken})
       AND "observationRequestGen" <= ${currentInterval.responseGen.toString()}::bigint
       AND ${currentInterval.requestGen.toString()}::bigint <= "observationResponseGen"`;
  return rows.map((row) => ({
    requestGen: asBigInt(row.observationRequestGen, "observationRequestGen"),
    responseGen: asBigInt(row.observationResponseGen, "observationResponseGen"),
  }));
}

/**
 * Completed directs with responseGen >= F are not safely earlier than the
 * bulk fence (spanning/overlapping F, or started after F).
 */
export async function loadCompletedDirectsNotSafelyEarlierThanFence(
  db: CanonicalApplyDb,
  shopId: string,
  identity: CanonicalFactIdentity,
  fenceGeneration: bigint,
): Promise<Array<{ requestGen: bigint; responseGen: bigint }>> {
  const pred = identityPredicate(identity);
  const rows = await queryRows<{
    observationRequestGen: unknown;
    observationResponseGen: unknown;
  }>(db)`SELECT "observationRequestGen", "observationResponseGen"
     FROM "CatalogObservationInFlight"
     WHERE "shopId" = ${shopId}
       AND "resourceKind" = ${pred.kind}::"CatalogResourceKind"
       AND (
         (${pred.kind} <> 'InventoryLevel' AND "shopifyGid" = ${pred.gid})
         OR (${pred.kind} = 'InventoryLevel' AND "inventoryItemGid" = ${pred.item} AND "locationGid" = ${pred.location})
       )
       AND "lifecycleState" = 'COMPLETED'
       AND "observationResponseGen" IS NOT NULL
       AND "observationResponseGen" >= ${fenceGeneration.toString()}::bigint`;
  return rows.map((row) => ({
    requestGen: asBigInt(row.observationRequestGen, "observationRequestGen"),
    responseGen: asBigInt(row.observationResponseGen, "observationResponseGen"),
  }));
}

export async function completeObservation(
  db: CanonicalApplyDb,
  shopId: string,
  token: string,
  expectedRequestGen: bigint,
  responseGen: bigint,
): Promise<void> {
  if (responseGen <= expectedRequestGen) {
    throw new CanonicalApplyError(
      "canonical_apply_interval_invalid",
      "observationResponseGen must be greater than the durable observationRequestGen",
    );
  }
  const rows = await queryRows<{ id: string }>(db)`UPDATE "CatalogObservationInFlight"
     SET "lifecycleState" = 'COMPLETED',
         "observationResponseGen" = ${responseGen.toString()}::bigint,
         "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId}
       AND id = ${token}
       AND "lifecycleState" = 'ACTIVE'
       AND "observationResponseGen" IS NULL
       AND "observationRequestGen" = ${expectedRequestGen.toString()}::bigint
       AND ${responseGen.toString()}::bigint > "observationRequestGen"
       AND clock_timestamp() < "leaseExpiresAt"
     RETURNING id`;
  if (rows.length !== 1) {
    throw new CanonicalApplyLeaseInvalidError(
      "Final observation completion fence failed",
    );
  }
}

export async function abandonOwnExpiredObservation(
  db: CanonicalApplyDb,
  shopId: string,
  token: string,
  expectedRequestGen: bigint,
  responseGen: bigint | null,
): Promise<void> {
  await queryRows(db)`UPDATE "CatalogObservationInFlight"
     SET "lifecycleState" = 'ABANDONED',
         "observationResponseGen" = ${responseGen?.toString() ?? null}::bigint,
         "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId}
       AND id = ${token}
       AND "lifecycleState" = 'ACTIVE'
       AND "observationRequestGen" = ${expectedRequestGen.toString()}::bigint`;
}
