import { describe, expect, it } from "vitest";
import { computeSuggestion } from "./suggestion";
import {
  NO_ROUNDING,
  type MethodParameters,
  type SampleWindow,
  type VariantPlanningInput,
} from "./types";
import { sampleWindowFor } from "./windows";

const AS_OF = "2026-11-10";

function input(
  overrides: Partial<VariantPlanningInput> = {},
): VariantPlanningInput {
  return {
    tracked: true,
    available: 0,
    incoming: 0,
    incomingSource: "SHOPIFY_INCOMING",
    netUnitsInWindow: 0,
    coverage: { kind: "FULL" },
    minimumQuantity: null,
    shelfLimitQuantity: null,
    packSize: null,
    minimumOrderQuantity: null,
    ...overrides,
  };
}

function run(
  params: MethodParameters,
  overrides: Partial<VariantPlanningInput> = {},
) {
  return computeSuggestion(
    params,
    sampleWindowFor(params, AS_OF),
    input(overrides),
    NO_ROUNDING,
  );
}

function codes(result: { warnings: { code: string }[] }) {
  return result.warnings.map((w) => w.code);
}

describe("Last X days", () => {
  it("matches Stocky's documented example: 14 sold in 7 days, suggest for 14 days → 28", () => {
    const result = run(
      { method: "LAST_X_DAYS", sampleDays: 7, suggestDays: 14 },
      { netUnitsInWindow: 14 },
    );
    expect(result.dailyVelocity).toBe("2.0000");
    expect(result.forecastDemand).toBe("28.0000");
    expect(result.parityQuantity).toBe(28);
    expect(result.suggestedQuantity).toBe(28);
    expect(result.window).toEqual({
      start: "2026-11-03",
      end: "2026-11-09",
      days: 7,
    });
  });

  it("subtracts available and incoming before rounding up", () => {
    const result = run(
      { method: "LAST_X_DAYS", sampleDays: 30, suggestDays: 14 },
      { netUnitsInWindow: 10, available: 2, incoming: 1 },
    );
    // 10 / 30 × 14 = 4.666…; 4.666… − 3 = 1.666… → 2
    expect(result.forecastDemand).toBe("4.6667");
    expect(result.baseNeed).toBe("1.6667");
    expect(result.parityQuantity).toBe(2);
  });

  it("is exact where floating point would not be", () => {
    // 1/3 × 3 is exactly 1, so the need is exactly 0 and nothing is suggested.
    const result = run(
      { method: "LAST_X_DAYS", sampleDays: 3, suggestDays: 3 },
      { netUnitsInWindow: 1, available: 1 },
    );
    expect(result.baseNeed).toBe("0.0000");
    expect(result.parityQuantity).toBe(0);
  });

  it("never suggests a negative quantity", () => {
    const result = run(
      { method: "LAST_X_DAYS", sampleDays: 30, suggestDays: 30 },
      { netUnitsInWindow: 5, available: 100 },
    );
    expect(result.baseNeed).toBe("-95.0000");
    expect(result.parityQuantity).toBe(0);
    expect(result.trace.at(-1)?.text).toMatch(/already cover/);
  });

  it("covers an oversold shortfall and says so", () => {
    const result = run(
      { method: "LAST_X_DAYS", sampleDays: 10, suggestDays: 10 },
      { netUnitsInWindow: 10, available: -4 },
    );
    expect(result.parityQuantity).toBe(14);
    expect(codes(result)).toContain("NEGATIVE_AVAILABLE");
  });

  it("explains every step in merchant language", () => {
    const result = run(
      { method: "LAST_X_DAYS", sampleDays: 7, suggestDays: 14 },
      { netUnitsInWindow: 14, available: 5, incoming: 3 },
    );
    expect(result.trace.map((s) => s.key)).toEqual([
      "stock.position",
      "sales.window",
      "sales.net",
      "forecast.demand",
      "need.base",
      "suggest.parity",
    ]);
    expect(result.trace[0].text).toBe(
      "In stock: 5 available + 3 incoming (Shopify incoming) = 8.",
    );
    expect(result.trace[3].text).toBe(
      "Forecast: 14 ÷ 7 days × 14 days = 28.00 units (2.00 per day).",
    );
    expect(result.trace[4].text).toBe(
      "Need: 28.00 forecast − 8 in stock = 20.00.",
    );
    expect(result.parityQuantity).toBe(20);
  });
});

describe("Custom date range", () => {
  it("matches Stocky's documented example: 50 sold over a 2-day sale, suggest for 5 days → 125", () => {
    const result = run(
      {
        method: "CUSTOM_RANGE",
        startDate: "2026-08-01",
        endDate: "2026-08-02",
        suggestDays: 5,
      },
      { netUnitsInWindow: 50 },
    );
    expect(result.window).toEqual({
      start: "2026-08-01",
      end: "2026-08-02",
      days: 2,
    });
    expect(result.dailyVelocity).toBe("25.0000");
    expect(result.parityQuantity).toBe(125);
  });

  it("counts both ends of the range as sample days", () => {
    const result = run(
      {
        method: "CUSTOM_RANGE",
        startDate: "2026-11-01",
        endDate: "2026-11-10",
        suggestDays: 10,
      },
      { netUnitsInWindow: 10 },
    );
    expect(result.window?.days).toBe(10);
    expect(result.parityQuantity).toBe(10);
  });
});

describe("Same period last year", () => {
  it("uses last year's net units for the window without scaling", () => {
    const result = run(
      { method: "SAME_PERIOD_LAST_YEAR", suggestDays: 30 },
      { netUnitsInWindow: 45, available: 10, incoming: 5 },
    );
    expect(result.window).toEqual({
      start: "2025-11-10",
      end: "2025-12-09",
      days: 30,
    });
    expect(result.forecastDemand).toBe("45.0000");
    expect(result.dailyVelocity).toBe("1.5000");
    expect(result.parityQuantity).toBe(30);
  });

  it("refuses to treat missing history as zero sales", () => {
    const result = run(
      { method: "SAME_PERIOD_LAST_YEAR", suggestDays: 30 },
      { netUnitsInWindow: null, coverage: { kind: "NONE" } },
    );
    expect(result.parityQuantity).toBeNull();
    expect(result.suggestedQuantity).toBeNull();
    expect(codes(result)).toEqual(["HISTORY_UNAVAILABLE"]);
  });

  it("also refuses when units were loaded but no day in the window has history", () => {
    const result = run(
      { method: "SAME_PERIOD_LAST_YEAR", suggestDays: 30 },
      { netUnitsInWindow: 0, coverage: { kind: "NONE" } },
    );
    expect(result.parityQuantity).toBeNull();
  });

  it("computes with partial history but warns", () => {
    const result = run(
      { method: "SAME_PERIOD_LAST_YEAR", suggestDays: 30 },
      { netUnitsInWindow: 12, coverage: { kind: "PARTIAL", coveredDays: 20 } },
    );
    expect(result.parityQuantity).toBe(12);
    expect(result.warnings).toContainEqual({
      code: "HISTORY_PARTIAL",
      message:
        "Order history covers 20 days of the 30 days in the sales window.",
    });
  });
});

describe("Fill shelves", () => {
  it("fills to the shelf limit", () => {
    const result = run(
      { method: "FILL_SHELVES" },
      { shelfLimitQuantity: 20, available: 7, incoming: 3 },
    );
    expect(result.parityQuantity).toBe(10);
    expect(result.dailyVelocity).toBeNull();
    expect(result.window).toBeNull();
  });

  it("suggests nothing when stock is already above the shelf limit", () => {
    const result = run(
      { method: "FILL_SHELVES" },
      { shelfLimitQuantity: 5, available: 9 },
    );
    expect(result.parityQuantity).toBe(0);
  });

  it("needs a shelf limit", () => {
    const result = run({ method: "FILL_SHELVES" }, { available: 1 });
    expect(result.parityQuantity).toBeNull();
    expect(codes(result)).toEqual(["SHELF_LIMIT_MISSING"]);
  });

  it("treats a shelf limit of zero as set", () => {
    const result = run(
      { method: "FILL_SHELVES" },
      { shelfLimitQuantity: 0, available: 0 },
    );
    expect(result.parityQuantity).toBe(0);
    expect(codes(result)).toEqual([]);
  });
});

describe("Fill shelves if below minimum", () => {
  it("fills to the shelf limit when stock is below the minimum", () => {
    const result = run(
      { method: "FILL_SHELVES_IF_BELOW_MIN" },
      { minimumQuantity: 5, shelfLimitQuantity: 20, available: 3, incoming: 1 },
    );
    expect(result.parityQuantity).toBe(16);
  });

  it("suggests nothing when stock equals the minimum", () => {
    const result = run(
      { method: "FILL_SHELVES_IF_BELOW_MIN" },
      { minimumQuantity: 5, shelfLimitQuantity: 20, available: 4, incoming: 1 },
    );
    expect(result.parityQuantity).toBe(0);
    expect(result.trace.find((s) => s.key === "need.base")?.text).toMatch(
      /not below the minimum 5/,
    );
  });

  it("counts incoming stock toward the minimum", () => {
    const result = run(
      { method: "FILL_SHELVES_IF_BELOW_MIN" },
      { minimumQuantity: 5, shelfLimitQuantity: 20, available: 0, incoming: 6 },
    );
    expect(result.parityQuantity).toBe(0);
  });

  it("needs both levels and reports each missing one", () => {
    const result = run(
      { method: "FILL_SHELVES_IF_BELOW_MIN" },
      { available: 0 },
    );
    expect(result.parityQuantity).toBeNull();
    expect(codes(result)).toEqual(["SHELF_LIMIT_MISSING", "MINIMUM_MISSING"]);
  });

  it("flags a minimum above the shelf limit but still follows the formula", () => {
    const result = run(
      { method: "FILL_SHELVES_IF_BELOW_MIN" },
      { minimumQuantity: 10, shelfLimitQuantity: 8, available: 2 },
    );
    expect(codes(result)).toContain("MINIMUM_ABOVE_SHELF_LIMIT");
    expect(result.parityQuantity).toBe(6);
  });
});

describe("Target stock level", () => {
  it("matches Stocky's documented example: stock 3, 6, 10 with target 15 → 12, 9, 5", () => {
    const params: MethodParameters = {
      method: "TARGET_STOCK_LEVEL",
      targetQuantity: 15,
    };
    expect(
      [3, 6, 10].map((available) => run(params, { available }).parityQuantity),
    ).toEqual([12, 9, 5]);
  });

  it("subtracts incoming", () => {
    const result = run(
      { method: "TARGET_STOCK_LEVEL", targetQuantity: 15 },
      { available: 3, incoming: 10 },
    );
    expect(result.parityQuantity).toBe(2);
  });
});

describe("data the engine must not guess", () => {
  const lastX: MethodParameters = {
    method: "LAST_X_DAYS",
    sampleDays: 30,
    suggestDays: 30,
  };

  it("skips variants Shopify doesn't track", () => {
    const result = run(lastX, { tracked: false, netUnitsInWindow: 100 });
    expect(result.suggestedQuantity).toBeNull();
    expect(codes(result)).toEqual(["NOT_TRACKED"]);
  });

  it("skips variants with unknown available stock", () => {
    const result = run(lastX, { available: null, netUnitsInWindow: 100 });
    expect(result.suggestedQuantity).toBeNull();
    expect(codes(result)).toEqual(["INVENTORY_UNKNOWN"]);
  });

  it("counts unknown incoming as zero and says so", () => {
    const result = run(lastX, {
      incoming: null,
      netUnitsInWindow: 30,
      available: 10,
    });
    expect(result.parityQuantity).toBe(20);
    expect(codes(result)).toEqual(["INCOMING_UNKNOWN"]);
  });

  it("ignores the incoming value when the run doesn't count incoming", () => {
    const result = run(lastX, {
      incomingSource: "NONE",
      incoming: 50,
      netUnitsInWindow: 30,
    });
    expect(result.parityQuantity).toBe(30);
    expect(codes(result)).toEqual([]);
  });

  it("flags untrusted sales evidence without hiding the quantity", () => {
    const result = run(lastX, {
      netUnitsInWindow: 30,
      salesEvidenceUntrusted: true,
    });
    expect(result.parityQuantity).toBe(30);
    expect(codes(result)).toContain("SALES_EVIDENCE_UNTRUSTED");
  });

  it("flags negative net sales", () => {
    const result = run(lastX, { netUnitsInWindow: -2, available: 0 });
    expect(result.parityQuantity).toBe(0);
    expect(codes(result)).toContain("NEGATIVE_NET_SALES");
  });

  it("throws if a sales method is called without a window", () => {
    expect(() => computeSuggestion(lastX, null, input(), NO_ROUNDING)).toThrow(
      /sample window/,
    );
  });
});

describe("opt-in supplier rules", () => {
  const params: MethodParameters = {
    method: "TARGET_STOCK_LEVEL",
    targetQuantity: 10,
  };
  const window: SampleWindow | null = null;

  it("leaves the parity quantity alone by default even when pack and MOQ are known", () => {
    const result = computeSuggestion(
      params,
      window,
      input({ packSize: 12, minimumOrderQuantity: 24 }),
      NO_ROUNDING,
    );
    expect(result.parityQuantity).toBe(10);
    expect(result.suggestedQuantity).toBe(10);
    expect(result.adjustments).toEqual([]);
  });

  it("raises to the MOQ and then rounds to whole packs, recording both", () => {
    const result = computeSuggestion(
      params,
      window,
      input({ packSize: 12, minimumOrderQuantity: 18 }),
      {
        applyMinimumOrderQuantity: true,
        roundUpToPackSize: true,
      },
    );
    expect(result.parityQuantity).toBe(10);
    expect(result.suggestedQuantity).toBe(24);
    expect(result.adjustments).toEqual([
      { rule: "MINIMUM_ORDER_QUANTITY", before: 10, after: 18 },
      { rule: "PACK_SIZE", before: 18, after: 24 },
    ]);
    expect(result.trace.slice(-2).map((s) => s.key)).toEqual([
      "adjust.moq",
      "adjust.pack",
    ]);
  });

  it("does not round a zero suggestion up to a pack", () => {
    const result = computeSuggestion(
      params,
      window,
      input({ available: 10, packSize: 6 }),
      {
        applyMinimumOrderQuantity: true,
        roundUpToPackSize: true,
      },
    );
    expect(result.suggestedQuantity).toBe(0);
    expect(result.adjustments).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("warns when a requested rule has no value to apply", () => {
    const result = computeSuggestion(params, window, input(), {
      applyMinimumOrderQuantity: true,
      roundUpToPackSize: true,
    });
    expect(result.suggestedQuantity).toBe(10);
    expect(codes(result)).toEqual(["MOQ_MISSING", "PACK_SIZE_MISSING"]);
  });

  it("leaves an exact multiple of the pack size unchanged", () => {
    const result = computeSuggestion(params, window, input({ packSize: 5 }), {
      applyMinimumOrderQuantity: false,
      roundUpToPackSize: true,
    });
    expect(result.suggestedQuantity).toBe(10);
    expect(result.adjustments).toEqual([]);
  });
});
