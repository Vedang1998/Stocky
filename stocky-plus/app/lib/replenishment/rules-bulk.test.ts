/**
 * applyRuleChanges against a stubbed transaction: what happens when another
 * save changes the same rules between this save's read and its writes. The
 * database tests cover the ordinary paths; these cover the races, which a
 * single connection cannot produce on demand.
 */
import { describe, expect, it, vi } from "vitest";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { describeLevelsOutcome } from "../../components/replenishment/LevelsBulkModal";
import { applyRuleChanges } from "./rules.server";

const A = "gid://shopify/ProductVariant/1";
const B = "gid://shopify/ProductVariant/2";

type Counts = {
  /** Variants that already have a rule when the save reads. */
  ruled?: string[];
  /** Variants still in the synced catalog. */
  live?: string[];
  deleted?: number;
  updated?: number[];
  created?: number;
};

type UpdateArgs = {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
};

function stub(counts: Counts) {
  const updates = [...(counts.updated ?? [])];
  const tx = {
    shopifyLocationFact: { findFirst: vi.fn(async () => ({ id: "loc" })) },
    shopifyVariantFact: {
      findMany: vi.fn(async () =>
        (counts.live ?? []).map((shopifyGid) => ({ shopifyGid })),
      ),
    },
    replenishmentVariantRule: {
      findMany: vi.fn(async () =>
        (counts.ruled ?? []).map((variantGid) => ({ variantGid })),
      ),
      deleteMany: vi.fn(async () => ({ count: counts.deleted ?? 0 })),
      updateMany: vi.fn(async (args: UpdateArgs) => ({
        count: args.where ? (updates.shift() ?? 0) : 0,
      })),
      createMany: vi.fn(async () => ({ count: counts.created ?? 0 })),
    },
  };
  const db = {
    $transaction: vi.fn(async (run: (client: typeof tx) => Promise<unknown>) =>
      run(tx),
    ),
  } as unknown as TenantDb;
  const firstUpdate = (): UpdateArgs => {
    const args = tx.replenishmentVariantRule.updateMany.mock.calls[0]?.[0];
    if (!args) throw new Error("no update was made");
    return args;
  };
  return { db, tx, firstUpdate };
}

describe("applyRuleChanges under concurrent saves", () => {
  it("applies the change to rules another save created after the read, instead of skipping them", async () => {
    // Neither variant had a rule when read; another save created B's first,
    // so the insert adds only A and the follow-up update covers both.
    const { db, tx } = stub({ live: [A, B], created: 1, updated: [2] });
    const outcome = await applyRuleChanges(db, {
      variantGids: [A, B],
      scopeKey: "SHOP",
      changes: { safetyStockQuantity: 6 },
    });
    expect(tx.replenishmentVariantRule.updateMany).toHaveBeenCalledWith({
      where: { variantGid: { in: [A, B] }, scopeKey: "SHOP" },
      data: { safetyStockQuantity: 6 },
    });
    expect(outcome).toEqual({
      updated: 1,
      created: 1,
      cleared: 0,
      skipped: 0,
      missed: 0,
    });
  });

  it("counts a rule deleted by another save before the update as missed, so the merchant is told", async () => {
    // Both had rules when read; another save removed B's before the update.
    const { db } = stub({ ruled: [A, B], updated: [1] });
    const outcome = await applyRuleChanges(db, {
      variantGids: [A, B],
      scopeKey: "SHOP",
      changes: { minimumQuantity: 4 },
    });
    expect(outcome).toEqual({
      updated: 1,
      created: 0,
      cleared: 0,
      skipped: 0,
      missed: 1,
    });
    expect(describeLevelsOutcome(2, outcome)).toBe(
      "Levels applied to 2 variants: 1 variant changed. 1 variant was not changed because someone else saved levels at the same moment. Try again.",
    );
  });

  it("never updates a clear-only change into an empty rule, and counts the rule it left as missed", async () => {
    // A clear of lead time only: the guard keeps the update to rules that
    // still hold another level.
    const { db, firstUpdate } = stub({
      ruled: [A, B],
      deleted: 1,
      updated: [0],
    });
    const outcome = await applyRuleChanges(db, {
      variantGids: [A, B],
      scopeKey: "SHOP",
      changes: { leadTimeDays: null },
    });
    const { where } = firstUpdate();
    expect(where.OR).toEqual([
      { minimumQuantity: { not: null } },
      { shelfLimitQuantity: { not: null } },
      { reorderPointQuantity: { not: null } },
      { safetyStockQuantity: { not: null } },
    ]);
    expect(outcome).toEqual({
      updated: 0,
      created: 0,
      cleared: 1,
      skipped: 0,
      missed: 1,
    });
  });

  it("treats an undefined field as not changed, like an absent one", async () => {
    const { db, tx, firstUpdate } = stub({ ruled: [A], updated: [1] });
    await applyRuleChanges(db, {
      variantGids: [A],
      scopeKey: "SHOP",
      changes: { minimumQuantity: 4, leadTimeDays: undefined },
    });
    expect(firstUpdate().data).toEqual({
      minimumQuantity: 4,
    });
    expect(tx.replenishmentVariantRule.deleteMany).not.toHaveBeenCalled();
  });
});
