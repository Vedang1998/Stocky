import { isInventoryWriteEnabled } from "../../lib/feature-flags.server";
import type { TenantDb } from "../../tenant/tenant-db.server";
import type { AdminGraphQLClient } from "../shopify-gql.server";
import {
  InventoryDocumentClosedError,
  InventoryOperationConflictError,
  InventoryOperationValidationError,
} from "../inventory-writes/errors";
import type { ExecuteInventoryOperationOptions } from "../inventory-writes/execute.server";
import { findActiveLocationIds } from "../inventory-writes/locations.server";
import {
  describeLineProblems,
  describeUnsettled,
  readDocumentLedgerState,
  settleInventoryDocument,
  type DocumentLineProblem,
  type InventoryDocument,
} from "../inventory-writes/settle.server";
import {
  createLevelQuantityReader,
  type ReadLevelQuantities,
} from "../inventory-writes/shopify-levels.server";
import type { InventoryActor } from "../inventory-writes/types";
import {
  ambiguousCodeMessage,
  findTrackedInventoryItemIds,
  findVariantsByCode,
  findVariantsById,
  findVariantsByInventoryItem,
  ledgerVariantId,
  variantsMatchingCode,
  type CatalogVariant,
} from "../inventory-writes/variant-items.server";
import {
  MAX_ADDED_ITEMS,
  MAX_COUNTED_QUANTITY,
  MAX_ITEM_LIST_LENGTH,
  MAX_STOCKTAKE_NAME_LENGTH,
} from "./stocktake-limits";

export type StocktakeStatus =
  "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type StocktakeScope = "FULL" | "PARTIAL";
/** The Shopify quantity the expected figures were frozen from. */
export type StocktakeQuantityBasis = "AVAILABLE" | "ON_HAND";
/** Where a count sheet's starting expected quantities were read: Shopify live, or the last sync. */
export type StocktakeExpectedSource = "LIVE" | "SYNC";
export type StocktakeCountSource = "MANUAL" | "SCAN" | "ZERO_FILL";
/**
 * How a line is settled when Shopify's quantity moved while the count was
 * open: the units were counted before the movement (the variance is measured
 * from the quantity frozen at the start) or after it (from the quantity
 * Shopify showed when the movement was found).
 */
export type MovementResolution = "COUNTED_BEFORE" | "COUNTED_AFTER";

export const STOCKTAKE_SOURCE_TYPE = "Stocktake";
export {
  MAX_ADDED_ITEMS,
  MAX_COUNTED_QUANTITY,
  MAX_ITEM_LIST_LENGTH,
  MAX_STOCKTAKE_NAME_LENGTH,
};
const MAX_CODE_LENGTH = 191;

/** Rows written per statement when a count sheet is created. */
const LINE_INSERT_CHUNK = 2_000;
const LOOKUP_CHUNK = 2_000;
/**
 * Items whose expected quantity is read live from Shopify when a full count
 * starts. A location with more items than this starts from synced quantities,
 * because reading them all live would outlast the request.
 */
const LIVE_EXPECTED_LIMIT = 1_000;
/** Counted lines checked against Shopify live at completion, lines with a variance first; the rest use synced quantities. */
const LIVE_MOVEMENT_CHECK_LIMIT = 2_000;
/** Lines flagged for movement review, or reviewed, in one request. */
const MOVEMENT_BATCH_LIMIT = 500;

export interface StocktakeOptions extends ExecuteInventoryOperationOptions {
  /** Live read of Shopify's quantities for the movement check; defaults to the Admin API. */
  readQuantities?: ReadLevelQuantities;
}

/** Options of the steps that put items on a count sheet. */
export interface StocktakeSheetOptions {
  now?: () => Date;
  /** Live read of Shopify's quantities for the expected quantity; defaults to the Admin API. */
  readQuantities?: ReadLevelQuantities;
}

export interface CompleteStocktakeOptions extends StocktakeOptions {
  /** Lines without a count are left as they are in Shopify instead of blocking completion. */
  acceptUncounted?: boolean;
}

export type StocktakeActionResult = { ok: true } | { ok: false; error: string };

export type CreateStocktakeResult =
  | {
      ok: true;
      stocktakeId: string;
      lineCount: number;
      /** How the sheet's expected quantities were read. */
      expectedSource: StocktakeExpectedSource;
      /** Stocked items left off the sheet because Shopify has no on-hand quantity for them at the location. */
      skippedUnsynced: number;
      /** Stocked items left off the sheet because no catalog variant is linked to them. */
      skippedUnlinked: number;
    }
  | { ok: false; error: string };

export type StocktakeScanResult =
  | {
      ok: true;
      lineId: string;
      title: string;
      countedQty: number;
      /** True when the scan put the item on the count sheet. */
      added: boolean;
    }
  | { ok: false; error: string };

export type AddStocktakeItemsResult =
  | { ok: true; added: number; alreadyOnCount: number }
  | { ok: false; error: string; details: string[] };

export type StocktakeLineProblem = DocumentLineProblem;

/** What stands between a count and its completion, when it is the merchant's call. */
export type CompletionBlocker = "UNCOUNTED" | "MOVEMENT";

export type CompleteStocktakeResult =
  | { ok: true; alreadyCompleted: boolean }
  | {
      ok: false;
      error: string;
      problems: StocktakeLineProblem[];
      blocker: CompletionBlocker | null;
    };

export type CancelStocktakeResult =
  { ok: true; alreadyCancelled: boolean } | { ok: false; error: string };

interface StocktakeRow {
  id: string;
  locationId: string;
  status: StocktakeStatus;
  scope: StocktakeScope;
  quantityBasis: StocktakeQuantityBasis;
}

interface CountLine {
  id: string;
  shopifyVariantId: string;
  expectedQty: number;
  /** When `expectedQty` was read from Shopify itself; null while it is a synced quantity. */
  expectedReadAt: Date | null;
  countedQty: number | null;
  movementDetectedQty: number | null;
  movementBaselineQty: number | null;
  movementReviewedAt: Date | null;
}

const STOCKTAKE_SELECT = {
  id: true,
  locationId: true,
  status: true,
  scope: true,
  quantityBasis: true,
} as const;

const COUNT_LINE_SELECT = {
  id: true,
  shopifyVariantId: true,
  expectedQty: true,
  expectedReadAt: true,
  countedQty: true,
  movementDetectedQty: true,
  movementBaselineQty: true,
  movementReviewedAt: true,
} as const;

const NO_MOVEMENT = {
  movementDetectedQty: null,
  movementBaselineQty: null,
  movementReviewedAt: null,
} as const;

const CLOSED_MESSAGE =
  "This count is closed. Its lines can no longer be changed.";
const NOT_FOUND_MESSAGE = "Stocktake not found";
const UNREADABLE_MESSAGE =
  "Shopify's current quantities could not be read. Nothing was changed. Try again in a moment.";
const INACTIVE_LOCATION_MESSAGE =
  "That location is not an active, synced location of this shop. Run a sync from the dashboard, then try again.";

function chunked<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < values.length; start += size) {
    chunks.push(values.slice(start, start + size));
  }
  return chunks;
}

const clock = (options: { now?: () => Date }) =>
  options.now ?? (() => new Date());

/**
 * The change a counted line stands for. A line counted after stock moved is
 * measured from the quantity Shopify showed when the movement was found.
 */
export function stocktakeLineDelta(line: {
  expectedQty: number;
  countedQty: number | null;
  movementBaselineQty: number | null;
}): number | null {
  if (line.countedQty === null) return null;
  return line.countedQty - (line.movementBaselineQty ?? line.expectedQty);
}

const awaitsMovementReview = (line: CountLine) =>
  line.countedQty !== null &&
  line.movementDetectedQty !== null &&
  line.movementReviewedAt === null;

/**
 * Hold the stocktake row for the rest of the transaction, provided the count
 * is still open. Completion and cancellation take the same lock before they
 * close the count, so a line saved under it is always seen by the closing
 * check.
 */
async function lockOpenStocktake(
  tx: TenantDb,
  stocktakeId: string,
): Promise<boolean> {
  const locked = await tx.stocktake.updateMany({
    where: { id: stocktakeId, status: "IN_PROGRESS" },
    data: { status: "IN_PROGRESS" },
  });
  return locked.count === 1;
}

async function findStocktake(
  db: TenantDb,
  stocktakeId: string,
): Promise<StocktakeRow | null> {
  return (await db.stocktake.findFirst({
    where: { id: stocktakeId },
    select: STOCKTAKE_SELECT,
  })) as StocktakeRow | null;
}

async function loadCountLines(
  db: TenantDb,
  stocktakeId: string,
): Promise<CountLine[]> {
  return (await db.stocktakeLineItem.findMany({
    where: { stocktakeId },
    select: COUNT_LINE_SELECT,
    orderBy: { id: "asc" },
  })) as CountLine[];
}

interface StockedLevel {
  inventoryItemGid: string;
  availableQuantity: number | null;
  onHandQuantity: number | null;
}

const basisQuantity = (level: StockedLevel, basis: StocktakeQuantityBasis) =>
  basis === "ON_HAND" ? level.onHandQuantity : level.availableQuantity;

const basisLabel = (basis: StocktakeQuantityBasis) =>
  basis === "ON_HAND" ? "on-hand" : "available";

/**
 * Synced inventory levels of live items actively stocked at a location, keyed
 * by inventory item. Pass `inventoryItemIds` to look up only those items.
 */
async function readStockedLevels(
  db: TenantDb,
  locationId: string,
  inventoryItemIds?: readonly string[],
): Promise<Map<string, StockedLevel>> {
  const select = {
    inventoryItemGid: true,
    availableQuantity: true,
    onHandQuantity: true,
  } as const;
  const base = {
    locationGid: locationId,
    existenceState: "LIVE",
    isActive: true,
  } as const;
  const levels = new Map<string, StockedLevel>();
  const collect = (rows: StockedLevel[]) => {
    for (const row of rows) levels.set(row.inventoryItemGid, row);
  };
  if (!inventoryItemIds) {
    collect(
      (await db.shopifyInventoryLevelFact.findMany({
        where: base,
        select,
      })) as StockedLevel[],
    );
    return levels;
  }
  for (const part of chunked([...new Set(inventoryItemIds)], LOOKUP_CHUNK)) {
    collect(
      (await db.shopifyInventoryLevelFact.findMany({
        where: { ...base, inventoryItemGid: { in: part } },
        select,
      })) as StockedLevel[],
    );
  }
  return levels;
}

/** The live read for a count's quantity basis, or null when there is no Admin client to read with. */
function liveReader(
  admin: AdminGraphQLClient | null,
  basis: StocktakeQuantityBasis,
  options: { readQuantities?: ReadLevelQuantities },
): ReadLevelQuantities | null {
  return (
    options.readQuantities ??
    (admin
      ? createLevelQuantityReader(
          admin,
          basis === "ON_HAND" ? "on_hand" : "available",
        )
      : null)
  );
}

/**
 * Start a count at one location.
 *
 * A full count lists every tracked item stocked at the location; a partial
 * count starts empty and takes the items that are scanned or added. Expected
 * quantities are frozen from Shopify's on-hand quantities: the units
 * physically at the location, which is what a person counts. Orders that are
 * placed but not yet fulfilled do not change it.
 *
 * The quantities are read from Shopify as the count starts. Synced on-hand
 * quantities can trail Shopify (an inventory webhook carries only the
 * available quantity), so they are used only for a location with more than
 * `LIVE_EXPECTED_LIMIT` items; the count records which it was.
 */
export async function createStocktake(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  input: {
    shop: string;
    locationId: string | null;
    name: string | null;
    scope?: unknown;
    blind?: boolean;
    actor?: InventoryActor | null;
  },
  options: StocktakeSheetOptions = {},
): Promise<CreateStocktakeResult> {
  if (!input.locationId) {
    return { ok: false, error: "Choose the location to count." };
  }
  const scope = input.scope ?? "FULL";
  if (scope !== "FULL" && scope !== "PARTIAL") {
    return { ok: false, error: "Choose a full or a partial count." };
  }
  const name = input.name?.trim() ?? "";
  if (name.length > MAX_STOCKTAKE_NAME_LENGTH) {
    return {
      ok: false,
      error: `The name can be at most ${MAX_STOCKTAKE_NAME_LENGTH} characters.`,
    };
  }
  const active = await findActiveLocationIds(db, [input.locationId]);
  if (!active.has(input.locationId)) {
    return { ok: false, error: INACTIVE_LOCATION_MESSAGE };
  }

  const lines: Array<{ shopifyVariantId: string; expectedQty: number }> = [];
  let skippedUnsynced = 0;
  let skippedUnlinked = 0;
  let expectedSource: StocktakeExpectedSource = "LIVE";
  if (scope === "FULL") {
    const levels = await readStockedLevels(db, input.locationId);
    const tracked = await findTrackedInventoryItemIds(db, [...levels.keys()]);
    const variants = await findVariantsByInventoryItem(db, [...tracked]);
    const countable = [...tracked].filter((itemId) => variants.has(itemId));
    skippedUnlinked = tracked.size - countable.length;

    const readLive = liveReader(admin, "ON_HAND", options);
    let onHand: Map<string, number | null>;
    if (readLive && countable.length <= LIVE_EXPECTED_LIMIT) {
      try {
        onHand = await readLive(input.locationId, countable);
      } catch {
        return {
          ok: false,
          error:
            "Shopify's current quantities could not be read, so the count was not started. Try again in a moment.",
        };
      }
    } else {
      expectedSource = "SYNC";
      onHand = new Map(
        countable.map((itemId) => [itemId, levels.get(itemId)!.onHandQuantity]),
      );
    }
    for (const itemId of countable) {
      const expectedQty = onHand.get(itemId) ?? null;
      if (expectedQty === null) {
        skippedUnsynced += 1;
      } else {
        lines.push({
          shopifyVariantId: variants.get(itemId)!.shopifyVariantId,
          expectedQty,
        });
      }
    }
    if (lines.length === 0) {
      return {
        ok: false,
        error:
          skippedUnsynced + skippedUnlinked > 0
            ? "Shopify has no on-hand quantity for the items synced at this location. Run a sync from the dashboard, then start the count again."
            : "No tracked items are stocked at this location in Shopify, so there is nothing to count. To count specific items, start a partial count.",
      };
    }
    lines.sort((a, b) => a.shopifyVariantId.localeCompare(b.shopifyVariantId));
  }

  const startedAt = clock(options)();
  const sheet = lines.map((line) => ({
    ...line,
    expectedReadAt: expectedSource === "LIVE" ? startedAt : null,
  }));
  const stocktakeId = await db.$transaction(async (tx: TenantDb) => {
    const created = (await tx.stocktake.create({
      data: {
        shop: input.shop,
        locationId: input.locationId,
        name: name || `Count ${startedAt.toISOString().slice(0, 10)}`,
        status: "IN_PROGRESS",
        scope,
        quantityBasis: "ON_HAND",
        expectedSource,
        blind: input.blind === true,
        startedAt,
        startedByUserId: input.actor?.shopifyUserId ?? null,
      },
      select: { id: true },
    })) as { id: string };
    // Written through the count they belong to: one statement per chunk, with
    // no per-row ownership lookup, so a sheet of thousands of items fits in
    // the transaction.
    for (const part of chunked(sheet, LINE_INSERT_CHUNK)) {
      await tx.stocktake.update({
        where: { id: created.id },
        data: { lineItems: { createMany: { data: part } } },
        select: { id: true },
      });
    }
    return created.id;
  });

  return {
    ok: true,
    stocktakeId,
    lineCount: lines.length,
    expectedSource,
    skippedUnsynced,
    skippedUnlinked,
  };
}

type NewLine =
  | { ok: true; expectedQty: number; readLive: boolean }
  | { ok: false; error: string };

/**
 * Whether each variant can be put on a count at the stocktake's location, and
 * the expected quantity it would start with: Shopify's quantity read now, or
 * the synced one when there is no Admin client to read with. A variant
 * Shopify cannot adjust there is refused now rather than when the count is
 * completed.
 *
 * Reads Shopify, so it is called before a transaction, never inside one.
 * Returns null when Shopify could not be read.
 */
async function resolveNewLines(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  stocktake: StocktakeRow,
  variants: readonly CatalogVariant[],
  options: StocktakeSheetOptions,
): Promise<Map<string, NewLine> | null> {
  const itemIds = variants.flatMap((v) =>
    v.inventoryItemId ? [v.inventoryItemId] : [],
  );
  const tracked = await findTrackedInventoryItemIds(db, itemIds);
  const readLive = liveReader(admin, stocktake.quantityBasis, options);

  let live: Map<string, number | null> | null = null;
  let synced = new Map<string, StockedLevel>();
  if (readLive) {
    try {
      live = await readLive(
        stocktake.locationId,
        itemIds.filter((itemId) => tracked.has(itemId)),
      );
    } catch {
      return null;
    }
  } else {
    synced = await readStockedLevels(db, stocktake.locationId, itemIds);
  }

  const resolved = new Map<string, NewLine>();
  for (const variant of variants) {
    const refuse = (error: string) =>
      resolved.set(variant.shopifyVariantId, { ok: false, error });
    const notStocked = () =>
      refuse(
        `${variant.title} is not stocked at this location in Shopify. Stock it at the location in Shopify first.`,
      );
    const itemId = variant.inventoryItemId;
    if (!itemId) {
      refuse(
        `Shopify inventory is not linked yet for ${variant.title}. Run a catalog sync from the dashboard.`,
      );
      continue;
    }
    if (!tracked.has(itemId)) {
      refuse(
        `${variant.title} is not tracked for inventory in Shopify, so it cannot be counted.`,
      );
      continue;
    }
    if (live) {
      const expectedQty = live.get(itemId) ?? null;
      if (expectedQty === null) notStocked();
      else {
        resolved.set(variant.shopifyVariantId, {
          ok: true,
          expectedQty,
          readLive: true,
        });
      }
      continue;
    }
    const level = synced.get(itemId);
    if (!level) {
      notStocked();
      continue;
    }
    const expectedQty = basisQuantity(level, stocktake.quantityBasis);
    if (expectedQty === null) {
      refuse(
        `Shopify's ${basisLabel(stocktake.quantityBasis)} quantity for ${variant.title} is not synced yet. Run a sync from the dashboard.`,
      );
      continue;
    }
    resolved.set(variant.shopifyVariantId, {
      ok: true,
      expectedQty,
      readLive: false,
    });
  }
  return resolved;
}

/**
 * Shopify's quantity now for a line whose expected quantity is still a synced
 * one, read as the line is counted so the variance is measured from the stock
 * that was there at that moment. Null when the line was already read from
 * Shopify or Shopify cannot answer; the count is saved either way, and the
 * line is read when the count is completed.
 */
async function readUnverifiedExpected(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  stocktake: StocktakeRow,
  line: { shopifyVariantId: string; expectedReadAt: Date | null },
  options: StocktakeSheetOptions,
): Promise<number | null> {
  if (line.expectedReadAt !== null) return null;
  const readLive = liveReader(admin, stocktake.quantityBasis, options);
  if (!readLive) return null;
  const itemId = (await findVariantsById(db, [line.shopifyVariantId])).get(
    line.shopifyVariantId,
  )?.inventoryItemId;
  if (!itemId) return null;
  try {
    return (await readLive(stocktake.locationId, [itemId])).get(itemId) ?? null;
  } catch {
    return null;
  }
}

/** The update that replaces a synced expected quantity with one read from Shopify. */
const expectedReadNow = (expectedQty: number, readAt: Date) => ({
  expectedQty,
  expectedReadAt: readAt,
  ...NO_MOVEMENT,
});

const isValidCount = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= MAX_COUNTED_QUANTITY;

/**
 * Save the counted quantity of one line, or clear it with `null`. A changed
 * count discards the line's movement review: it is checked again when the
 * count is completed.
 */
export async function saveStocktakeCount(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  input: {
    lineId: string;
    countedQty: number | null;
    /** When given, the line must belong to this stocktake. */
    stocktakeId?: string;
    actor?: InventoryActor | null;
  },
  options: StocktakeSheetOptions = {},
): Promise<StocktakeActionResult> {
  if (input.countedQty !== null && !isValidCount(input.countedQty)) {
    return {
      ok: false,
      error: `Enter the counted quantity as a whole number from 0 to ${MAX_COUNTED_QUANTITY.toLocaleString("en-US")}.`,
    };
  }
  const line = (await db.stocktakeLineItem.findFirst({
    where: {
      id: input.lineId,
      ...(input.stocktakeId ? { stocktakeId: input.stocktakeId } : {}),
    },
    select: {
      id: true,
      stocktakeId: true,
      shopifyVariantId: true,
      expectedReadAt: true,
    },
  })) as {
    id: string;
    stocktakeId: string;
    shopifyVariantId: string;
    expectedReadAt: Date | null;
  } | null;
  if (!line) return { ok: false, error: "Stocktake line not found" };

  const counted = input.countedQty !== null;
  let liveExpected: number | null = null;
  if (counted && line.expectedReadAt === null) {
    const stocktake = await findStocktake(db, line.stocktakeId);
    if (stocktake?.status === "IN_PROGRESS") {
      liveExpected = await readUnverifiedExpected(
        db,
        admin,
        stocktake,
        line,
        options,
      );
    }
  }

  return db.$transaction(async (tx: TenantDb) => {
    if (!(await lockOpenStocktake(tx, line.stocktakeId))) {
      return { ok: false as const, error: CLOSED_MESSAGE };
    }
    const current = (await tx.stocktakeLineItem.findFirst({
      where: { id: line.id },
      select: { countedQty: true, expectedReadAt: true },
    })) as { countedQty: number | null; expectedReadAt: Date | null } | null;
    if (!current) {
      return { ok: false as const, error: "Stocktake line not found" };
    }
    const now = clock(options)();
    await tx.stocktakeLineItem.update({
      where: { id: line.id },
      data: {
        countedQty: input.countedQty,
        countSource: counted ? "MANUAL" : null,
        countedAt: counted ? now : null,
        countedByUserId: counted ? (input.actor?.shopifyUserId ?? null) : null,
        ...(current.countedQty === input.countedQty ? {} : NO_MOVEMENT),
        ...(liveExpected !== null && current.expectedReadAt === null
          ? expectedReadNow(liveExpected, now)
          : {}),
      },
    });
    return { ok: true as const };
  });
}

function readCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim();
  return code.length > 0 && code.length <= MAX_CODE_LENGTH ? code : null;
}

/**
 * Count units by barcode, SKU or variant ID: each scan adds `quantity` to the
 * item's count. An item that is not on the sheet yet is added to it, provided
 * Shopify stocks it at the counted location.
 */
export async function recordStocktakeScan(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  input: {
    stocktakeId: string;
    code: unknown;
    quantity?: number;
    actor?: InventoryActor | null;
  },
  options: StocktakeSheetOptions = {},
): Promise<StocktakeScanResult> {
  const fail = (error: string) => ({ ok: false as const, error });
  const code = readCode(input.code);
  if (!code) return fail("Scan or type a barcode or SKU.");
  const quantity = input.quantity ?? 1;
  if (!isValidCount(quantity) || quantity === 0) {
    return fail(
      `Enter the scanned quantity as a whole number from 1 to ${MAX_COUNTED_QUANTITY.toLocaleString("en-US")}.`,
    );
  }

  const stocktake = await findStocktake(db, input.stocktakeId);
  if (!stocktake) return fail(NOT_FOUND_MESSAGE);
  if (stocktake.status !== "IN_PROGRESS") return fail(CLOSED_MESSAGE);

  const matches = variantsMatchingCode(
    await findVariantsByCode(db, [code]),
    code,
  );
  if (matches.length === 0) {
    return fail(
      `No item in this shop's catalog has the barcode or SKU ${code}.`,
    );
  }
  if (matches.length > 1) return fail(ambiguousCodeMessage(code, matches));
  const [variant] = matches;
  const lineOfVariant = {
    stocktakeId: stocktake.id,
    shopifyVariantId: variant.shopifyVariantId,
  };

  // An item that is not on the sheet yet gets its expected quantity from
  // Shopify before the count is locked; lines are never removed, so a line
  // found here is still there inside the transaction.
  let newLine: { expectedQty: number; readLive: boolean } | null = null;
  let liveExpected: number | null = null;
  const onSheet = (await db.stocktakeLineItem.findFirst({
    where: lineOfVariant,
    select: { id: true, expectedReadAt: true },
    orderBy: { id: "asc" },
  })) as { id: string; expectedReadAt: Date | null } | null;
  if (onSheet) {
    liveExpected = await readUnverifiedExpected(
      db,
      admin,
      stocktake,
      { ...lineOfVariant, expectedReadAt: onSheet.expectedReadAt },
      options,
    );
  } else {
    const resolved = await resolveNewLines(
      db,
      admin,
      stocktake,
      [variant],
      options,
    );
    if (!resolved) return fail(UNREADABLE_MESSAGE);
    const outcome = resolved.get(variant.shopifyVariantId)!;
    if (!outcome.ok) return fail(outcome.error);
    newLine = outcome;
  }

  return db.$transaction(async (tx: TenantDb) => {
    if (!(await lockOpenStocktake(tx, stocktake.id))) {
      return fail(CLOSED_MESSAGE);
    }
    type ScannedLine = {
      id: string;
      countedQty: number | null;
      expectedReadAt: Date | null;
    };
    const scannedLine = {
      id: true,
      countedQty: true,
      expectedReadAt: true,
    } as const;
    const now = clock(options)();
    let line = (await tx.stocktakeLineItem.findFirst({
      where: lineOfVariant,
      select: scannedLine,
      orderBy: { id: "asc" },
    })) as ScannedLine | null;
    const added = line === null;
    if (!line) {
      if (!newLine) return fail(NOT_FOUND_MESSAGE);
      line = (await tx.stocktakeLineItem.create({
        data: {
          ...lineOfVariant,
          expectedQty: newLine.expectedQty,
          expectedReadAt: newLine.readLive ? now : null,
        },
        select: scannedLine,
      })) as ScannedLine;
    }

    const countedQty = (line.countedQty ?? 0) + quantity;
    if (countedQty > MAX_COUNTED_QUANTITY) {
      return fail(
        `${variant.title} would be counted above ${MAX_COUNTED_QUANTITY.toLocaleString("en-US")}. Check its count.`,
      );
    }
    await tx.stocktakeLineItem.update({
      where: { id: line.id },
      data: {
        countedQty,
        countSource: "SCAN",
        countedAt: now,
        countedByUserId: input.actor?.shopifyUserId ?? null,
        ...NO_MOVEMENT,
        ...(liveExpected !== null && line.expectedReadAt === null
          ? expectedReadNow(liveExpected, now)
          : {}),
      },
    });
    return {
      ok: true as const,
      lineId: line.id,
      title: variant.title,
      countedQty,
      added,
    };
  });
}

/** The given variants that already have a line on a count's sheet. */
async function findVariantsOnSheet(
  db: TenantDb,
  stocktakeId: string,
  shopifyVariantIds: readonly string[],
): Promise<Set<string>> {
  const lines = (await db.stocktakeLineItem.findMany({
    where: { stocktakeId, shopifyVariantId: { in: [...shopifyVariantIds] } },
    select: { shopifyVariantId: true },
  })) as Array<{ shopifyVariantId: string }>;
  return new Set(lines.map((line) => line.shopifyVariantId));
}

/**
 * Put a list of items on a count sheet, one barcode, SKU or variant ID per
 * line, without counting them. Nothing is added unless every line names
 * exactly one item that can be counted at the location.
 */
export async function addStocktakeItems(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  input: { stocktakeId: string; codesText: unknown },
  options: StocktakeSheetOptions = {},
): Promise<AddStocktakeItemsResult> {
  const fail = (error: string, details: string[] = []) => ({
    ok: false as const,
    error,
    details,
  });
  if (typeof input.codesText !== "string") {
    return fail("Enter at least one barcode or SKU.");
  }
  if (input.codesText.length > MAX_ITEM_LIST_LENGTH) {
    return fail(
      `The list is too long. Add at most ${MAX_ADDED_ITEMS} items at a time.`,
    );
  }
  const entries = input.codesText
    .split(/\r?\n/)
    .map((text, index) => ({ lineNumber: index + 1, code: text.trim() }))
    .filter((entry) => entry.code.length > 0);
  if (entries.length === 0) return fail("Enter at least one barcode or SKU.");
  if (entries.length > MAX_ADDED_ITEMS) {
    return fail(
      `Add at most ${MAX_ADDED_ITEMS} items at a time. This list has ${entries.length}.`,
    );
  }

  const stocktake = await findStocktake(db, input.stocktakeId);
  if (!stocktake) return fail(NOT_FOUND_MESSAGE);
  if (stocktake.status !== "IN_PROGRESS") return fail(CLOSED_MESSAGE);

  const details: string[] = [];
  const usable = entries.filter((entry) => {
    if (entry.code.length <= MAX_CODE_LENGTH) return true;
    details.push(
      `Line ${entry.lineNumber}: that is too long for a barcode or SKU.`,
    );
    return false;
  });
  const catalog = await findVariantsByCode(
    db,
    usable.map((entry) => entry.code),
  );
  const wanted = new Map<
    string,
    { variant: CatalogVariant; lineNumber: number }
  >();
  for (const entry of usable) {
    const matches = variantsMatchingCode(catalog, entry.code);
    if (matches.length === 0) {
      details.push(
        `Line ${entry.lineNumber}: no item has the barcode or SKU ${entry.code}.`,
      );
    } else if (matches.length > 1) {
      details.push(
        `Line ${entry.lineNumber}: ${ambiguousCodeMessage(entry.code, matches)}`,
      );
    } else if (!wanted.has(matches[0].shopifyVariantId)) {
      wanted.set(matches[0].shopifyVariantId, {
        variant: matches[0],
        lineNumber: entry.lineNumber,
      });
    }
  }

  // Expected quantities are read from Shopify before the count is locked.
  const onSheet = await findVariantsOnSheet(db, stocktake.id, [
    ...wanted.keys(),
  ]);
  const fresh = [...wanted.values()].filter(
    ({ variant }) => !onSheet.has(variant.shopifyVariantId),
  );
  const resolved = await resolveNewLines(
    db,
    admin,
    stocktake,
    fresh.map(({ variant }) => variant),
    options,
  );
  if (!resolved) return fail(UNREADABLE_MESSAGE);
  const readAt = clock(options)();
  const lines: Array<{
    shopifyVariantId: string;
    expectedQty: number;
    expectedReadAt: Date | null;
  }> = [];
  for (const { variant, lineNumber } of fresh) {
    const outcome = resolved.get(variant.shopifyVariantId)!;
    if (outcome.ok) {
      lines.push({
        shopifyVariantId: variant.shopifyVariantId,
        expectedQty: outcome.expectedQty,
        expectedReadAt: outcome.readLive ? readAt : null,
      });
    } else {
      details.push(`Line ${lineNumber}: ${outcome.error}`);
    }
  }
  if (details.length > 0) {
    return fail(
      "Some lines could not be added. Nothing was added to the count.",
      details.sort(
        (a, b) =>
          Number(a.slice(5, a.indexOf(":"))) -
          Number(b.slice(5, b.indexOf(":"))),
      ),
    );
  }

  return db.$transaction(async (tx: TenantDb) => {
    if (!(await lockOpenStocktake(tx, stocktake.id))) {
      return fail(CLOSED_MESSAGE);
    }
    // Another request may have added some of them in the meantime.
    const nowOnSheet = await findVariantsOnSheet(tx, stocktake.id, [
      ...wanted.keys(),
    ]);
    const added = lines.filter(
      (line) => !nowOnSheet.has(line.shopifyVariantId),
    );
    if (added.length > 0) {
      await tx.stocktake.update({
        where: { id: stocktake.id },
        data: { lineItems: { createMany: { data: added } } },
        select: { id: true },
      });
    }
    return {
      ok: true as const,
      added: added.length,
      alreadyOnCount: wanted.size - added.length,
    };
  });
}

/**
 * Count every line that has no count yet as zero: the items on the sheet that
 * nobody found. They are marked so the step can be undone and told apart from
 * items somebody counted as zero.
 */
export async function zeroFillUncounted(
  db: TenantDb,
  input: { stocktakeId: string; actor?: InventoryActor | null },
  options: { now?: () => Date } = {},
): Promise<{ ok: true; lines: number } | { ok: false; error: string }> {
  return db.$transaction(async (tx: TenantDb) => {
    if (!(await lockOpenStocktake(tx, input.stocktakeId))) {
      return {
        ok: false as const,
        error: await closedOrMissing(tx, input.stocktakeId),
      };
    }
    const filled = await tx.stocktakeLineItem.updateMany({
      where: { stocktakeId: input.stocktakeId, countedQty: null },
      data: {
        countedQty: 0,
        countSource: "ZERO_FILL",
        countedAt: clock(options)(),
        countedByUserId: input.actor?.shopifyUserId ?? null,
        ...NO_MOVEMENT,
      },
    });
    return { ok: true as const, lines: filled.count };
  });
}

/** Take back the zero counts `zeroFillUncounted` entered; counts entered by people stay. */
export async function clearZeroFill(
  db: TenantDb,
  input: { stocktakeId: string },
): Promise<{ ok: true; lines: number } | { ok: false; error: string }> {
  return db.$transaction(async (tx: TenantDb) => {
    if (!(await lockOpenStocktake(tx, input.stocktakeId))) {
      return {
        ok: false as const,
        error: await closedOrMissing(tx, input.stocktakeId),
      };
    }
    const cleared = await tx.stocktakeLineItem.updateMany({
      where: { stocktakeId: input.stocktakeId, countSource: "ZERO_FILL" },
      data: {
        countedQty: null,
        countSource: null,
        countedAt: null,
        countedByUserId: null,
        ...NO_MOVEMENT,
      },
    });
    return { ok: true as const, lines: cleared.count };
  });
}

async function closedOrMissing(db: TenantDb, stocktakeId: string) {
  return (await findStocktake(db, stocktakeId))
    ? CLOSED_MESSAGE
    : NOT_FOUND_MESSAGE;
}

/**
 * Settle lines whose Shopify quantity moved while the count was open. With
 * `lineIds` null every line waiting for review is settled the same way, up to
 * `MOVEMENT_BATCH_LIMIT` per call; `remaining` reports what is left.
 */
export async function resolveStocktakeMovement(
  db: TenantDb,
  input: {
    stocktakeId: string;
    lineIds: readonly string[] | null;
    resolution: unknown;
  },
  options: { now?: () => Date } = {},
): Promise<
  | { ok: true; resolved: number; remaining: number }
  | { ok: false; error: string }
> {
  const { resolution } = input;
  if (resolution !== "COUNTED_BEFORE" && resolution !== "COUNTED_AFTER") {
    return {
      ok: false,
      error:
        "Choose whether the item was counted before or after the stock moved.",
    };
  }
  const lineIds = input.lineIds ? [...new Set(input.lineIds)] : null;
  if (
    lineIds &&
    (lineIds.length === 0 || lineIds.length > MOVEMENT_BATCH_LIMIT)
  ) {
    return { ok: false, error: "Choose the lines to review." };
  }

  return db.$transaction(async (tx: TenantDb) => {
    if (!(await lockOpenStocktake(tx, input.stocktakeId))) {
      return {
        ok: false as const,
        error: await closedOrMissing(tx, input.stocktakeId),
      };
    }
    const waiting = {
      stocktakeId: input.stocktakeId,
      countedQty: { not: null },
      movementDetectedQty: { not: null },
      movementReviewedAt: null,
    };
    const lines = (await tx.stocktakeLineItem.findMany({
      where: { ...waiting, ...(lineIds ? { id: { in: lineIds } } : {}) },
      select: { id: true, movementDetectedQty: true },
      orderBy: { id: "asc" },
      take: MOVEMENT_BATCH_LIMIT,
    })) as Array<{ id: string; movementDetectedQty: number }>;

    const reviewedAt = clock(options)();
    if (resolution === "COUNTED_BEFORE") {
      await tx.stocktakeLineItem.updateMany({
        where: { id: { in: lines.map((line) => line.id) } },
        data: { movementReviewedAt: reviewedAt, movementBaselineQty: null },
      });
    } else {
      const byQuantity = new Map<number, string[]>();
      for (const line of lines) {
        const ids = byQuantity.get(line.movementDetectedQty) ?? [];
        ids.push(line.id);
        byQuantity.set(line.movementDetectedQty, ids);
      }
      for (const [quantity, ids] of byQuantity) {
        await tx.stocktakeLineItem.updateMany({
          where: { id: { in: ids } },
          data: {
            movementReviewedAt: reviewedAt,
            movementBaselineQty: quantity,
          },
        });
      }
    }
    const remaining = (await tx.stocktakeLineItem.count({
      where: waiting,
    })) as number;
    return { ok: true as const, resolved: lines.length, remaining };
  });
}

type BuiltDocument =
  | {
      ok: true;
      document: InventoryDocument;
      /** inventory item GID → the stocktake line it came from. */
      lineByItem: Map<string, { shopifyVariantId: string; title: string }>;
    }
  | { ok: false; error: string };

const stocktakeDocument = (
  stocktakeId: string,
  desired: InventoryDocument["desired"],
): InventoryDocument => ({
  kind: "STOCKTAKE",
  source: { type: STOCKTAKE_SOURCE_TYPE, id: stocktakeId },
  reason: "cycle_count_available",
  quantityName: "available",
  referenceDocumentUri: `gid://propo/Stocktake/${stocktakeId}`,
  desired,
});

/**
 * The stock change a count stands for: one relative change per counted line
 * that differs from its starting point, so stock that moves after this is
 * kept. The change is made to `available`; the other on-hand states
 * (committed, reserved and so on) are not touched, so on-hand moves by the
 * same amount. Uncounted lines are left alone; they are never treated as zero.
 */
async function buildStocktakeDocument(
  db: TenantDb,
  stocktake: StocktakeRow,
  lines: readonly CountLine[],
): Promise<BuiltDocument> {
  const counted = lines.filter((line) => line.countedQty !== null);
  if (counted.length === 0) {
    return { ok: false, error: "Enter at least one count before completing." };
  }

  const variances = counted.filter((line) => stocktakeLineDelta(line) !== 0);
  const items = await findVariantsById(
    db,
    variances.map((line) => line.shopifyVariantId),
  );

  const seen = new Set<string>();
  const repeated = new Set<string>();
  const unresolved = new Set<string>();
  for (const line of variances) {
    const title =
      items.get(line.shopifyVariantId)?.title ?? line.shopifyVariantId;
    if (seen.has(line.shopifyVariantId)) repeated.add(title);
    seen.add(line.shopifyVariantId);
    if (!items.get(line.shopifyVariantId)?.inventoryItemId) {
      unresolved.add(title);
    }
  }
  if (repeated.size > 0) {
    return {
      ok: false,
      error: `These items are on the count more than once, so their counts cannot be applied: ${[...repeated].join(", ")}.`,
    };
  }
  if (unresolved.size > 0) {
    return {
      ok: false,
      error: `Shopify inventory is not linked yet for: ${[...unresolved].join(", ")}. Run a catalog sync from the dashboard, then complete the count again.`,
    };
  }

  const lineByItem = new Map<
    string,
    { shopifyVariantId: string; title: string }
  >();
  const desired = variances.map((line) => {
    const item = items.get(line.shopifyVariantId)!;
    lineByItem.set(item.inventoryItemId!, {
      shopifyVariantId: line.shopifyVariantId,
      title: item.title,
    });
    return {
      inventoryItemId: item.inventoryItemId!,
      variantId: ledgerVariantId(line.shopifyVariantId),
      locationId: stocktake.locationId,
      delta: stocktakeLineDelta(line)!,
      changeFromQuantity: null,
    };
  });

  return {
    ok: true,
    document: stocktakeDocument(stocktake.id, desired),
    lineByItem,
  };
}

/**
 * Inventory items this count has already sent to Shopify, or may have. Their
 * quantity in Shopify no longer says anything about movement during the
 * count, because the count itself changed it.
 */
async function readItemsSentToShopify(
  db: TenantDb,
  stocktakeId: string,
): Promise<Set<string>> {
  const operations = (await db.inventoryOperation.findMany({
    where: { sourceType: STOCKTAKE_SOURCE_TYPE, sourceId: stocktakeId },
    select: { id: true },
  })) as Array<{ id: string }>;
  if (operations.length === 0) return new Set();
  const lines = (await db.inventoryOperationLine.findMany({
    where: {
      operationId: { in: operations.map((operation) => operation.id) },
      status: { in: ["APPLIED", "IN_FLIGHT"] },
    },
    select: { inventoryItemGid: true },
  })) as Array<{ inventoryItemGid: string }>;
  return new Set(lines.map((line) => line.inventoryItemGid));
}

interface ShopifyCheck {
  /** Lines whose stock moved in Shopify and that wait for review. */
  awaitingReview: number;
  /** Counted lines whose expected quantity still has to be read from Shopify. */
  unread: number;
  /** True when an expected quantity was replaced, so the variances changed. */
  expectedChanged: boolean;
}

/**
 * Compare the counted lines with Shopify before anything is sent.
 *
 * A line whose expected quantity was read from Shopify (when the count
 * started, or when the line was counted) is flagged for review if Shopify's
 * quantity no longer matches it: a sale fulfilled or a delivery received in
 * between changes what the variance should be, and only the person who
 * counted knows whether the units were counted before or after it.
 *
 * A line whose expected quantity is still a synced one cannot be told apart
 * from a line whose stock moved, because the sync may simply be behind. Its
 * expected quantity is replaced with Shopify's quantity now, so its variance
 * is measured from real stock; the count is not sent while such lines remain.
 *
 * Shopify is read live for up to `LIVE_MOVEMENT_CHECK_LIMIT` lines per call:
 * the unread ones first, then lines with a variance, then the rest. Lines
 * beyond the limit that were read before are compared with the synced
 * quantity. Lines already reviewed, and items this count has already changed
 * in Shopify, are not checked again.
 *
 * Returns null when Shopify could not be read.
 */
async function checkAgainstShopify(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  stocktake: StocktakeRow,
  lines: readonly CountLine[],
  options: StocktakeOptions,
): Promise<ShopifyCheck | null> {
  const unreviewed = lines.filter(
    (line) => line.countedQty !== null && line.movementReviewedAt === null,
  );
  if (unreviewed.length === 0) {
    return { awaitingReview: 0, unread: 0, expectedChanged: false };
  }

  const [variants, sent] = await Promise.all([
    findVariantsById(
      db,
      unreviewed.map((line) => line.shopifyVariantId),
    ),
    readItemsSentToShopify(db, stocktake.id),
  ]);
  const checkable = unreviewed.flatMap((line) => {
    const itemId = variants.get(line.shopifyVariantId)?.inventoryItemId;
    return itemId && !sent.has(itemId) ? [{ line, itemId }] : [];
  });
  type Checkable = (typeof checkable)[number];
  const isUnread = ({ line }: Checkable) => line.expectedReadAt === null;
  const hasVariance = ({ line }: Checkable) =>
    line.countedQty !== line.expectedQty;

  const readLive = liveReader(admin, stocktake.quantityBasis, options);
  if (!readLive && checkable.some(isUnread)) return null;
  const read = checkable.filter((entry) => !isUnread(entry));
  const live = readLive
    ? [
        ...checkable.filter(isUnread),
        ...read.filter(hasVariance),
        ...read.filter((entry) => !hasVariance(entry)),
      ].slice(0, LIVE_MOVEMENT_CHECK_LIMIT)
    : [];
  const liveIds = new Set(live.map(({ itemId }) => itemId));
  let liveQuantities = new Map<string, number | null>();
  if (readLive && liveIds.size > 0) {
    try {
      liveQuantities = await readLive(stocktake.locationId, [...liveIds]);
    } catch {
      return null;
    }
  }
  const synced = await readStockedLevels(
    db,
    stocktake.locationId,
    read.flatMap(({ itemId }) => (liveIds.has(itemId) ? [] : [itemId])),
  );

  const nowRead: Array<{ id: string; quantity: number }> = [];
  const notStocked: string[] = [];
  const moved: Array<{ id: string; quantity: number }> = [];
  const settledAgain: string[] = [];
  let unread = 0;
  for (const entry of checkable) {
    const { line, itemId } = entry;
    if (isUnread(entry)) {
      if (!liveIds.has(itemId)) {
        unread += 1;
        continue;
      }
      // No reading means Shopify does not stock the item here any more. The
      // line counts as read, so it is not asked for again, and Shopify
      // answers for the item itself if a change is sent for it.
      const quantity = liveQuantities.get(itemId) ?? null;
      if (quantity === null) notStocked.push(line.id);
      else nowRead.push({ id: line.id, quantity });
      continue;
    }
    const level = synced.get(itemId);
    const current = liveIds.has(itemId)
      ? liveQuantities.get(itemId)
      : level && basisQuantity(level, stocktake.quantityBasis);
    // No reading (not stocked any more, or not synced) is not evidence of
    // movement; Shopify answers for such an item when the change is sent.
    if (current === null || current === undefined) continue;
    if (current !== line.expectedQty) {
      moved.push({ id: line.id, quantity: current });
    } else if (line.movementDetectedQty !== null) {
      settledAgain.push(line.id);
    }
  }

  const flagged = moved.slice(0, MOVEMENT_BATCH_LIMIT);
  if (
    nowRead.length === 0 &&
    notStocked.length === 0 &&
    flagged.length === 0 &&
    settledAgain.length === 0
  ) {
    return {
      awaitingReview: lines.filter(awaitsMovementReview).length,
      unread,
      expectedChanged: false,
    };
  }

  const byQuantity = (entries: Array<{ id: string; quantity: number }>) => {
    const grouped = new Map<number, string[]>();
    for (const { id, quantity } of entries) {
      const ids = grouped.get(quantity) ?? [];
      ids.push(id);
      grouped.set(quantity, ids);
    }
    return grouped;
  };
  const readAt = clock(options)();
  return db.$transaction(async (tx: TenantDb) => {
    if (!(await lockOpenStocktake(tx, stocktake.id))) {
      return { awaitingReview: 0, unread: 0, expectedChanged: false };
    }
    const unreviewedLine = {
      stocktakeId: stocktake.id,
      movementReviewedAt: null,
    };
    let expectedChanged = false;
    for (const [quantity, ids] of byQuantity(nowRead)) {
      const updated = await tx.stocktakeLineItem.updateMany({
        where: { ...unreviewedLine, id: { in: ids }, expectedReadAt: null },
        data: expectedReadNow(quantity, readAt),
      });
      expectedChanged ||= updated.count > 0;
    }
    for (const part of chunked(notStocked, LOOKUP_CHUNK)) {
      await tx.stocktakeLineItem.updateMany({
        where: { ...unreviewedLine, id: { in: part }, expectedReadAt: null },
        data: { expectedReadAt: readAt },
      });
    }
    for (const [quantity, ids] of byQuantity(flagged)) {
      await tx.stocktakeLineItem.updateMany({
        where: { ...unreviewedLine, id: { in: ids } },
        data: { movementDetectedQty: quantity },
      });
    }
    for (const part of chunked(settledAgain, LOOKUP_CHUNK)) {
      await tx.stocktakeLineItem.updateMany({
        where: { ...unreviewedLine, id: { in: part } },
        data: { movementDetectedQty: null },
      });
    }
    const awaitingReview = (await tx.stocktakeLineItem.count({
      where: {
        ...unreviewedLine,
        countedQty: { not: null },
        movementDetectedQty: { not: null },
      },
    })) as number;
    return { awaitingReview, unread, expectedChanged };
  });
}

const itemsText = (count: number) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? "item" : "items"}`;

/**
 * Apply a count's variances to Shopify and close the count.
 *
 * Before anything is sent the count must be whole: items without a count are
 * either counted, zero-filled or explicitly left unchanged
 * (`acceptUncounted`), and every line whose stock moved in Shopify during the
 * count has been reviewed.
 *
 * The count is closed only when the ledger shows every variance applied.
 * Pressing complete again, twice at once, or after a partial failure sends
 * only what Shopify has not confirmed yet; a completed count sends nothing.
 */
export async function completeStocktake(
  db: TenantDb,
  admin: AdminGraphQLClient | null,
  actor: InventoryActor,
  stocktakeId: string,
  options: CompleteStocktakeOptions = {},
): Promise<CompleteStocktakeResult> {
  const fail = (
    error: string,
    extra: {
      problems?: StocktakeLineProblem[];
      blocker?: CompletionBlocker;
    } = {},
  ): CompleteStocktakeResult => ({
    ok: false,
    error,
    problems: extra.problems ?? [],
    blocker: extra.blocker ?? null,
  });
  const notOpen = async (): Promise<CompleteStocktakeResult> => {
    const now = await findStocktake(db, stocktakeId);
    return now?.status === "COMPLETED"
      ? { ok: true, alreadyCompleted: true }
      : fail("Only a count that is in progress can be completed.");
  };

  const stocktake = await findStocktake(db, stocktakeId);
  if (!stocktake) return fail(NOT_FOUND_MESSAGE);
  if (stocktake.status !== "IN_PROGRESS") return notOpen();

  const isEnabled = options.isCapabilityEnabled ?? isInventoryWriteEnabled;
  if (!isEnabled("stocktakeInventoryWrites")) {
    return fail(
      "Stocktake inventory changes are switched off for this app. Nothing was sent to Shopify and the count stays open.",
    );
  }

  const lines = await loadCountLines(db, stocktake.id);
  let built = await buildStocktakeDocument(db, stocktake, lines);
  if (!built.ok) return fail(built.error);

  const uncounted = lines.filter((line) => line.countedQty === null).length;
  if (uncounted > 0 && !options.acceptUncounted) {
    return fail(
      uncounted === 1
        ? "1 item on this count has no count. Count it, mark it as zero, or complete the count leaving it unchanged."
        : `${itemsText(uncounted)} on this count have no count. Count them, mark them as zero, or complete the count leaving them unchanged.`,
      { blocker: "UNCOUNTED" },
    );
  }

  const check = await checkAgainstShopify(db, admin, stocktake, lines, options);
  if (check === null) {
    return fail(
      "Shopify's current quantities could not be read, so the count was not completed. Nothing was sent to Shopify. Try again in a moment.",
    );
  }
  if (check.unread > 0) {
    return fail(
      `Shopify's current quantities still have to be read for ${itemsText(check.unread)} on this count. Complete the count again to continue. Nothing was sent to Shopify.`,
    );
  }
  const awaitingReview = check.awaitingReview;
  if (awaitingReview > 0) {
    return fail(
      `Stock moved in Shopify for ${itemsText(awaitingReview)} while this count was open. Review ${awaitingReview === 1 ? "it" : "them"}, then complete the count again. Nothing was sent to Shopify.`,
      { blocker: "MOVEMENT" },
    );
  }

  if (check.expectedChanged) {
    // Variances are measured from the quantities just read.
    built = await buildStocktakeDocument(
      db,
      stocktake,
      await loadCountLines(db, stocktake.id),
    );
    if (!built.ok) return fail(built.error);
  }

  let settle;
  try {
    settle = await settleInventoryDocument(
      db,
      admin,
      {
        ...built.document,
        actor,
        note: null,
        holdOpen: (tx) => lockOpenStocktake(tx, stocktake.id),
      },
      options,
    );
  } catch (err) {
    if (err instanceof InventoryDocumentClosedError) return notOpen();
    if (err instanceof InventoryOperationConflictError) {
      return fail(
        "This count changed while it was being completed. Reload the page and complete it again.",
      );
    }
    if (err instanceof InventoryOperationValidationError) {
      return fail(err.message);
    }
    throw err;
  }
  if (!settle.settled) {
    return fail(describeUnsettled(settle, "The count stays open."), {
      problems: describeLineProblems(settle.operation, built.lineByItem),
    });
  }

  const outcome = await db.$transaction(async (tx: TenantDb) => {
    if (!(await lockOpenStocktake(tx, stocktake.id))) return "not_open";
    const current = await loadCountLines(tx, stocktake.id);
    if (
      current.some(awaitsMovementReview) ||
      (!options.acceptUncounted &&
        current.some((line) => line.countedQty === null))
    ) {
      return "changed";
    }
    const rebuilt = await buildStocktakeDocument(tx, stocktake, current);
    if (!rebuilt.ok) return "changed";
    const state = await readDocumentLedgerState(tx, rebuilt.document);
    if (state.unfinishedOperationId || state.outstanding.length > 0) {
      return "changed";
    }
    await tx.stocktake.update({
      where: { id: stocktake.id },
      data: {
        status: "COMPLETED",
        completedAt: clock(options)(),
        completedByUserId: actor.shopifyUserId,
      },
    });
    return "closed";
  });

  if (outcome === "closed") return { ok: true, alreadyCompleted: false };
  if (outcome === "not_open") return notOpen();
  return fail(
    "A count was saved while this stocktake was being completed. Complete it again to apply the latest counts.",
  );
}

/**
 * Abandon a count without changing stock. A count that has already changed
 * stock in Shopify, or whose last attempt Shopify has not finished answering,
 * cannot be cancelled: it has to be completed so the ledger and Shopify agree.
 */
export async function cancelStocktake(
  db: TenantDb,
  input: { stocktakeId: string; actor?: InventoryActor | null },
  options: { now?: () => Date } = {},
): Promise<CancelStocktakeResult> {
  const stocktake = await findStocktake(db, input.stocktakeId);
  if (!stocktake) return { ok: false, error: NOT_FOUND_MESSAGE };
  if (stocktake.status === "CANCELLED") {
    return { ok: true, alreadyCancelled: true };
  }

  return db.$transaction(async (tx: TenantDb) => {
    if (!(await lockOpenStocktake(tx, stocktake.id))) {
      const now = await findStocktake(tx, stocktake.id);
      return now?.status === "CANCELLED"
        ? { ok: true as const, alreadyCancelled: true }
        : {
            ok: false as const,
            error: "Only a count that is in progress can be cancelled.",
          };
    }
    const state = await readDocumentLedgerState(
      tx,
      stocktakeDocument(stocktake.id, []),
    );
    if (state.unfinishedOperationId) {
      return {
        ok: false as const,
        error:
          "Shopify has not finished answering for this count's last attempt. Complete the count again first; it cannot be cancelled until then.",
      };
    }
    if (state.outstanding.length > 0) {
      return {
        ok: false as const,
        error: `This count has already changed ${itemsText(state.outstanding.length)} in Shopify, so it cannot be cancelled. Complete it, or set those counts back to their expected quantities and complete it to put the stock back.`,
      };
    }
    await tx.stocktake.update({
      where: { id: stocktake.id },
      data: {
        status: "CANCELLED",
        cancelledAt: clock(options)(),
        cancelledByUserId: input.actor?.shopifyUserId ?? null,
      },
    });
    return { ok: true as const, alreadyCancelled: false };
  });
}
