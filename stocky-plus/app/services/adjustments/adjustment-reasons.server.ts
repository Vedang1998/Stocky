import type { TenantDb } from "../../tenant/tenant-db.server";
import { isUniqueViolation } from "../inventory-writes/ledger.server";
import type { InventoryActor } from "../inventory-writes/types";
import {
  MAX_ADJUSTMENT_REASON_NAME_LENGTH,
  MAX_OWN_ADJUSTMENT_REASONS,
  isAdjustmentReason,
  isBuiltInReasonName,
  normalizeReasonName,
  reasonNameKey,
} from "./adjustment-input";

/** One of the shop's own adjustment reasons. */
export interface OwnAdjustmentReason {
  id: string;
  name: string;
  /** The Shopify reason code an adjustment with this reason is recorded under. */
  shopifyReason: string;
}

export type OwnAdjustmentReasonResult =
  { ok: true; reason: OwnAdjustmentReason } | { ok: false; error: string };

export interface OwnAdjustmentReasonInput {
  name: string;
  shopifyReason: unknown;
}

const REASON_SELECT = { id: true, name: true, shopifyReason: true } as const;

const NOT_FOUND =
  "That reason is no longer in your list. Reload the page to see the current list.";

const fail = (error: string): OwnAdjustmentReasonResult => ({
  ok: false,
  error,
});

const toReason = (row: OwnAdjustmentReason): OwnAdjustmentReason => ({
  id: row.id,
  name: row.name,
  shopifyReason: row.shopifyReason,
});

type CheckedInput =
  | { ok: true; name: string; nameKey: string; shopifyReason: string }
  | { ok: false; error: string };

function checkInput(input: OwnAdjustmentReasonInput): CheckedInput {
  const name = normalizeReasonName(input.name);
  if (name === "") return { ok: false, error: "Enter a name for the reason." };
  if (name.length > MAX_ADJUSTMENT_REASON_NAME_LENGTH) {
    return {
      ok: false,
      error: `A reason name can be at most ${MAX_ADJUSTMENT_REASON_NAME_LENGTH} characters.`,
    };
  }
  if (isBuiltInReasonName(name)) {
    return {
      ok: false,
      error: `"${name}" is already one of the built-in reasons. Choose another name.`,
    };
  }
  if (!isAdjustmentReason(input.shopifyReason)) {
    return {
      ok: false,
      error: "Choose the Shopify reason this reason counts as.",
    };
  }
  return {
    ok: true,
    name,
    nameKey: reasonNameKey(name),
    shopifyReason: input.shopifyReason,
  };
}

const nameTaken = (name: string): OwnAdjustmentReasonResult =>
  fail(`You already have a reason called "${name}".`);

/** The shop's own reasons, in name order. */
export async function listOwnAdjustmentReasons(
  db: TenantDb,
): Promise<OwnAdjustmentReason[]> {
  const rows = (await db.adjustmentReason.findMany({
    select: REASON_SELECT,
    orderBy: [{ nameKey: "asc" }, { id: "asc" }],
    // The limit is checked when a reason is added; this bounds the read all
    // the same.
    take: MAX_OWN_ADJUSTMENT_REASONS * 2,
  })) as OwnAdjustmentReason[];
  return rows.map(toReason);
}

export async function findOwnAdjustmentReason(
  db: TenantDb,
  id: string,
): Promise<OwnAdjustmentReason | null> {
  const row = (await db.adjustmentReason.findFirst({
    where: { id },
    select: REASON_SELECT,
  })) as OwnAdjustmentReason | null;
  return row ? toReason(row) : null;
}

export async function addOwnAdjustmentReason(
  db: TenantDb,
  actor: InventoryActor,
  input: OwnAdjustmentReasonInput,
): Promise<OwnAdjustmentReasonResult> {
  const checked = checkInput(input);
  if (!checked.ok) return fail(checked.error);

  try {
    return await db.$transaction(async (tx) => {
      // Two additions at the same moment can each see room for one more; the
      // limit keeps the list short, and one over it does no harm.
      const count = await tx.adjustmentReason.count({});
      if (count >= MAX_OWN_ADJUSTMENT_REASONS) {
        return fail(
          `A shop can have at most ${MAX_OWN_ADJUSTMENT_REASONS} reasons of its own. Remove one you no longer use first.`,
        );
      }
      const created = (await tx.adjustmentReason.create({
        data: {
          name: checked.name,
          nameKey: checked.nameKey,
          shopifyReason: checked.shopifyReason,
          createdByUserId: actor.shopifyUserId,
        },
        select: REASON_SELECT,
      })) as OwnAdjustmentReason;
      return { ok: true, reason: toReason(created) };
    });
  } catch (err) {
    if (isUniqueViolation(err)) return nameTaken(checked.name);
    throw err;
  }
}

/**
 * Rename a reason or change the Shopify reason it counts as. Adjustments
 * already recorded keep the name and the Shopify reason they were recorded
 * with.
 */
export async function updateOwnAdjustmentReason(
  db: TenantDb,
  id: string,
  input: OwnAdjustmentReasonInput,
): Promise<OwnAdjustmentReasonResult> {
  const checked = checkInput(input);
  if (!checked.ok) return fail(checked.error);

  try {
    // In a transaction so that two edits of one reason queue on its row.
    return await db.$transaction(async (tx) => {
      const { count } = (await tx.adjustmentReason.updateMany({
        where: { id },
        data: {
          name: checked.name,
          nameKey: checked.nameKey,
          shopifyReason: checked.shopifyReason,
        },
      })) as { count: number };
      const updated =
        count === 1 ? await findOwnAdjustmentReason(tx, id) : null;
      return updated ? { ok: true, reason: updated } : fail(NOT_FOUND);
    });
  } catch (err) {
    if (isUniqueViolation(err)) return nameTaken(checked.name);
    throw err;
  }
}

/** Take a reason off the list. Adjustments recorded with it keep its name. */
export async function removeOwnAdjustmentReason(
  db: TenantDb,
  id: string,
): Promise<OwnAdjustmentReasonResult> {
  return db.$transaction(async (tx) => {
    const reason = await findOwnAdjustmentReason(tx, id);
    if (!reason) return fail(NOT_FOUND);
    await tx.adjustmentReason.deleteMany({ where: { id } });
    return { ok: true, reason };
  });
}
