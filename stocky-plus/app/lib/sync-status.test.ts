import { describe, expect, it } from "vitest";
import { buildSyncStatusView, type SyncStatusInput } from "./sync-status";

function input(
  domain: string,
  state: SyncStatusInput["state"],
  detailCode: string | null = null,
): SyncStatusInput {
  return { domain, state, detailCode, lastSucceededAt: "2026-11-11T08:00:00.000Z" };
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
      input("catalog", "DEGRADED", "compatibility_projection_pending"),
    ]);
    expect(attention?.message).toBe(
      "Part of the last sync did not complete. Sync again to refresh your data.",
    );
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
});
