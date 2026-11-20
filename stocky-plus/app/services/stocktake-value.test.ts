/**
 * What a count's differences are worth: the arithmetic, the wording, which
 * costs are read and how they are kept on a completed count. The same reads
 * and writes run against PostgreSQL in
 * scripts/tenant-enforcement/tests/stocktake-workflow.test.ts.
 */
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  differenceValueAmount,
  differenceValueLine,
  differenceValueNote,
  signedMoney,
  type DifferenceValue,
} from "./stocktakes/stocktake-value";
import {
  keepDifferenceCosts,
  readUnitCosts,
  sumDifferenceValue,
  type UnitCost,
} from "./stocktakes/stocktake-value.server";

const cost = (amount: string, currencyCode = "USD"): UnitCost => ({
  amount: new Prisma.Decimal(amount),
  currencyCode,
});

const worth = (extra: Partial<DifferenceValue> = {}): DifferenceValue => ({
  basis: "CURRENT",
  totals: [{ currencyCode: "USD", amount: "-214.5" }],
  costedCount: 3,
  uncostedCount: 0,
  ...extra,
});

describe("Adding up the differences", () => {
  it("is units over less units short, each at its unit cost", () => {
    expect(
      sumDifferenceValue(
        [
          { delta: -3, unitCost: cost("4.250000") },
          { delta: 2, unitCost: cost("12.500000") },
        ],
        "CURRENT",
      ),
    ).toEqual({
      basis: "CURRENT",
      totals: [{ currencyCode: "USD", amount: "12.25" }],
      costedCount: 2,
      uncostedCount: 0,
    });
  });

  it("does the arithmetic in decimals, exactly", () => {
    // 0.1 + 0.2 and 1.005 are the classic binary floating point failures.
    const value = sumDifferenceValue(
      [
        { delta: 1, unitCost: cost("0.100000") },
        { delta: 1, unitCost: cost("0.200000") },
        { delta: 3, unitCost: cost("1.005000") },
        { delta: -1, unitCost: cost("0.000001") },
      ],
      "CURRENT",
    );

    expect(value.totals).toEqual([{ currencyCode: "USD", amount: "3.314999" }]);
  });

  it("keeps a total far larger than a JavaScript number holds exactly", () => {
    const value = sumDifferenceValue(
      [
        { delta: 1_000_000, unitCost: cost("99999999999999.999999") },
        { delta: 1, unitCost: cost("0.000001") },
      ],
      "COMPLETION",
    );

    expect(value.totals[0].amount).toBe("99999999999999999999.000001");
  });

  it("counts a difference with no unit cost and leaves it out of the total", () => {
    expect(
      sumDifferenceValue(
        [
          { delta: -3, unitCost: cost("4.25") },
          { delta: 5, unitCost: null },
          { delta: -1, unitCost: null },
        ],
        "CURRENT",
      ),
    ).toMatchObject({
      totals: [{ currencyCode: "USD", amount: "-12.75" }],
      costedCount: 1,
      uncostedCount: 2,
    });
  });

  it("ignores lines counted as expected, whatever they cost", () => {
    expect(
      sumDifferenceValue(
        [
          { delta: 0, unitCost: cost("1000") },
          { delta: 0, unitCost: null },
        ],
        "CURRENT",
      ),
    ).toEqual({
      basis: "CURRENT",
      totals: [],
      costedCount: 0,
      uncostedCount: 0,
    });
  });

  it("reports nothing when overs and shorts cancel out, not an empty total", () => {
    const value = sumDifferenceValue(
      [
        { delta: -2, unitCost: cost("5") },
        { delta: 1, unitCost: cost("10") },
      ],
      "CURRENT",
    );

    expect(value.totals).toEqual([{ currencyCode: "USD", amount: "0" }]);
    expect(differenceValueAmount(value)).toBe("$0.00");
  });

  it("never adds one currency to another", () => {
    const value = sumDifferenceValue(
      [
        { delta: -1, unitCost: cost("10", "USD") },
        { delta: 2, unitCost: cost("3", "EUR") },
        { delta: -1, unitCost: cost("2.5", "USD") },
      ],
      "CURRENT",
    );

    expect(value.totals).toEqual([
      { currencyCode: "EUR", amount: "6" },
      { currencyCode: "USD", amount: "-12.5" },
    ]);
    expect(differenceValueAmount(value)).toBe("+€6.00 and -$12.50");
  });
});

describe("Saying what the differences are worth", () => {
  it("signs a gain, leaves a loss as it is, and gives zero no sign", () => {
    expect(signedMoney("37", "USD")).toBe("+$37.00");
    expect(signedMoney("-214.5", "USD")).toBe("-$214.50");
    expect(signedMoney("0", "USD")).toBe("$0.00");
    expect(signedMoney("0.000", "USD")).toBe("$0.00");
  });

  it("rounds to the currency's own decimals, half away from zero", () => {
    expect(signedMoney("-12.375", "USD")).toBe("-$12.38");
    expect(signedMoney("1250.4", "JPY")).toBe("+¥1,250");
    expect(signedMoney("1.0005", "KWD")).toBe("+KWD\u00a01.001");
  });

  it("says which cost an open count is valued at", () => {
    expect(differenceValueLine(worth())).toBe(
      "Value of differences: -$214.50. At Shopify's unit cost as last synced.",
    );
  });

  it("says which cost a completed count is valued at", () => {
    expect(differenceValueLine(worth({ basis: "COMPLETION" }))).toBe(
      "Value of differences: -$214.50. At Shopify's unit cost when the count was completed.",
    );
  });

  it("says what is left out, in the singular and the plural", () => {
    expect(differenceValueNote(worth({ uncostedCount: 1 }))).toBe(
      "At Shopify's unit cost as last synced. 1 item with a difference has no unit cost in Shopify and is not in this figure.",
    );
    expect(differenceValueNote(worth({ uncostedCount: 1_200 }))).toBe(
      "At Shopify's unit cost as last synced. 1,200 items with a difference have no unit cost in Shopify and are not in this figure.",
    );
    expect(
      differenceValueNote(worth({ basis: "COMPLETION", uncostedCount: 2 })),
    ).toBe(
      "At Shopify's unit cost when the count was completed. 2 items with a difference had no unit cost when the count was completed and are not in this figure.",
    );
  });

  it("gives no figure when no difference has a cost", () => {
    const none = worth({ totals: [], costedCount: 0, uncostedCount: 4 });

    expect(differenceValueAmount(none)).toBeNull();
    expect(differenceValueLine(none)).toBe(
      "Value of differences: not known. 4 items with a difference have no unit cost in Shopify.",
    );
    expect(differenceValueLine({ ...none, basis: "COMPLETION" })).toBe(
      "Value of differences: not known. 4 items with a difference had no unit cost when the count was completed.",
    );
  });

  it("says nothing for a count without differences", () => {
    const none = worth({ totals: [], costedCount: 0, uncostedCount: 0 });

    expect(differenceValueNote(none)).toBeNull();
    expect(differenceValueLine(none)).toBeNull();
  });
});

describe("Which unit costs are read", () => {
  const RED = "gid://shopify/ProductVariant/1";
  const WHITE = "gid://shopify/ProductVariant/2";

  function catalog(rows: unknown[]) {
    const findMany = vi.fn<(query: unknown) => Promise<unknown[]>>(
      async () => rows,
    );
    return { db: { shopifyInventoryItemFact: { findMany } }, findMany };
  }

  it("asks for live items whose cost Shopify gave, once for each variant", async () => {
    const { db, findMany } = catalog([]);

    await readUnitCosts(db as never, [RED, WHITE, RED]);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        existenceState: "LIVE",
        unitCostAccess: "PRESENT",
        shopifyVariantGid: { in: [RED, WHITE] },
      },
      select: {
        shopifyVariantGid: true,
        unitCostAmount: true,
        unitCostCurrencyCode: true,
      },
      orderBy: { shopifyGid: "asc" },
    });
  });

  it("asks nothing when there are no variants", async () => {
    const { db, findMany } = catalog([]);

    expect((await readUnitCosts(db as never, [])).size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("looks a long count up in several queries", async () => {
    const { db, findMany } = catalog([]);
    const many = Array.from(
      { length: 4_500 },
      (_, index) => `gid://shopify/ProductVariant/${index + 1}`,
    );

    await readUnitCosts(db as never, many);

    expect(
      findMany.mock.calls.map(
        ([query]) =>
          (query as { where: { shopifyVariantGid: { in: string[] } } }).where
            .shopifyVariantGid.in.length,
      ),
    ).toEqual([2_000, 2_000, 500]);
  });

  it("takes an amount only with its currency, never a negative one, and the first item of a variant", async () => {
    const row = (
      shopifyVariantGid: string | null,
      amount: string | null,
      unitCostCurrencyCode: string | null,
    ) => ({
      shopifyVariantGid,
      unitCostAmount: amount === null ? null : new Prisma.Decimal(amount),
      unitCostCurrencyCode,
    });
    const { db } = catalog([
      row(RED, "4.250000", "USD"),
      row(RED, "9.000000", "USD"),
      row(WHITE, "-1.000000", "USD"),
      row("gid://shopify/ProductVariant/3", "2.000000", null),
      row("gid://shopify/ProductVariant/4", null, "USD"),
      row(null, "7.000000", "USD"),
    ]);

    const costs = await readUnitCosts(db as never, [RED, WHITE]);

    expect(
      [...costs.entries()].map(([variant, unitCost]) => [
        variant,
        unitCost.amount.toFixed(),
        unitCost.currencyCode,
      ]),
    ).toEqual([[RED, "4.25", "USD"]]);
  });
});

describe("Keeping unit costs when a count is completed", () => {
  const ID = "st-1";
  const variant = (n: number) => `gid://shopify/ProductVariant/${n}`;

  interface Line {
    id: string;
    shopifyVariantId: string;
    expectedQty: number;
    countedQty: number | null;
    movementBaselineQty: number | null;
    unitCostAmount: Prisma.Decimal | null;
    unitCostCurrencyCode: string | null;
  }

  const line = (
    n: number,
    countedQty: number | null,
    kept?: UnitCost,
  ): Line => ({
    id: `line-${n}`,
    shopifyVariantId: variant(n),
    expectedQty: 10,
    countedQty,
    movementBaselineQty: null,
    unitCostAmount: kept?.amount ?? null,
    unitCostCurrencyCode: kept?.currencyCode ?? null,
  });

  function database(lines: Line[], costs: Record<number, UnitCost>) {
    const updateMany = vi.fn<(query: unknown) => Promise<{ count: number }>>(
      async () => ({ count: 0 }),
    );
    return {
      updateMany,
      db: {
        stocktakeLineItem: { findMany: vi.fn(async () => lines), updateMany },
        shopifyInventoryItemFact: {
          findMany: vi.fn<(query: unknown) => Promise<unknown[]>>(async () =>
            Object.entries(costs).map(([n, unitCost]) => ({
              shopifyVariantGid: variant(Number(n)),
              unitCostAmount: unitCost.amount,
              unitCostCurrencyCode: unitCost.currencyCode,
            })),
          ),
        },
      },
    };
  }

  /** `[line IDs, amount, currency]` of each statement, in a stable order. */
  const writes = (updateMany: ReturnType<typeof database>["updateMany"]) =>
    updateMany.mock.calls
      .map(([query]) => {
        const { where, data } = query as unknown as {
          where: {
            stocktakeId: string;
            id: { in: string[] };
            stocktake: { status: string };
          };
          data: {
            unitCostAmount: Prisma.Decimal | null;
            unitCostCurrencyCode: string | null;
          };
        };
        expect(where.stocktakeId).toBe(ID);
        // Never a line of a count that has closed.
        expect(where.stocktake).toEqual({ status: "IN_PROGRESS" });
        return [
          where.id.in,
          data.unitCostAmount?.toFixed() ?? null,
          data.unitCostCurrencyCode,
        ];
      })
      .sort((a, b) => String(a[1]).localeCompare(String(b[1])));

  it("writes one statement for each distinct cost, only for lines with a difference", async () => {
    const { db, updateMany } = database(
      [
        line(1, 7),
        line(2, 12),
        line(3, 9),
        line(4, 10), // counted as expected
        line(5, null), // not counted
      ],
      { 1: cost("4.25"), 2: cost("4.250000"), 3: cost("8"), 4: cost("99") },
    );

    await keepDifferenceCosts(db as never, ID);

    expect(writes(updateMany)).toEqual([
      [["line-1", "line-2"], "4.25", "USD"],
      [["line-3"], "8", "USD"],
    ]);
  });

  it("asks for the costs of the lines with a difference only", async () => {
    const { db } = database([line(1, 7), line(2, 10), line(3, null)], {});

    await keepDifferenceCosts(db as never, ID);

    expect(db.shopifyInventoryItemFact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          shopifyVariantGid: { in: [variant(1)] },
        }),
      }),
    );
  });

  it("writes nothing for a difference without a cost, and nothing when every cost is already kept", async () => {
    const { db, updateMany } = database(
      [line(1, 7), line(2, 12, cost("6.5"))],
      { 2: cost("6.500000") },
    );

    await keepDifferenceCosts(db as never, ID);

    expect(updateMany).not.toHaveBeenCalled();
  });

  it("clears a cost kept by an earlier attempt from a line that no longer differs or no longer has a cost", async () => {
    const { db, updateMany } = database(
      [
        line(1, 10, cost("4.25")), // corrected to the expected quantity
        line(2, null, cost("3")), // count cleared
        line(3, 7, cost("5")), // the item's cost was removed in Shopify
        line(4, 7, cost("2")), // the cost changed
      ],
      { 4: cost("2.2") },
    );

    await keepDifferenceCosts(db as never, ID);

    expect(writes(updateMany)).toEqual([
      [["line-4"], "2.2", "USD"],
      [["line-3", "line-1", "line-2"], null, null],
    ]);
  });

  it("measures a line counted after stock moved from the quantity it was reviewed at", async () => {
    const moved = { ...line(1, 8), movementBaselineQty: 8 };
    const { db, updateMany } = database([moved], { 1: cost("4.25") });

    await keepDifferenceCosts(db as never, ID);

    // 8 counted against 8: no difference, so no cost is kept.
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("writes a long count in statements of at most 2,000 lines", async () => {
    const lines = Array.from({ length: 4_100 }, (_, index) =>
      line(index + 1, 9),
    );
    const costs = Object.fromEntries(
      lines.map((_, index) => [index + 1, cost("1.5")]),
    );
    const { db, updateMany } = database(lines, costs);

    await keepDifferenceCosts(db as never, ID);

    expect(
      updateMany.mock.calls.map(
        ([query]) =>
          (query as unknown as { where: { id: { in: string[] } } }).where.id.in
            .length,
      ),
    ).toEqual([2_000, 2_000, 100]);
  });
});
