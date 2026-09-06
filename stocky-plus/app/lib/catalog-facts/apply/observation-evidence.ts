/**
 * Direct Clock-B intervals versus full-sync fence markers.
 *
 * A full-sync fence is not a direct [requestGen, responseGen] existence
 * interval. LIVE_FULL_SYNC_PRESENT persists existence gens as NULL/NULL.
 */
import type { FullSyncAttributeMarker, FullSyncFenceGeneration, GenerationInterval } from "./clocks";
import type {
  DirectCanonicalObservation,
  FullSyncCanonicalObservation,
} from "./types";

export function directObservationInterval(
  observation: DirectCanonicalObservation,
): GenerationInterval {
  return {
    requestGen: observation.observationRequestGen,
    responseGen: observation.observationResponseGen,
  };
}

export function fullSyncFenceGeneration(
  observation: FullSyncCanonicalObservation,
): FullSyncFenceGeneration {
  return {
    kind: "full_sync_fence",
    fenceGeneration: observation.fenceGeneration,
  };
}

export function fullSyncAttributeMarker(
  observation: FullSyncCanonicalObservation,
): FullSyncAttributeMarker {
  return {
    kind: "full_sync_attribute_marker",
    fenceGeneration: observation.fenceGeneration,
  };
}

/** Completed direct is safely earlier than fence F only when responseGen < F. */
export function isDirectSafelyEarlierThanFence(
  direct: GenerationInterval,
  fence: FullSyncFenceGeneration | bigint,
): boolean {
  const fenceGeneration =
    typeof fence === "bigint" ? fence : fence.fenceGeneration;
  return direct.responseGen < fenceGeneration;
}

/**
 * Any completed direct with responseGen >= F is not safely earlier than the
 * bulk fence: it either spans/overlaps F or started after F.
 */
export function isDirectNotSafelyEarlierThanFence(
  direct: GenerationInterval,
  fence: FullSyncFenceGeneration | bigint,
): boolean {
  return !isDirectSafelyEarlierThanFence(direct, fence);
}
