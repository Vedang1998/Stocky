/**
 * PR5-F2B canonical merchant-fact applicator.
 *
 * Receives already-authoritative observations. Performs no Shopify network I/O.
 * Every writer acquires the frozen pg_advisory_xact_lock identity anchor first.
 */
import { acquireCanonicalIdentityAdvisoryLock } from "../advisory-lock";
import {
  evaluateCanonicalLockCapacity,
  type LockCapacitySettings,
} from "../lock-capacity";
import {
  deriveCanonicalLockKey,
  orderCanonicalLockKeysForAcquisition,
  type CanonicalLockIdentity,
} from "../lock-key";
import {
  decideAttributeClock,
  decideQuantityClock,
  nullableFallbackIntervalFromFullSyncMarker,
  type GenerationInterval,
} from "./clocks";
import {
  CanonicalApplyBatchExceedsCapacityError,
  CanonicalApplyError,
  CanonicalApplyExistenceKindError,
  CanonicalApplyIncompleteAuthoritativeAttributesError,
  CanonicalApplyIncompleteFirstLiveError,
  CanonicalApplyLeaseInvalidError,
  CanonicalApplyMissingTokenError,
  CanonicalApplyMoneyError,
  CanonicalApplyNumericScaleError,
  CanonicalApplyPhysicalDeleteError,
  CanonicalApplyQuantityDomainError,
} from "./errors";
import { decideExistence } from "./existence";
import {
  directObservationInterval,
  fullSyncAttributeMarker,
  fullSyncFenceGeneration,
} from "./observation-evidence";
import {
  inventoryLevelHasResourceAttributes,
  validateExistingAuthoritativeAttributes,
  validateFirstLiveAttributes,
  validateObservationNumericColumns,
  validateObservationQuantityColumns,
} from "./first-live";
import {
  abandonExpiredResultlessRows,
  abandonOwnExpiredObservation,
  completeObservation,
  fenceDirectObservation,
  loadActiveUnexpiredBlockers,
  loadActiveUnexpiredBlockersForFullSync,
  loadCompletedDirectsNotSafelyEarlierThanFence,
  loadCompletedOverlappingIntervals,
  loadExpiredActiveResultlessBlockers,
  lockObservationRows,
} from "./fencing";
import type { CanonicalApplyDb } from "./sql";
import { queryRows } from "./sql";
import {
  identityKey,
  observationLockIdentity,
  DIAGNOSTIC,
  QUANTITY_COLUMN_SPECS,
  type CanonicalApplyBatchInput,
  type CanonicalApplyBatchResult,
  type CanonicalApplyObservationResult,
  type CanonicalFactIdentity,
  type CanonicalObservation,
  type InventoryItemAttributes,
  type InventoryLevelAttributes,
  type LocationAttributes,
  type ProductAttributes,
  type VariantAttributes,
} from "./types";
import {
  insertFact,
  inventoryItemAttributesEqual,
  inventoryLevelAttributesEqual,
  locationAttributesEqual,
  lockAndReadFact,
  markCompatibilityProjectionPending,
  productAttributesEqual,
  updateDiagnostic,
  updateExistence,
  updateFreshnessAndDiagnostic,
  updateInventoryItemAttributes,
  updateInventoryLevelAttributes,
  updateLocationAttributes,
  updatePresenceMarker,
  updateProductAttributes,
  updateQuantity,
  updateVariantAttributes,
  variantAttributesEqual,
  type ExistenceWrite,
  type FactSnapshot,
} from "./writers";

export type { CanonicalApplyDb };

/** R-164: ordinary apply surface has no physical-delete operation. */
export const CANONICAL_APPLY_PHYSICAL_DELETE_OPERATIONS = [] as const;

export function denyCanonicalFactPhysicalDelete(): never {
  throw new CanonicalApplyPhysicalDeleteError();
}

function compareObservations(
  a: CanonicalObservation,
  b: CanonicalObservation,
): number {
  const aGen =
    a.observationKind === "full_sync"
      ? a.fenceGeneration
      : a.observationRequestGen;
  const bGen =
    b.observationKind === "full_sync"
      ? b.fenceGeneration
      : b.observationRequestGen;
  if (aGen !== bGen) {
    return aGen < bGen ? -1 : 1;
  }
  const aToken =
    a.observationKind === "direct"
      ? a.observationToken
      : `full_sync:${a.epochId}`;
  const bToken =
    b.observationKind === "direct"
      ? b.observationToken
      : `full_sync:${b.epochId}`;
  return aToken < bToken ? -1 : aToken > bToken ? 1 : 0;
}

function validateObservation(observation: CanonicalObservation): void {
  if (
    observation.identity.shopId == null ||
    observation.identity.shopId === ""
  ) {
    throw new CanonicalApplyError(
      "canonical_apply_identity_invalid",
      "shopId is required",
    );
  }
  if (
    observation.existenceKind !== "LIVE_REFETCH" &&
    observation.existenceKind !== "LIVE_FULL_SYNC_PRESENT" &&
    observation.existenceKind !== "ABSENT_CONFIRMED_QUERY"
  ) {
    throw new CanonicalApplyExistenceKindError(
      String(observation.existenceKind),
    );
  }
  if (
    observation.observationKind === "full_sync" &&
    observation.existenceKind === "ABSENT_CONFIRMED_QUERY"
  ) {
    throw new CanonicalApplyExistenceKindError("ABSENT_FULL_SYNC_SWEEP");
  }
  if (observation.observationKind === "direct") {
    if (!observation.observationToken) {
      throw new CanonicalApplyMissingTokenError();
    }
    if (
      observation.observationRequestGen >= observation.observationResponseGen
    ) {
      throw new CanonicalApplyError(
        "canonical_apply_interval_invalid",
        "direct observationRequestGen must be < observationResponseGen",
      );
    }
  }
}

async function requireTenant(
  db: CanonicalApplyDb,
  shopId: string,
): Promise<void> {
  const rows = await queryRows<{ shop_id: string | null }>(
    db,
  )`SELECT NULLIF(current_setting('stocky.current_shop_id', true), '') AS shop_id`;
  const current = rows[0]?.shop_id ?? null;
  if (!current || current !== shopId) {
    throw new CanonicalApplyError(
      "canonical_apply_tenant_mismatch",
      "Canonical apply requires a matching tenant transaction",
    );
  }
}

async function readCapacitySettings(
  db: CanonicalApplyDb,
): Promise<LockCapacitySettings> {
  const rows = await queryRows<{
    max_locks_per_transaction: string;
    max_connections: string;
    max_prepared_transactions: string;
  }>(db)`SELECT
       current_setting('max_locks_per_transaction') AS max_locks_per_transaction,
       current_setting('max_connections') AS max_connections,
       current_setting('max_prepared_transactions') AS max_prepared_transactions`;
  const row = rows[0];
  if (!row) {
    throw new CanonicalApplyError(
      "canonical_apply_capacity_settings_missing",
      "PostgreSQL lock capacity settings were not returned",
    );
  }
  const asSafeInt = (raw: string, name: string): number => {
    if (typeof raw !== "string" || !/^-?\d+$/.test(raw.trim())) {
      throw new CanonicalApplyError(
        "canonical_apply_capacity_settings_invalid",
        `${name} is not a numeric integer`,
      );
    }
    const value = Number(raw.trim());
    if (!Number.isSafeInteger(value)) {
      throw new CanonicalApplyError(
        "canonical_apply_capacity_settings_unsafe",
        `${name} is not a safe integer`,
      );
    }
    return value;
  };
  return {
    maxLocksPerTransaction: asSafeInt(
      String(row.max_locks_per_transaction),
      "max_locks_per_transaction",
    ),
    maxConnections: asSafeInt(String(row.max_connections), "max_connections"),
    maxPreparedTransactions: asSafeInt(
      String(row.max_prepared_transactions),
      "max_prepared_transactions",
    ),
  };
}

async function acquireOrderedLocks(
  db: CanonicalApplyDb,
  identities: CanonicalLockIdentity[],
): Promise<void> {
  const keys = identities.map((identity) => ({
    identity,
    key: deriveCanonicalLockKey(identity),
  }));
  const ordered = orderCanonicalLockKeysForAcquisition(
    keys.map((item) => item.key),
  );
  const seen = new Set<string>();
  for (const key of ordered) {
    const match = keys.find(
      (item) => item.key.key1 === key.key1 && item.key.key2 === key.key2,
    );
    if (!match) continue;
    const id = `${key.key1}:${key.key2}`;
    if (seen.has(id)) continue;
    seen.add(id);
    await acquireCanonicalIdentityAdvisoryLock(db, match.identity);
  }
}

function storedIntervalFromFact(
  fact: FactSnapshot | null,
): GenerationInterval | null {
  if (!fact) return null;
  if (fact.attributeRequestGen == null || fact.attributeResponseGen == null)
    return null;
  return {
    requestGen: fact.attributeRequestGen,
    responseGen: fact.attributeResponseGen,
  };
}

async function rejectUsableObservation(
  db: CanonicalApplyDb,
  observation: CanonicalObservation,
  abandoned: string[],
  failure: { error: CanonicalApplyError; diagnostic: string },
  extras?: {
    factId: string | null;
    existenceMutated: boolean;
    fact?: FactSnapshot | null;
  },
): Promise<{
  result: CanonicalApplyObservationResult;
  abandoned: string[];
}> {
  if (observation.observationKind === "full_sync") {
    throw failure.error;
  }
  if (extras?.factId && extras.fact) {
    await updateFreshnessAndDiagnostic(
      db,
      observation.identity,
      extras.factId,
      "DEGRADED",
      preserveRevivalDiagnostic(
        extras.fact.existenceDiagnosticState,
        failure.diagnostic,
      ),
    );
    await markCompatibilityProjectionPending(
      db,
      observation.identity,
      extras.factId,
    );
  }
  await completeObservation(
    db,
    observation.identity.shopId,
    observation.observationToken,
    observation.observationRequestGen,
    observation.observationResponseGen,
  );
  return {
    abandoned,
    result: {
      identity: observation.identity,
      outcome: "rejected",
      existenceMutated: extras?.existenceMutated ?? false,
      attributesApplied: false,
      presenceUpdated: false,
      diagnosticState: failure.diagnostic,
      factId: extras?.factId ?? null,
    },
  };
}

function preserveRevivalDiagnostic(
  existing: string | null,
  incoming: string | null,
): string | null {
  if (existing && existing.startsWith(`${DIAGNOSTIC.TERMINAL_REVIVAL}`)) {
    return existing;
  }
  return incoming ?? existing;
}

async function persistClockNoop(
  db: CanonicalApplyDb,
  identity: CanonicalFactIdentity,
  fact: FactSnapshot,
  decision: {
    freshness: "ORDERED" | "DEGRADED" | null;
    diagnostic: string | null;
  },
): Promise<void> {
  if (!decision.freshness && !decision.diagnostic) return;
  await updateFreshnessAndDiagnostic(
    db,
    identity,
    fact.id,
    decision.freshness ?? "DEGRADED",
    preserveRevivalDiagnostic(
      fact.existenceDiagnosticState,
      decision.diagnostic,
    ),
  );
}

async function applyAttributes(
  db: CanonicalApplyDb,
  observation: CanonicalObservation,
  fact: FactSnapshot,
  interval: GenerationInterval,
): Promise<{ applied: boolean; diagnostic: string | null }> {
  const identity = observation.identity;
  if (!observation.attributes) {
    return { applied: false, diagnostic: null };
  }
  if (identity.resourceKind === "Product") {
    const attrs = observation.attributes as ProductAttributes;
    const decision = decideAttributeClock({
      incomingUpdatedAt: observation.shopifyUpdatedAt ?? null,
      storedUpdatedAt: fact.shopifyUpdatedAt,
      incomingInterval: interval,
      storedInterval: storedIntervalFromFact(fact),
      attributesEqual: productAttributesEqual(fact, attrs),
    });
    if (decision.apply) {
      await updateProductAttributes(
        db,
        identity.shopId,
        fact.id,
        attrs,
        observation.shopifyUpdatedAt ?? null,
        interval,
        decision.freshness,
      );
    } else {
      await persistClockNoop(db, identity, fact, decision);
    }
    return { applied: decision.apply, diagnostic: decision.diagnostic };
  }
  if (identity.resourceKind === "ProductVariant") {
    const attrs = observation.attributes as VariantAttributes;
    const decision = decideAttributeClock({
      incomingUpdatedAt: observation.shopifyUpdatedAt ?? null,
      storedUpdatedAt: fact.shopifyUpdatedAt,
      incomingInterval: interval,
      storedInterval: storedIntervalFromFact(fact),
      attributesEqual: variantAttributesEqual(fact, attrs),
    });
    if (decision.apply) {
      await updateVariantAttributes(
        db,
        identity.shopId,
        fact.id,
        attrs,
        observation.shopifyUpdatedAt ?? null,
        interval,
        decision.freshness,
      );
    } else {
      await persistClockNoop(db, identity, fact, decision);
    }
    return { applied: decision.apply, diagnostic: decision.diagnostic };
  }
  if (identity.resourceKind === "InventoryItem") {
    const attrs = observation.attributes as InventoryItemAttributes;
    const decision = decideAttributeClock({
      incomingUpdatedAt: observation.shopifyUpdatedAt ?? null,
      storedUpdatedAt: fact.shopifyUpdatedAt,
      incomingInterval: interval,
      storedInterval: storedIntervalFromFact(fact),
      attributesEqual: inventoryItemAttributesEqual(fact, attrs),
    });
    if (decision.apply) {
      await updateInventoryItemAttributes(
        db,
        identity.shopId,
        fact.id,
        attrs,
        observation.shopifyUpdatedAt ?? null,
        interval,
        decision.freshness,
      );
    } else {
      await persistClockNoop(db, identity, fact, decision);
    }
    return { applied: decision.apply, diagnostic: decision.diagnostic };
  }
  if (identity.resourceKind === "Location") {
    const attrs = observation.attributes as LocationAttributes;
    const decision = decideAttributeClock({
      incomingUpdatedAt: observation.shopifyUpdatedAt ?? null,
      storedUpdatedAt: fact.shopifyUpdatedAt,
      incomingInterval: interval,
      storedInterval: storedIntervalFromFact(fact),
      attributesEqual: locationAttributesEqual(fact, attrs),
    });
    if (decision.apply) {
      await updateLocationAttributes(
        db,
        identity.shopId,
        fact.id,
        attrs,
        observation.shopifyUpdatedAt ?? null,
        interval,
        decision.freshness,
      );
    } else {
      await persistClockNoop(db, identity, fact, decision);
    }
    return { applied: decision.apply, diagnostic: decision.diagnostic };
  }
  if (identity.resourceKind === "InventoryLevel") {
    const attrs = observation.attributes as InventoryLevelAttributes;
    if (
      !inventoryLevelHasResourceAttributes(
        attrs as unknown as Record<string, unknown>,
      )
    ) {
      return { applied: false, diagnostic: null };
    }
    const decision = decideAttributeClock({
      incomingUpdatedAt: observation.shopifyUpdatedAt ?? null,
      storedUpdatedAt: fact.shopifyUpdatedAt,
      incomingInterval: interval,
      storedInterval: storedIntervalFromFact(fact),
      attributesEqual: inventoryLevelAttributesEqual(fact, attrs),
    });
    if (decision.apply) {
      await updateInventoryLevelAttributes(
        db,
        identity.shopId,
        fact.id,
        attrs,
        observation.shopifyUpdatedAt ?? null,
        interval,
        decision.freshness,
      );
    } else {
      await persistClockNoop(db, identity, fact, decision);
    }
    return { applied: decision.apply, diagnostic: decision.diagnostic };
  }
  return { applied: false, diagnostic: null };
}

async function applyQuantities(
  db: CanonicalApplyDb,
  observation: CanonicalObservation,
  fact: FactSnapshot,
  interval: GenerationInterval,
): Promise<boolean> {
  if (observation.identity.resourceKind !== "InventoryLevel") return false;
  const attrs = (observation.attributes ?? {}) as InventoryLevelAttributes;
  const incoming = attrs.quantities ?? [];
  let applied = false;
  for (const spec of QUANTITY_COLUMN_SPECS) {
    const qty = incoming.find((item) => item.name === spec.name);
    if (!qty) continue;
    const stored = fact.quantities[spec.name];
    const storedInterval =
      stored?.requestGen != null && stored.responseGen != null
        ? { requestGen: stored.requestGen, responseGen: stored.responseGen }
        : null;
    const decision = decideQuantityClock({
      incomingUpdatedAt: qty.shopifyUpdatedAt,
      storedUpdatedAt: stored?.updatedAt ?? null,
      incomingInterval: interval,
      storedInterval,
      storedValue: stored?.value ?? null,
      incomingValue: qty.quantity,
    });
    if (decision.apply) {
      await updateQuantity(
        db,
        observation.identity.shopId,
        fact.id,
        spec,
        qty.quantity,
        qty.shopifyUpdatedAt,
        interval,
      );
      applied = true;
    } else if (decision.diagnostic || decision.freshness) {
      await persistClockNoop(db, observation.identity, fact, decision);
    }
  }
  return applied;
}

async function applyOneObservation(
  db: CanonicalApplyDb,
  observation: CanonicalObservation,
): Promise<{
  result: CanonicalApplyObservationResult;
  abandoned: string[];
}> {
  validateObservation(observation);
  const identity = observation.identity;
  const directInterval: GenerationInterval | null =
    observation.observationKind === "direct"
      ? directObservationInterval(observation)
      : null;
  const fence =
    observation.observationKind === "full_sync"
      ? fullSyncFenceGeneration(observation)
      : null;
  const attributeFallbackInterval: GenerationInterval =
    observation.observationKind === "direct"
      ? directObservationInterval(observation)
      : nullableFallbackIntervalFromFullSyncMarker(
          fullSyncAttributeMarker(observation),
        );
  const token =
    observation.observationKind === "direct"
      ? observation.observationToken
      : null;
  const abandoned: string[] = [];

  // Frozen order: tenant/RLS (caller) → advisory (batch) → canonical row →
  // observation rows → blocker/lease/clock decisions → fact writes.
  let fact = await lockAndReadFact(db, identity);

  await lockObservationRows(db, identity.shopId, identity);

  if (observation.observationKind === "direct") {
    try {
      await fenceDirectObservation(
        db,
        identity.shopId,
        token as string,
        identity,
        observation.observationRequestGen,
      );
    } catch (error) {
      if (error instanceof CanonicalApplyLeaseInvalidError) {
        await abandonOwnExpiredObservation(
          db,
          identity.shopId,
          token as string,
          observation.observationRequestGen,
          observation.observationResponseGen,
        );
        return {
          abandoned,
          result: {
            identity,
            outcome: "lease_invalid",
            existenceMutated: false,
            attributesApplied: false,
            presenceUpdated: false,
            diagnosticState: null,
            factId: null,
          },
        };
      }
      throw error;
    }
  }

  await lockObservationRows(db, identity.shopId, identity);

  let existenceMutated = false;
  let factId: string | null = null;
  let diagnostic: string | null = null;
  let presenceUpdated = false;
  let attributesApplied = false;
  let existenceBlocked = false;
  let existenceDecision: ReturnType<typeof decideExistence> = {
    mutate: false,
    reason: "uninitialized",
    diagnostic: null,
  };

  const expiredBlockers =
    observation.observationKind === "direct" && directInterval
      ? await loadExpiredActiveResultlessBlockers(
          db,
          identity.shopId,
          identity,
          {
            currentToken: token,
            maxRequestGen: directInterval.requestGen,
          },
        )
      : await loadExpiredActiveResultlessBlockers(
          db,
          identity.shopId,
          identity,
          {},
        );
  const blockers =
    observation.observationKind === "direct" && directInterval
      ? await loadActiveUnexpiredBlockers(
          db,
          identity.shopId,
          identity,
          token,
          directInterval,
        )
      : await loadActiveUnexpiredBlockersForFullSync(
          db,
          identity.shopId,
          identity,
        );
  const overlappingCompleted =
    observation.observationKind === "direct" && directInterval
      ? await loadCompletedOverlappingIntervals(
          db,
          identity.shopId,
          identity,
          token,
          directInterval,
        )
      : [];
  const completedDirectNotSafelyEarlierThanFence =
    observation.observationKind === "full_sync" && fence
      ? await loadCompletedDirectsNotSafelyEarlierThanFence(
          db,
          identity.shopId,
          identity,
          fence.fenceGeneration,
        )
      : [];

  const storedExistence = fact
    ? {
        existenceState: fact.existenceState,
        existenceKind: fact.existenceKind,
        existenceRequestGen: fact.existenceRequestGen,
        existenceResponseGen: fact.existenceResponseGen,
        shopifyCreatedAt: fact.shopifyCreatedAt,
        existenceDiagnosticState: fact.existenceDiagnosticState,
      }
    : null;

  const decideWithBlock = (blocked: boolean) =>
    decideExistence({
      identity,
      stored: storedExistence,
      incomingKind: observation.existenceKind,
      incomingInterval: directInterval,
      incomingShopifyCreatedAt: observation.shopifyCreatedAt ?? null,
      existenceBlocked: blocked,
      overlappingCompleted,
      fenceGeneration: fence?.fenceGeneration ?? null,
      completedDirectNotSafelyEarlierThanFence:
        observation.observationKind === "full_sync"
          ? completedDirectNotSafelyEarlierThanFence
          : undefined,
    });

  const decisionHonoringExpiry = decideWithBlock(blockers.length > 0);
  const decisionIfExpiredStillBlocking = decideWithBlock(
    blockers.length > 0 || expiredBlockers.length > 0,
  );
  const reliesOnExpiry =
    decisionHonoringExpiry.mutate &&
    !decisionIfExpiredStillBlocking.mutate &&
    expiredBlockers.length > 0;

  if (reliesOnExpiry) {
    abandoned.push(
      ...(await abandonExpiredResultlessRows(
        db,
        identity.shopId,
        expiredBlockers,
      )),
    );
    const blockersAfter =
      observation.observationKind === "direct" && directInterval
        ? await loadActiveUnexpiredBlockers(
            db,
            identity.shopId,
            identity,
            token,
            directInterval,
          )
        : await loadActiveUnexpiredBlockersForFullSync(
            db,
            identity.shopId,
            identity,
          );
    existenceBlocked = blockersAfter.length > 0;
    existenceDecision = decideWithBlock(existenceBlocked);
  } else {
    existenceBlocked = blockers.length > 0;
    existenceDecision = decisionHonoringExpiry;
  }

  existenceMutated = false;
  factId = fact?.id ?? null;
  diagnostic = existenceDecision.diagnostic;

  if (existenceDecision.mutate) {
    const write: ExistenceWrite = {
      state: existenceDecision.nextState,
      kind: existenceDecision.nextKind,
      interval:
        observation.existenceKind === "LIVE_FULL_SYNC_PRESENT"
          ? null
          : directInterval,
      observedAt: observation.existenceObservedAt,
      diagnostic,
      deletionSource: existenceDecision.deletionSource,
      shopifyCreatedAt: observation.shopifyCreatedAt ?? null,
    };
    if (!fact) {
      if (existenceDecision.nextState === "LIVE") {
        const firstLive = validateFirstLiveAttributes(observation);
        if (!firstLive.ok) {
          return rejectUsableObservation(db, observation, abandoned, firstLive);
        }
        const firstLiveQty = validateObservationQuantityColumns(observation);
        if (!firstLiveQty.ok) {
          return rejectUsableObservation(
            db,
            observation,
            abandoned,
            firstLiveQty,
          );
        }
      }
      const freshness =
        observation.shopifyUpdatedAt == null ? "DEGRADED" : "ORDERED";
      const presence =
        observation.observationKind === "full_sync"
          ? observation.epochId
          : null;
      try {
        factId = await insertFact(
          db,
          observation,
          write,
          attributeFallbackInterval,
          freshness,
          presence,
        );
      } catch (error) {
        if (error instanceof CanonicalApplyIncompleteFirstLiveError) {
          return rejectUsableObservation(db, observation, abandoned, {
            error,
            diagnostic: DIAGNOSTIC.INCOMPLETE_FIRST_LIVE,
          });
        }
        if (
          error instanceof CanonicalApplyIncompleteAuthoritativeAttributesError
        ) {
          return rejectUsableObservation(db, observation, abandoned, {
            error,
            diagnostic: DIAGNOSTIC.INCOMPLETE_AUTHORITATIVE,
          });
        }
        if (error instanceof CanonicalApplyNumericScaleError) {
          return rejectUsableObservation(db, observation, abandoned, {
            error,
            diagnostic: DIAGNOSTIC.NUMERIC_SCALE,
          });
        }
        if (error instanceof CanonicalApplyMoneyError) {
          return rejectUsableObservation(db, observation, abandoned, {
            error,
            diagnostic: DIAGNOSTIC.NUMERIC_SCALE,
          });
        }
        if (error instanceof CanonicalApplyQuantityDomainError) {
          return rejectUsableObservation(db, observation, abandoned, {
            error,
            diagnostic: DIAGNOSTIC.QUANTITY_DOMAIN,
          });
        }
        throw error;
      }
      fact = await lockAndReadFact(db, identity);
      existenceMutated = true;
    } else {
      await updateExistence(db, identity, fact.id, write);
      existenceMutated = true;
      fact = await lockAndReadFact(db, identity);
    }
  } else if (fact && diagnostic) {
    await updateDiagnostic(db, identity, fact.id, diagnostic);
  }

  attributesApplied = false;
  const incomingLive =
    observation.existenceKind === "LIVE_REFETCH" ||
    observation.existenceKind === "LIVE_FULL_SYNC_PRESENT";
  const allowAttributes =
    fact != null &&
    !existenceBlocked &&
    fact.existenceState === "LIVE" &&
    incomingLive;
  if (allowAttributes && fact) {
    const existingShape = validateExistingAuthoritativeAttributes(observation);
    if (!existingShape.ok) {
      return rejectUsableObservation(
        db,
        observation,
        abandoned,
        existingShape,
        {
          factId: fact.id,
          existenceMutated,
          fact,
        },
      );
    }
    const numericCheck = validateObservationNumericColumns(observation);
    if (!numericCheck.ok) {
      return rejectUsableObservation(db, observation, abandoned, numericCheck, {
        factId: fact.id,
        existenceMutated,
        fact,
      });
    }
    const quantityCheck = validateObservationQuantityColumns(observation);
    if (!quantityCheck.ok) {
      return rejectUsableObservation(
        db,
        observation,
        abandoned,
        quantityCheck,
        {
          factId: fact.id,
          existenceMutated,
          fact,
        },
      );
    }
  }

  presenceUpdated = false;
  if (observation.observationKind === "full_sync" && fact) {
    await updatePresenceMarker(db, identity, fact.id, observation.epochId);
    presenceUpdated = true;
    fact = (await lockAndReadFact(db, identity)) ?? fact;
  }

  if (allowAttributes && fact) {
    const attrResult = await applyAttributes(
      db,
      observation,
      fact,
      attributeFallbackInterval,
    );
    attributesApplied = attrResult.applied;
    if (attrResult.diagnostic) {
      diagnostic = preserveRevivalDiagnostic(
        fact.existenceDiagnosticState,
        attrResult.diagnostic,
      );
    }
    fact = (await lockAndReadFact(db, identity)) ?? fact;
    const qtyApplied = await applyQuantities(
      db,
      observation,
      fact,
      attributeFallbackInterval,
    );
    attributesApplied = attributesApplied || qtyApplied;
  }

  if (
    factId &&
    (existenceMutated ||
      attributesApplied ||
      presenceUpdated ||
      diagnostic != null)
  ) {
    await markCompatibilityProjectionPending(db, identity, factId);
  }

  if (observation.observationKind === "direct") {
    await completeObservation(
      db,
      identity.shopId,
      observation.observationToken,
      observation.observationRequestGen,
      observation.observationResponseGen,
    );
  }

  let outcome: CanonicalApplyObservationResult["outcome"] = "applied";
  if (
    existenceBlocked &&
    !existenceMutated &&
    !attributesApplied &&
    !presenceUpdated
  ) {
    outcome = "blocked";
  } else if (
    existenceDecision.reason.includes("conflict") ||
    diagnostic?.includes("CONFLICT")
  ) {
    outcome = "conflict";
  } else if (!existenceMutated && !attributesApplied && !presenceUpdated) {
    outcome = "noop";
  }

  return {
    abandoned,
    result: {
      identity,
      outcome,
      existenceMutated,
      attributesApplied,
      presenceUpdated,
      diagnosticState: diagnostic,
      factId,
    },
  };
}

/**
 * Apply already-authoritative canonical observations inside an open tenant
 * transaction. The caller owns COMMIT/ROLLBACK. No network I/O is performed.
 */
export async function applyCanonicalFacts(
  db: CanonicalApplyDb,
  input: CanonicalApplyBatchInput,
): Promise<CanonicalApplyBatchResult> {
  if (!input.shopId) {
    throw new CanonicalApplyError(
      "canonical_apply_shop_required",
      "shopId is required",
    );
  }
  for (const observation of input.observations) {
    if (observation.identity.shopId !== input.shopId) {
      throw new CanonicalApplyError(
        "canonical_apply_shop_mismatch",
        "Observation shopId does not match batch shopId",
      );
    }
    validateObservation(observation);
  }

  await requireTenant(db, input.shopId);

  if (input.observations.length === 0) {
    return {
      results: [],
      identitiesLocked: 0,
      abandonedBlockerTokens: [],
    };
  }

  const identities: CanonicalLockIdentity[] = [];
  const seen = new Set<string>();
  for (const observation of input.observations) {
    const key = identityKey(observation.identity);
    if (seen.has(key)) continue;
    seen.add(key);
    identities.push(observationLockIdentity(observation));
  }

  const settings = await readCapacitySettings(db);
  const evaluation = evaluateCanonicalLockCapacity(settings, {
    requestedCanonicalIdentitiesPerTransaction:
      input.requestedCanonicalIdentitiesPerTransaction ?? identities.length,
    configuredWorstCaseConcurrentCanonicalTransactions:
      input.configuredWorstCaseConcurrentCanonicalTransactions,
  });
  if (
    identities.length > evaluation.effectiveCanonicalIdentitiesPerTransaction
  ) {
    throw new CanonicalApplyBatchExceedsCapacityError(
      identities.length,
      evaluation.effectiveCanonicalIdentitiesPerTransaction,
    );
  }

  await acquireOrderedLocks(db, identities);

  const byIdentity = new Map<string, CanonicalObservation[]>();
  for (const observation of input.observations) {
    const key = identityKey(observation.identity);
    const list = byIdentity.get(key) ?? [];
    list.push(observation);
    byIdentity.set(key, list);
  }

  const orderedIdentities = identities
    .map((identity) => ({
      identity,
      key: deriveCanonicalLockKey(identity),
    }))
    .sort((a, b) => {
      if (a.key.key1 !== b.key.key1) return a.key.key1 < b.key.key1 ? -1 : 1;
      if (a.key.key2 !== b.key.key2) return a.key.key2 < b.key.key2 ? -1 : 1;
      return 0;
    });

  const results: CanonicalApplyObservationResult[] = [];
  const abandonedBlockerTokens: string[] = [];

  for (const item of orderedIdentities) {
    const key =
      item.identity.resourceKind === "InventoryLevel"
        ? `${item.identity.shopId}|InventoryLevel|${item.identity.inventoryItemGid}|${item.identity.locationGid}`
        : `${item.identity.shopId}|${item.identity.resourceKind}|${item.identity.shopifyGid}`;
    const observations = (byIdentity.get(key) ?? [])
      .slice()
      .sort(compareObservations);
    for (const observation of observations) {
      const applied = await applyOneObservation(db, observation);
      results.push(applied.result);
      abandonedBlockerTokens.push(...applied.abandoned);
    }
  }

  return {
    results,
    identitiesLocked: identities.length,
    abandonedBlockerTokens,
  };
}

/**
 * Retry unique-conflict / advisory-lock-timeout by rolling the caller
 * transaction back and invoking `begin` again. `begin` MUST start a fresh
 * PostgreSQL transaction. Do not retry inside an aborted transaction
 * (SQLSTATE 25P02). No ON CONFLICT DO UPDATE. No savepoint recovery.
 */
export async function applyCanonicalFactsWithRetry(
  begin: (
    fn: (db: CanonicalApplyDb) => Promise<CanonicalApplyBatchResult>,
  ) => Promise<CanonicalApplyBatchResult>,
  input: CanonicalApplyBatchInput,
  options?: { maxAttempts?: number },
): Promise<CanonicalApplyBatchResult> {
  const maxAttempts = options?.maxAttempts ?? 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await begin((db) => applyCanonicalFacts(db, input));
    } catch (error) {
      lastError = error;
      const code = (error as { code?: string }).code;
      if (
        (code === "canonical_advisory_lock_timeout" ||
          code === "canonical_apply_unique_conflict") &&
        attempt < maxAttempts
      ) {
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
