/**
 * Independent Order and Refund Clock A (Shopify updatedAt).
 * Do not collapse clocks (R-174). Agreement happenedAt is event time, not Clock A.
 *
 * Reject only older parent snapshots. Equal timestamps reapply for child repair.
 * Generations order app request lifecycle only — never last-writer-wins.
 */

export type GenerationInterval = {
  requestGen: bigint;
  responseGen: bigint;
};

export type FullSyncAttributeMarker = {
  readonly kind: "full_sync_attribute_marker";
  readonly fenceGeneration: bigint;
};

export type FullSyncFenceGeneration = {
  readonly kind: "full_sync_fence";
  readonly fenceGeneration: bigint;
};

export function nullableFallbackIntervalFromFullSyncMarker(
  marker: FullSyncAttributeMarker,
): GenerationInterval {
  return {
    requestGen: marker.fenceGeneration,
    responseGen: marker.fenceGeneration,
  };
}

export function intervalsOverlap(
  a: GenerationInterval,
  b: GenerationInterval,
): boolean {
  return a.requestGen <= b.responseGen && b.requestGen <= a.responseGen;
}

export function isNonOverlappingLater(
  incoming: GenerationInterval,
  stored: GenerationInterval,
): boolean {
  return incoming.requestGen > stored.responseGen;
}

function timeMs(value: Date | null | undefined): number | null {
  if (value == null) return null;
  const ms = value.getTime();
  return Number.isFinite(ms) ? ms : null;
}

export type ClockADecision = {
  applyParent: boolean;
  applyChildren: boolean;
  reason:
    | "newer"
    | "equal_repair"
    | "stale"
    | "first_or_unversioned"
    | "incoming_null_stored_versioned"
    | "both_null";
};

/**
 * Clock A for Order and Refund independently.
 * Stale parent ⇒ no parent attribute overwrite and no children from that snapshot.
 * Equal ⇒ idempotent reapply including child repair (T45).
 */
export function decideClockA(input: {
  incomingUpdatedAt: Date | null | undefined;
  storedUpdatedAt: Date | null | undefined;
}): ClockADecision {
  const incomingMs = timeMs(input.incomingUpdatedAt ?? null);
  const storedMs = timeMs(input.storedUpdatedAt ?? null);

  if (incomingMs != null && storedMs != null) {
    if (incomingMs > storedMs) {
      return { applyParent: true, applyChildren: true, reason: "newer" };
    }
    if (incomingMs === storedMs) {
      return { applyParent: true, applyChildren: true, reason: "equal_repair" };
    }
    return { applyParent: false, applyChildren: false, reason: "stale" };
  }

  if (incomingMs != null && storedMs == null) {
    return {
      applyParent: true,
      applyChildren: true,
      reason: "first_or_unversioned",
    };
  }

  if (incomingMs == null && storedMs != null) {
    return {
      applyParent: false,
      applyChildren: false,
      reason: "incoming_null_stored_versioned",
    };
  }

  return { applyParent: true, applyChildren: true, reason: "both_null" };
}

export function createdAtMatches(
  stored: Date | null | undefined,
  incoming: Date | null | undefined,
): boolean {
  const storedMs = timeMs(stored ?? null);
  const incomingMs = timeMs(incoming ?? null);
  if (storedMs == null || incomingMs == null) return true;
  return storedMs === incomingMs;
}

export function isWithinHistoryWindow(input: {
  processedAt: Date | null;
  shopifyCreatedAt: Date | null;
  observedAt: Date;
  windowDays: number;
  hasReadAllOrders: boolean;
}): boolean {
  if (input.hasReadAllOrders) return true;
  const anchor = input.processedAt ?? input.shopifyCreatedAt;
  if (anchor == null) return false;
  const windowMs = input.windowDays * 24 * 60 * 60 * 1000;
  return anchor.getTime() >= input.observedAt.getTime() - windowMs;
}
