import { describe, expect, it } from "vitest";
import { adjudicateNullObserved, grantHandlesFromWebhookPayloadCurrent } from "./existence-adjudication";

describe("PR6-D null_observed adjudication", () => {
  const base = {
    nullObserved: true,
    queryCompleted: true,
    observedAt: new Date("2026-09-01T00:00:00.000Z"),
    processedAt: new Date("2026-08-20T00:00:00.000Z"),
    shopifyCreatedAt: new Date("2026-08-20T00:00:00.000Z"),
    currentScopes: ["read_orders"],
    lastConfirmedScopes: ["read_orders"],
    storedKind: null,
    storedState: null,
    storedDeletedAt: null,
    deleteWebhook: false,
    hasReadAllOrders: false,
  };

  it("confirms in-window absence with scope continuity", () => {
    const result = adjudicateNullObserved(base);
    expect(result).toMatchObject({
      apply: true,
      existenceKind: "ABSENT_CONFIRMED_QUERY",
    });
  });

  it("does not overwrite an established confirmed-query tombstone", () => {
    const result = adjudicateNullObserved({
      ...base,
      storedKind: "ABSENT_CONFIRMED_QUERY",
      storedState: "ABSENT",
    });
    expect(result.apply).toBe(false);
    if (!result.apply) {
      expect(result.reason).toBe("preserve_established_tombstone");
    }
  });

  it("does not overwrite an unverified-delete tombstone with inaccessible", () => {
    const result = adjudicateNullObserved({
      ...base,
      observedAt: new Date("2026-12-01T00:00:00.000Z"),
      processedAt: new Date("2026-01-01T00:00:00.000Z"),
      shopifyCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
      storedKind: "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
      storedState: "ABSENT",
      storedDeletedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    expect(result.apply).toBe(false);
    if (!result.apply) {
      expect(result.reason).toBe("preserve_established_tombstone");
    }
  });

  it("marks unverified delete even when continuity would allow confirmed absence", () => {
    const result = adjudicateNullObserved({
      ...base,
      deleteWebhook: true,
    });
    expect(result).toMatchObject({
      apply: true,
      existenceKind: "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
    });
  });

  it("marks unverified delete when continuity is missing", () => {
    const result = adjudicateNullObserved({
      ...base,
      lastConfirmedScopes: null,
      deleteWebhook: true,
    });
    expect(result).toMatchObject({
      apply: true,
      existenceKind: "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
    });
  });

  it("does not overwrite an established inaccessible row", () => {
    const result = adjudicateNullObserved({
      ...base,
      observedAt: new Date("2026-12-01T00:00:00.000Z"),
      processedAt: new Date("2026-01-01T00:00:00.000Z"),
      shopifyCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
      storedKind: "INACCESSIBLE_HISTORY_WINDOW",
      storedState: "LIVE",
    });
    expect(result.apply).toBe(false);
    if (!result.apply) {
      expect(result.reason).toBe("preserve_established_tombstone");
    }
  });

  it("denies destructive absence when continuity is missing", () => {
    const result = adjudicateNullObserved({
      ...base,
      lastConfirmedScopes: null,
      deleteWebhook: false,
    });
    expect(result.apply).toBe(false);
    if (!result.apply) {
      expect(result.reason).toBe("scope_continuity_denies_absence");
    }
  });

  it("never treats scopes_update.current as granted-scope proof", () => {
    expect(() =>
      grantHandlesFromWebhookPayloadCurrent(["read_orders"]),
    ).toThrow(/not granted-scope proof/);
  });
});
