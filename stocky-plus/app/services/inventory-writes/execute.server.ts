import { randomUUID } from "node:crypto";
import {
  isInventoryWriteEnabled,
  type InventoryWriteCapability,
} from "../../lib/feature-flags.server";
import type { TenantDb } from "../../tenant/tenant-db.server";
import type { AdminGraphQLClient } from "../shopify-gql.server";
import { InventoryOperationNotFoundError } from "./errors";
import { getInventoryOperationResult } from "./ledger.server";
import {
  createShopifyAdjustSender,
  type AdjustBatchError,
  type AdjustBatchOutcome,
  type AdjustBatchRequest,
  type SendAdjustBatch,
} from "./shopify-adjust.server";
import {
  TERMINAL_OPERATION_STATUSES,
  type AdjustableQuantityName,
  type InventoryOperationLineStatus,
  type InventoryOperationResult,
  type InventoryOperationStatus,
} from "./types";

export const DEFAULT_BATCH_SIZE = 100;
/** Shopify accepts at most 250 changes per inventoryAdjustQuantities call. */
export const MAX_BATCH_SIZE = 250;
const DEFAULT_LEASE_MS = 60_000;
const DEFAULT_DEADLINE_MS = 20_000;

/**
 * Shopify recorded this key as failed, so nothing was applied under it and the
 * same changes must go out under a new key. IDEMPOTENCY_KEY_PARAMETER_MISMATCH
 * is deliberately not here: an IN_FLIGHT batch is always resent unchanged, so
 * a mismatch means the ledger and Shopify disagree about what the key carried
 * and the batch is failed for review instead of being sent again.
 */
const REBATCH_ERROR_CODES = new Set(["IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED"]);

const CAPABILITY_DISABLED = "WRITE_CAPABILITY_DISABLED";

export interface ExecuteInventoryOperationOptions {
  /** Replaces the Shopify sender (tests). */
  sendBatch?: SendAdjustBatch;
  /** Replaces the environment kill switches (tests). */
  isCapabilityEnabled?: (capability: InventoryWriteCapability) => boolean;
  now?: () => Date;
  batchSize?: number;
  leaseMs?: number;
  /**
   * Wall-clock budget for this call. Unfinished work stays RETRY_PENDING and
   * the next call resumes it, so a request handler never runs unbounded.
   */
  deadlineMs?: number;
}

interface OperationHead {
  id: string;
  status: InventoryOperationStatus;
  writeCapability: string;
  reason: string;
  quantityName: string;
  referenceDocumentUri: string | null;
  lineCount: number;
}

interface BatchLine {
  id: string;
  inventoryItemGid: string;
  locationGid: string;
  delta: number;
  changeFromQuantity: number | null;
}

interface Batch {
  key: string;
  lines: BatchLine[];
}

const BATCH_LINE_SELECT = {
  id: true,
  inventoryItemGid: true,
  locationGid: true,
  delta: true,
  changeFromQuantity: true,
} as const;

/**
 * The quantity a level holds once a change is applied. Shopify does not
 * always report it. A compare-and-swap change was applied on exactly the
 * quantity it named, so its result is known either way; a relative change
 * without a report stays unknown rather than guessed.
 */
function quantityAfter(
  line: { delta: number; changeFromQuantity: number | null },
  reported: number | null | undefined,
): number | null {
  if (typeof reported === "number") return reported;
  return line.changeFromQuantity === null
    ? null
    : line.changeFromQuantity + line.delta;
}

function batchKey(operationId: string, sequence: number): string {
  return `propo-inv:${operationId}:${sequence}`;
}

/** Ledger document Shopify requires for non-`available` quantity names. */
function ledgerDocumentUri(
  operationId: string,
  quantityName: string,
): string | null {
  return quantityName === "available"
    ? null
    : `gid://propo/InventoryOperation/${operationId}`;
}

function joinErrors(errors: AdjustBatchError[]): {
  code: string;
  message: string;
} {
  return {
    code: errors[0]?.code ?? "REJECTED",
    message: errors
      .map((e) => e.message)
      .join("; ")
      .slice(0, 1000),
  };
}

/**
 * Apply a recorded inventory operation to Shopify.
 *
 * Guarantees:
 * - nothing is sent while the operation's kill switch is off;
 * - one executor at a time (lease on the operation row);
 * - every batch is written ahead as IN_FLIGHT with its idempotency key before
 *   it is sent, and an unconfirmed batch is only ever resent with that same
 *   key and identical changes, so a lost response cannot double-apply;
 * - a line is APPLIED only when Shopify returned the adjustment group;
 * - the operation is APPLIED only when every line is.
 *
 * Safe to call repeatedly; a terminal operation is returned unchanged.
 */
export async function executeInventoryOperation(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  operationId: string,
  options: ExecuteInventoryOperationOptions = {},
): Promise<InventoryOperationResult> {
  const clock = options.now ?? (() => new Date());
  const isEnabled = options.isCapabilityEnabled ?? isInventoryWriteEnabled;
  const batchSize = Math.min(
    Math.max(1, Math.floor(options.batchSize ?? DEFAULT_BATCH_SIZE)),
    MAX_BATCH_SIZE,
  );
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
  const deadline =
    clock().getTime() + (options.deadlineMs ?? DEFAULT_DEADLINE_MS);

  const op = (await db.inventoryOperation.findFirst({
    where: { id: operationId },
    select: {
      id: true,
      status: true,
      writeCapability: true,
      reason: true,
      quantityName: true,
      referenceDocumentUri: true,
      lineCount: true,
    },
  })) as OperationHead | null;
  if (!op) throw new InventoryOperationNotFoundError(operationId);
  if (TERMINAL_OPERATION_STATUSES.has(op.status)) {
    return getInventoryOperationResult(db, op.id);
  }

  const capability = op.writeCapability as InventoryWriteCapability;
  const disabledMessage = `Inventory writes for ${capability} are switched off. Nothing was sent to Shopify.`;

  if (!isEnabled(capability)) {
    await db.inventoryOperation.updateMany({
      where: { id: op.id, status: { in: ["PENDING", "BLOCKED"] } },
      data: {
        status: "BLOCKED",
        lastErrorCode: CAPABILITY_DISABLED,
        lastErrorMessage: disabledMessage,
      },
    });
    await db.inventoryOperation.updateMany({
      where: { id: op.id, status: "RETRY_PENDING" },
      data: {
        lastErrorCode: CAPABILITY_DISABLED,
        lastErrorMessage: disabledMessage,
      },
    });
    return getInventoryOperationResult(db, op.id);
  }

  if (!options.sendBatch && !admin) {
    throw new Error("executeInventoryOperation requires an Admin API client");
  }
  const send = options.sendBatch ?? createShopifyAdjustSender(admin!);
  const owner = randomUUID();

  const claimedAt = clock();
  const claim = await db.inventoryOperation.updateMany({
    where: {
      id: op.id,
      status: { in: ["PENDING", "RETRY_PENDING", "BLOCKED", "APPLYING"] },
      OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: claimedAt } }],
    },
    data: {
      status: "APPLYING",
      leaseOwner: owner,
      leaseExpiresAt: new Date(claimedAt.getTime() + leaseMs),
      attemptCount: { increment: 1 },
      lastAttemptAt: claimedAt,
    },
  });
  if (claim.count !== 1) {
    // Another executor holds a live lease; report what is recorded now.
    return getInventoryOperationResult(db, op.id);
  }

  async function holdLease(tx: TenantDb): Promise<boolean> {
    const renewed = await tx.inventoryOperation.updateMany({
      where: { id: op!.id, leaseOwner: owner, status: "APPLYING" },
      data: { leaseExpiresAt: new Date(clock().getTime() + leaseMs) },
    });
    return renewed.count === 1;
  }

  async function nextBatch(): Promise<Batch | "lease_lost" | null> {
    const inFlight = (await db.inventoryOperationLine.findFirst({
      where: { operationId: op!.id, status: "IN_FLIGHT" },
      select: { batchKey: true },
      orderBy: { lineNumber: "asc" },
    })) as { batchKey: string } | null;
    if (inFlight) {
      const lines = (await db.inventoryOperationLine.findMany({
        where: {
          operationId: op!.id,
          status: "IN_FLIGHT",
          batchKey: inFlight.batchKey,
        },
        select: BATCH_LINE_SELECT,
        orderBy: { lineNumber: "asc" },
      })) as BatchLine[];
      return { key: inFlight.batchKey, lines };
    }

    const pending = (await db.inventoryOperationLine.findMany({
      where: { operationId: op!.id, status: "PENDING" },
      select: BATCH_LINE_SELECT,
      orderBy: { lineNumber: "asc" },
      take: batchSize,
    })) as BatchLine[];
    if (pending.length === 0) return null;

    return db.$transaction(async (tx) => {
      if (!(await holdLease(tx))) return "lease_lost" as const;
      const bumped = (await tx.inventoryOperation.update({
        where: { id: op!.id },
        data: { batchSequence: { increment: 1 } },
        select: { batchSequence: true },
      })) as { batchSequence: number };
      const key = batchKey(op!.id, bumped.batchSequence);
      const marked = await tx.inventoryOperationLine.updateMany({
        where: {
          operationId: op!.id,
          status: "PENDING",
          id: { in: pending.map((line) => line.id) },
        },
        data: { status: "IN_FLIGHT", batchKey: key },
      });
      if (marked.count !== pending.length) {
        throw new Error("Inventory operation lines changed while batching");
      }
      return { key, lines: pending };
    });
  }

  async function recordOutcome(
    batch: Batch,
    outcome: AdjustBatchOutcome,
  ): Promise<boolean> {
    return db.$transaction(async (tx) => {
      if (!(await holdLease(tx))) return false;
      const now = clock();

      if (outcome.kind === "applied") {
        const afterByLevel = new Map(
          outcome.changes.map((c) => [
            `${c.inventoryItemId}|${c.locationId}`,
            c.quantityAfterChange,
          ]),
        );
        for (const line of batch.lines) {
          await tx.inventoryOperationLine.update({
            where: { id: line.id },
            data: {
              status: "APPLIED",
              appliedAt: now,
              shopifyAdjustmentGroupGid: outcome.adjustmentGroupId,
              quantityAfterChange: quantityAfter(
                line,
                afterByLevel.get(
                  `${line.inventoryItemGid}|${line.locationGid}`,
                ),
              ),
              errorCode: null,
              errorMessage: null,
            },
          });
        }
        return true;
      }

      if (outcome.kind === "retry") {
        await tx.inventoryOperation.updateMany({
          where: { id: op!.id, leaseOwner: owner },
          data: {
            lastErrorCode: outcome.code,
            lastErrorMessage: outcome.message,
          },
        });
        return true;
      }

      const byLine = new Map<number, AdjustBatchError[]>();
      for (const error of outcome.errors) {
        if (error.changeIndex === null) continue;
        const list = byLine.get(error.changeIndex) ?? [];
        list.push(error);
        byLine.set(error.changeIndex, list);
      }
      const summary = joinErrors(outcome.errors);

      if (byLine.size > 0) {
        // Shopify applied nothing; the attributed lines are final and the rest
        // go back to PENDING to be sent again under a new key.
        for (const [index, errors] of byLine) {
          const line = batch.lines[index];
          const joined = joinErrors(errors);
          const stale = errors.some(
            (e) => e.code === "CHANGE_FROM_QUANTITY_STALE",
          );
          await tx.inventoryOperationLine.update({
            where: { id: line.id },
            data: {
              status: stale ? "CONFLICT" : "FAILED",
              errorCode: stale ? "CHANGE_FROM_QUANTITY_STALE" : joined.code,
              errorMessage: joined.message,
            },
          });
        }
        await tx.inventoryOperationLine.updateMany({
          where: {
            operationId: op!.id,
            status: "IN_FLIGHT",
            batchKey: batch.key,
          },
          data: { status: "PENDING", batchKey: null },
        });
      } else if (outcome.errors.every((e) => REBATCH_ERROR_CODES.has(e.code))) {
        await tx.inventoryOperationLine.updateMany({
          where: {
            operationId: op!.id,
            status: "IN_FLIGHT",
            batchKey: batch.key,
          },
          data: { status: "PENDING", batchKey: null },
        });
      } else {
        await tx.inventoryOperationLine.updateMany({
          where: {
            operationId: op!.id,
            status: "IN_FLIGHT",
            batchKey: batch.key,
          },
          data: {
            status: "FAILED",
            errorCode: summary.code,
            errorMessage: summary.message,
          },
        });
      }
      await tx.inventoryOperation.updateMany({
        where: { id: op!.id, leaseOwner: owner },
        data: {
          lastErrorCode: summary.code,
          lastErrorMessage: summary.message,
        },
      });
      return true;
    });
  }

  // Each send either finalizes at least one line or stops the run, except a
  // key-level rebatch; the cap bounds a pathological sequence of those.
  const maxSends = op.lineCount + 2 * Math.ceil(op.lineCount / batchSize) + 5;
  let sends = 0;
  let stoppedByKillSwitch = false;

  while (clock().getTime() < deadline && sends < maxSends) {
    if (!isEnabled(capability)) {
      stoppedByKillSwitch = true;
      break;
    }
    const batch = await nextBatch();
    if (batch === null) break;
    if (batch === "lease_lost") return getInventoryOperationResult(db, op.id);

    const request: AdjustBatchRequest = {
      idempotencyKey: batch.key,
      reason: op.reason,
      quantityName: op.quantityName as AdjustableQuantityName,
      referenceDocumentUri: op.referenceDocumentUri,
      ledgerDocumentUri: ledgerDocumentUri(op.id, op.quantityName),
      changes: batch.lines.map((line) => ({
        inventoryItemId: line.inventoryItemGid,
        locationId: line.locationGid,
        delta: line.delta,
        changeFromQuantity: line.changeFromQuantity,
      })),
    };
    sends += 1;
    const outcome = await send(request);
    if (!(await recordOutcome(batch, outcome))) {
      return getInventoryOperationResult(db, op.id);
    }
    if (outcome.kind === "retry") break;
  }

  await finalize(db, op, owner, clock(), stoppedByKillSwitch, disabledMessage);
  return getInventoryOperationResult(db, op.id);
}

async function countLines(
  db: TenantDb,
  operationId: string,
): Promise<Record<InventoryOperationLineStatus, number>> {
  const statuses: InventoryOperationLineStatus[] = [
    "PENDING",
    "IN_FLIGHT",
    "APPLIED",
    "FAILED",
    "CONFLICT",
  ];
  const counts = await Promise.all(
    statuses.map(
      (status) =>
        db.inventoryOperationLine.count({
          where: { operationId, status },
        }) as Promise<number>,
    ),
  );
  return Object.fromEntries(
    statuses.map((status, i) => [status, counts[i]]),
  ) as Record<InventoryOperationLineStatus, number>;
}

async function finalize(
  db: TenantDb,
  op: OperationHead,
  owner: string,
  now: Date,
  stoppedByKillSwitch: boolean,
  disabledMessage: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const counts = await countLines(tx, op.id);
    const unfinished = counts.PENDING + counts.IN_FLIGHT;

    let status: InventoryOperationStatus;
    if (unfinished > 0) {
      status =
        stoppedByKillSwitch && counts.PENDING === op.lineCount
          ? "BLOCKED"
          : "RETRY_PENDING";
    } else if (counts.APPLIED === op.lineCount) {
      status = "APPLIED";
    } else if (counts.APPLIED > 0) {
      status = "PARTIALLY_APPLIED";
    } else {
      status = "FAILED";
    }
    const terminal = TERMINAL_OPERATION_STATUSES.has(status);

    await tx.inventoryOperation.updateMany({
      where: { id: op.id, leaseOwner: owner, status: "APPLYING" },
      data: {
        status,
        appliedLineCount: counts.APPLIED,
        failedLineCount: counts.FAILED,
        conflictLineCount: counts.CONFLICT,
        completedAt: terminal ? now : null,
        leaseOwner: null,
        leaseExpiresAt: null,
        ...(status === "APPLIED"
          ? { lastErrorCode: null, lastErrorMessage: null }
          : {}),
        ...(stoppedByKillSwitch
          ? {
              lastErrorCode: CAPABILITY_DISABLED,
              lastErrorMessage: disabledMessage,
            }
          : {}),
      },
    });
  });
}
