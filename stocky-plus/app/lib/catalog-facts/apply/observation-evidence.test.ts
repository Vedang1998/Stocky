import { describe, expect, it } from "vitest";
import {
  decideAttributeClock,
  nullableFallbackIntervalFromFullSyncMarker,
} from "./clocks";
import {
  directObservationInterval,
  fullSyncAttributeMarker,
  fullSyncFenceGeneration,
  isDirectNotSafelyEarlierThanFence,
  isDirectSafelyEarlierThanFence,
} from "./observation-evidence";
import type {
  DirectCanonicalObservation,
  FullSyncCanonicalObservation,
} from "./types";

function direct(requestGen: bigint, responseGen: bigint): DirectCanonicalObservation {
  return {
    observationKind: "direct",
    observationToken: "tok",
    observationRequestGen: requestGen,
    observationResponseGen: responseGen,
    identity: { shopId: "s", resourceKind: "Product", shopifyGid: "gid://shopify/Product/1" },
    existenceKind: "LIVE_REFETCH",
    existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
    sourceKind: "INCREMENTAL_REFETCH",
  };
}

function bulk(fenceGeneration: bigint): FullSyncCanonicalObservation {
  return {
    observationKind: "full_sync",
    fenceGeneration,
    epochId: "epoch",
    identity: { shopId: "s", resourceKind: "Product", shopifyGid: "gid://shopify/Product/1" },
    existenceKind: "LIVE_FULL_SYNC_PRESENT",
    existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
    sourceKind: "FULL_SYNC",
  };
}

describe("PR5-F2B direct interval vs full-sync fence markers", () => {
  it("keeps direct intervals and full-sync fence/attribute markers type-separated", () => {
    const interval = directObservationInterval(direct(8n, 9n));
    expect(interval).toEqual({ requestGen: 8n, responseGen: 9n });
    expect(fullSyncFenceGeneration(bulk(5n))).toEqual({
      kind: "full_sync_fence",
      fenceGeneration: 5n,
    });
    expect(fullSyncAttributeMarker(bulk(5n))).toEqual({
      kind: "full_sync_attribute_marker",
      fenceGeneration: 5n,
    });
  });

  it("treats responseGen >= F as not safely earlier than the fence", () => {
    const fence = fullSyncFenceGeneration(bulk(10n));
    expect(isDirectSafelyEarlierThanFence({ requestGen: 1n, responseGen: 9n }, fence)).toBe(
      true,
    );
    expect(isDirectNotSafelyEarlierThanFence({ requestGen: 11n, responseGen: 12n }, fence)).toBe(
      true,
    );
    expect(isDirectNotSafelyEarlierThanFence({ requestGen: 5n, responseGen: 15n }, fence)).toBe(
      true,
    );
    expect(isDirectNotSafelyEarlierThanFence({ requestGen: 10n, responseGen: 11n }, fence)).toBe(
      true,
    );
  });

  it("uses the named attribute marker only for nullable Clock A fallback", () => {
    const marker = fullSyncAttributeMarker(bulk(5n));
    const fallback = nullableFallbackIntervalFromFullSyncMarker(marker);
    const laterDirect = decideAttributeClock({
      incomingUpdatedAt: null,
      storedUpdatedAt: null,
      incomingInterval: fallback,
      storedInterval: { requestGen: 10n, responseGen: 12n },
      attributesEqual: false,
    });
    expect(laterDirect.apply).toBe(false);
    expect(laterDirect.reason).toBe("null_nonoverlap_not_later");

    const laterFence = decideAttributeClock({
      incomingUpdatedAt: null,
      storedUpdatedAt: null,
      incomingInterval: nullableFallbackIntervalFromFullSyncMarker(
        fullSyncAttributeMarker(bulk(20n)),
      ),
      storedInterval: { requestGen: 10n, responseGen: 12n },
      attributesEqual: false,
    });
    expect(laterFence.apply).toBe(true);
    expect(laterFence.reason).toBe("null_nonoverlap_later");
  });
});
