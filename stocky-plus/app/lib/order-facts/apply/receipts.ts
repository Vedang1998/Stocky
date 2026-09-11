/**
 * ATOMIC_APPLICATION_RECEIPT for order-fact apply.
 * Receipt insert is the FINAL write inside the tenant transaction.
 * ON CONFLICT DO NOTHING RETURNING so a unique race never aborts (25P02).
 */
import { ORDER_RECEIPT_SCHEMA_VERSION } from "./constants";
import {
  OrderApplyReceiptDigestConflictError,
  OrderApplyError,
} from "./errors";
import { newFactId, queryRows, type OrderApplyDb } from "./sql";
import type { OrderApplyReceiptInput } from "./types";

export type ReceiptLookup = {
  id: string;
  payloadDigest: string;
};

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
): Promise<"inserted" | "already_applied"> {
  const schemaVersion =
    input.applicationSchemaVersion ?? ORDER_RECEIPT_SCHEMA_VERSION;
  const id = newFactId("ocr");
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
      NULL,
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
