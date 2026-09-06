/**
 * Clock A / nullable-version fallback (§6.F.5 / §6.F.9).
 * Generations order app request lifecycle only — never last-writer-wins.
 */

export type GenerationInterval = {
  requestGen: bigint;
  responseGen: bigint;
};

/**
 * Conservative bulk epoch marker for null-version Clock A / quantity fallback.
 * This is NOT a direct Clock-B existence interval. Do not pass it to existence
 * overlap APIs. Persistence of existenceRequestGen / existenceResponseGen stays
 * NULL/NULL for LIVE_FULL_SYNC_PRESENT.
 */
export type FullSyncAttributeMarker = {
  readonly kind: "full_sync_attribute_marker";
  readonly fenceGeneration: bigint;
};

export type FullSyncFenceGeneration = {
  readonly kind: "full_sync_fence";
  readonly fenceGeneration: bigint;
};

/**
 * Point representation used only by the nullable attribute/quantity fallback.
 * Equal request/response gens here are a bulk epoch marker, not a fabricated
 * direct [fence, fence] existence interval.
 */
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
    // Brief §6.F.9: incoming null-version against a stored versioned fact does
    // not apply. Freshness becomes/remains DEGRADED because absolute freshness
    // cannot be established. This is intentional, not a silent no-op.
    return {
      apply: false,
      freshness: "DEGRADED",
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
