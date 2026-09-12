import { describe, expect, it } from "vitest";
import {
  accessScopeSetsEqual,
  decideOrderExistence,
  encodeRevivalConfirmation,
  mergeAccessScopeFloor,
  scopeContinuityAllowsAbsence,
} from "./existence";
import { DIAGNOSTIC } from "./types";

const interval = { requestGen: 1n, responseGen: 2n };
const later = { requestGen: 3n, responseGen: 4n };
const observedAt = new Date("2026-09-11T00:00:00.000Z");
const inWindowProcessedAt = new Date("2026-08-01T00:00:00.000Z");
const agedOutProcessedAt = new Date("2026-01-01T00:00:00.000Z");

const liveStored = {
  existenceState: "LIVE" as const,
  existenceKind: "LIVE_REFETCH",
  existenceRequestGen: 1n,
  existenceResponseGen: 2n,
  shopifyCreatedAt: new Date("2026-08-01T00:00:00.000Z"),
  processedAt: inWindowProcessedAt,
  deletedAt: null,
  deletionSource: null,
  existenceDiagnosticState: null,
  historyWindowState: null,
  accessScopeSnapshot: ["read_orders"],
};

describe("PR6-C existence / window / revival", () => {
  it("does not tombstone aged-out null (T41)", () => {
    const decision = decideOrderExistence({
      stored: { ...liveStored, processedAt: agedOutProcessedAt },
      incomingKind: "ABSENT_CONFIRMED_QUERY",
      incomingInterval: later,
      existenceObservedAt: observedAt,
      existenceBlocked: false,
      overlappingCompleted: [],
      queryCompleted: true,
      queryReturnedNull: true,
      currentScopes: ["read_orders"],
    });
    expect(decision.mutate).toBe(true);
    if (decision.mutate) {
      expect(decision.nextKind).toBe("INACCESSIBLE_HISTORY_WINDOW");
      expect(decision.deletedAtNow).toBe(false);
      expect(decision.nextState).toBe("LIVE");
    }
  });

  it("tombstones in-window completed null (T42)", () => {
    const decision = decideOrderExistence({
      stored: liveStored,
      incomingKind: "ABSENT_CONFIRMED_QUERY",
      incomingInterval: later,
      existenceObservedAt: observedAt,
      existenceBlocked: false,
      overlappingCompleted: [],
      queryCompleted: true,
      queryReturnedNull: true,
      currentScopes: ["read_orders"],
      lastConfirmedScopes: ["read_orders"],
    });
    expect(decision.mutate).toBe(true);
    if (decision.mutate) {
      expect(decision.nextKind).toBe("ABSENT_CONFIRMED_QUERY");
      expect(decision.deletedAtNow).toBe(true);
      expect(decision.deletionSource).toBe("CONFIRMED_QUERY");
    }
  });

  it("encodes unverified delete with WEBHOOK deletionSource (T43)", () => {
    const decision = decideOrderExistence({
      stored: liveStored,
      incomingKind: "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
      incomingInterval: later,
      existenceObservedAt: observedAt,
      existenceBlocked: false,
      overlappingCompleted: [],
      currentScopes: ["read_orders"],
    });
    expect(decision.mutate).toBe(true);
    if (decision.mutate) {
      expect(decision.nextKind).toBe("ABSENT_SIGNALLED_DELETE_UNVERIFIED");
      expect(decision.deletionSource).toBe("WEBHOOK");
      expect(decision.deletedAtNow).toBe(true);
    }
  });

  it("does not erase a confirmed tombstone when history later becomes inaccessible", () => {
    const decision = decideOrderExistence({
      stored: {
        ...liveStored,
        existenceState: "ABSENT",
        existenceKind: "ABSENT_CONFIRMED_QUERY",
        deletedAt: observedAt,
        deletionSource: "CONFIRMED_QUERY",
      },
      incomingKind: "INACCESSIBLE_HISTORY_WINDOW",
      incomingInterval: later,
      existenceObservedAt: observedAt,
      existenceBlocked: false,
      overlappingCompleted: [],
      currentScopes: ["read_orders"],
    });
    expect(decision.mutate).toBe(false);
    expect(decision.diagnostic).toBe(DIAGNOSTIC.EXISTENCE_UNVERIFIABLE);
  });

  it("records the first LIVE confirmation without reviving (two-step revival)", () => {
    const decision = decideOrderExistence({
      stored: {
        ...liveStored,
        existenceState: "ABSENT",
        existenceKind: "ABSENT_CONFIRMED_QUERY",
        deletedAt: observedAt,
        deletionSource: "CONFIRMED_QUERY",
      },
      incomingKind: "LIVE_REFETCH",
      incomingInterval: later,
      incomingShopifyCreatedAt: liveStored.shopifyCreatedAt,
      existenceObservedAt: observedAt,
      existenceBlocked: false,
      overlappingCompleted: [],
      currentScopes: ["read_orders"],
    });
    expect(decision.mutate).toBe(false);
    expect(decision.reason).toBe("terminal_first_confirmation");
    expect(decision.diagnostic).toBe(encodeRevivalConfirmation(later));
  });

  it("rejects overlapping second confirmations", () => {
    const first = encodeRevivalConfirmation(later);
    const overlap = { requestGen: 3n, responseGen: 5n };
    const decision = decideOrderExistence({
      stored: {
        ...liveStored,
        existenceState: "ABSENT",
        existenceKind: "ABSENT_CONFIRMED_QUERY",
        deletedAt: observedAt,
        deletionSource: "CONFIRMED_QUERY",
        existenceDiagnosticState: first,
        existenceRequestGen: 1n,
        existenceResponseGen: 2n,
      },
      incomingKind: "LIVE_REFETCH",
      incomingInterval: overlap,
      incomingShopifyCreatedAt: liveStored.shopifyCreatedAt,
      existenceObservedAt: observedAt,
      existenceBlocked: false,
      overlappingCompleted: [],
      currentScopes: ["read_orders"],
    });
    expect(decision.mutate).toBe(false);
    expect(decision.reason).toBe("terminal_overlapping_confirmations");
  });

  it("revives after a second non-overlapping LIVE confirmation", () => {
    const first = encodeRevivalConfirmation(later);
    const second = { requestGen: 5n, responseGen: 6n };
    const decision = decideOrderExistence({
      stored: {
        ...liveStored,
        existenceState: "ABSENT",
        existenceKind: "ABSENT_CONFIRMED_QUERY",
        deletedAt: observedAt,
        deletionSource: "CONFIRMED_QUERY",
        existenceDiagnosticState: first,
      },
      incomingKind: "LIVE_REFETCH",
      incomingInterval: second,
      incomingShopifyCreatedAt: liveStored.shopifyCreatedAt,
      existenceObservedAt: observedAt,
      existenceBlocked: false,
      overlappingCompleted: [],
      currentScopes: ["read_orders"],
    });
    expect(decision.mutate).toBe(true);
    if (decision.mutate) {
      expect(decision.nextState).toBe("LIVE");
      expect(decision.nextKind).toBe("LIVE_REFETCH");
      expect(decision.reason).toBe("terminal_revival");
    }
  });

  it("voids absence authority on scope downgrade (T50)", () => {
    const continuity = scopeContinuityAllowsAbsence({
      currentScopes: ["read_orders"],
      lastConfirmedScopes: ["read_orders", "read_all_orders"],
    });
    expect(continuity.ok).toBe(false);
    const decision = decideOrderExistence({
      stored: liveStored,
      incomingKind: "ABSENT_CONFIRMED_QUERY",
      incomingInterval: later,
      existenceObservedAt: observedAt,
      existenceBlocked: false,
      overlappingCompleted: [],
      queryCompleted: true,
      queryReturnedNull: true,
      currentScopes: ["read_orders"],
      lastConfirmedScopes: ["read_orders", "read_all_orders"],
    });
    expect(decision.mutate).toBe(false);
    expect(decision.diagnostic).toBe(DIAGNOSTIC.SCOPE_DOWNGRADE);
  });

  it("does not fabricate a first-insert tombstone", () => {
    const decision = decideOrderExistence({
      stored: null,
      incomingKind: "ABSENT_CONFIRMED_QUERY",
      incomingInterval: interval,
      existenceObservedAt: observedAt,
      existenceBlocked: false,
      overlappingCompleted: [],
      queryCompleted: true,
      queryReturnedNull: true,
      currentScopes: ["read_orders"],
    });
    expect(decision.mutate).toBe(false);
    expect(decision.reason).toBe("first_insert_absent_preserve_no_row");
  });

  it("advances a later LIVE presence interval (F-02)", () => {
    const decision = decideOrderExistence({
      stored: liveStored,
      incomingKind: "LIVE_REFETCH",
      incomingInterval: { requestGen: 9n, responseGen: 10n },
      existenceObservedAt: observedAt,
      existenceBlocked: false,
      overlappingCompleted: [],
      currentScopes: ["read_orders"],
    });
    expect(decision.mutate).toBe(true);
    if (decision.mutate) {
      expect(decision.reason).toBe("advance_live_presence_interval");
      expect(decision.nextState).toBe("LIVE");
      expect(decision.deletedAtNow).toBe(false);
    }
  });

  it("does not rewind an older LIVE interval (F-02 negative)", () => {
    const decision = decideOrderExistence({
      stored: {
        ...liveStored,
        existenceRequestGen: 9n,
        existenceResponseGen: 10n,
      },
      incomingKind: "LIVE_REFETCH",
      incomingInterval: { requestGen: 3n, responseGen: 4n },
      existenceObservedAt: observedAt,
      existenceBlocked: false,
      overlappingCompleted: [],
      currentScopes: ["read_orders"],
    });
    expect(decision.mutate).toBe(false);
    expect(decision.reason).toBe("already_live");
  });

  it("rejects delayed older ABSENT after a later LIVE interval (F-02)", () => {
    const decision = decideOrderExistence({
      stored: {
        ...liveStored,
        existenceRequestGen: 9n,
        existenceResponseGen: 10n,
      },
      incomingKind: "ABSENT_CONFIRMED_QUERY",
      incomingInterval: { requestGen: 5n, responseGen: 6n },
      existenceObservedAt: observedAt,
      existenceBlocked: false,
      overlappingCompleted: [],
      queryCompleted: true,
      queryReturnedNull: true,
      currentScopes: ["read_orders"],
      lastConfirmedScopes: ["read_orders"],
    });
    expect(decision.mutate).toBe(false);
    expect(decision.reason).toBe("absent_not_later");
    expect(decision.diagnostic).toBe(DIAGNOSTIC.CONCURRENT_EXISTENCE);
  });

  it("treats persisted scopes as a floor when lastConfirmed is empty (F-05)", () => {
    expect(
      mergeAccessScopeFloor([], ["read_orders", "read_all_orders"]),
    ).toEqual(["read_orders", "read_all_orders"]);
    const decision = decideOrderExistence({
      stored: {
        ...liveStored,
        accessScopeSnapshot: ["read_orders", "read_all_orders"],
      },
      incomingKind: "ABSENT_CONFIRMED_QUERY",
      incomingInterval: later,
      existenceObservedAt: observedAt,
      existenceBlocked: false,
      overlappingCompleted: [],
      queryCompleted: true,
      queryReturnedNull: true,
      currentScopes: ["read_orders"],
      lastConfirmedScopes: [],
    });
    expect(decision.mutate).toBe(false);
    expect(decision.diagnostic).toBe(DIAGNOSTIC.SCOPE_DOWNGRADE);
  });

  it("still tombstones when persisted floor lacks read_all_orders (F-05 negative)", () => {
    const decision = decideOrderExistence({
      stored: liveStored,
      incomingKind: "ABSENT_CONFIRMED_QUERY",
      incomingInterval: later,
      existenceObservedAt: observedAt,
      existenceBlocked: false,
      overlappingCompleted: [],
      queryCompleted: true,
      queryReturnedNull: true,
      currentScopes: ["read_orders"],
      lastConfirmedScopes: [],
    });
    expect(decision.mutate).toBe(true);
    if (decision.mutate) {
      expect(decision.nextKind).toBe("ABSENT_CONFIRMED_QUERY");
    }
  });

  it("compares access-scope snapshots as sets", () => {
    expect(
      accessScopeSetsEqual(
        ["read_orders", "read_all_orders"],
        ["read_all_orders", "read_orders"],
      ),
    ).toBe(true);
    expect(
      accessScopeSetsEqual(["read_orders"], ["read_orders", "read_all_orders"]),
    ).toBe(false);
  });
});
