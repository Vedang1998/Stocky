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
import type { InventoryActor } from "../inventory-writes/types";
import {
  findVariantInventoryItems,
  ledgerVariantId,
} from "../inventory-writes/variant-items.server";

interface StocktakeLine {
  id: string;
  shopifyVariantId: string;
  expectedQty: number;
  countedQty: number | null;
}

interface StocktakeWithLines {
  id: string;
  locationId: string;
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  lineItems: StocktakeLine[];
}

export type StocktakeActionResult = { ok: true } | { ok: false; error: string };

export type StocktakeLineProblem = DocumentLineProblem;

export type CompleteStocktakeResult =
  | { ok: true; alreadyCompleted: boolean }
  | { ok: false; error: string; problems: StocktakeLineProblem[] };

const CLOSED_MESSAGE =
  "This count is closed. Its lines can no longer be changed.";

/**
 * Hold the stocktake row for the rest of the transaction, provided the count
 * is still open. Completion takes the same lock before it closes the count,
 * so a line saved under it is always seen by the closing check.
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

export const MAX_COUNTED_QUANTITY = 1_000_000;
const MAX_NAME_LENGTH = 120;

/**
 * Start a count at one location. Expected quantities are frozen from the
 * latest inventory snapshot of every variant stocked there.
 */
export async function createStocktake(
  db: TenantDb,
  input: { shop: string; locationId: string | null; name: string | null },
): Promise<StocktakeActionResult> {
  if (!input.locationId) {
    return { ok: false, error: "Choose the location to count." };
  }
  const active = await findActiveLocationIds(db, [input.locationId]);
  if (!active.has(input.locationId)) {
    return {
      ok: false,
      error:
        "That location is not an active, synced location of this shop. Run a sync from the dashboard, then try again.",
    };
  }
  const name = input.name?.trim() ?? "";
  if (name.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      error: `The name can be at most ${MAX_NAME_LENGTH} characters.`,
    };
  }

  const snapshots = (await db.inventorySnapshot.findMany({
    where: { locationId: input.locationId },
    orderBy: { snapshotDate: "desc" },
    distinct: ["shopifyVariantId"],
  })) as Array<{ shopifyVariantId: string; quantityAvailable: number }>;

  const startedAt = new Date();
  await db.stocktake.create({
    data: {
      shop: input.shop,
      locationId: input.locationId,
      name: name || `Count ${startedAt.toISOString().slice(0, 10)}`,
      status: "IN_PROGRESS",
      startedAt,
      lineItems: {
        create: snapshots.map((snapshot) => ({
          shopifyVariantId: snapshot.shopifyVariantId,
          expectedQty: snapshot.quantityAvailable,
        })),
      },
    },
  });
  return { ok: true };
}

export async function saveStocktakeCount(
  db: TenantDb,
  input: { lineId: string; countedQty: number },
): Promise<StocktakeActionResult> {
  const line = (await db.stocktakeLineItem.findFirst({
    where: { id: input.lineId },
  })) as { id: string; stocktakeId: string } | null;
  if (!line) return { ok: false, error: "Stocktake line not found" };

  return db.$transaction(async (tx: TenantDb) => {
    if (!(await lockOpenStocktake(tx, line.stocktakeId))) {
      return { ok: false as const, error: CLOSED_MESSAGE };
    }
    await tx.stocktakeLineItem.update({
      where: { id: line.id },
      data: { countedQty: input.countedQty },
    });
    return { ok: true as const };
  });
}

export async function addStocktakeLine(
  db: TenantDb,
  input: { stocktakeId: string; shopifyVariantId: string },
): Promise<StocktakeActionResult> {
  const stocktake = (await db.stocktake.findFirst({
    where: { id: input.stocktakeId },
  })) as { id: string; locationId: string } | null;
  if (!stocktake) return { ok: false, error: "Stocktake not found" };

  const known = await findVariantInventoryItems(db, [input.shopifyVariantId]);
  if (!known.has(input.shopifyVariantId)) {
    return { ok: false, error: "That variant is not in this shop's catalog." };
  }

  const snapshot = (await db.inventorySnapshot.findFirst({
    where: {
      shopifyVariantId: input.shopifyVariantId,
      locationId: stocktake.locationId,
    },
    orderBy: { snapshotDate: "desc" },
  })) as { quantityAvailable: number } | null;

  return db.$transaction(async (tx: TenantDb) => {
    if (!(await lockOpenStocktake(tx, stocktake.id))) {
      return { ok: false as const, error: CLOSED_MESSAGE };
    }
    const existing = await tx.stocktakeLineItem.findFirst({
      where: {
        stocktakeId: stocktake.id,
        shopifyVariantId: input.shopifyVariantId,
      },
    });
    if (!existing) {
      await tx.stocktakeLineItem.create({
        data: {
          stocktakeId: stocktake.id,
          shopifyVariantId: input.shopifyVariantId,
          expectedQty: snapshot?.quantityAvailable ?? 0,
        },
      });
    }
    return { ok: true as const };
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

/**
 * The stock change a count stands for: counted minus expected for every
 * counted line, as a relative change so sales made during the count are kept.
 * Uncounted lines are left alone; they are never treated as zero.
 */
async function buildStocktakeDocument(
  db: TenantDb,
  stocktake: StocktakeWithLines,
): Promise<BuiltDocument> {
  const counted = stocktake.lineItems.filter((l) => l.countedQty !== null);
  if (counted.length === 0) {
    return { ok: false, error: "Enter at least one count before completing." };
  }

  const variances = counted.filter((l) => l.countedQty !== l.expectedQty);
  const items = await findVariantInventoryItems(
    db,
    variances.map((l) => l.shopifyVariantId),
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
      delta: line.countedQty! - line.expectedQty,
      changeFromQuantity: null,
    };
  });

  return {
    ok: true,
    document: {
      kind: "STOCKTAKE",
      source: { type: "Stocktake", id: stocktake.id },
      reason: "cycle_count_available",
      quantityName: "available",
      referenceDocumentUri: `gid://propo/Stocktake/${stocktake.id}`,
      desired,
    },
    lineByItem,
  };
}

async function loadStocktake(
  db: TenantDb,
  stocktakeId: string,
): Promise<StocktakeWithLines | null> {
  return (await db.stocktake.findFirst({
    where: { id: stocktakeId },
    include: { lineItems: true },
  })) as StocktakeWithLines | null;
}

/**
 * Apply a count's variances to Shopify and close the count.
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
  options: ExecuteInventoryOperationOptions = {},
): Promise<CompleteStocktakeResult> {
  const fail = (
    error: string,
    problems: StocktakeLineProblem[] = [],
  ): CompleteStocktakeResult => ({ ok: false, error, problems });

  const stocktake = await loadStocktake(db, stocktakeId);
  if (!stocktake) return fail("Stocktake not found");
  if (stocktake.status === "COMPLETED") {
    return { ok: true, alreadyCompleted: true };
  }
  if (stocktake.status !== "IN_PROGRESS") {
    return fail("Only a count that is in progress can be completed.");
  }

  const isEnabled = options.isCapabilityEnabled ?? isInventoryWriteEnabled;
  if (!isEnabled("stocktakeInventoryWrites")) {
    return fail(
      "Stocktake inventory changes are switched off for this app. Nothing was sent to Shopify and the count stays open.",
    );
  }

  const built = await buildStocktakeDocument(db, stocktake);
  if (!built.ok) return fail(built.error);

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
    if (err instanceof InventoryDocumentClosedError) {
      const now = await loadStocktake(db, stocktake.id);
      return now?.status === "COMPLETED"
        ? { ok: true, alreadyCompleted: true }
        : fail("Only a count that is in progress can be completed.");
    }
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
    return fail(
      `${describeUnsettled(settle)} The count stays open.`,
      describeLineProblems(settle.operation, built.lineByItem),
    );
  }

  const outcome = await db.$transaction(async (tx: TenantDb) => {
    if (!(await lockOpenStocktake(tx, stocktake.id))) return "not_open";
    const current = await loadStocktake(tx, stocktake.id);
    const rebuilt = current && (await buildStocktakeDocument(tx, current));
    if (!rebuilt || !rebuilt.ok) return "changed";
    const state = await readDocumentLedgerState(tx, rebuilt.document);
    if (state.unfinishedOperationId || state.outstanding.length > 0) {
      return "changed";
    }
    await tx.stocktake.update({
      where: { id: stocktake.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return "closed";
  });

  if (outcome === "closed") return { ok: true, alreadyCompleted: false };
  if (outcome === "not_open") {
    const now = await loadStocktake(db, stocktake.id);
    return now?.status === "COMPLETED"
      ? { ok: true, alreadyCompleted: true }
      : fail("Only a count that is in progress can be completed.");
  }
  return fail(
    "A count was saved while this stocktake was being completed. Complete it again to apply the latest counts.",
  );
}
