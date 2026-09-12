/**
 * PR6-C canonical order/refund applicator.
 *
 * Receives already-authoritative observations. Performs no Shopify network I/O.
 * Every writer acquires the frozen pg_advisory_xact_lock identity anchor first.
 * Lock identities are Order + nested Refund GIDs only — never every line.
 */
import {
  acquireOrderIdentityAdvisoryLock,
  evaluateCanonicalLockCapacity,
} from "../advisory-lock";
import type { LockCapacitySettings } from "../../catalog-facts/lock-capacity";
import {
  deriveOrderLockKey,
  orderOrderLockKeysForAcquisition,
  type OrderGidLockIdentity,
} from "../lock-key";
import { decideClockA, isWithinHistoryWindow, type GenerationInterval } from "./clocks";
import {
  ORDER_APPLY_PHYSICAL_DELETE_OPERATIONS,
  ORDER_HISTORY_WINDOW_DAYS,
} from "./constants";
import {
  OrderApplyBatchExceedsCapacityError,
  OrderApplyClientShopDeniedError,
  OrderApplyCurrencyMismatchError,
  OrderApplyError,
  OrderApplyExistenceKindError,
  OrderApplyLeaseInvalidError,
  OrderApplyMoneyError,
  OrderApplyNumericScaleError,
  OrderApplyPhysicalDeleteError,
  OrderApplyReceiptNotCertifiableError,
} from "./errors";
import {
  decideOrderExistence,
  existenceWriteConfirmsLive,
  lastValidLiveScopeFloor,
  mergeAccessScopeFloor,
  scopesGrantReadAllOrders,
  type ExistenceDecision,
  type StoredOrderExistence,
} from "./existence";
import {
  abandonExpiredResultlessRows,
  abandonOwnExpiredObservation,
  completeObservation,
  fenceDirectObservation,
  loadActiveUnexpiredBlockers,
  loadActiveUnexpiredBlockersForFullSync,
  loadCompletedOverlappingIntervals,
  loadExpiredActiveResultlessBlockers,
  lockObservationRows,
  persistIncompleteObservation,
} from "./fencing";
import {
  directObservationInterval,
  fullSyncFenceGeneration,
  isSnapshotStructurallyComplete,
} from "./observation-evidence";
import {
  parseCompleteOrderSnapshot,
  parseRefundMoney,
  refundShopCurrency,
} from "./parse";
import {
  acquireReceiptApplicationKeyLock,
  insertReceiptFinal,
  shortCircuitIfApplied,
} from "./receipts";
import { batchCertifiesReceiptSuccess } from "./receipt-certification";
import { queryRows, type OrderApplyDb } from "./sql";
import {
  DIAGNOSTIC,
  identityKey,
  type OrderApplyBatchInput,
  type OrderApplyBatchResult,
  type OrderApplyObservationResult,
  type OrderObservation,
} from "./types";
import { evaluateUnits } from "./units";
import {
  applyLineUnitDiagnostics,
  applyOrderUnitDiagnostics,
  insertOrderFact,
  lockAndReadOrderFact,
  lockAndReadRefundFact,
  markOmittedOrderChildrenAbsent,
  nominateAbsenceCandidate,
  refreshLineDenormalized,
  requireProcessingEnabled,
  updateOrderAttributes,
  updateOrderDiagnosticsOnly,
  updateOrderExistence,
  updateRefundDiagnosticsOnly,
  updateRefundExistence,
  upsertAgreementAndSales,
  upsertOrderLine,
  upsertRefundSnapshot,
  type ExistenceWriteInput,
  type OrderFactRow,
} from "./writers";

export type { OrderApplyDb };

export { ORDER_APPLY_PHYSICAL_DELETE_OPERATIONS };
export { observationCertifiesReceiptSuccess } from "./receipt-certification";

export function denyOrderFactPhysicalDelete(): never {
  throw new OrderApplyPhysicalDeleteError();
}

function compareObservations(a: OrderObservation, b: OrderObservation): number {
  const aGen =
    a.observationKind === "full_sync"
      ? a.fenceGeneration
      : a.observationRequestGen;
  const bGen =
    b.observationKind === "full_sync"
      ? b.fenceGeneration
      : b.observationRequestGen;
  if (aGen !== bGen) return aGen < bGen ? -1 : 1;
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

function validateObservation(observation: OrderObservation): void {
  if (!observation.identity.shopId) {
    throw new OrderApplyError(
      "order_apply_identity_invalid",
      "shopId is required",
    );
  }
  const kind = observation.existenceKind;
  if (
    kind !== "LIVE_REFETCH" &&
    kind !== "LIVE_FULL_SYNC_PRESENT" &&
    kind !== "ABSENT_CONFIRMED_QUERY" &&
    kind !== "INACCESSIBLE_HISTORY_WINDOW" &&
    kind !== "ABSENT_SIGNALLED_DELETE_UNVERIFIED"
  ) {
    throw new OrderApplyExistenceKindError(String(kind));
  }
  if (observation.observationKind === "direct") {
    if (!observation.observationToken) {
      throw new OrderApplyError(
        "order_apply_missing_token",
        "direct observation token is required",
      );
    }
    if (
      observation.observationRequestGen >= observation.observationResponseGen
    ) {
      throw new OrderApplyError(
        "order_apply_interval_invalid",
        "direct observationRequestGen must be < observationResponseGen",
      );
    }
  }
}

async function requireTenant(db: OrderApplyDb, shopId: string): Promise<void> {
  const rows = await queryRows<{ shop_id: string | null }>(
    db,
  )`SELECT NULLIF(current_setting('stocky.current_shop_id', true), '') AS shop_id`;
  const current = rows[0]?.shop_id ?? null;
  if (!current || current !== shopId) {
    throw new OrderApplyError(
      "order_apply_tenant_mismatch",
      "Order apply requires a matching tenant transaction",
    );
  }
}

async function readCapacitySettings(
  db: OrderApplyDb,
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
    throw new OrderApplyError(
      "order_apply_capacity_settings_missing",
      "PostgreSQL lock capacity settings were not returned",
    );
  }
  const asSafeInt = (raw: string, name: string): number => {
    if (typeof raw !== "string" || !/^-?\d+$/.test(raw.trim())) {
      throw new OrderApplyError(
        "order_apply_capacity_settings_invalid",
        `${name} is not a numeric integer`,
      );
    }
    const value = Number(raw.trim());
    if (!Number.isSafeInteger(value)) {
      throw new OrderApplyError(
        "order_apply_capacity_settings_unsafe",
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

function collectLockIdentities(
  shopId: string,
  observations: readonly OrderObservation[],
): OrderGidLockIdentity[] {
  const seen = new Set<string>();
  const identities: OrderGidLockIdentity[] = [];
  const add = (identity: OrderGidLockIdentity) => {
    const key = `${identity.resourceKind}|${identity.shopifyGid}`;
    if (seen.has(key)) return;
    seen.add(key);
    identities.push(identity);
  };
  for (const observation of observations) {
    add({
      shopId,
      resourceKind: observation.identity.resourceKind,
      shopifyGid: observation.identity.shopifyGid,
    });
    const refunds: Array<{ shopifyGid: string; shopifyOrderGid: string }> = [];
    if (observation.refund) refunds.push(observation.refund);
    if (observation.nestedRefunds) refunds.push(...observation.nestedRefunds);
    for (const refund of refunds) {
      add({
        shopId,
        resourceKind: "Order",
        shopifyGid: refund.shopifyOrderGid,
      });
      add({
        shopId,
        resourceKind: "Refund",
        shopifyGid: refund.shopifyGid,
      });
    }
    if (observation.order) {
      add({
        shopId,
        resourceKind: "Order",
        shopifyGid: observation.order.shopifyGid,
      });
    }
  }
  return identities;
}

async function acquireOrderedLocks(
  db: OrderApplyDb,
  identities: OrderGidLockIdentity[],
): Promise<void> {
  const keys = identities.map((identity) => ({
    identity,
    key: deriveOrderLockKey(identity),
  }));
  const ordered = orderOrderLockKeysForAcquisition(keys.map((item) => item.key));
  const seen = new Set<string>();
  for (const key of ordered) {
    const match = keys.find(
      (item) => item.key.key1 === key.key1 && item.key.key2 === key.key2,
    );
    if (!match) continue;
    const id = `${key.key1}:${key.key2}`;
    if (seen.has(id)) continue;
    seen.add(id);
    await acquireOrderIdentityAdvisoryLock(db, match.identity);
  }
}

function parentVersionedChildWrite(
  observation: OrderObservation,
  interval: GenerationInterval | null,
  accessScopeSnapshot: readonly string[],
): ExistenceWriteInput {
  const nextKind =
    observation.observationKind === "full_sync"
      ? "LIVE_FULL_SYNC_PRESENT"
      : "LIVE_REFETCH";
  return {
    decision: {
      mutate: true,
      nextState: "LIVE",
      nextKind,
      reason: "parent_versioned_child",
      diagnostic: null,
      deletionSource: null,
      deletedAtNow: false,
    },
    interval: nextKind === "LIVE_FULL_SYNC_PRESENT" ? null : interval,
    observedAt: observation.existenceObservedAt,
    sourceKind: observation.sourceKind,
    accessScopeSnapshot,
  };
}

function toStoredExistence(row: OrderFactRow | null): StoredOrderExistence | null {
  if (!row) return null;
  return {
    existenceState: row.existenceState,
    existenceKind: row.existenceKind,
    existenceRequestGen: row.existenceRequestGen,
    existenceResponseGen: row.existenceResponseGen,
    shopifyCreatedAt: row.shopifyCreatedAt,
    processedAt: row.processedAt,
    deletedAt: row.deletedAt,
    deletionSource: row.deletionSource,
    existenceDiagnosticState: row.existenceDiagnosticState,
    historyWindowState: row.historyWindowState,
    accessScopeSnapshot: row.accessScopeSnapshot,
  };
}

function accessScopesForFactWrite(
  decision: Extract<ExistenceDecision, { mutate: true }>,
  currentScopes: readonly string[],
  persisted: readonly string[] | null | undefined,
): string[] {
  if (existenceWriteConfirmsLive(decision)) {
    return mergeAccessScopeFloor(currentScopes, persisted);
  }
  return [...(persisted ?? [])];
}

async function applyOrderChildren(
  db: OrderApplyDb,
  shopId: string,
  observation: OrderObservation,
  order: NonNullable<OrderObservation["order"]>,
  interval: GenerationInterval | null,
  accessScopeSnapshot: readonly string[],
): Promise<void> {
  const write = parentVersionedChildWrite(observation, interval, accessScopeSnapshot);
  for (const line of order.lines) {
    await upsertOrderLine(
      db,
      shopId,
      order,
      line,
      write,
      observation.sourceKind,
    );
  }
  await refreshLineDenormalized(db, shopId, order.shopifyGid, order);
  for (const agreement of order.agreements) {
    await upsertAgreementAndSales(
      db,
      shopId,
      order,
      agreement,
      write,
      observation.sourceKind,
    );
  }
  await markOmittedOrderChildrenAbsent(db, shopId, order, write);
  const units = evaluateUnits({
    lines: order.lines,
    agreements: order.agreements,
  });
  const orderRow = await lockAndReadOrderFact(db, shopId, order.shopifyGid);
  if (orderRow) {
    await applyOrderUnitDiagnostics(db, shopId, orderRow.id, units.diagnostic);
  }
  for (const line of units.lines) {
    const lineDiag = line.signInconsistent
      ? DIAGNOSTIC.SALE_SIGN
      : line.identityInconsistent
        ? DIAGNOSTIC.LINE_UNIT
        : null;
    await applyLineUnitDiagnostics(db, shopId, line.shopifyLineItemGid, lineDiag);
  }
}

async function applyRefundSnapshotIfClockAllows(
  db: OrderApplyDb,
  shopId: string,
  observation: OrderObservation,
  refund: NonNullable<OrderObservation["refund"]>,
  interval: GenerationInterval | null,
  accessScopeSnapshot: readonly string[],
  existenceWrite: ExistenceWriteInput | null,
): Promise<{ applied: boolean; diagnostic: string | null; factId: string | null }> {
  const stored = await lockAndReadRefundFact(db, shopId, refund.shopifyGid);
  if (stored?.existenceState === "ABSENT") {
    return { applied: false, diagnostic: null, factId: stored.id };
  }
  const clock = decideClockA({
    incomingUpdatedAt: refund.shopifyUpdatedAt,
    storedUpdatedAt: stored?.shopifyUpdatedAt ?? null,
  });
  if (!clock.applyParent && !clock.applyChildren && stored) {
    return { applied: false, diagnostic: null, factId: stored.id };
  }
  const localOrder = await lockAndReadOrderFact(
    db,
    shopId,
    refund.shopifyOrderGid,
  );
  const write =
    existenceWrite ??
    parentVersionedChildWrite(observation, interval, accessScopeSnapshot);
  const result = await upsertRefundSnapshot(
    db,
    shopId,
    refund,
    write,
    observation.sourceKind,
    localOrder?.shopCurrencyCode ?? null,
  );
  return {
    applied: true,
    diagnostic: result.moneyDiagnosticState,
    factId: result.id,
  };
}

async function applyEmbeddedRefund(
  db: OrderApplyDb,
  shopId: string,
  observation: OrderObservation,
  refund: NonNullable<OrderObservation["refund"]>,
  interval: GenerationInterval | null,
  fenceGeneration: bigint | null,
  accessScopeSnapshot: readonly string[],
): Promise<{
  applied: boolean;
  existenceMutated: boolean;
  diagnostic: string | null;
  factId: string | null;
  blocked: boolean;
}> {
  const refundIdentity = {
    shopId,
    resourceKind: "Refund" as const,
    shopifyGid: refund.shopifyGid,
  };
  await lockObservationRows(db, shopId, refundIdentity);
  let stored = await lockAndReadRefundFact(db, shopId, refund.shopifyGid);
  const incomingKind =
    observation.observationKind === "full_sync"
      ? "LIVE_FULL_SYNC_PRESENT"
      : "LIVE_REFETCH";
  const expiredBlockers =
    observation.observationKind === "direct" && interval
      ? await loadExpiredActiveResultlessBlockers(db, shopId, refundIdentity, {
          maxRequestGen: interval.requestGen,
        })
      : await loadExpiredActiveResultlessBlockers(db, shopId, refundIdentity, {});
  const blockers =
    observation.observationKind === "direct" && interval
      ? await loadActiveUnexpiredBlockers(
          db,
          shopId,
          refundIdentity,
          null,
          interval,
        )
      : await loadActiveUnexpiredBlockersForFullSync(db, shopId, refundIdentity);
  const overlappingCompleted =
    observation.observationKind === "direct" && interval
      ? await loadCompletedOverlappingIntervals(
          db,
          shopId,
          refundIdentity,
          null,
          interval,
        )
      : [];

  const decideWithBlock = (blocked: boolean) =>
    decideOrderExistence({
      stored: toStoredExistence(stored),
      incomingKind,
      incomingInterval: interval,
      incomingShopifyCreatedAt: refund.shopifyCreatedAt,
      incomingProcessedAt: refund.processedAt,
      existenceObservedAt: observation.existenceObservedAt,
      existenceBlocked: blocked,
      overlappingCompleted,
      fenceGeneration,
      queryCompleted: true,
      queryReturnedNull: false,
      currentScopes: accessScopeSnapshot,
      lastConfirmedScopes: lastValidLiveScopeFloor(
        stored?.accessScopeSnapshot,
        null,
      ),
    });

  const decisionHonoringExpiry = decideWithBlock(blockers.length > 0);
  const decisionIfExpiredStillBlocking = decideWithBlock(
    blockers.length > 0 || expiredBlockers.length > 0,
  );
  const reliesOnExpiry =
    decisionHonoringExpiry.mutate &&
    !decisionIfExpiredStillBlocking.mutate &&
    expiredBlockers.length > 0;

  let existenceDecision: ExistenceDecision;
  let existenceBlocked: boolean;
  if (reliesOnExpiry) {
    await abandonExpiredResultlessRows(db, shopId, expiredBlockers);
    const blockersAfter =
      observation.observationKind === "direct" && interval
        ? await loadActiveUnexpiredBlockers(
            db,
            shopId,
            refundIdentity,
            null,
            interval,
          )
        : await loadActiveUnexpiredBlockersForFullSync(db, shopId, refundIdentity);
    existenceBlocked = blockersAfter.length > 0;
    existenceDecision = decideWithBlock(existenceBlocked);
  } else {
    existenceBlocked = blockers.length > 0;
    existenceDecision = decisionHonoringExpiry;
  }

  let existenceMutated = false;
  const diagnostic = existenceDecision.diagnostic ?? null;
  let factId = stored?.id ?? null;

  const writeFromRefundDecision = (
    decision: Extract<ExistenceDecision, { mutate: true }>,
  ): ExistenceWriteInput => ({
    decision,
    interval,
    observedAt: observation.existenceObservedAt,
    sourceKind: observation.sourceKind,
    accessScopeSnapshot: accessScopesForFactWrite(
      decision,
      accessScopeSnapshot,
      stored?.accessScopeSnapshot,
    ),
  });

  if (existenceDecision.mutate) {
    const write = writeFromRefundDecision(existenceDecision);
    if (stored) {
      await updateRefundExistence(db, shopId, stored.id, write);
      existenceMutated = true;
      stored = await lockAndReadRefundFact(db, shopId, refund.shopifyGid);
      factId = stored?.id ?? factId;
    }
  } else if (
    stored &&
    (existenceDecision.diagnostic || existenceDecision.historyWindowState)
  ) {
    await updateRefundDiagnosticsOnly(
      db,
      shopId,
      stored.id,
      existenceDecision.diagnostic,
      existenceDecision.historyWindowState ?? null,
    );
  }

  const resultingLive = existenceDecision.mutate
    ? existenceDecision.nextState === "LIVE"
    : stored?.existenceState === "LIVE";
  if (existenceBlocked || !resultingLive) {
    return {
      applied: false,
      existenceMutated,
      diagnostic,
      factId,
      blocked: existenceBlocked,
    };
  }

  const snapshotWrite =
    existenceDecision.mutate && existenceDecision.nextState === "LIVE"
      ? writeFromRefundDecision(existenceDecision)
      : null;
  const snapshot = await applyRefundSnapshotIfClockAllows(
    db,
    shopId,
    observation,
    refund,
    interval,
    accessScopeSnapshot,
    snapshotWrite,
  );
  return {
    applied: snapshot.applied || existenceMutated,
    existenceMutated,
    diagnostic: snapshot.diagnostic ?? diagnostic,
    factId: snapshot.factId ?? factId,
    blocked: false,
  };
}

async function applyOneObservation(
  db: OrderApplyDb,
  observation: OrderObservation,
): Promise<{
  result: OrderApplyObservationResult;
  abandoned: string[];
}> {
  validateObservation(observation);
  const identity = observation.identity;
  const shopId = identity.shopId;
  const directInterval: GenerationInterval | null =
    observation.observationKind === "direct"
      ? directObservationInterval(observation)
      : null;
  const fence =
    observation.observationKind === "full_sync"
      ? fullSyncFenceGeneration(observation)
      : null;
  const token =
    observation.observationKind === "direct"
      ? observation.observationToken
      : null;
  const abandoned: string[] = [];
  let currentScopes = [...observation.accessScopeSnapshot];

  if (identity.resourceKind === "Order") {
    await lockAndReadOrderFact(db, shopId, identity.shopifyGid);
  } else {
    await lockAndReadRefundFact(db, shopId, identity.shopifyGid);
  }
  await lockObservationRows(db, shopId, identity);

  if (observation.observationKind === "direct") {
    try {
      const fenced = await fenceDirectObservation(
        db,
        shopId,
        token as string,
        identity,
        observation.observationRequestGen,
        observation.accessScopeSnapshot,
      );
      currentScopes = fenced.accessScopeSnapshot;
    } catch (error) {
      if (error instanceof OrderApplyLeaseInvalidError) {
        await abandonOwnExpiredObservation(
          db,
          shopId,
          token as string,
          observation.observationRequestGen,
          observation.observationResponseGen,
        );
        return {
          abandoned,
          result: {
            identity,
            outcome: "lease_invalid",
            reason: "lease_invalid",
            existenceMutated: false,
            attributesApplied: false,
            childrenApplied: false,
            diagnosticState: null,
            factId: null,
          },
        };
      }
      throw error;
    }
  }

  if (!isSnapshotStructurallyComplete(observation)) {
    if (observation.observationKind === "direct") {
      await persistIncompleteObservation(
        db,
        shopId,
        token as string,
        observation.observationRequestGen,
        observation.observationResponseGen,
      );
    }
    return {
      abandoned,
      result: {
        identity,
        outcome: "incomplete",
        reason: "incomplete",
        existenceMutated: false,
        attributesApplied: false,
        childrenApplied: false,
        diagnosticState: DIAGNOSTIC.SNAPSHOT_INCOMPLETE,
        factId: null,
      },
    };
  }

  const stored: OrderFactRow | null =
    identity.resourceKind === "Order"
      ? await lockAndReadOrderFact(db, shopId, identity.shopifyGid)
      : await lockAndReadRefundFact(db, shopId, identity.shopifyGid);

  const expiredBlockers =
    observation.observationKind === "direct" && directInterval
      ? await loadExpiredActiveResultlessBlockers(db, shopId, identity, {
          currentToken: token,
          maxRequestGen: directInterval.requestGen,
        })
      : await loadExpiredActiveResultlessBlockers(db, shopId, identity, {});
  const blockers =
    observation.observationKind === "direct" && directInterval
      ? await loadActiveUnexpiredBlockers(
          db,
          shopId,
          identity,
          token,
          directInterval,
        )
      : await loadActiveUnexpiredBlockersForFullSync(db, shopId, identity);
  const overlappingCompleted =
    observation.observationKind === "direct" && directInterval
      ? await loadCompletedOverlappingIntervals(
          db,
          shopId,
          identity,
          token,
          directInterval,
        )
      : [];

  const storedExistence = stored
    ? {
        existenceState: stored.existenceState,
        existenceKind: stored.existenceKind,
        existenceRequestGen: stored.existenceRequestGen,
        existenceResponseGen: stored.existenceResponseGen,
        shopifyCreatedAt: stored.shopifyCreatedAt,
        processedAt: stored.processedAt,
        deletedAt: stored.deletedAt,
        deletionSource: stored.deletionSource,
        existenceDiagnosticState: stored.existenceDiagnosticState,
        historyWindowState: stored.historyWindowState,
        accessScopeSnapshot: stored.accessScopeSnapshot,
      }
    : null;

  const decideWithBlock = (blocked: boolean) =>
    decideOrderExistence({
      stored: storedExistence,
      incomingKind: observation.existenceKind,
      incomingInterval: directInterval,
      incomingShopifyCreatedAt:
        observation.observationKind === "direct"
          ? (observation.shopifyCreatedAt ??
            observation.order?.shopifyCreatedAt ??
            observation.refund?.shopifyCreatedAt ??
            null)
          : (observation.order?.shopifyCreatedAt ??
            observation.refund?.shopifyCreatedAt ??
            null),
      incomingProcessedAt:
        observation.observationKind === "direct"
          ? (observation.processedAt ??
            observation.order?.processedAt ??
            observation.refund?.processedAt ??
            null)
          : (observation.order?.processedAt ??
            observation.refund?.processedAt ??
            null),
      existenceObservedAt: observation.existenceObservedAt,
      existenceBlocked: blocked,
      overlappingCompleted,
      fenceGeneration: fence?.fenceGeneration ?? null,
      queryCompleted:
        observation.observationKind === "direct"
          ? observation.queryCompleted
          : true,
      queryReturnedNull:
        observation.observationKind === "direct"
          ? observation.queryReturnedNull
          : false,
      currentScopes,
      lastConfirmedScopes: lastValidLiveScopeFloor(
        stored?.accessScopeSnapshot,
        observation.observationKind === "direct"
          ? observation.lastConfirmedAccessScopes
          : null,
      ),
    });

  const decisionHonoringExpiry = decideWithBlock(blockers.length > 0);
  const decisionIfExpiredStillBlocking = decideWithBlock(
    blockers.length > 0 || expiredBlockers.length > 0,
  );
  const reliesOnExpiry =
    decisionHonoringExpiry.mutate &&
    !decisionIfExpiredStillBlocking.mutate &&
    expiredBlockers.length > 0;

  let existenceDecision: ExistenceDecision;
  let existenceBlocked: boolean;
  if (reliesOnExpiry) {
    abandoned.push(
      ...(await abandonExpiredResultlessRows(db, shopId, expiredBlockers)),
    );
    const blockersAfter =
      observation.observationKind === "direct" && directInterval
        ? await loadActiveUnexpiredBlockers(
            db,
            shopId,
            identity,
            token,
            directInterval,
          )
        : await loadActiveUnexpiredBlockersForFullSync(db, shopId, identity);
    existenceBlocked = blockersAfter.length > 0;
    existenceDecision = decideWithBlock(existenceBlocked);
  } else {
    existenceBlocked = blockers.length > 0;
    existenceDecision = decisionHonoringExpiry;
  }

  let fact = stored;
  let existenceMutated = false;
  let attributesApplied = false;
  let childrenApplied = false;
  let diagnostic = existenceDecision.diagnostic ?? null;
  let factId = fact?.id ?? null;

  const writeFromDecision = (
    decision: Extract<ExistenceDecision, { mutate: true }>,
  ): ExistenceWriteInput => ({
    decision,
    interval: directInterval,
    observedAt: observation.existenceObservedAt,
    sourceKind: observation.sourceKind,
    accessScopeSnapshot: accessScopesForFactWrite(
      decision,
      currentScopes,
      fact?.accessScopeSnapshot,
    ),
  });

  try {
    if (observation.order) {
      parseCompleteOrderSnapshot(observation.order);
    }
    const refunds = [
      ...(observation.refund ? [observation.refund] : []),
      ...(observation.nestedRefunds ?? []),
    ];
    for (const refund of refunds) {
      parseRefundMoney(
        refund,
        refundShopCurrency(
          refund,
          observation.order?.shopCurrencyCode ?? fact?.shopCurrencyCode ?? null,
        ),
      );
    }

    if (existenceDecision.mutate) {
      const write = writeFromDecision(existenceDecision);
      if (identity.resourceKind === "Order") {
        if (!fact) {
          if (
            existenceDecision.nextState === "LIVE" &&
            observation.order &&
            (observation.existenceKind === "LIVE_REFETCH" ||
              observation.existenceKind === "LIVE_FULL_SYNC_PRESENT")
          ) {
            factId = await insertOrderFact(
              db,
              shopId,
              observation.order,
              write,
              observation.sourceKind,
            );
            fact = await lockAndReadOrderFact(db, shopId, identity.shopifyGid);
            existenceMutated = true;
            attributesApplied = true;
          } else {
            existenceMutated = false;
          }
        } else {
          await updateOrderExistence(db, shopId, fact.id, write);
          existenceMutated = true;
          fact = await lockAndReadOrderFact(db, shopId, identity.shopifyGid);
        }
      } else if (fact) {
        await updateRefundExistence(db, shopId, fact.id, write);
        existenceMutated = true;
        fact = await lockAndReadRefundFact(db, shopId, identity.shopifyGid);
      }
    } else if (
      fact &&
      (existenceDecision.diagnostic || existenceDecision.historyWindowState)
    ) {
      if (identity.resourceKind === "Order") {
        await updateOrderDiagnosticsOnly(
          db,
          shopId,
          fact.id,
          existenceDecision.diagnostic,
          existenceDecision.historyWindowState ?? null,
        );
      } else {
        await updateRefundDiagnosticsOnly(
          db,
          shopId,
          fact.id,
          existenceDecision.diagnostic,
          existenceDecision.historyWindowState ?? null,
        );
      }
    }

    const incomingLive =
      observation.existenceKind === "LIVE_REFETCH" ||
      observation.existenceKind === "LIVE_FULL_SYNC_PRESENT";
    const orderSnapshot = observation.order ?? null;
    const resultingLive = existenceDecision.mutate
      ? existenceDecision.nextState === "LIVE"
      : fact?.existenceState === "LIVE";
    const childScopes = mergeAccessScopeFloor(
      currentScopes,
      fact?.accessScopeSnapshot,
    );
    if (
      identity.resourceKind === "Order" &&
      incomingLive &&
      orderSnapshot &&
      fact &&
      !existenceBlocked &&
      resultingLive
    ) {
      const clock = decideClockA({
        incomingUpdatedAt: orderSnapshot.shopifyUpdatedAt,
        storedUpdatedAt: fact.shopifyUpdatedAt,
      });
      if (clock.applyParent) {
        await updateOrderAttributes(
          db,
          shopId,
          fact.id,
          orderSnapshot,
          directInterval,
          null,
        );
        attributesApplied = true;
      }
      if (clock.applyChildren) {
        await applyOrderChildren(
          db,
          shopId,
          observation,
          orderSnapshot,
          directInterval,
          childScopes,
        );
        childrenApplied = true;
      }
    }

    if (identity.resourceKind === "Order" && !existenceBlocked) {
      for (const refund of refunds) {
        const refundResult = await applyEmbeddedRefund(
          db,
          shopId,
          observation,
          refund,
          directInterval,
          fence?.fenceGeneration ?? null,
          currentScopes,
        );
        if (refundResult.blocked && !refundResult.applied && !refundResult.existenceMutated) {
          continue;
        }
        if (refundResult.applied || refundResult.existenceMutated) {
          childrenApplied = true;
          if (refundResult.existenceMutated) existenceMutated = true;
          if (refundResult.diagnostic) diagnostic = refundResult.diagnostic;
          if (!factId) factId = refundResult.factId;
        }
      }
    } else if (
      identity.resourceKind === "Refund" &&
      observation.refund &&
      !existenceBlocked &&
      resultingLive
    ) {
      const refundWrite =
        existenceDecision.mutate && existenceDecision.nextState === "LIVE"
          ? writeFromDecision(existenceDecision)
          : null;
      const refundResult = await applyRefundSnapshotIfClockAllows(
        db,
        shopId,
        observation,
        observation.refund,
        directInterval,
        currentScopes,
        refundWrite,
      );
      if (refundResult.applied) {
        childrenApplied = true;
        attributesApplied = true;
        if (refundResult.diagnostic) diagnostic = refundResult.diagnostic;
        if (!factId) factId = refundResult.factId;
        if (
          existenceDecision.mutate &&
          existenceDecision.nextState === "LIVE" &&
          !existenceMutated
        ) {
          existenceMutated = true;
          fact = await lockAndReadRefundFact(db, shopId, identity.shopifyGid);
          factId = fact?.id ?? factId;
        }
      }
    }

    if (
      observation.observationKind === "full_sync" &&
      observation.nominateAbsence &&
      identity.resourceKind === "Order" &&
      fact &&
      fact.existenceState === "LIVE" &&
      isWithinHistoryWindow({
        processedAt: fact.processedAt,
        shopifyCreatedAt: fact.shopifyCreatedAt,
        observedAt: observation.existenceObservedAt,
        windowDays: ORDER_HISTORY_WINDOW_DAYS,
        hasReadAllOrders: scopesGrantReadAllOrders(currentScopes),
      })
    ) {
      await nominateAbsenceCandidate(db, shopId, fact.id);
    }
  } catch (error) {
    if (
      error instanceof OrderApplyMoneyError ||
      error instanceof OrderApplyNumericScaleError ||
      error instanceof OrderApplyCurrencyMismatchError
    ) {
      if (observation.observationKind === "direct") {
        await completeObservation(
          db,
          shopId,
          token as string,
          observation.observationRequestGen,
          observation.observationResponseGen,
        );
      }
      const moneyDiag =
        error instanceof OrderApplyCurrencyMismatchError
          ? DIAGNOSTIC.MONEY_CURRENCY
          : diagnostic;
      if (fact) {
        if (identity.resourceKind === "Order") {
          await updateOrderDiagnosticsOnly(
            db,
            shopId,
            fact.id,
            moneyDiag,
            null,
          );
        } else {
          await updateRefundDiagnosticsOnly(
            db,
            shopId,
            fact.id,
            moneyDiag,
            null,
          );
        }
      }
      return {
        abandoned,
        result: {
          identity,
          outcome: "rejected",
          reason: "money_unsafe",
          existenceMutated,
          attributesApplied: false,
          childrenApplied: false,
          diagnosticState: moneyDiag,
          factId: fact?.id ?? null,
        },
      };
    }
    throw error;
  }

  if (observation.observationKind === "direct") {
    await completeObservation(
      db,
      shopId,
      token as string,
      observation.observationRequestGen,
      observation.observationResponseGen,
    );
  }

  let outcome: OrderApplyObservationResult["outcome"] = "applied";
  let reason = existenceDecision.reason;
  if (
    existenceBlocked &&
    !existenceMutated &&
    !attributesApplied &&
    !childrenApplied
  ) {
    outcome = "blocked";
    reason = "active_blocker";
  } else if (
    existenceDecision.reason.includes("conflict") ||
    diagnostic?.includes("CONFLICT")
  ) {
    outcome = "conflict";
  } else if (!existenceMutated && !attributesApplied && !childrenApplied) {
    outcome = "noop";
  } else if (outcome === "applied" && !reason) {
    reason = "applied_snapshot";
  }

  return {
    abandoned,
    result: {
      identity,
      outcome,
      reason,
      existenceMutated,
      attributesApplied,
      childrenApplied,
      diagnosticState: diagnostic,
      factId,
    },
  };
}

/**
 * Apply already-authoritative order/refund observations inside an open tenant
 * transaction. The caller owns COMMIT/ROLLBACK. No network I/O is performed.
 */
export async function applyOrderFacts(
  db: OrderApplyDb,
  input: OrderApplyBatchInput,
): Promise<OrderApplyBatchResult> {
  if (!input.shopId) {
    throw new OrderApplyError(
      "order_apply_shop_required",
      "shopId is required",
    );
  }
  if (
    input.claimedClientShopId != null &&
    input.claimedClientShopId !== "" &&
    input.claimedClientShopId !== input.shopId
  ) {
    throw new OrderApplyClientShopDeniedError();
  }
  for (const observation of input.observations) {
    if (observation.identity.shopId !== input.shopId) {
      throw new OrderApplyError(
        "order_apply_shop_mismatch",
        "Observation shopId does not match batch shopId",
      );
    }
    validateObservation(observation);
  }

  await requireTenant(db, input.shopId);
  await requireProcessingEnabled(db, input.shopId);

  if (input.receipt) {
    await acquireReceiptApplicationKeyLock(
      db,
      input.shopId,
      input.receipt.applicationKey,
    );
    const short = await shortCircuitIfApplied(
      db,
      input.shopId,
      input.receipt,
    );
    if (short === "already_applied") {
      return {
        results: input.observations.map((observation) => ({
          identity: observation.identity,
          outcome: "already_applied",
          reason: "already_applied",
          existenceMutated: false,
          attributesApplied: false,
          childrenApplied: false,
          diagnosticState: null,
          factId: null,
        })),
        identitiesLocked: 0,
        abandonedBlockerTokens: [],
        receiptStatus: "already_applied",
      };
    }
  }

  if (input.observations.length === 0) {
    return {
      results: [],
      identitiesLocked: 0,
      abandonedBlockerTokens: [],
      receiptStatus: "none",
    };
  }

  const identities = collectLockIdentities(input.shopId, input.observations);
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
    throw new OrderApplyBatchExceedsCapacityError(
      identities.length,
      evaluation.effectiveCanonicalIdentitiesPerTransaction,
    );
  }

  await acquireOrderedLocks(db, identities);
  await requireProcessingEnabled(db, input.shopId);

  const byIdentity = new Map<string, OrderObservation[]>();
  for (const observation of input.observations) {
    const key = identityKey(observation.identity);
    const list = byIdentity.get(key) ?? [];
    list.push(observation);
    byIdentity.set(key, list);
  }

  const orderedIdentities = identities
    .map((identity) => ({
      identity,
      key: deriveOrderLockKey(identity),
    }))
    .sort((a, b) => {
      if (a.key.key1 !== b.key.key1) return a.key.key1 < b.key.key1 ? -1 : 1;
      if (a.key.key2 !== b.key.key2) return a.key.key2 < b.key.key2 ? -1 : 1;
      return 0;
    });

  const results: OrderApplyObservationResult[] = [];
  const abandonedBlockerTokens: string[] = [];
  const seenObs = new Set<OrderObservation>();

  for (const item of orderedIdentities) {
    const key = `${item.identity.shopId}|${item.identity.resourceKind}|${item.identity.shopifyGid}`;
    const observations = (byIdentity.get(key) ?? [])
      .slice()
      .sort(compareObservations);
    for (const observation of observations) {
      if (seenObs.has(observation)) continue;
      seenObs.add(observation);
      const applied = await applyOneObservation(db, observation);
      results.push(applied.result);
      abandonedBlockerTokens.push(...applied.abandoned);
    }
  }

  let receiptStatus: OrderApplyBatchResult["receiptStatus"] = "none";
  if (input.receipt) {
    if (!batchCertifiesReceiptSuccess(results)) {
      throw new OrderApplyReceiptNotCertifiableError(
        `Receipt-bound apply outcomes are not terminal-accepted: ${results
          .map((result) => `${result.outcome}:${result.reason}`)
          .join(",")}`,
      );
    }
    const inserted = await insertReceiptFinal(
      db,
      input.shopId,
      input.receipt,
      {
        observationOutcomes: results.map((result) => ({
          resourceKind: result.identity.resourceKind,
          shopifyGid: result.identity.shopifyGid,
          outcome: result.outcome,
          reason: result.reason,
        })),
      },
    );
    receiptStatus = inserted === "inserted" ? "applied" : "already_applied";
  }

  return {
    results,
    identitiesLocked: identities.length,
    abandonedBlockerTokens,
    receiptStatus,
  };
}

/**
 * Retry unique-conflict / advisory-lock-timeout by rolling the caller
 * transaction back and invoking `begin` again. `begin` MUST start a fresh
 * PostgreSQL transaction. Do not retry inside an aborted transaction
 * (SQLSTATE 25P02). No ON CONFLICT DO UPDATE. No savepoint recovery.
 */
export async function applyOrderFactsWithRetry(
  begin: (
    fn: (db: OrderApplyDb) => Promise<OrderApplyBatchResult>,
  ) => Promise<OrderApplyBatchResult>,
  input: OrderApplyBatchInput,
  options?: { maxAttempts?: number },
): Promise<OrderApplyBatchResult> {
  const maxAttempts = options?.maxAttempts ?? 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await begin((db) => applyOrderFacts(db, input));
    } catch (error) {
      lastError = error;
      const code = (error as { code?: string }).code;
      if (
        (code === "order_advisory_lock_timeout" ||
          code === "order_apply_unique_conflict" ||
          code === "order_apply_receipt_lock_timeout") &&
        attempt < maxAttempts
      ) {
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
