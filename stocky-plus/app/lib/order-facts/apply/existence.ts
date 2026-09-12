/**
 * Order existence / window / unverified-delete / terminal-revival decisions.
 *
 * CHECK cannot see OLD state. Do not clear deletion evidence to make SQL pass.
 * INACCESSIBLE_HISTORY_WINDOW never sets deletedAt. Confirmed absence requires
 * completed null query + in-window + scope continuity.
 */
import type { OrderExistenceKind } from "../types";
import {
  createdAtMatches,
  intervalsOverlap,
  isNonOverlappingLater,
  isWithinHistoryWindow,
  type GenerationInterval,
} from "./clocks";
import {
  ORDER_HISTORY_WINDOW_DAYS,
  ORDER_TERMINAL_REVIVAL_PREFIX,
  READ_ALL_ORDERS_SCOPE,
  READ_ORDERS_SCOPE,
} from "./constants";
import { DIAGNOSTIC } from "./types";

export type StoredOrderExistence = {
  existenceState: "LIVE" | "ABSENT";
  existenceKind: OrderExistenceKind | string;
  existenceRequestGen: bigint | null;
  existenceResponseGen: bigint | null;
  shopifyCreatedAt: Date | null;
  processedAt: Date | null;
  deletedAt: Date | null;
  deletionSource: string | null;
  existenceDiagnosticState: string | null;
  historyWindowState: string | null;
  accessScopeSnapshot: string[];
};

export type ExistenceDecision =
  | {
      mutate: false;
      reason: string;
      diagnostic: string | null;
      historyWindowState?: string | null;
    }
  | {
      mutate: true;
      nextState: "LIVE" | "ABSENT";
      nextKind: OrderExistenceKind;
      reason: string;
      diagnostic: string | null;
      historyWindowState?: string | null;
      deletionSource: "CONFIRMED_QUERY" | "WEBHOOK" | null;
      deletedAtNow: boolean;
    };

export function parseRevivalConfirmation(
  diagnostic: string | null,
): GenerationInterval | null {
  if (!diagnostic) return null;
  const prefix = `${ORDER_TERMINAL_REVIVAL_PREFIX}:`;
  if (!diagnostic.startsWith(prefix)) return null;
  const rest = diagnostic.slice(prefix.length);
  const [req, resp] = rest.split(":");
  if (!req || !resp) return null;
  try {
    const requestGen = BigInt(req);
    const responseGen = BigInt(resp);
    if (requestGen >= responseGen) return null;
    return { requestGen, responseGen };
  } catch {
    return null;
  }
}

export function encodeRevivalConfirmation(
  interval: GenerationInterval,
): string {
  return `${ORDER_TERMINAL_REVIVAL_PREFIX}:${interval.requestGen.toString()}:${interval.responseGen.toString()}`;
}

export function storedExistenceInterval(
  stored: StoredOrderExistence | null,
): GenerationInterval | null {
  if (!stored) return null;
  if (
    stored.existenceRequestGen == null ||
    stored.existenceResponseGen == null
  ) {
    return null;
  }
  return {
    requestGen: stored.existenceRequestGen,
    responseGen: stored.existenceResponseGen,
  };
}

export function scopesGrantReadOrders(
  scopes: readonly string[] | null | undefined,
): boolean {
  if (!scopes || scopes.length === 0) return false;
  return scopes.includes(READ_ORDERS_SCOPE);
}

export function scopesGrantReadAllOrders(
  scopes: readonly string[] | null | undefined,
): boolean {
  return Boolean(scopes?.includes(READ_ALL_ORDERS_SCOPE));
}

/**
 * Set equality for scope snapshots. Order and duplicates do not matter.
 */
export function accessScopeSetsEqual(
  left: readonly string[] | null | undefined,
  right: readonly string[] | null | undefined,
): boolean {
  const leftSet = new Set(left ?? []);
  const rightSet = new Set(right ?? []);
  if (leftSet.size !== rightSet.size) return false;
  for (const scope of leftSet) {
    if (!rightSet.has(scope)) return false;
  }
  return true;
}

/**
 * Persisted LIVE scope history is a floor. An empty or weaker caller
 * lastConfirmedAccessScopes must not erase read_all_orders (T50 / F-05).
 */
export function mergeAccessScopeFloor(
  caller: readonly string[] | null | undefined,
  persisted: readonly string[] | null | undefined,
): string[] {
  const merged = new Set<string>();
  for (const scope of persisted ?? []) {
    if (scope) merged.add(scope);
  }
  for (const scope of caller ?? []) {
    if (scope) merged.add(scope);
  }
  return [...merged];
}

/**
 * Deny absence if grant continuity is missing, stale, or downgraded vs the
 * last valid LIVE confirmation (T50).
 */
export function scopeContinuityAllowsAbsence(input: {
  currentScopes: readonly string[];
  lastConfirmedScopes: readonly string[] | null | undefined;
}): { ok: boolean; diagnostic: string | null } {
  if (!scopesGrantReadOrders(input.currentScopes)) {
    return { ok: false, diagnostic: DIAGNOSTIC.SCOPE_DOWNGRADE };
  }
  const last = input.lastConfirmedScopes ?? null;
  if (last && last.length > 0) {
    if (
      scopesGrantReadAllOrders(last) &&
      !scopesGrantReadAllOrders(input.currentScopes)
    ) {
      return { ok: false, diagnostic: DIAGNOSTIC.SCOPE_DOWNGRADE };
    }
    if (scopesGrantReadOrders(last) && !scopesGrantReadOrders(input.currentScopes)) {
      return { ok: false, diagnostic: DIAGNOSTIC.SCOPE_DOWNGRADE };
    }
  }
  return { ok: true, diagnostic: null };
}

function incomingIsLive(kind: OrderExistenceKind): boolean {
  return kind === "LIVE_REFETCH" || kind === "LIVE_FULL_SYNC_PRESENT";
}

function isConfirmedTombstone(stored: StoredOrderExistence): boolean {
  return stored.existenceKind === "ABSENT_CONFIRMED_QUERY";
}

function isUnverifiedDelete(stored: StoredOrderExistence): boolean {
  return stored.existenceKind === "ABSENT_SIGNALLED_DELETE_UNVERIFIED";
}

function preserveTombstoneDiagnostics(
  stored: StoredOrderExistence,
  incomingDiagnostic: string | null,
  historyWindowState: string | null,
): ExistenceDecision {
  return {
    mutate: false,
    reason: "preserve_established_tombstone",
    diagnostic: incomingDiagnostic ?? stored.existenceDiagnosticState,
    historyWindowState: historyWindowState ?? stored.historyWindowState,
  };
}

export function decideOrderExistence(input: {
  stored: StoredOrderExistence | null;
  incomingKind: OrderExistenceKind;
  incomingInterval: GenerationInterval | null;
  incomingShopifyCreatedAt?: Date | null;
  incomingProcessedAt?: Date | null;
  existenceObservedAt: Date;
  existenceBlocked: boolean;
  overlappingCompleted: GenerationInterval[];
  fenceGeneration?: bigint | null;
  queryCompleted?: boolean;
  queryReturnedNull?: boolean;
  currentScopes: readonly string[];
  lastConfirmedScopes?: readonly string[] | null;
  windowDays?: number;
}): ExistenceDecision {
  const { stored, incomingKind } = input;
  const windowDays = input.windowDays ?? ORDER_HISTORY_WINDOW_DAYS;

  if (input.existenceBlocked) {
    return { mutate: false, reason: "active_blocker", diagnostic: null };
  }

  if (incomingKind === "LIVE_FULL_SYNC_PRESENT") {
    if (input.fenceGeneration == null) {
      throw new Error("full-sync existence decision requires fenceGeneration");
    }
    if (!stored) {
      return {
        mutate: true,
        nextState: "LIVE",
        nextKind: "LIVE_FULL_SYNC_PRESENT",
        reason: "first_insert_live_full_sync",
        diagnostic: null,
        deletionSource: null,
        deletedAtNow: false,
      };
    }
    if (isConfirmedTombstone(stored) || isUnverifiedDelete(stored)) {
      return preserveTombstoneDiagnostics(stored, null, null);
    }
    if (stored.existenceState === "LIVE") {
      return { mutate: false, reason: "presence_keep_live", diagnostic: null };
    }
    return {
      mutate: false,
      reason: "full_sync_cannot_tombstone_or_revive",
      diagnostic: null,
    };
  }

  const incomingInterval = input.incomingInterval;
  if (incomingInterval == null) {
    throw new Error(
      "direct existence decision requires a direct observation interval",
    );
  }

  const extraOverlap = input.overlappingCompleted.some((interval) =>
    intervalsOverlap(interval, incomingInterval),
  );

  if (incomingKind === "INACCESSIBLE_HISTORY_WINDOW") {
    if (!stored) {
      return {
        mutate: false,
        reason: "inaccessible_no_row",
        diagnostic: DIAGNOSTIC.EXISTENCE_UNVERIFIABLE,
        historyWindowState: DIAGNOSTIC.WINDOW_TRUNCATED,
      };
    }
    if (isConfirmedTombstone(stored) || isUnverifiedDelete(stored)) {
      return preserveTombstoneDiagnostics(
        stored,
        DIAGNOSTIC.EXISTENCE_UNVERIFIABLE,
        DIAGNOSTIC.WINDOW_TRUNCATED,
      );
    }
    return {
      mutate: true,
      nextState: stored.existenceState,
      nextKind: "INACCESSIBLE_HISTORY_WINDOW",
      reason: "inaccessible_preserve_state",
      diagnostic: DIAGNOSTIC.EXISTENCE_UNVERIFIABLE,
      historyWindowState: DIAGNOSTIC.WINDOW_TRUNCATED,
      deletionSource: null,
      deletedAtNow: false,
    };
  }

  if (!stored) {
    if (extraOverlap) {
      return {
        mutate: false,
        reason: "first_insert_overlapping_completed",
        diagnostic: DIAGNOSTIC.CONCURRENT_EXISTENCE,
      };
    }
    if (incomingIsLive(incomingKind)) {
      return {
        mutate: true,
        nextState: "LIVE",
        nextKind: incomingKind,
        reason: "first_insert_live",
        diagnostic: null,
        deletionSource: null,
        deletedAtNow: false,
      };
    }
    return {
      mutate: false,
      reason: "first_insert_absent_preserve_no_row",
      diagnostic: null,
    };
  }

  const storedInterval = storedExistenceInterval(stored);
  const storedLive = stored.existenceState === "LIVE";

  if (storedInterval && intervalsOverlap(storedInterval, incomingInterval)) {
    if (storedLive === incomingIsLive(incomingKind)) {
      return { mutate: false, reason: "overlap_agree", diagnostic: null };
    }
    return {
      mutate: false,
      reason: "overlap_conflict",
      diagnostic: DIAGNOSTIC.CONCURRENT_EXISTENCE,
    };
  }

  if (extraOverlap && storedLive !== incomingIsLive(incomingKind)) {
    if (!(isConfirmedTombstone(stored) && incomingIsLive(incomingKind))) {
      return {
        mutate: false,
        reason: "completed_overlap_conflict",
        diagnostic: DIAGNOSTIC.CONCURRENT_EXISTENCE,
      };
    }
  }

  if (incomingKind === "ABSENT_SIGNALLED_DELETE_UNVERIFIED") {
    if (isConfirmedTombstone(stored)) {
      return preserveTombstoneDiagnostics(stored, null, null);
    }
    if (isUnverifiedDelete(stored)) {
      return { mutate: false, reason: "already_unverified_delete", diagnostic: null };
    }
    return {
      mutate: true,
      nextState: "ABSENT",
      nextKind: "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
      reason: "unverified_delete",
      diagnostic: null,
      deletionSource: "WEBHOOK",
      deletedAtNow: true,
    };
  }

  if (incomingKind === "ABSENT_CONFIRMED_QUERY") {
    if (!input.queryCompleted || !input.queryReturnedNull) {
      return {
        mutate: false,
        reason: "absence_query_incomplete",
        diagnostic: DIAGNOSTIC.EXISTENCE_UNVERIFIABLE,
      };
    }
    const scope = scopeContinuityAllowsAbsence({
      currentScopes: input.currentScopes,
      lastConfirmedScopes: mergeAccessScopeFloor(
        input.lastConfirmedScopes,
        stored.accessScopeSnapshot,
      ),
    });
    if (!scope.ok) {
      return {
        mutate: false,
        reason: "scope_continuity_denied",
        diagnostic: scope.diagnostic,
      };
    }
    const inWindow = isWithinHistoryWindow({
      processedAt: stored.processedAt ?? input.incomingProcessedAt ?? null,
      shopifyCreatedAt:
        stored.shopifyCreatedAt ?? input.incomingShopifyCreatedAt ?? null,
      observedAt: input.existenceObservedAt,
      windowDays,
      hasReadAllOrders: scopesGrantReadAllOrders(input.currentScopes),
    });
    if (!inWindow) {
      if (isConfirmedTombstone(stored) || isUnverifiedDelete(stored)) {
        return preserveTombstoneDiagnostics(
          stored,
          DIAGNOSTIC.EXISTENCE_UNVERIFIABLE,
          DIAGNOSTIC.WINDOW_TRUNCATED,
        );
      }
      return {
        mutate: true,
        nextState: stored.existenceState,
        nextKind: "INACCESSIBLE_HISTORY_WINDOW",
        reason: "aged_out_null_not_tombstone",
        diagnostic: DIAGNOSTIC.EXISTENCE_UNVERIFIABLE,
        historyWindowState: DIAGNOSTIC.WINDOW_TRUNCATED,
        deletionSource: null,
        deletedAtNow: false,
      };
    }
    if (storedInterval && !isNonOverlappingLater(incomingInterval, storedInterval)) {
      return {
        mutate: false,
        reason: "absent_not_later",
        diagnostic: DIAGNOSTIC.CONCURRENT_EXISTENCE,
      };
    }
    if (storedLive && incomingIsLive(incomingKind) === false) {
      return {
        mutate: true,
        nextState: "ABSENT",
        nextKind: "ABSENT_CONFIRMED_QUERY",
        reason: "confirmed_tombstone",
        diagnostic: null,
        deletionSource: "CONFIRMED_QUERY",
        deletedAtNow: true,
      };
    }
    if (isUnverifiedDelete(stored)) {
      return {
        mutate: true,
        nextState: "ABSENT",
        nextKind: "ABSENT_CONFIRMED_QUERY",
        reason: "upgrade_unverified_to_confirmed",
        diagnostic: null,
        deletionSource: "CONFIRMED_QUERY",
        deletedAtNow: true,
      };
    }
    return { mutate: false, reason: "already_absent", diagnostic: null };
  }

  if (incomingIsLive(incomingKind)) {
    if (storedLive) {
      if (
        incomingKind === "LIVE_REFETCH" &&
        stored.existenceKind !== "LIVE_REFETCH"
      ) {
        return {
          mutate: true,
          nextState: "LIVE",
          nextKind: "LIVE_REFETCH",
          reason: "upgrade_to_live_refetch",
          diagnostic: null,
          deletionSource: null,
          deletedAtNow: false,
        };
      }
      if (
        storedInterval &&
        isNonOverlappingLater(incomingInterval, storedInterval)
      ) {
        return {
          mutate: true,
          nextState: "LIVE",
          nextKind: "LIVE_REFETCH",
          reason: "advance_live_presence_interval",
          diagnostic: null,
          deletionSource: null,
          deletedAtNow: false,
        };
      }
      return { mutate: false, reason: "already_live", diagnostic: null };
    }

    if (stored.existenceKind === "INACCESSIBLE_HISTORY_WINDOW") {
      return {
        mutate: true,
        nextState: "LIVE",
        nextKind: "LIVE_REFETCH",
        reason: "inaccessible_reversed_by_live",
        diagnostic: null,
        deletionSource: null,
        deletedAtNow: false,
      };
    }

    if (isUnverifiedDelete(stored)) {
      return {
        mutate: true,
        nextState: "LIVE",
        nextKind: "LIVE_REFETCH",
        reason: "stale_unverified_delete_live",
        diagnostic: DIAGNOSTIC.STALE_DELETE,
        deletionSource: null,
        deletedAtNow: false,
      };
    }

    if (!isConfirmedTombstone(stored)) {
      return {
        mutate: true,
        nextState: "LIVE",
        nextKind: "LIVE_REFETCH",
        reason: "nonterminal_reconnect",
        diagnostic: null,
        deletionSource: null,
        deletedAtNow: false,
      };
    }

    if (storedInterval && !isNonOverlappingLater(incomingInterval, storedInterval)) {
      return {
        mutate: false,
        reason: "live_not_later_than_absence",
        diagnostic: DIAGNOSTIC.CONCURRENT_EXISTENCE,
      };
    }

    if (!createdAtMatches(stored.shopifyCreatedAt, input.incomingShopifyCreatedAt)) {
      return {
        mutate: false,
        reason: "created_at_mismatch",
        diagnostic: DIAGNOSTIC.TERMINAL_REVIVAL,
      };
    }

    const first = parseRevivalConfirmation(stored.existenceDiagnosticState);
    if (!first) {
      return {
        mutate: false,
        reason: "terminal_first_confirmation",
        diagnostic: encodeRevivalConfirmation(incomingInterval),
      };
    }
    if (!(incomingInterval.requestGen > first.responseGen)) {
      return {
        mutate: false,
        reason: "terminal_overlapping_confirmations",
        diagnostic: encodeRevivalConfirmation(first),
      };
    }
    return {
      mutate: true,
      nextState: "LIVE",
      nextKind: "LIVE_REFETCH",
      reason: "terminal_revival",
      diagnostic: null,
      deletionSource: null,
      deletedAtNow: false,
    };
  }

  return { mutate: false, reason: "unhandled_kind", diagnostic: null };
}
