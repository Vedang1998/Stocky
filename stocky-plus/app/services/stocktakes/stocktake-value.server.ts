/**
 * The value of a count's differences at Shopify's unit cost.
 *
 * While a count is open the cost is the one last synced from Shopify
 * (`InventoryItem.unitCost`). When the count is completed the cost of every
 * line that changes stock is kept on the line, so the record of a finished
 * count does not move when costs change later. Amounts are decimals from the
 * database to the text; no JavaScript number carries money.
 */
import { Prisma } from "@prisma/client";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { stocktakeLineDelta } from "./stocktake-delta";
import type { StocktakeStatus } from "./stocktake.server";
import type { DifferenceValue, DifferenceValueBasis } from "./stocktake-value";

export interface UnitCost {
  amount: Prisma.Decimal;
  currencyCode: string;
}

/**
 * Sums and products are worked out with room for every digit. The database
 * holds a cost with up to 20 digits and Prisma's own decimal rounds results
 * to 20 significant digits, which a large count at a large cost could pass.
 */
const Exact = Prisma.Decimal.clone({ precision: 60 });

/** A line's difference at its unit cost, as a plain decimal. */
const valueOf = (delta: number, unitCost: UnitCost) =>
  new Exact(unitCost.amount.toFixed()).times(delta);

/** Lists longer than this are looked up or written in several queries. */
const CHUNK = 2_000;

function chunked<T>(values: readonly T[], size = CHUNK): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < values.length; start += size) {
    chunks.push(values.slice(start, start + size));
  }
  return chunks;
}

/**
 * Shopify's unit cost of each of these variants that has one, as last synced.
 * A variant is absent when its item has no cost in Shopify, when the cost
 * could not be read, or when the item is no longer in the catalog.
 */
export async function readUnitCosts(
  db: TenantDb,
  variantIds: readonly string[],
): Promise<Map<string, UnitCost>> {
  const costs = new Map<string, UnitCost>();
  for (const part of chunked([...new Set(variantIds)])) {
    const rows = (await db.shopifyInventoryItemFact.findMany({
      where: {
        existenceState: "LIVE",
        unitCostAccess: "PRESENT",
        shopifyVariantGid: { in: part },
      },
      select: {
        shopifyVariantGid: true,
        unitCostAmount: true,
        unitCostCurrencyCode: true,
      },
      orderBy: { shopifyGid: "asc" },
    })) as Array<{
      shopifyVariantGid: string | null;
      unitCostAmount: Prisma.Decimal | null;
      unitCostCurrencyCode: string | null;
    }>;
    for (const row of rows) {
      if (
        row.shopifyVariantGid === null ||
        row.unitCostAmount === null ||
        row.unitCostCurrencyCode === null ||
        row.unitCostAmount.isNegative() ||
        costs.has(row.shopifyVariantGid)
      ) {
        continue;
      }
      costs.set(row.shopifyVariantGid, {
        amount: row.unitCostAmount,
        currencyCode: row.unitCostCurrencyCode,
      });
    }
  }
  return costs;
}

/** One line's difference and the unit cost it is valued at, if it has one. */
export interface ValuedDifference {
  delta: number;
  unitCost: UnitCost | null;
}

/** Add up differences at their unit costs. Lines without a difference are ignored. */
export function sumDifferenceValue(
  differences: Iterable<ValuedDifference>,
  basis: DifferenceValueBasis,
): DifferenceValue {
  const byCurrency = new Map<string, Prisma.Decimal>();
  let costedCount = 0;
  let uncostedCount = 0;
  for (const { delta, unitCost } of differences) {
    if (delta === 0) continue;
    if (!unitCost) {
      uncostedCount += 1;
      continue;
    }
    costedCount += 1;
    byCurrency.set(
      unitCost.currencyCode,
      (byCurrency.get(unitCost.currencyCode) ?? new Exact(0)).plus(
        valueOf(delta, unitCost),
      ),
    );
  }
  return {
    basis,
    totals: [...byCurrency.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([currencyCode, amount]) => ({
        currencyCode,
        amount: amount.toFixed(),
      })),
    costedCount,
    uncostedCount,
  };
}

const VALUE_LINE_SELECT = {
  id: true,
  shopifyVariantId: true,
  expectedQty: true,
  countedQty: true,
  movementBaselineQty: true,
  unitCostAmount: true,
  unitCostCurrencyCode: true,
} as const;

interface ValueLine {
  id: string;
  shopifyVariantId: string;
  expectedQty: number;
  countedQty: number | null;
  movementBaselineQty: number | null;
  unitCostAmount: Prisma.Decimal | null;
  unitCostCurrencyCode: string | null;
}

export interface StocktakeLineValue {
  unitCost: UnitCost;
  /** The line's difference at that cost: a plain decimal, exact, not rounded to the currency. */
  value: string;
}

interface ValuedCount {
  basis: DifferenceValueBasis;
  /** Every line with a difference, in no particular order. */
  differences: Array<ValuedDifference & { lineId: string }>;
}

/**
 * The lines of a count that have a difference, each with the cost it is
 * valued at. Null for a cancelled count: it changed no stock, so its
 * differences have no value to report.
 */
async function valueCount(
  db: TenantDb,
  stocktake: { id: string; status: StocktakeStatus },
): Promise<ValuedCount | null> {
  if (stocktake.status === "CANCELLED") return null;
  const lines = (await db.stocktakeLineItem.findMany({
    where: { stocktakeId: stocktake.id, countedQty: { not: null } },
    select: VALUE_LINE_SELECT,
  })) as ValueLine[];
  const differing = lines.filter((line) => stocktakeLineDelta(line) !== 0);

  if (stocktake.status === "COMPLETED") {
    return {
      basis: "COMPLETION",
      differences: differing.map((line) => ({
        lineId: line.id,
        delta: stocktakeLineDelta(line)!,
        unitCost:
          line.unitCostAmount !== null && line.unitCostCurrencyCode !== null
            ? {
                amount: line.unitCostAmount,
                currencyCode: line.unitCostCurrencyCode,
              }
            : null,
      })),
    };
  }

  const costs = await readUnitCosts(
    db,
    differing.map((line) => line.shopifyVariantId),
  );
  return {
    basis: "CURRENT",
    differences: differing.map((line) => ({
      lineId: line.id,
      delta: stocktakeLineDelta(line)!,
      unitCost: costs.get(line.shopifyVariantId) ?? null,
    })),
  };
}

/** What a count's differences are worth, or null for a cancelled count. */
export async function getStocktakeDifferenceValue(
  db: TenantDb,
  stocktake: { id: string; status: StocktakeStatus },
): Promise<DifferenceValue | null> {
  const valued = await valueCount(db, stocktake);
  return valued && sumDifferenceValue(valued.differences, valued.basis);
}

/**
 * The unit cost and value of each line that has a difference and a cost, by
 * line ID, for the count report. Empty for a cancelled count.
 */
export async function listStocktakeLineValues(
  db: TenantDb,
  stocktake: { id: string; status: StocktakeStatus },
): Promise<Map<string, StocktakeLineValue>> {
  const values = new Map<string, StocktakeLineValue>();
  const valued = await valueCount(db, stocktake);
  for (const { lineId, delta, unitCost } of valued?.differences ?? []) {
    if (unitCost) {
      values.set(lineId, {
        unitCost,
        value: valueOf(delta, unitCost).toFixed(),
      });
    }
  }
  return values;
}

/**
 * Keep Shopify's unit cost on every line of a count whose count changes
 * stock, and on no other line. Called while the count is being completed,
 * after Shopify has confirmed the changes and before the count is closed; a
 * failure leaves the count open, and completing it again starts over here.
 *
 * The writes are grouped by cost, so a count costs one statement for each
 * distinct cost, not one for each line.
 */
export async function keepDifferenceCosts(
  db: TenantDb,
  stocktakeId: string,
): Promise<void> {
  const lines = (await db.stocktakeLineItem.findMany({
    where: { stocktakeId },
    select: VALUE_LINE_SELECT,
  })) as ValueLine[];
  const differing = lines.filter((line) => {
    const delta = stocktakeLineDelta(line);
    return delta !== null && delta !== 0;
  });
  const costs = await readUnitCosts(
    db,
    differing.map((line) => line.shopifyVariantId),
  );

  const same = (line: ValueLine, cost: UnitCost | undefined) =>
    cost
      ? line.unitCostAmount !== null &&
        line.unitCostAmount.equals(cost.amount) &&
        line.unitCostCurrencyCode === cost.currencyCode
      : line.unitCostAmount === null && line.unitCostCurrencyCode === null;

  const differingIds = new Set(differing.map((line) => line.id));
  const toClear = lines
    .filter((line) => !differingIds.has(line.id) && !same(line, undefined))
    .map((line) => line.id);
  const groups = new Map<string, { cost: UnitCost | null; ids: string[] }>();
  for (const line of differing) {
    const cost = costs.get(line.shopifyVariantId);
    if (same(line, cost)) continue;
    const key = cost ? `${cost.currencyCode} ${cost.amount.toFixed()}` : "";
    const group = groups.get(key) ?? { cost: cost ?? null, ids: [] };
    group.ids.push(line.id);
    groups.set(key, group);
  }
  if (toClear.length > 0) {
    const none = groups.get("") ?? { cost: null, ids: [] };
    none.ids.push(...toClear);
    groups.set("", none);
  }

  for (const { cost, ids } of groups.values()) {
    for (const part of chunked(ids)) {
      await db.stocktakeLineItem.updateMany({
        where: { stocktakeId, id: { in: part } },
        data: {
          unitCostAmount: cost?.amount ?? null,
          unitCostCurrencyCode: cost?.currencyCode ?? null,
        },
      });
    }
  }
}
