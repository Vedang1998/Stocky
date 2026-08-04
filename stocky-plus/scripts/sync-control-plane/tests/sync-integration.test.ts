/**
 * Lightweight sync scripts smoke tests (no DB).
 * Full DB integration lives in app/sync/__tests__/sync-control-plane.integration.test.ts
 */
import { describe, expect, it } from "vitest";
import { SYNC_SURFACES } from "../manifest";
import { assertTransition } from "../../../app/sync/state-machine.server";
import { SyncControlPlaneError } from "../../../app/sync/errors";

describe("sync inventory manifest", () => {
  it("lists required control-plane tables", () => {
    const tables = SYNC_SURFACES.filter((s) => s.kind === "control_plane_table");
    expect(tables.map((t) => t.symbol).sort()).toEqual(
      [
        "DeadLetter",
        "DataIssue",
        "DurableJob",
        "JobAttempt",
        "JobDispatch",
        "JobReplay",
        "ReconciliationRun",
        "SyncCursor",
        "SyncHealth",
        "SyncRun",
        "WebhookDelivery",
      ].sort(),
    );
  });

  it("includes durable producers and replay", () => {
    expect(
      SYNC_SURFACES.some((s) => s.symbol === "ingestAuthenticatedWebhook"),
    ).toBe(true);
    expect(SYNC_SURFACES.some((s) => s.symbol === "replayDeadLetter")).toBe(
      true,
    );
    expect(SYNC_SURFACES.some((s) => s.symbol === "dispatchPendingJobs")).toBe(
      true,
    );
  });
});

describe("state machine drift guard", () => {
  it("rejects illegal transition", () => {
    expect(() => assertTransition("PENDING", "SUCCEEDED")).toThrow(
      SyncControlPlaneError,
    );
  });
});
