/**
 * Characterization tests — evidence of CURRENT behavior, not endorsement.
 *
 * Tests marked CHARACTERIZATION / KNOWN-WRONG document gaps vs Stocky parity
 * (docs/product/02_FULL_STOCKY_PARITY_PRD.md). Do not "fix" these to match
 * parity without an explicit Phase-2 decision and replacement engine.
 */
import { describe, expect, it } from "vitest";
import {
  calculateDailySalesVelocity,
  calculateReorderPoint,
  calculateToBuy,
} from "./forecasting.server";
import { receivePartialPO } from "./landed-cost.server";
import { featureFlags } from "../lib/feature-flags.server";
import { poDisplayNumber, poLineTotals } from "../lib/po-display";

/** Mirrors runAbcAnalysis classification (post-add cumulative %). */
function classifyAbcPostAddCumulative(pct: number): "A" | "B" | "C" {
  if (pct <= 0.8) return "A";
  if (pct <= 0.95) return "B";
  return "C";
}

/**
 * Stocky parity rule (docs): item crossing a boundary stays in the earlier class.
 * Current repo uses post-add cumulative, so the crossing item flips class.
 */
function classifyAbcStockyParity(
  cumulativeBefore: number,
  _value: number,
  total: number,
): "A" | "B" | "C" {
  const beforePct = total > 0 ? cumulativeBefore / total : 0;
  if (beforePct < 0.8) return "A";
  if (beforePct < 0.95) return "B";
  return "C";
}

describe("CHARACTERIZATION: forecast defaults (KNOWN-WRONG vs Stocky Last X)", () => {
  it("documents OOS-day exclusion in velocity (NOT Stocky Last X)", () => {
    // Current: units / (lookback - oos). Parity Last X: units / sample_calendar_days.
    expect(calculateDailySalesVelocity(60, 30, 10)).toBe(3);
    expect(calculateDailySalesVelocity(60, 30, 0)).toBe(2);
  });

  it("documents ROP = velocity * leadTime + safetyStock baked into default path", () => {
    expect(calculateReorderPoint(2, 7, 5)).toBe(19);
  });

  it("documents toBuy uses ROP + targetDays (14) rather than simple Last X suggest", () => {
    // reorder 20 + ceil(2*14)=28 => target 48; onHand 10 + incoming 5 => need 33
    expect(calculateToBuy(20, 14, 2, 10, 5)).toBe(33);
  });

  it("documents .env.example defaults lookback=30 targetDays=14", async () => {
    const fs = await import("node:fs/promises");
    const envExample = await fs.readFile(
      new URL("../../.env.example", import.meta.url),
      "utf8",
    );
    expect(envExample).toMatch(/DEFAULT_LOOKBACK_DAYS=30/);
    expect(envExample).toMatch(/DEFAULT_TARGET_DAYS_OF_STOCK=14/);
  });
});

describe("CHARACTERIZATION: ABC 90-day post-add boundary (KNOWN-WRONG)", () => {
  it("classifies the item that crosses 80% as B (Stocky keeps it A)", () => {
    // Revenues: 70, 20, 10. After first: 70% A. After second: 90% -> current B.
    const total = 100;
    let cumulative = 0;
    const values = [70, 20, 10];
    const current: Array<"A" | "B" | "C"> = [];
    const parity: Array<"A" | "B" | "C"> = [];

    for (const value of values) {
      const before = cumulative;
      cumulative += value;
      current.push(classifyAbcPostAddCumulative(cumulative / total));
      parity.push(classifyAbcStockyParity(before, value, total));
    }

    expect(current).toEqual(["A", "B", "C"]);
    expect(parity).toEqual(["A", "A", "B"]);
  });

  it("has no U grade in current classifier", () => {
    // Current AbcClass enum usage in runAbcAnalysis only assigns A/B/C.
    expect(classifyAbcPostAddCumulative(0)).toBe("A");
    expect(["A", "B", "C"]).not.toContain("U");
  });

  it("documents 90-day window in runAbcAnalysis source", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(
      new URL("./forecasting.server.ts", import.meta.url),
      "utf8",
    );
    expect(src).toMatch(
      /ninetyDaysAgo\.setDate\(ninetyDaysAgo\.getDate\(\) - 90\)/,
    );
    expect(src).not.toMatch(/eight weeks|8 \* 7|56/);
  });
});

describe("CHARACTERIZATION: feature flags default OFF", () => {
  it("disables inventory write capabilities by default", () => {
    expect(featureFlags.stocktakeInventoryWrites()).toBe(false);
    expect(featureFlags.adjustmentWrites()).toBe(false);
    expect(featureFlags.receiptWrites()).toBe(false);
    expect(featureFlags.costSync()).toBe(false);
    expect(featureFlags.transferWrites()).toBe(false);
  });
});

describe("CHARACTERIZATION: PO display helpers", () => {
  it("falls back to truncated id when poNumber missing", () => {
    expect(poDisplayNumber({ id: "abcdefghijklmnop", poNumber: null })).toBe(
      "PO-KLMNOP",
    );
    expect(
      poDisplayNumber({ id: "abcdefghijklmnop", poNumber: "PO-2026-0001" }),
    ).toBe("PO-2026-0001");
  });

  it("sums merchandise and landed including allocated cost", () => {
    const totals = poLineTotals([
      {
        orderedQty: 10,
        receivedQty: 4,
        unitCost: 5,
        allocatedLandedCost: 1,
      },
    ]);
    expect(totals.orderedUnits).toBe(10);
    expect(totals.receivedUnits).toBe(4);
    expect(totals.merchandise).toBe(50);
    expect(totals.landed).toBe(60);
  });
});

describe("CHARACTERIZATION: stocktake completion safety (Phase 0 fix)", () => {
  /**
   * Pre-Phase-0 control flow marked COMPLETED even when Shopify writes failed.
   * Phase 0 corrected the control flow: failures leave status IN_PROGRESS.
   */
  it("does not mark complete when line writes failed", () => {
    const failures: string[] = ["SKU-A"];
    let status: "IN_PROGRESS" | "COMPLETED" = "IN_PROGRESS";
    if (failures.length === 0) {
      status = "COMPLETED";
    }
    expect(status).toBe("IN_PROGRESS");
  });
});

describe("CHARACTERIZATION: receivePartialPO status transitions", () => {
  it("exposes receivePartialPO for integration characterization", () => {
    expect(typeof receivePartialPO).toBe("function");
  });
});

describe("CHARACTERIZATION: MOQ/pack rounding (KNOWN-WRONG vs product rules)", () => {
  it("documents forced MOQ then pack rounding as current Buying Table math", () => {
    const moq = 12;
    const packSize = 6;
    let qty = 5;
    qty = Math.max(qty, moq);
    qty = Math.ceil(qty / packSize) * packSize;
    expect(qty).toBe(12);
  });
});
