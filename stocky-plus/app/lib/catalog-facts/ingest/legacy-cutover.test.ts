import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { executionStrategyForJobType } from "../../../sync/execution-strategy.server";
import {
  BULK_POLL_INTERVAL_MS,
  BULK_POLL_MAX_ATTEMPTS,
  BULK_POLL_WALL_CLOCK_MAX_MS,
} from "../../../jobs/workers/catalog-facts/catalog-sync";

const APP = path.resolve(process.cwd(), "app");
const source = (relative: string) =>
  readFileSync(path.join(APP, relative), "utf8");

describe("PR5-F3 v1 authority cutover and continuation contracts", () => {
  it("canonical enqueue emits catalog-facts-v1 only", () => {
    const queue = source("jobs/queue.server.ts");
    expect(queue).toContain('payloadSchemaVersion: "catalog-facts-v1"');
    expect(queue).not.toContain('payloadSchemaVersion: "catalog-sync-v1"');
  });

  it("worker branches on payloadSchemaVersion and dead-letters v1 stably", () => {
    const worker = source("jobs/workers/webhook-processor.ts");
    expect(worker).toContain(
      'durable.payloadSchemaVersion !== "catalog-facts-v1"',
    );
    expect(worker).toContain("LEGACY_CATALOG_SYNC_V1_DISABLED");
  });

  it("legacy full-body catalog applicator is physically unreachable", () => {
    const legacy = source("services/shopify-sync.server.ts");
    expect(legacy).not.toMatch(/startCatalogSync|ingestBulkVariantCache/);
    expect(legacy).not.toMatch(/response\.text\s*\(/);
  });

  it("legacy current-operation poller is physically absent", () => {
    const legacy = source("services/shopify-gql.server.ts");
    expect(legacy).not.toMatch(/pollBulkOperation|StockyCurrentBulkOperation/);
    expect(legacy).not.toMatch(/\bcurrentBulkOperation\b/);
  });

  it("bulk finish is CONTROL_ONLY and never an applicator", () => {
    expect(executionStrategyForJobType("webhook:bulk_operations/finish")).toBe(
      "CONTROL_ONLY",
    );
  });

  it("all catalog resource webhooks use atomic application receipts", () => {
    for (const topic of [
      "products/create",
      "products/update",
      "products/delete",
      "inventory_items/create",
      "inventory_items/update",
      "inventory_items/delete",
      "inventory_levels/connect",
      "inventory_levels/update",
      "inventory_levels/disconnect",
      "locations/create",
      "locations/update",
      "locations/delete",
      "locations/activate",
      "locations/deactivate",
    ]) {
      expect(executionStrategyForJobType(`webhook:${topic}`)).toBe(
        "ATOMIC_APPLICATION_RECEIPT",
      );
    }
  });

  it("bulk polling uses the frozen bounded continuation ceiling", () => {
    expect(BULK_POLL_INTERVAL_MS).toBe(5_000);
    expect(BULK_POLL_MAX_ATTEMPTS).toBe(120);
    expect(BULK_POLL_WALL_CLOCK_MAX_MS).toBe(600_000);
  });

  it("fair claim SQL contains explicit webhook-class preference", () => {
    const fairClaim = source("sync/fair-claim-query.server.ts");
    expect(fairClaim).toContain("webhook_priority");
    expect(fairClaim).toContain("webhook:bulk_operations/finish");
  });
});
