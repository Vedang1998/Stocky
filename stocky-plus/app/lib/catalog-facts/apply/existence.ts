/**
 * Clock B existence / tombstone / terminal-revival decisions (§6.F.3 / §6.F.7 / §6.F.8).
 */
import {
  intervalsOverlap,
  isNonOverlappingLater,
  createdAtMatches,
  type GenerationInterval,
} from "./clocks";
import {
  DIAGNOSTIC,
  isTerminalResource,
  type ApprovedExistenceKind,
  type CanonicalFactIdentity,
} from "./types";

export type StoredExistence = {
  existenceState: "LIVE" | "ABSENT";
  existenceKind: ApprovedExistenceKind | string;
  existenceRequestGen: bigint | null;
  existenceResponseGen: bigint | null;
  shopifyCreatedAt: Date | null;
  existenceDiagnosticState: string | null;
};

export type ExistenceDecision =
  | { mutate: false; reason: string; diagnostic: string | null; openRevival?: GenerationInterval }
  | {
      mutate: true;
      nextState: "LIVE" | "ABSENT";
      nextKind: ApprovedExistenceKind;
      reason: string;
      diagnostic: string | null;
      deletionSource: "CONFIRMED_QUERY" | "DISCONNECT" | null;
    };

export function parseRevivalConfirmation(
  diagnostic: string | null,
): GenerationInterval | null {
  if (!diagnostic) return null;
  const prefix = `${DIAGNOSTIC.TERMINAL_REVIVAL}:`;
  if (!diagnostic.startsWith(prefix) && diagnostic !== DIAGNOSTIC.TERMINAL_REVIVAL) {
    return null;
  }
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

export function encodeRevivalConfirmation(interval: GenerationInterval): string {
  return `${DIAGNOSTIC.TERMINAL_REVIVAL}:${interval.requestGen.toString()}:${interval.responseGen.toString()}`;
}

export function storedExistenceInterval(
  stored: StoredExistence | null,
): GenerationInterval | null {
  if (!stored) return null;
  if (stored.existenceRequestGen == null || stored.existenceResponseGen == null) {
    return null;
  }
  return {
    requestGen: stored.existenceRequestGen,
    responseGen: stored.existenceResponseGen,
  };
}

function incomingIsLive(kind: ApprovedExistenceKind): boolean {
  return kind === "LIVE_REFETCH" || kind === "LIVE_FULL_SYNC_PRESENT";
}

export function decideExistence(input: {
  identity: CanonicalFactIdentity;
  stored: StoredExistence | null;
  incomingKind: ApprovedExistenceKind;
  incomingInterval: GenerationInterval;
  incomingShopifyCreatedAt?: Date | null;
  existenceBlocked: boolean;
  overlappingCompleted: GenerationInterval[];
  fenceGeneration?: bigint | null;
}): ExistenceDecision {
  const { stored, incomingKind, incomingInterval, identity } = input;
  const incomingLive = incomingIsLive(incomingKind);
  const terminal = isTerminalResource(identity.resourceKind);

  if (input.existenceBlocked) {
    return { mutate: false, reason: "active_blocker", diagnostic: null };
  }

  const extraOverlap = input.overlappingCompleted.some((interval) =>
    intervalsOverlap(interval, incomingInterval),
  );

  if (!stored) {
    // A completed overlapping observation that did not insert cannot freeze
    // first LIVE insert. ABSENT first insert still fails closed on overlap.
    if (extraOverlap && !incomingLive) {
      return {
        mutate: false,
        reason: "first_insert_overlapping_completed",
        diagnostic: DIAGNOSTIC.CONCURRENT_EXISTENCE,
      };
    }
    if (incomingLive) {
      return {
        mutate: true,
        nextState: "LIVE",
        nextKind: incomingKind,
        reason: "first_insert_live",
        diagnostic: null,
        deletionSource: null,
      };
    }
    // Unseen ABSENT_CONFIRMED_QUERY: preserve no canonical row. Frozen schema
    // requires live business columns / parent FKs; fabricating those values to
    // make a never-seen tombstone insertable is forbidden. Tombstone remains
    // an UPDATE of an already-inserted fact.
    return {
      mutate: false,
      reason: "first_insert_absent_preserve_no_row",
      diagnostic: null,
    };
  }

  const storedInterval = storedExistenceInterval(stored);
  const storedLive = stored.existenceState === "LIVE";

  if (incomingKind === "LIVE_FULL_SYNC_PRESENT" && storedLive) {
    return { mutate: false, reason: "presence_keep_live", diagnostic: null };
  }

  if (storedInterval && intervalsOverlap(storedInterval, incomingInterval)) {
    if (storedLive === incomingLive) {
      return { mutate: false, reason: "overlap_agree", diagnostic: null };
    }
    return {
      mutate: false,
      reason: "overlap_conflict",
      diagnostic: DIAGNOSTIC.CONCURRENT_EXISTENCE,
    };
  }

  if (extraOverlap && storedLive !== incomingLive) {
    // Terminal ABSENT + later LIVE uses the revival protocol, not LWW.
    if (!(terminal && !storedLive && incomingLive)) {
      return {
        mutate: false,
        reason: "completed_overlap_conflict",
        diagnostic: DIAGNOSTIC.CONCURRENT_EXISTENCE,
      };
    }
  }

  if (storedLive && incomingLive) {
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
      };
    }
    return { mutate: false, reason: "already_live", diagnostic: null };
  }

  if (storedLive && !incomingLive) {
    if (storedInterval && !isNonOverlappingLater(incomingInterval, storedInterval)) {
      return {
        mutate: false,
        reason: "absent_not_later",
        diagnostic: DIAGNOSTIC.CONCURRENT_EXISTENCE,
      };
    }
    return {
      mutate: true,
      nextState: "ABSENT",
      nextKind: "ABSENT_CONFIRMED_QUERY",
      reason: "tombstone",
      diagnostic: null,
      deletionSource:
        identity.resourceKind === "InventoryLevel" ? "DISCONNECT" : "CONFIRMED_QUERY",
    };
  }

  // Stored ABSENT.
  if (!incomingLive) {
    return { mutate: false, reason: "already_absent", diagnostic: null };
  }

  if (incomingKind === "LIVE_FULL_SYNC_PRESENT") {
    const fence = input.fenceGeneration;
    if (
      !terminal &&
      fence != null &&
      stored.existenceResponseGen != null &&
      fence > stored.existenceResponseGen
    ) {
      return {
        mutate: true,
        nextState: "LIVE",
        nextKind: "LIVE_FULL_SYNC_PRESENT",
        reason: "level_reconnect_full_sync",
        diagnostic: null,
        deletionSource: null,
      };
    }
    if (terminal) {
      return {
        mutate: false,
        reason: "terminal_bulk_revival_conflict",
        diagnostic: DIAGNOSTIC.TERMINAL_REVIVAL,
      };
    }
    return { mutate: false, reason: "full_sync_cannot_resurrect", diagnostic: null };
  }

  if (storedInterval && !isNonOverlappingLater(incomingInterval, storedInterval)) {
    return {
      mutate: false,
      reason: "live_not_later_than_absence",
      diagnostic: DIAGNOSTIC.CONCURRENT_EXISTENCE,
    };
  }

  if (!terminal) {
    return {
      mutate: true,
      nextState: "LIVE",
      nextKind: "LIVE_REFETCH",
      reason: "level_reconnect",
      diagnostic: null,
      deletionSource: null,
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
      openRevival: incomingInterval,
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
  };
}
