/**
 * ATOMIC_APPLICATION_RECEIPT for order-fact apply.
 * Receipt insert is the FINAL write inside the tenant transaction.
 * ON CONFLICT DO NOTHING RETURNING so a unique race never aborts (25P02).
 *
 * Lock order when a receipt is bound:
 * 1. Tenant + processingEnabled (pre-lock).
 * 2. Application-key advisory lock (this module; distinct from A identity keys).
 * 3. Receipt row FOR UPDATE lookup.
 * 4. Frozen A identity advisory locks (ascending).
 * 5. processingEnabled re-check.
 * 6. Canonical DML.
 * 7. Receipt insert.
 */
import { createHash } from "node:crypto";
import { PR6_CANONICAL_ADVISORY_LOCK_TIMEOUT_MS } from "../constants";
import { orderLockPreimage } from "../lock-key";
import { ORDER_RECEIPT_SCHEMA_VERSION } from "./constants";
import {
  OrderApplyError,
  OrderApplyReceiptDigestConflictError,
  OrderApplyReceiptLockTimeoutError,
} from "./errors";
import { newFactId, queryRows, type OrderApplyDb } from "./sql";
import type { OrderApplyReceiptInput } from "./types";

export const ORDER_RECEIPT_LOCK_VERSION = "stocky-pr6-c-receipt-v1" as const;

export type ReceiptLookup = {
  id: string;
  payloadDigest: string;
};

export type ReceiptResultMetadata = {
  observationOutcomes: Array<{
    resourceKind: string;
    shopifyGid: string;
    outcome: string;
    reason: string;
  }>;
};

function isPostgresLockTimeoutError(error: unknown): boolean {
  const err = error as {
    code?: string;
    message?: string;
    meta?: { code?: string; message?: string };
  };
  const code = err.code ?? err.meta?.code;
  const message = `${err.message ?? ""} ${err.meta?.message ?? ""}`;
  return (
    code === "55P03" ||
    /canceling statement due to lock timeout/i.test(message)
  );
}

/**
 * Distinct from A identity locks. Same SHA-256 int32 pair encoding, different
 * version prefix so receipt serialization cannot mutate frozen lock primitives.
 */
export function deriveReceiptApplicationLockKey(
  shopId: string,
  applicationKey: string,
): { key1: number; key2: number; digestHex: string } {
  const preimage = orderLockPreimage([
    ORDER_RECEIPT_LOCK_VERSION,
    shopId,
    applicationKey,
  ]);
  const digest = createHash("sha256").update(preimage).digest();
  return {
    key1: digest.readInt32BE(0),
    key2: digest.readInt32BE(4),
    digestHex: digest.toString("hex"),
  };
}

export async function acquireReceiptApplicationKeyLock(
  db: OrderApplyDb,
  shopId: string,
  applicationKey: string,
  options?: { timeoutMs?: number },
): Promise<void> {
  const timeoutMs =
    options?.timeoutMs ?? PR6_CANONICAL_ADVISORY_LOCK_TIMEOUT_MS;
  const key = deriveReceiptApplicationLockKey(shopId, applicationKey);
  const priorRows = await queryRows<{ lock_timeout: string }>(db)`
    SELECT current_setting('lock_timeout') AS lock_timeout`;
  const prior = priorRows[0]?.lock_timeout;
  if (prior == null) {
    throw new OrderApplyError(
      "order_apply_receipt_lock_timeout_unreadable",
      "current_setting('lock_timeout') returned no value",
    );
  }
  await queryRows(db)`SELECT set_config('lock_timeout', ${`${timeoutMs}ms`}, true)`;
  try {
    await queryRows(db)`
      WITH _receipt_key_lock AS (
        SELECT pg_advisory_xact_lock(
          CAST(${key.key1} AS INTEGER),
          CAST(${key.key2} AS INTEGER)
        )
      )
      SELECT 1 AS acquired FROM _receipt_key_lock`;
  } catch (error) {
    if (isPostgresLockTimeoutError(error)) {
      throw new OrderApplyReceiptLockTimeoutError(timeoutMs);
    }
    throw error;
  }
  await queryRows(db)`SELECT set_config('lock_timeout', ${prior}, true)`;
}

export async function loadReceipt(
  db: OrderApplyDb,
  shopId: string,
  applicationKey: string,
): Promise<ReceiptLookup | null> {
  const rows = await queryRows<{ id: string; payloadDigest: string }>(db)`
    SELECT id, "payloadDigest"
      FROM "SyncApplicationReceipt"
     WHERE "shopId" = ${shopId}
       AND "applicationKey" = ${applicationKey}
     FOR UPDATE`;
  const row = rows[0];
  if (!row) return null;
  return { id: String(row.id), payloadDigest: String(row.payloadDigest) };
}

export async function insertReceiptFinal(
  db: OrderApplyDb,
  shopId: string,
  input: OrderApplyReceiptInput,
  resultMetadata: ReceiptResultMetadata | null = null,
): Promise<"inserted" | "already_applied"> {
  const schemaVersion =
    input.applicationSchemaVersion ?? ORDER_RECEIPT_SCHEMA_VERSION;
  const id = newFactId("ocr");
  const metadataJson = resultMetadata ? JSON.stringify(resultMetadata) : null;
  const inserted = await queryRows<{ id: string }>(db)`
    INSERT INTO "SyncApplicationReceipt" (
      id,
      "shopId",
      "applicationKey",
      "sourceJobType",
      "rootDurableJobId",
      "firstApplyingDurableJobId",
      "payloadDigest",
      "applicationSchemaVersion",
      "resultMetadata",
      "appliedAt"
    ) VALUES (
      ${id},
      ${shopId},
      ${input.applicationKey},
      ${input.sourceJobType},
      ${input.rootDurableJobId},
      ${input.applyingDurableJobId},
      ${input.payloadDigest},
      ${schemaVersion},
      ${metadataJson}::jsonb,
      clock_timestamp()
    )
    ON CONFLICT ("shopId", "applicationKey") DO NOTHING
    RETURNING id`;
  if (inserted.length === 1) return "inserted";
  const winner = await loadReceipt(db, shopId, input.applicationKey);
  if (!winner) {
    throw new OrderApplyError(
      "order_apply_receipt_uncertain",
      "Receipt conflict winner is unreadable",
    );
  }
  if (winner.payloadDigest !== input.payloadDigest) {
    throw new OrderApplyReceiptDigestConflictError();
  }
  return "already_applied";
}

export async function shortCircuitIfApplied(
  db: OrderApplyDb,
  shopId: string,
  input: OrderApplyReceiptInput,
): Promise<"continue" | "already_applied"> {
  const existing = await loadReceipt(db, shopId, input.applicationKey);
  if (!existing) return "continue";
  if (existing.payloadDigest !== input.payloadDigest) {
    throw new OrderApplyReceiptDigestConflictError();
  }
  return "already_applied";
}
