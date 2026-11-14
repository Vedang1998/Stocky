import { isInventoryWriteEnabled } from "../../lib/feature-flags.server";
import type { TenantDb } from "../../tenant/tenant-db.server";
import type { AdminGraphQLClient } from "../shopify-gql.server";
import {
  InventoryOperationConflictError,
  InventoryOperationValidationError,
} from "../inventory-writes/errors";
import {
  executeInventoryOperation,
  type ExecuteInventoryOperationOptions,
} from "../inventory-writes/execute.server";
import {
  recordInventoryOperation,
  recordInventoryReversal,
} from "../inventory-writes/ledger.server";
import { findActiveLocationIds } from "../inventory-writes/locations.server";
import {
  describeLineProblems,
  type DocumentLineProblem,
} from "../inventory-writes/settle.server";
import {
  createAvailableQuantityReader,
  type ReadAvailableQuantities,
} from "../inventory-writes/shopify-levels.server";
import {
  TERMINAL_OPERATION_STATUSES,
  type InventoryActor,
  type InventoryOperationLineDraft,
  type InventoryOperationLineStatus,
  type InventoryOperationResult,
  type InventoryOperationStatus,
} from "../inventory-writes/types";
import {
  findVariantsByCode,
  findVariantsByInventoryItem,
  ledgerVariantId,
  variantsMatchingCode,
  type CatalogVariant,
} from "../inventory-writes/variant-items.server";
import {
  MAX_ADJUSTMENT_NOTE_LENGTH,
  isAdjustmentMode,
  isAdjustmentReason,
  parseAdjustmentLines,
  type AdjustmentMode,
  type AdjustmentReasonCode,
} from "./adjustment-input";

export const ADJUSTMENT_SOURCE_TYPE = "InventoryAdjustment";

const SUBMISSION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SWITCHED_OFF_MESSAGE =
  "Inventory adjustments are switched off for this app. Nothing was sent to Shopify.";

export interface AdjustmentOptions extends ExecuteInventoryOperationOptions {
  /** Live read of Shopify's available quantities; defaults to the Admin API. */
  readAvailable?: ReadAvailableQuantities;
}

export interface SubmitAdjustmentInput {
  /** Generated when the form was rendered; one per intended adjustment. */
  submissionId: string | null;
  locationId: string | null;
  reason: unknown;
  mode: unknown;
  note: string | null;
  /** Pasted lines: `SKU or barcode, quantity`. */
  linesText: string;
}

export type AdjustmentResult =
  | {
      ok: true;
      operationId: string | null;
      changedLineCount: number;
      /** The same submission was already recorded; nothing new was sent. */
      alreadySubmitted: boolean;
    }
  | {
      ok: false;
      error: string;
      details: string[];
      problems: DocumentLineProblem[];
      /**
       * True when the adjustment is in the ledger. Its lines must then not be
       * offered for re-entry as they were: some of them may be applied.
       */
      recorded: boolean;
      /** Set when the adjustment is recorded but Shopify has not confirmed all of it. */
      unfinishedOperationId: string | null;
    };

const fail = (
  error: string,
  extra: Partial<{
    details: string[];
    problems: DocumentLineProblem[];
    recorded: boolean;
    unfinishedOperationId: string | null;
  }> = {},
): AdjustmentResult => ({
  ok: false,
  error,
  details: extra.details ?? [],
  problems: extra.problems ?? [],
  recorded: extra.recorded ?? Boolean(extra.unfinishedOperationId),
  unfinishedOperationId: extra.unfinishedOperationId ?? null,
});

function isSwitchedOn(options: AdjustmentOptions): boolean {
  return (options.isCapabilityEnabled ?? isInventoryWriteEnabled)(
    "adjustmentWrites",
  );
}

/** Turn what the ledger recorded for an operation into what the merchant is told. */
async function describeOutcome(
  db: TenantDb,
  result: InventoryOperationResult,
  alreadySubmitted: boolean,
): Promise<AdjustmentResult> {
  if (result.status === "APPLIED") {
    return {
      ok: true,
      operationId: result.operationId,
      changedLineCount: result.appliedLineCount,
      alreadySubmitted,
    };
  }
  if (result.status === "BLOCKED") {
    return fail(SWITCHED_OFF_MESSAGE, {
      unfinishedOperationId: result.operationId,
    });
  }
  if (result.status === "APPLYING") {
    // Another request holds this operation and is sending it; there may be
    // nothing left to finish once it is done.
    return fail(
      "This adjustment is being sent to Shopify right now, possibly by another request. Changes Shopify has confirmed are not sent twice. Reload the page in a moment to see the result.",
      { unfinishedOperationId: result.operationId },
    );
  }
  if (!TERMINAL_OPERATION_STATUSES.has(result.status)) {
    return fail(
      "Shopify has not confirmed every change yet. Changes it confirmed are recorded and will not be sent again. Use Finish applying to send the rest.",
      { unfinishedOperationId: result.operationId },
    );
  }

  const variants = await findVariantsByInventoryItem(
    db,
    result.lines.map((line) => line.inventoryItemId),
  );
  const rejected = result.failedLineCount + result.conflictLineCount;
  return fail(
    `Shopify did not accept ${rejected} of ${result.lineCount} changes. ${
      result.appliedLineCount > 0
        ? "The others are applied."
        : "Nothing was changed."
    } Enter the lines below again as a new adjustment.`,
    { problems: describeLineProblems(result, variants), recorded: true },
  );
}

async function findAdjustmentOperation(
  db: TenantDb,
  where: Record<string, unknown>,
): Promise<{
  id: string;
  kind: string;
  status: InventoryOperationStatus;
} | null> {
  return (await db.inventoryOperation.findFirst({
    where: { ...where, sourceType: ADJUSTMENT_SOURCE_TYPE },
    select: { id: true, kind: true, status: true },
  })) as { id: string; kind: string; status: InventoryOperationStatus } | null;
}

/**
 * Record and apply one adjustment: a set of quantity changes at one location
 * with a reason, by a named staff member.
 *
 * The submission ID makes the form safe to submit twice: the second request
 * finds the recorded operation and returns its result without reading or
 * changing anything else.
 */
export async function submitAdjustment(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  actor: InventoryActor,
  input: SubmitAdjustmentInput,
  options: AdjustmentOptions = {},
): Promise<AdjustmentResult> {
  const { submissionId } = input;
  if (!submissionId || !SUBMISSION_ID.test(submissionId)) {
    return fail("Reload the page and enter the adjustment again.");
  }

  const existing = await findAdjustmentOperation(db, {
    sourceId: submissionId,
    kind: "ADJUSTMENT",
  });
  if (existing) {
    return describeOutcome(
      db,
      await executeInventoryOperation(db, admin, existing.id, options),
      true,
    );
  }

  if (!isSwitchedOn(options)) return fail(SWITCHED_OFF_MESSAGE);

  if (!input.locationId) return fail("Choose a location.");
  if (!isAdjustmentReason(input.reason)) return fail("Choose a reason.");
  if (!isAdjustmentMode(input.mode)) {
    return fail("Choose whether to change the quantity or set it.");
  }
  const reason: AdjustmentReasonCode = input.reason;
  const mode: AdjustmentMode = input.mode;
  const note = input.note?.trim() ?? "";
  if (note.length > MAX_ADJUSTMENT_NOTE_LENGTH) {
    return fail(
      `The note can be at most ${MAX_ADJUSTMENT_NOTE_LENGTH} characters.`,
    );
  }

  const parsed = parseAdjustmentLines(input.linesText, mode);
  if (!parsed.ok) {
    return fail("Some lines could not be read. Nothing was changed.", {
      details: parsed.errors,
    });
  }

  const active = await findActiveLocationIds(db, [input.locationId]);
  if (!active.has(input.locationId)) {
    return fail(
      "That location is not an active, synced location of this shop. Run a sync from the dashboard, then try again.",
    );
  }

  const catalog = await findVariantsByCode(
    db,
    parsed.lines.map((line) => line.code),
  );
  const details: string[] = [];
  const lineOfVariant = new Map<string, number>();
  const resolved: Array<{ variant: CatalogVariant; quantity: number }> = [];
  for (const line of parsed.lines) {
    const matches = variantsMatchingCode(catalog, line.code);
    if (matches.length === 0) {
      details.push(
        `Line ${line.lineNumber}: no variant has the SKU or barcode ${line.code}.`,
      );
      continue;
    }
    if (matches.length > 1) {
      details.push(
        `Line ${line.lineNumber}: ${line.code} matches ${matches.length} variants (${matches
          .slice(0, 3)
          .map((v) => v.title)
          .join(
            ", ",
          )}${matches.length > 3 ? ", …" : ""}). Use a barcode or SKU that only one variant has.`,
      );
      continue;
    }
    const [variant] = matches;
    const firstLine = lineOfVariant.get(variant.shopifyVariantId);
    if (firstLine !== undefined) {
      details.push(
        `Line ${line.lineNumber}: ${variant.title} is already on line ${firstLine}.`,
      );
      continue;
    }
    lineOfVariant.set(variant.shopifyVariantId, line.lineNumber);
    if (!variant.inventoryItemId) {
      details.push(
        `Line ${line.lineNumber}: Shopify inventory is not linked yet for ${variant.title}. Run a catalog sync from the dashboard.`,
      );
      continue;
    }
    resolved.push({ variant, quantity: line.quantity });
  }
  if (details.length > 0) {
    return fail("Some lines could not be matched. Nothing was changed.", {
      details,
    });
  }

  const lines: InventoryOperationLineDraft[] = [];
  if (mode === "ADJUST") {
    for (const { variant, quantity } of resolved) {
      lines.push({
        inventoryItemId: variant.inventoryItemId!,
        variantId: ledgerVariantId(variant.shopifyVariantId),
        locationId: input.locationId,
        delta: quantity,
        changeFromQuantity: null,
      });
    }
  } else {
    const readAvailable =
      options.readAvailable ??
      (admin ? createAvailableQuantityReader(admin) : null);
    if (!readAvailable) {
      return fail("Shopify could not be reached. Nothing was changed.");
    }
    let current: Map<string, number | null>;
    try {
      current = await readAvailable(
        input.locationId,
        resolved.map(({ variant }) => variant.inventoryItemId!),
      );
    } catch {
      return fail(
        "Shopify's current quantities could not be read. Nothing was changed. Try again in a moment.",
      );
    }
    for (const { variant, quantity } of resolved) {
      const available = current.get(variant.inventoryItemId!) ?? null;
      if (available === null) {
        details.push(
          `${variant.title} is not stocked at this location in Shopify. Stock it there first, or adjust it at another location.`,
        );
        continue;
      }
      if (available === quantity) continue;
      lines.push({
        inventoryItemId: variant.inventoryItemId!,
        variantId: ledgerVariantId(variant.shopifyVariantId),
        locationId: input.locationId,
        delta: quantity - available,
        // Refuse the change if Shopify's quantity moves before it lands.
        changeFromQuantity: available,
      });
    }
    if (details.length > 0) {
      return fail("Some quantities could not be set. Nothing was changed.", {
        details,
      });
    }
    if (lines.length === 0) {
      return {
        ok: true,
        operationId: null,
        changedLineCount: 0,
        alreadySubmitted: false,
      };
    }
  }

  let operationId: string;
  let created: boolean;
  try {
    const recorded = await recordInventoryOperation(db, {
      kind: "ADJUSTMENT",
      idempotencyKey: `adjustment:${submissionId}`,
      source: { type: ADJUSTMENT_SOURCE_TYPE, id: submissionId },
      reason,
      quantityName: "available",
      referenceDocumentUri: `gid://propo/InventoryAdjustment/${submissionId}`,
      actor,
      note: note || null,
      lines,
    });
    operationId = recorded.operation.id;
    created = recorded.created;
  } catch (err) {
    if (err instanceof InventoryOperationConflictError) {
      // A second press of the same form read different live quantities; the
      // first one is the adjustment.
      operationId = err.existingOperationId;
      created = false;
    } else if (err instanceof InventoryOperationValidationError) {
      return fail(err.message);
    } else {
      throw err;
    }
  }

  return describeOutcome(
    db,
    await executeInventoryOperation(db, admin, operationId, options),
    !created,
  );
}

/** Send what Shopify has not confirmed yet for a recorded adjustment or reversal. */
export async function resumeAdjustment(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  operationId: string,
  options: AdjustmentOptions = {},
): Promise<AdjustmentResult> {
  const operation = await findAdjustmentOperation(db, { id: operationId });
  if (!operation) return fail("Adjustment not found");
  return describeOutcome(
    db,
    await executeInventoryOperation(db, admin, operation.id, options),
    true,
  );
}

/**
 * Undo an adjustment by applying the opposite of its applied lines. Each
 * adjustment can be reversed once; a reversal cannot be reversed.
 */
export async function reverseAdjustment(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  actor: InventoryActor,
  input: { operationId: string; note: string | null },
  options: AdjustmentOptions = {},
): Promise<AdjustmentResult> {
  const operation = await findAdjustmentOperation(db, {
    id: input.operationId,
    kind: "ADJUSTMENT",
  });
  if (!operation) return fail("Adjustment not found");
  if (!isSwitchedOn(options)) return fail(SWITCHED_OFF_MESSAGE);

  const note = input.note?.trim() ?? "";
  if (note.length > MAX_ADJUSTMENT_NOTE_LENGTH) {
    return fail(
      `The note can be at most ${MAX_ADJUSTMENT_NOTE_LENGTH} characters.`,
    );
  }

  let reversal;
  try {
    reversal = await recordInventoryReversal(db, {
      operationId: operation.id,
      actor,
      note: note || null,
    });
  } catch (err) {
    if (err instanceof InventoryOperationValidationError) {
      return fail(err.message);
    }
    throw err;
  }
  return describeOutcome(
    db,
    await executeInventoryOperation(db, admin, reversal.operation.id, options),
    !reversal.created,
  );
}

export interface AdjustmentHistoryLine {
  title: string;
  sku: string | null;
  delta: number;
  status: InventoryOperationLineStatus;
  quantityAfterChange: number | null;
  errorMessage: string | null;
}

export interface AdjustmentHistoryEntry {
  operationId: string;
  kind: "ADJUSTMENT" | "REVERSAL";
  status: InventoryOperationStatus;
  reason: string;
  note: string | null;
  staffId: string | null;
  locationId: string | null;
  createdAt: Date;
  completedAt: Date | null;
  /** For a reversal: the adjustment it undoes. */
  reversesOperationId: string | null;
  /** For an adjustment: the reversal recorded for it, if any. */
  reversedByOperationId: string | null;
  canReverse: boolean;
  canResume: boolean;
  lines: AdjustmentHistoryLine[];
}

interface HistoryOperationRow {
  id: string;
  kind: "ADJUSTMENT" | "REVERSAL";
  status: InventoryOperationStatus;
  reason: string;
  note: string | null;
  actorShopifyUserId: string | null;
  reversesOperationId: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

interface HistoryLineRow {
  operationId: string;
  inventoryItemGid: string;
  locationGid: string;
  delta: number;
  status: InventoryOperationLineStatus;
  quantityAfterChange: number | null;
  errorMessage: string | null;
}

export const ADJUSTMENT_HISTORY_PAGE_SIZE = 25;

/** Position of the last entry of a page; the next page starts after it. */
export interface AdjustmentCursor {
  createdAt: Date;
  operationId: string;
}

export interface AdjustmentHistoryFilter {
  /** Inclusive bounds on when the adjustment was recorded. */
  from?: Date | null;
  to?: Date | null;
  after?: AdjustmentCursor | null;
  take?: number;
}

/** Adjustments and their reversals, newest first. */
export async function listAdjustments(
  db: TenantDb,
  filter: AdjustmentHistoryFilter = {},
): Promise<AdjustmentHistoryEntry[]> {
  const conditions: Array<Record<string, unknown>> = [];
  if (filter.from) conditions.push({ createdAt: { gte: filter.from } });
  if (filter.to) conditions.push({ createdAt: { lte: filter.to } });
  if (filter.after) {
    conditions.push({
      OR: [
        { createdAt: { lt: filter.after.createdAt } },
        {
          createdAt: filter.after.createdAt,
          id: { lt: filter.after.operationId },
        },
      ],
    });
  }

  const operations = (await db.inventoryOperation.findMany({
    where: { sourceType: ADJUSTMENT_SOURCE_TYPE, AND: conditions },
    select: {
      id: true,
      kind: true,
      status: true,
      reason: true,
      note: true,
      actorShopifyUserId: true,
      reversesOperationId: true,
      createdAt: true,
      completedAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: filter.take ?? ADJUSTMENT_HISTORY_PAGE_SIZE,
  })) as HistoryOperationRow[];
  if (operations.length === 0) return [];

  const ids = operations.map((o) => o.id);
  const [lines, reversals] = await Promise.all([
    db.inventoryOperationLine.findMany({
      where: { operationId: { in: ids } },
      select: {
        operationId: true,
        inventoryItemGid: true,
        locationGid: true,
        delta: true,
        status: true,
        quantityAfterChange: true,
        errorMessage: true,
      },
      orderBy: [{ operationId: "asc" }, { lineNumber: "asc" }],
    }) as Promise<HistoryLineRow[]>,
    db.inventoryOperation.findMany({
      where: { reversesOperationId: { in: ids } },
      select: { id: true, reversesOperationId: true },
    }) as Promise<Array<{ id: string; reversesOperationId: string }>>,
  ]);
  const variants = await findVariantsByInventoryItem(
    db,
    lines.map((line) => line.inventoryItemGid),
  );
  const reversedBy = new Map(
    reversals.map((r) => [r.reversesOperationId, r.id]),
  );
  const linesByOperation = new Map<string, HistoryLineRow[]>();
  for (const line of lines) {
    const own = linesByOperation.get(line.operationId);
    if (own) own.push(line);
    else linesByOperation.set(line.operationId, [line]);
  }

  return operations.map((operation) => {
    const own = linesByOperation.get(operation.id) ?? [];
    const reversedByOperationId = reversedBy.get(operation.id) ?? null;
    return {
      operationId: operation.id,
      kind: operation.kind,
      status: operation.status,
      reason: operation.reason,
      note: operation.note,
      staffId: operation.actorShopifyUserId,
      locationId: own[0]?.locationGid ?? null,
      createdAt: operation.createdAt,
      completedAt: operation.completedAt,
      reversesOperationId: operation.reversesOperationId,
      reversedByOperationId,
      canReverse:
        operation.kind === "ADJUSTMENT" &&
        reversedByOperationId === null &&
        (operation.status === "APPLIED" ||
          operation.status === "PARTIALLY_APPLIED"),
      canResume: !TERMINAL_OPERATION_STATUSES.has(operation.status),
      lines: own.map((line) => {
        const variant = variants.get(line.inventoryItemGid);
        return {
          title: variant?.title ?? line.inventoryItemGid,
          sku: variant?.sku ?? null,
          delta: line.delta,
          status: line.status,
          quantityAfterChange: line.quantityAfterChange,
          errorMessage: line.errorMessage,
        };
      }),
    };
  });
}

/** Most adjustments one export holds; the export route refuses a longer period. */
export const ADJUSTMENT_EXPORT_LIMIT = 2_000;

/**
 * Every adjustment and reversal in a period, newest first, for the report
 * export. `truncated` is true when the period holds more than the limit.
 */
export async function listAdjustmentsForExport(
  db: TenantDb,
  period: { from?: Date | null; to?: Date | null },
  bounds: { limit?: number; pageSize?: number } = {},
): Promise<{ entries: AdjustmentHistoryEntry[]; truncated: boolean }> {
  const limit = bounds.limit ?? ADJUSTMENT_EXPORT_LIMIT;
  const pageSize = bounds.pageSize ?? 200;
  const entries: AdjustmentHistoryEntry[] = [];
  let after: AdjustmentCursor | null = null;
  while (entries.length <= limit) {
    const page: AdjustmentHistoryEntry[] = await listAdjustments(db, {
      ...period,
      after,
      take: pageSize,
    });
    entries.push(...page);
    const last = page.at(-1);
    if (page.length < pageSize || !last) break;
    after = { createdAt: last.createdAt, operationId: last.operationId };
  }
  return {
    entries: entries.slice(0, limit),
    truncated: entries.length > limit,
  };
}
