import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeWebhookPayload } from "../../../sync/sanitize.server";
import { executionStrategyForJobType } from "../../../sync/execution-strategy.server";
import { ORDER_FACTS_BULK_SUBMITTER_MODULE } from "./constants";

const SYNC_DIR = path.dirname(fileURLToPath(import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir)) {
    const full = path.join(dir, ent);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".ts") && !full.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("PR6-D safety and coherent registration", () => {
  it("does not use parseFloat or Number(amount) on the canonical D path", () => {
    for (const file of walk(SYNC_DIR)) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/\bparseFloat\s*\(/);
      expect(text).not.toMatch(/Number\(\s*amount/);
    }
  });

  it("does not contain currentBulkOperation or a duplicated bulkOperationRunQuery", () => {
    for (const file of walk(SYNC_DIR)) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/\bcurrentBulkOperation\b/);
      expect(text).not.toMatch(/mutation[^\n]*bulkOperationRunQuery/);
    }
    expect(ORDER_FACTS_BULK_SUBMITTER_MODULE).toBe(
      "app/lib/catalog-facts/ingest/bulk-operation-submitter.ts",
    );
  });

  it("registers new topics as identity-only projections", () => {
    const edited = sanitizeWebhookPayload("orders/edited", {
      order_edit: { id: 1, order_id: 9, committed_at: "2026-09-01T00:00:00Z" },
      line_items: Array.from({ length: 300 }, (_, i) => ({ id: i })),
    });
    expect(edited.schemaVersion).toBe("webhook-projection-orders-edited-v1");
    expect(edited.projection).not.toHaveProperty("line_items");

    const deleted = sanitizeWebhookPayload("orders/delete", { id: 42 });
    expect(deleted.schemaVersion).toBe("webhook-projection-orders-delete-v1");
    expect(deleted.projection.id).toBe(42);

    const txn = sanitizeWebhookPayload("order_transactions/create", {
      id: 3,
      order_id: 9,
      status: "success",
      payment_details: { credit_card_number: "1" },
    });
    expect(txn.schemaVersion).toBe(
      "webhook-projection-order-transactions-create-v1",
    );
    expect(txn.projection).not.toHaveProperty("payment_details");
  });

  it("keeps frozen v1 orders/create line arrays and 250-line bound", () => {
    const ok = sanitizeWebhookPayload("orders/create", {
      id: 1,
      line_items: [{ variant_id: 2, quantity: 1, price: "1.00" }],
    });
    expect(ok.schemaVersion).toBe("webhook-projection-orders-create-v1");
    expect(Array.isArray(ok.projection.line_items)).toBe(true);
    expect(() =>
      sanitizeWebhookPayload("orders/create", {
        id: 1,
        line_items: Array.from({ length: 251 }, (_, i) => ({
          variant_id: i + 1,
          quantity: 1,
          price: "1.00",
        })),
      }),
    ).toThrow(/line_items exceeds max 250/);
  });

  it("registers rebuildable strategies for D jobs and atomic receipts for new topics", () => {
    expect(executionStrategyForJobType("order-facts-sync")).toBe(
      "REBUILDABLE_IDEMPOTENT",
    );
    expect(executionStrategyForJobType("order-facts-reconcile")).toBe(
      "REBUILDABLE_IDEMPOTENT",
    );
    expect(executionStrategyForJobType("webhook:orders/edited")).toBe(
      "ATOMIC_APPLICATION_RECEIPT",
    );
    expect(executionStrategyForJobType("webhook:orders/delete")).toBe(
      "ATOMIC_APPLICATION_RECEIPT",
    );
    expect(
      executionStrategyForJobType("webhook:order_transactions/create"),
    ).toBe("ATOMIC_APPLICATION_RECEIPT");
    expect(executionStrategyForJobType("order-facts-unknown")).toBe(
      "NO_AUTOMATIC_RETRY",
    );
  });

  it("does not load ids or grouped indexes as a whole JavaScript string", () => {
    const sourceStage = readFileSync(path.join(SYNC_DIR, "source-stage.ts"), "utf8");
    expect(sourceStage).not.toMatch(/readFile\([^)]*idsPath/);
    expect(sourceStage).not.toMatch(/readFile\([^)]*groupedPath/);
    expect(sourceStage).not.toMatch(/new Set</);
  });

  it("does not keep pending checkpoint ordinals in an in-memory Set", () => {
    const importer = readFileSync(path.join(SYNC_DIR, "import.ts"), "utf8");
    expect(importer).not.toMatch(/pendingCommitted/);
    expect(importer).toMatch(/DiskOrdinalAck/);
  });
});
