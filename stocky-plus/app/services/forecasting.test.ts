import { describe, expect, it } from "vitest";
import {
  calculateDailySalesVelocity,
  calculateReorderPoint,
  calculateToBuy,
} from "./forecasting.server";
import { allocateLandedCosts } from "./landed-cost.server";
import { Decimal } from "@prisma/client/runtime/library";

describe("calculateDailySalesVelocity", () => {
  it("divides units sold by in-stock days only", () => {
    // 60 units over 30 days with 10 OOS days -> 60 / 20 = 3/day
    expect(calculateDailySalesVelocity(60, 30, 10)).toBe(3);
  });

  it("returns 0 when every day was out of stock", () => {
    expect(calculateDailySalesVelocity(5, 30, 30)).toBe(0);
  });

  it("returns 0 when OOS days exceed the lookback", () => {
    expect(calculateDailySalesVelocity(5, 30, 31)).toBe(0);
  });

  it("returns 0 for zero sales", () => {
    expect(calculateDailySalesVelocity(0, 30, 0)).toBe(0);
  });

  it("uses full lookback when never out of stock", () => {
    expect(calculateDailySalesVelocity(30, 30, 0)).toBe(1);
  });
});

describe("calculateReorderPoint", () => {
  it("multiplies velocity by lead time and adds safety stock", () => {
    // 2/day * 7 days + 5 safety = 19
    expect(calculateReorderPoint(2, 7, 5)).toBe(19);
  });

  it("rounds up fractional demand", () => {
    // 1.5/day * 3 days = 4.5 -> 5
    expect(calculateReorderPoint(1.5, 3, 0)).toBe(5);
  });

  it("is just safety stock when velocity is zero", () => {
    expect(calculateReorderPoint(0, 14, 3)).toBe(3);
  });
});

describe("calculateToBuy", () => {
  it("covers reorder point plus target days minus stock on hand and incoming", () => {
    // reorder 20 + (2/day * 14d = 28) = 48 target; 10 on hand + 5 incoming = 33
    expect(calculateToBuy(20, 14, 2, 10, 5)).toBe(33);
  });

  it("never returns a negative quantity", () => {
    expect(calculateToBuy(10, 7, 1, 100, 50)).toBe(0);
  });

  it("ignores incoming stock already covering demand", () => {
    expect(calculateToBuy(10, 0, 0, 0, 10)).toBe(0);
  });
});

describe("allocateLandedCosts", () => {
  const line = (
    id: string,
    unitCost: number,
    qty: number,
    weight: number | null = null,
    volume: number | null = null,
  ) => ({
    id,
    unitCost: new Decimal(unitCost),
    weight: weight === null ? null : new Decimal(weight),
    volume: volume === null ? null : new Decimal(volume),
    orderedQty: qty,
  });

  it("allocates by line cost proportionally", () => {
    // $100 freight over lines worth $300 and $100 -> $75 and $25
    const allocations = allocateLandedCosts(
      [line("a", 3, 100), line("b", 1, 100)],
      100,
      0,
      "COST",
    );
    expect(Number(allocations.get("a"))).toBeCloseTo(0.75); // per unit
    expect(Number(allocations.get("b"))).toBeCloseTo(0.25);
  });

  it("allocates by weight", () => {
    // 500 freight; line a = 10kg total, line b = 40kg total
    const allocations = allocateLandedCosts(
      [line("a", 5, 10, 1), line("b", 5, 10, 4)],
      500,
      0,
      "WEIGHT",
    );
    expect(Number(allocations.get("a"))).toBeCloseTo(10); // 100 over 10 units
    expect(Number(allocations.get("b"))).toBeCloseTo(40); // 400 over 10 units
  });

  it("includes customs in the allocation", () => {
    const allocations = allocateLandedCosts([line("a", 10, 10)], 50, 50, "COST");
    expect(Number(allocations.get("a"))).toBeCloseTo(10); // 100 over 10 units
  });

  it("splits evenly when the weighting metric is all zeros", () => {
    const allocations = allocateLandedCosts(
      [line("a", 5, 10), line("b", 5, 10)],
      100,
      0,
      "WEIGHT", // no weights on file
    );
    expect(Number(allocations.get("a"))).toBeCloseTo(5); // 50 over 10 units
    expect(Number(allocations.get("b"))).toBeCloseTo(5);
  });

  it("returns zero allocations when there is no freight or customs", () => {
    const allocations = allocateLandedCosts([line("a", 5, 10)], 0, 0, "COST");
    expect(Number(allocations.get("a"))).toBe(0);
  });
});
