import { describe, expect, it } from "vitest";
import { buildSyncStatusView, type SyncStatusInput } from "./sync-status";

function input(
  domain: string,
  state: SyncStatusInput["state"],
  detailCode: string | null = null,
  overrides: Partial<SyncStatusInput> = {},
): SyncStatusInput {
  return {
    domain,
    state,
    detailCode,
    lastSucceededAt: "2026-11-11T08:00:00.000Z",
    syncing: false,
    ...overrides,
  };
}

describe("buildSyncStatusView", () => {
  it("labels each domain in merchant terms and keeps the given order", () => {
    const view = buildSyncStatusView([
      input("locations", "HEALTHY"),
      input("catalog", "RUNNING"),
      input("inventory_levels", "NEVER_STARTED"),
    ]);
    expect(view.rows.map((row) => [row.label, row.badge.text, row.badge.tone])).toEqual([
      ["Locations", "Up to date", "success"],
      ["Products", "Syncing", "info"],
      ["Inventory levels", "Not synced yet", "neutral"],
    ]);
    expect(view.rows[0].lastSucceededAt).toBe("2026-11-11T08:00:00.000Z");
  });

  it("raises nothing while every domain is healthy, running or not started", () => {
    const view = buildSyncStatusView([
      input("locations", "HEALTHY"),
      input("catalog", "RUNNING"),
      input("inventory_levels", "NEVER_STARTED"),
    ]);
    expect(view.attention).toBeNull();
  });

  it("reports a failed sync ahead of a degraded one", () => {
    const view = buildSyncStatusView([
      input("locations", "DEGRADED", "retry_wait"),
      input("catalog", "FAILED", "open_dead_letter"),
    ]);
    expect(view.attention).toMatchObject({
      tone: "critical",
      heading: "The last sync did not finish",
    });
  });

  it("explains a retry without asking the merchant to act", () => {
    const { attention } = buildSyncStatusView([input("catalog", "DEGRADED", "retry_wait")]);
    expect(attention?.tone).toBe("warning");
    expect(attention?.message).toContain("retrying");
  });

  it("explains unknown quantities", () => {
    const { attention } = buildSyncStatusView([
      input("inventory_levels", "DEGRADED", "authoritative_quantity_unknown"),
    ]);
    expect(attention?.message).toContain("has not reported a quantity");
  });

  it("falls back to a general message for other degraded reasons", () => {
    const { attention } = buildSyncStatusView([
      input("catalog", "DEGRADED", "catalog_ingestion_incomplete"),
    ]);
    expect(attention?.message).toBe(
      "Part of the last sync did not complete. Sync again to refresh your data.",
    );
  });

  // With removal of missing products held, the engine reports this reason
  // after every successful sync; the store tester saw it as a false warning.
  it.each(["absence_reconciliation_uncertain", "catalog_reconcile_uncertain"])(
    "shows a completed sync as up to date when the engine is only running its own check (%s)",
    (detailCode) => {
      const view = buildSyncStatusView([
        input("locations", "DEGRADED", detailCode),
        input("catalog", "DEGRADED", detailCode),
        input("inventory_levels", "DEGRADED", detailCode),
      ]);
      expect(view.rows.map((row) => row.badge)).toEqual(
        Array(3).fill({ tone: "success", text: "Up to date" }),
      );
      expect(view.attention).toBeNull();
      expect(view.inProgress).toBe(false);
    },
  );

  it("still asks for attention when that check is reported but no sync has ever succeeded", () => {
    const view = buildSyncStatusView([
      input("catalog", "DEGRADED", "absence_reconciliation_uncertain", {
        lastSucceededAt: null,
      }),
    ]);
    expect(view.rows[0].badge.text).toBe("Needs attention");
    expect(view.attention?.tone).toBe("warning");
  });

  it("keeps a real problem visible beside a domain that only has the engine's check", () => {
    const view = buildSyncStatusView([
      input("catalog", "DEGRADED", "absence_reconciliation_uncertain"),
      input("inventory_levels", "DEGRADED", "authoritative_quantity_unknown"),
    ]);
    expect(view.rows.map((row) => row.badge.text)).toEqual(["Up to date", "Needs attention"]);
    expect(view.attention?.message).toContain("has not reported a quantity");
  });

  it("shows data that is in but still being prepared as finishing, without a warning", () => {
    const view = buildSyncStatusView([
      input("catalog", "DEGRADED", "compatibility_projection_pending"),
    ]);
    expect(view.rows[0].badge).toEqual({ tone: "info", text: "Finishing up" });
    expect(view.attention).toBeNull();
  });

  it("shows a domain as syncing while a sync is under way, whatever the last result was", () => {
    const view = buildSyncStatusView([
      input("locations", "HEALTHY", "latest_succeeded"),
      input("catalog", "NEVER_STARTED", null, { lastSucceededAt: null, syncing: true }),
      input("inventory_levels", "FAILED", "failed_sync_run", { syncing: true }),
    ]);
    expect(view.rows.map((row) => row.badge.text)).toEqual([
      "Up to date",
      "Syncing",
      "Syncing",
    ]);
    expect(view.attention).toBeNull();
    expect(view.inProgress).toBe(true);
  });

  it("is not in progress once nothing is syncing", () => {
    const view = buildSyncStatusView([
      input("catalog", "HEALTHY"),
      input("inventory_levels", "NEVER_STARTED", null, { lastSucceededAt: null }),
    ]);
    expect(view.inProgress).toBe(false);
  });

  it("never shows an internal reason code to the merchant", () => {
    const view = buildSyncStatusView([
      input("catalog", "FAILED", "open_dead_letter"),
      input("locations", "DEGRADED", "inconclusive_history"),
    ]);
    const text = JSON.stringify(view);
    expect(text).not.toContain("open_dead_letter");
    expect(text).not.toContain("inconclusive_history");
  });

  it("shows a paused shop as paused without raising an alert", () => {
    const view = buildSyncStatusView([input("catalog", "DISABLED", "shop_processing_disabled")]);
    expect(view.rows[0].badge).toEqual({ tone: "neutral", text: "Paused" });
    expect(view.attention).toBeNull();
  });

  it("does not claim a paused shop is syncing because a job is still queued", () => {
    const view = buildSyncStatusView([
      input("catalog", "DISABLED", "shop_processing_disabled", { syncing: true }),
    ]);
    expect(view.rows[0].badge.text).toBe("Paused");
    expect(view.inProgress).toBe(false);
  });
});
