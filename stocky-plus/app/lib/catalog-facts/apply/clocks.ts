/**
 * Clock A / nullable-version fallback (§6.F.5 / §6.F.9).
 * Generations order app request lifecycle only — never last-writer-wins.
 */

export type GenerationInterval = {
  requestGen: bigint;
  responseGen: bigint;
};

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

export type AttributeClockInput = {
  incomingUpdatedAt: Date | null | undefined;
  storedUpdatedAt: Date | null | undefined;
  incomingInterval: GenerationInterval;
  storedInterval: GenerationInterval | null;
  attributesEqual: boolean;
};

export type AttributeClockDecision =
  | { apply: true; freshness: "ORDERED" | "DEGRADED"; diagnostic: string | null; reason: string }
  | { apply: false; freshness: "ORDERED" | "DEGRADED" | null; diagnostic: string | null; reason: string };

function timeMs(value: Date | null | undefined): number | null {
  if (value == null) return null;
  const ms = value.getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function decideAttributeClock(input: AttributeClockInput): AttributeClockDecision {
  const incomingMs = timeMs(input.incomingUpdatedAt ?? null);
  const storedMs = timeMs(input.storedUpdatedAt ?? null);

  if (incomingMs != null && storedMs != null) {
    if (incomingMs > storedMs) {
      return { apply: true, freshness: "ORDERED", diagnostic: null, reason: "newer_shopify" };
    }
    if (incomingMs < storedMs) {
      return { apply: false, freshness: null, diagnostic: null, reason: "stale_shopify" };
    }
    if (input.attributesEqual) {
      return { apply: false, freshness: null, diagnostic: null, reason: "equal_match" };
    }
    return {
      apply: false,
      freshness: "DEGRADED",
      diagnostic: "EQUAL_VERSION_CONFLICT",
      reason: "equal_conflict",
    };
  }

  if (incomingMs != null && storedMs == null) {
    return {
      apply: true,
      freshness: "ORDERED",
      diagnostic: null,
      reason: "incoming_shopify_outranks_null",
    };
  }

  if (incomingMs == null && storedMs != null) {
    return {
      apply: false,
      freshness: null,
      diagnostic: "CATALOG_NULL_VERSION_OBSERVATION",
      reason: "incoming_null_stored_versioned",
    };
  }

  // Both null: nullable-version fallback. Infinite no-op is forbidden.
  if (input.storedInterval == null) {
    return {
      apply: true,
      freshness: "DEGRADED",
      diagnostic: null,
      reason: "null_first_insert",
    };
  }

  if (intervalsOverlap(input.incomingInterval, input.storedInterval)) {
    if (input.attributesEqual) {
      return {
        apply: false,
        freshness: "DEGRADED",
        diagnostic: null,
        reason: "null_overlap_identical",
      };
    }
    return {
      apply: false,
      freshness: "DEGRADED",
      diagnostic: "CONCURRENT_ATTRIBUTE_OBSERVATION_CONFLICT",
      reason: "null_overlap_conflict",
    };
  }

  if (isNonOverlappingLater(input.incomingInterval, input.storedInterval)) {
    return {
      apply: true,
      freshness: "DEGRADED",
      diagnostic: null,
      reason: "null_nonoverlap_later",
    };
  }

  return {
    apply: false,
    freshness: "DEGRADED",
    diagnostic: null,
    reason: "null_nonoverlap_not_later",
  };
}

export type QuantityClockInput = {
  incomingUpdatedAt: Date | null | undefined;
  storedUpdatedAt: Date | null | undefined;
  incomingInterval: GenerationInterval;
  storedInterval: GenerationInterval | null;
  storedValue: number | null;
  incomingValue: number | null;
};

export function decideQuantityClock(input: QuantityClockInput): AttributeClockDecision {
  return decideAttributeClock({
    incomingUpdatedAt: input.incomingUpdatedAt,
    storedUpdatedAt: input.storedUpdatedAt,
    incomingInterval: input.incomingInterval,
    storedInterval: input.storedInterval,
    attributesEqual: input.incomingValue === input.storedValue,
  });
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
