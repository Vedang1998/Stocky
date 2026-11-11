import { Prisma } from "@prisma/client";
import type { TenantDb } from "../../tenant/tenant-db.server";
import {
  InventoryOperationConflictError,
  InventoryOperationNotFoundError,
  InventoryOperationValidationError,
} from "./errors";
import {
  inventoryOperationPayloadDigest,
  normalizeInventoryOperationDraft,
} from "./payload";
import type {
  ForwardInventoryOperationKind,
  InventoryActor,
  InventoryOperationDraft,
  InventoryOperationKind,
  InventoryOperationLineResult,
  InventoryOperationResult,
  InventoryOperationStatus,
  NormalizedInventoryOperationDraft,
} from "./types";

/** Columns read back for results; never includes lease internals. */
const OPERATION_SELECT = {
  id: true,
  idempotencyKey: true,
  payloadDigest: true,
  kind: true,
  writeCapability: true,
  sourceType: true,
  sourceId: true,
  reason: true,
  quantityName: true,
  status: true,
  lineCount: true,
  appliedLineCount: true,
  failedLineCount: true,
  conflictLineCount: true,
  lastErrorCode: true,
  lastErrorMessage: true,
  completedAt: true,
  createdAt: true,
} as const;

const LINE_SELECT = {
  id: true,
  lineNumber: true,
  inventoryItemGid: true,
  variantGid: true,
  locationGid: true,
  delta: true,
  changeFromQuantity: true,
  status: true,
  quantityAfterChange: true,
  errorCode: true,
  errorMessage: true,
} as const;

export interface InventoryOperationRecord {
  id: string;
  idempotencyKey: string;
  payloadDigest: string;
  kind: InventoryOperationKind;
  writeCapability: string;
  sourceType: string;
  sourceId: string;
  reason: string;
  quantityName: string;
  status: InventoryOperationStatus;
  lineCount: number;
  appliedLineCount: number;
  failedLineCount: number;
  conflictLineCount: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  completedAt: Date | null;
  createdAt: Date;
}

interface LineRow {
  id: string;
  lineNumber: number;
  inventoryItemGid: string;
  variantGid: string | null;
  locationGid: string;
  delta: number;
  changeFromQuantity: number | null;
  status: InventoryOperationLineResult["status"];
  quantityAfterChange: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

function toLineResult(row: LineRow): InventoryOperationLineResult {
  return {
    lineId: row.id,
    lineNumber: row.lineNumber,
    inventoryItemId: row.inventoryItemGid,
    variantId: row.variantGid,
    locationId: row.locationGid,
    delta: row.delta,
    changeFromQuantity: row.changeFromQuantity,
    status: row.status,
    quantityAfterChange: row.quantityAfterChange,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
  };
}

/**
 * Every location must be an active location of this shop and every inventory
 * item must belong to this shop, according to the synced catalog facts.
 * Shopify would also reject foreign IDs, but checking first keeps rejected
 * input out of the ledger and gives the merchant a precise message.
 */
async function assertTargetsBelongToShop(
  db: TenantDb,
  draft: NormalizedInventoryOperationDraft,
): Promise<void> {
  const locationIds = [...new Set(draft.lines.map((l) => l.locationId))];
  const itemIds = [...new Set(draft.lines.map((l) => l.inventoryItemId))];

  const [locations, items] = await Promise.all([
    db.shopifyLocationFact.findMany({
      where: { shopifyGid: { in: locationIds }, existenceState: "LIVE" },
      select: { shopifyGid: true, isActive: true },
    }) as Promise<Array<{ shopifyGid: string; isActive: boolean }>>,
    db.shopifyInventoryItemFact.findMany({
      where: { shopifyGid: { in: itemIds }, existenceState: "LIVE" },
      select: { shopifyGid: true },
    }) as Promise<Array<{ shopifyGid: string }>>,
  ]);

  const issues: string[] = [];
  const activeLocations = new Set(
    locations.filter((l) => l.isActive).map((l) => l.shopifyGid),
  );
  const inactive = new Set(
    locations.filter((l) => !l.isActive).map((l) => l.shopifyGid),
  );
  for (const id of locationIds) {
    if (inactive.has(id)) {
      issues.push(`Location ${id} is deactivated`);
    } else if (!activeLocations.has(id)) {
      issues.push(`Location ${id} is not a synced location of this shop`);
    }
  }
  const knownItems = new Set(items.map((i) => i.shopifyGid));
  const unknownItems = itemIds.filter((id) => !knownItems.has(id));
  if (unknownItems.length > 0) {
    const shown = unknownItems.slice(0, 5).join(", ");
    const more =
      unknownItems.length > 5 ? ` and ${unknownItems.length - 5} more` : "";
    issues.push(
      `Inventory items not synced for this shop: ${shown}${more}. Run a catalog sync and try again.`,
    );
  }
  if (issues.length > 0) {
    throw new InventoryOperationValidationError(issues[0], issues);
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

async function findByIdempotencyKey(
  db: TenantDb,
  idempotencyKey: string,
): Promise<InventoryOperationRecord | null> {
  return (await db.inventoryOperation.findFirst({
    where: { idempotencyKey },
    select: OPERATION_SELECT,
  })) as InventoryOperationRecord | null;
}

function assertSamePayload(
  existing: InventoryOperationRecord,
  digest: string,
): InventoryOperationRecord {
  if (existing.payloadDigest !== digest) {
    throw new InventoryOperationConflictError(
      existing.idempotencyKey,
      existing.id,
    );
  }
  return existing;
}

async function persist(
  db: TenantDb,
  draft: NormalizedInventoryOperationDraft,
): Promise<{ operation: InventoryOperationRecord; created: boolean }> {
  const digest = inventoryOperationPayloadDigest(draft);

  const existing = await findByIdempotencyKey(db, draft.idempotencyKey);
  if (existing) {
    return { operation: assertSamePayload(existing, digest), created: false };
  }

  await assertTargetsBelongToShop(db, draft);

  try {
    const operation = await db.$transaction(async (tx) => {
      const created = (await tx.inventoryOperation.create({
        data: {
          idempotencyKey: draft.idempotencyKey,
          payloadDigest: digest,
          kind: draft.kind,
          writeCapability: draft.capability,
          sourceType: draft.source.type,
          sourceId: draft.source.id,
          reason: draft.reason,
          quantityName: draft.quantityName,
          referenceDocumentUri: draft.referenceDocumentUri,
          actorShopifyUserId: draft.actor.shopifyUserId,
          actorDisplayName: draft.actor.displayName,
          actorChannel: draft.actor.channel,
          note: draft.note,
          reversesOperationId: draft.reversesOperationId,
          lineCount: draft.lines.length,
        },
        select: OPERATION_SELECT,
      })) as InventoryOperationRecord;
      await tx.inventoryOperationLine.createMany({
        data: draft.lines.map((line, index) => ({
          operationId: created.id,
          lineNumber: index + 1,
          inventoryItemGid: line.inventoryItemId,
          variantGid: line.variantId,
          locationGid: line.locationId,
          delta: line.delta,
          changeFromQuantity: line.changeFromQuantity,
        })),
      });
      return created;
    });
    return { operation, created: true };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // A concurrent request recorded the same key first.
    const winner = await findByIdempotencyKey(db, draft.idempotencyKey);
    if (!winner) throw err;
    return { operation: assertSamePayload(winner, digest), created: false };
  }
}

/**
 * Record an inventory write before anything is sent to Shopify. Idempotent on
 * (shop, idempotencyKey): the same key with the same payload returns the
 * existing operation (created=false); a different payload throws
 * InventoryOperationConflictError. Call executeInventoryOperation to apply it.
 */
export async function recordInventoryOperation(
  db: TenantDb,
  draft: InventoryOperationDraft,
): Promise<{ operation: InventoryOperationRecord; created: boolean }> {
  return persist(db, normalizeInventoryOperationDraft(draft));
}

export async function getInventoryOperationResult(
  db: TenantDb,
  operationId: string,
): Promise<InventoryOperationResult> {
  const operation = (await db.inventoryOperation.findFirst({
    where: { id: operationId },
    select: OPERATION_SELECT,
  })) as InventoryOperationRecord | null;
  if (!operation) throw new InventoryOperationNotFoundError(operationId);

  const lines = (await db.inventoryOperationLine.findMany({
    where: { operationId },
    select: LINE_SELECT,
    orderBy: { lineNumber: "asc" },
  })) as LineRow[];

  return {
    operationId: operation.id,
    idempotencyKey: operation.idempotencyKey,
    kind: operation.kind,
    status: operation.status,
    lineCount: operation.lineCount,
    appliedLineCount: operation.appliedLineCount,
    failedLineCount: operation.failedLineCount,
    conflictLineCount: operation.conflictLineCount,
    lastErrorCode: operation.lastErrorCode,
    lastErrorMessage: operation.lastErrorMessage,
    completedAt: operation.completedAt,
    lines: lines.map(toLineResult),
  };
}

/** Operations recorded for one business document, newest first. */
export async function listInventoryOperationsForSource(
  db: TenantDb,
  source: { type: string; id: string },
): Promise<InventoryOperationRecord[]> {
  return (await db.inventoryOperation.findMany({
    where: { sourceType: source.type, sourceId: source.id },
    select: OPERATION_SELECT,
    orderBy: { createdAt: "desc" },
  })) as InventoryOperationRecord[];
}

/**
 * Reverse the applied lines of a finished operation by recording the exact
 * opposite deltas as a REVERSAL operation.
 *
 * Policy: only APPLIED or PARTIALLY_APPLIED operations can be reversed, only
 * their APPLIED lines are reversed, a reversal cannot itself be reversed, and
 * each operation can be reversed once (the key is derived from its ID).
 * Reversal deltas are relative and skip compare-and-swap: undoing "+5" must
 * subtract 5 even if sales moved the quantity since.
 */
export async function recordInventoryReversal(
  db: TenantDb,
  input: { operationId: string; actor: InventoryActor; note: string | null },
): Promise<{ operation: InventoryOperationRecord; created: boolean }> {
  const original = (await db.inventoryOperation.findFirst({
    where: { id: input.operationId },
    select: { ...OPERATION_SELECT, referenceDocumentUri: true },
  })) as
    (InventoryOperationRecord & { referenceDocumentUri: string | null }) | null;
  if (!original) throw new InventoryOperationNotFoundError(input.operationId);

  if (original.kind === "REVERSAL") {
    throw new InventoryOperationValidationError(
      "A reversal cannot be reversed. Record a new adjustment instead.",
    );
  }
  if (
    original.status !== "APPLIED" &&
    original.status !== "PARTIALLY_APPLIED"
  ) {
    throw new InventoryOperationValidationError(
      "Only applied inventory changes can be reversed.",
    );
  }

  const applied = (await db.inventoryOperationLine.findMany({
    where: { operationId: original.id, status: "APPLIED" },
    select: LINE_SELECT,
    orderBy: { lineNumber: "asc" },
  })) as LineRow[];
  if (applied.length === 0) {
    throw new InventoryOperationValidationError(
      "This change has no applied lines to reverse.",
    );
  }

  const draft = normalizeInventoryOperationDraft(
    {
      kind: original.kind as ForwardInventoryOperationKind,
      idempotencyKey: `reversal:${original.id}`,
      source: { type: original.sourceType, id: original.sourceId },
      reason: "correction",
      quantityName:
        original.quantityName as InventoryOperationDraft["quantityName"],
      referenceDocumentUri: original.referenceDocumentUri,
      actor: input.actor,
      note: input.note,
      lines: applied.map((line) => ({
        inventoryItemId: line.inventoryItemGid,
        variantId: line.variantGid,
        locationId: line.locationGid,
        delta: -line.delta,
        changeFromQuantity: null,
      })),
    },
    original.id,
  );
  return persist(db, draft);
}
