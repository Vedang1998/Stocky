import type { TenantDb } from "../../tenant/tenant-db.server";
import type { AdminGraphQLClient } from "../shopify-gql.server";
import {
  InventoryDocumentClosedError,
  InventoryOperationValidationError,
} from "./errors";
import {
  executeInventoryOperation,
  type ExecuteInventoryOperationOptions,
} from "./execute.server";
import { recordInventoryOperation } from "./ledger.server";
import {
  TERMINAL_OPERATION_STATUSES,
  type AdjustableQuantityName,
  type ForwardInventoryOperationKind,
  type InventoryActor,
  type InventoryOperationLineDraft,
  type InventoryOperationResult,
  type InventoryOperationStatus,
  type ShopifyInventoryReason,
} from "./types";

/**
 * A business document (one stocktake, one transfer shipment, …) described by
 * the net change it should have made to each inventory level once it is fully
 * applied. The ledger is compared against this, so applying a document twice
 * finds nothing left to send.
 */
export interface InventoryDocument {
  kind: ForwardInventoryOperationKind;
  source: { type: string; id: string };
  reason: ShopifyInventoryReason;
  quantityName: AdjustableQuantityName;
  referenceDocumentUri: string | null;
  /** At most one entry per item and location. `delta` may be 0. */
  desired: InventoryOperationLineDraft[];
}

export interface SettleInventoryDocumentInput extends InventoryDocument {
  actor: InventoryActor;
  note: string | null;
  /**
   * Locks the document's own row and reports whether it still accepts stock
   * changes. It runs in the transaction that records each new operation, so
   * the document cannot close between the check and the record.
   */
  holdOpen: (tx: TenantDb) => Promise<boolean>;
}

export interface DocumentLedgerState {
  /** Operations recorded for the document so far. */
  operationCount: number;
  /** An operation Shopify has not finished answering; it must be resumed first. */
  unfinishedOperationId: string | null;
  /** Changes still needed for the applied net to equal `desired`. */
  outstanding: InventoryOperationLineDraft[];
}

export interface SettleResult {
  /** True when nothing is unfinished and nothing is outstanding. */
  settled: boolean;
  /** The last operation executed by this call, if any. */
  operation: InventoryOperationResult | null;
  outstanding: InventoryOperationLineDraft[];
}

const levelKey = (inventoryItemId: string, locationId: string) =>
  `${inventoryItemId}|${locationId}`;

/**
 * Compare a document with what the ledger has applied for it. Reversals count
 * because they are recorded under the same source with opposite deltas.
 */
export async function readDocumentLedgerState(
  db: TenantDb,
  document: InventoryDocument,
): Promise<DocumentLedgerState> {
  const desired = new Map<string, InventoryOperationLineDraft>();
  for (const line of document.desired) {
    const key = levelKey(line.inventoryItemId, line.locationId);
    if (desired.has(key)) {
      throw new InventoryOperationValidationError(
        `More than one change for inventory item ${line.inventoryItemId} at ${line.locationId}`,
      );
    }
    desired.set(key, line);
  }

  const operations = (await db.inventoryOperation.findMany({
    where: {
      sourceType: document.source.type,
      sourceId: document.source.id,
    },
    select: { id: true, status: true },
    orderBy: { createdAt: "asc" },
  })) as Array<{ id: string; status: InventoryOperationStatus }>;

  const appliedLines =
    operations.length === 0
      ? []
      : ((await db.inventoryOperationLine.findMany({
          where: {
            operationId: { in: operations.map((o) => o.id) },
            status: "APPLIED",
          },
          select: {
            inventoryItemGid: true,
            variantGid: true,
            locationGid: true,
            delta: true,
          },
        })) as Array<{
          inventoryItemGid: string;
          variantGid: string | null;
          locationGid: string;
          delta: number;
        }>);

  const applied = new Map<
    string,
    {
      inventoryItemId: string;
      variantId: string | null;
      locationId: string;
      net: number;
    }
  >();
  for (const line of appliedLines) {
    const key = levelKey(line.inventoryItemGid, line.locationGid);
    const entry = applied.get(key);
    if (entry) {
      entry.net += line.delta;
    } else {
      applied.set(key, {
        inventoryItemId: line.inventoryItemGid,
        variantId: line.variantGid,
        locationId: line.locationGid,
        net: line.delta,
      });
    }
  }

  const outstanding: InventoryOperationLineDraft[] = [];
  for (const [key, line] of desired) {
    const delta = line.delta - (applied.get(key)?.net ?? 0);
    if (delta !== 0) outstanding.push({ ...line, delta });
  }
  // A level the document no longer asks for but that was already changed is
  // put back, e.g. a count corrected to the expected quantity after a retry.
  for (const [key, entry] of applied) {
    if (!desired.has(key) && entry.net !== 0) {
      outstanding.push({
        inventoryItemId: entry.inventoryItemId,
        variantId: entry.variantId,
        locationId: entry.locationId,
        delta: -entry.net,
        changeFromQuantity: null,
      });
    }
  }

  return {
    operationCount: operations.length,
    unfinishedOperationId:
      operations.find((o) => !TERMINAL_OPERATION_STATUSES.has(o.status))?.id ??
      null,
    outstanding,
  };
}

/**
 * Bring Shopify in line with a document: resume the operation that is still
 * unfinished, otherwise record and execute one for whatever is outstanding.
 *
 * Each attempt gets the next key in the document's sequence, so two requests
 * racing on the same state record the same operation and only one of them
 * sends it. If the document changed between two racing requests the second
 * one fails with InventoryOperationConflictError and nothing extra is sent.
 * A document that closed first fails with InventoryDocumentClosedError.
 */
export async function settleInventoryDocument(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  input: SettleInventoryDocumentInput,
  options: ExecuteInventoryOperationOptions = {},
): Promise<SettleResult> {
  let executed: InventoryOperationResult | null = null;

  // Two rounds at most: finish what was in flight, then send what remains.
  for (let round = 0; round < 2; round += 1) {
    const state = await readDocumentLedgerState(db, input);
    let operationId = state.unfinishedOperationId;
    if (!operationId) {
      if (state.outstanding.length === 0) break;
      const { operation } = await recordInventoryOperation(
        db,
        {
          kind: input.kind,
          idempotencyKey: `${input.source.type}:${input.source.id}:${state.operationCount + 1}`,
          source: input.source,
          reason: input.reason,
          quantityName: input.quantityName,
          referenceDocumentUri: input.referenceDocumentUri,
          actor: input.actor,
          note: input.note,
          lines: state.outstanding,
        },
        {
          guard: async (tx) => {
            if (!(await input.holdOpen(tx))) {
              throw new InventoryDocumentClosedError(input.source);
            }
          },
        },
      );
      operationId = operation.id;
    }
    executed = await executeInventoryOperation(db, admin, operationId, options);
    if (executed.status !== "APPLIED") break;
  }

  const final = await readDocumentLedgerState(db, input);
  return {
    settled:
      final.unfinishedOperationId === null && final.outstanding.length === 0,
    operation: executed,
    outstanding: final.outstanding,
  };
}

export interface DocumentLineProblem {
  shopifyVariantId: string;
  title: string;
  message: string;
}

/** The lines Shopify refused in an operation, named the way the merchant knows them. */
export function describeLineProblems(
  operation: InventoryOperationResult | null,
  lineByItem: Map<string, { shopifyVariantId: string; title: string }>,
): DocumentLineProblem[] {
  if (!operation) return [];
  return operation.lines
    .filter((l) => l.status === "FAILED" || l.status === "CONFLICT")
    .map((l) => {
      const line = lineByItem.get(l.inventoryItemId);
      return {
        shopifyVariantId: line?.shopifyVariantId ?? l.variantId ?? "",
        title: line?.title ?? l.inventoryItemId,
        message:
          l.status === "CONFLICT"
            ? "Shopify's quantity changed after this was prepared."
            : (l.errorMessage ?? "Shopify rejected this change."),
      };
    });
}

/** Merchant-facing explanation of why a document is not settled yet. */
export function describeUnsettled(result: SettleResult): string {
  const operation = result.operation;
  if (!operation) {
    return "Shopify has not confirmed every change yet. Try again.";
  }
  switch (operation.status) {
    case "BLOCKED":
      return "Inventory changes are switched off for this app, so nothing was sent to Shopify.";
    case "PENDING":
    case "APPLYING":
    case "RETRY_PENDING":
      return operation.lastErrorCode === "WRITE_CAPABILITY_DISABLED"
        ? "Inventory changes were switched off part-way through. Lines already confirmed by Shopify are recorded; try again once changes are enabled."
        : "Shopify has not confirmed every change yet. Lines already confirmed are recorded and will not be sent again. Try again in a moment.";
    case "PARTIALLY_APPLIED":
    case "FAILED": {
      const rejected = operation.failedLineCount + operation.conflictLineCount;
      return `Shopify did not accept ${rejected} of ${operation.lineCount} changes. Lines it accepted are recorded and will not be sent again.`;
    }
    case "APPLIED":
      return "The document changed while it was being applied. Review it and try again.";
  }
}
