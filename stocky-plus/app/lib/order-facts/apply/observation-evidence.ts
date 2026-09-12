/**
 * Direct Clock-B intervals versus full-sync fence markers.
 */
import type {
  FullSyncAttributeMarker,
  FullSyncFenceGeneration,
  GenerationInterval,
} from "./clocks";
import type {
  DirectOrderObservation,
  FullSyncOrderObservation,
} from "./types";

export function directObservationInterval(
  observation: DirectOrderObservation,
): GenerationInterval {
  return {
    requestGen: observation.observationRequestGen,
    responseGen: observation.observationResponseGen,
  };
}

export function fullSyncFenceGeneration(
  observation: FullSyncOrderObservation,
): FullSyncFenceGeneration {
  return {
    kind: "full_sync_fence",
    fenceGeneration: observation.fenceGeneration,
  };
}

export function fullSyncAttributeMarker(
  observation: FullSyncOrderObservation,
): FullSyncAttributeMarker {
  return {
    kind: "full_sync_attribute_marker",
    fenceGeneration: observation.fenceGeneration,
  };
}

function refundWalkComplete(refund: {
  linesComplete: boolean;
  adjustmentsComplete: boolean;
  transactionsComplete: boolean;
}): boolean {
  return (
    refund.linesComplete &&
    refund.adjustmentsComplete &&
    refund.transactionsComplete
  );
}

export function isSnapshotStructurallyComplete(observation: {
  snapshotComplete: boolean;
  order?: {
    linesComplete: boolean;
    agreementsComplete: boolean;
    agreements?: Array<{ salesComplete: boolean }>;
  } | null;
  refund?: {
    linesComplete: boolean;
    adjustmentsComplete: boolean;
    transactionsComplete: boolean;
  } | null;
  nestedRefunds?: Array<{
    linesComplete: boolean;
    adjustmentsComplete: boolean;
    transactionsComplete: boolean;
  }>;
}): boolean {
  if (!observation.snapshotComplete) return false;
  if (observation.order) {
    if (
      !observation.order.linesComplete ||
      !observation.order.agreementsComplete
    ) {
      return false;
    }
    for (const agreement of observation.order.agreements ?? []) {
      if (!agreement.salesComplete) return false;
    }
  }
  if (observation.refund && !refundWalkComplete(observation.refund)) {
    return false;
  }
  for (const refund of observation.nestedRefunds ?? []) {
    if (!refundWalkComplete(refund)) return false;
  }
  return true;
}
