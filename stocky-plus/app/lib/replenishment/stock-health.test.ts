import { describe, expect, it } from "vitest";
import { rational } from "./rational";
import {
  computeStockHealth,
  resolveLeadTime,
  type StockHealthInput,
} from "./stock-health";

function health(overrides: Partial<StockHealthInput> = {}) {
  return computeStockHealth({
    asOf: "2026-11-10",
    available: 20,
    incoming: 0,
    velocity: rational(2),
    leadTime: null,
    safetyStock: null,
    manualReorderPoint: null,
    minimumQuantity: null,
    ...overrides,
  });
}

describe("days of stock and depletion", () => {
  it("divides available by units per day", () => {
    const result = health({ available: 20, velocity: rational(3) });
    expect(result.daysOfStock).toBe("6.7");
    expect(result.depletionDate).toBe("2026-11-16");
  });

  it("reports out of stock today when nothing is available", () => {
    const result = health({ available: 0 });
    expect(result.status).toBe("OUT_OF_STOCK");
    expect(result.daysOfStock).toBe("0.0");
    expect(result.depletionDate).toBe("2026-11-10");
  });

  it("does not deplete without sales", () => {
    const result = health({ velocity: rational(0) });
    expect(result.daysOfStock).toBeNull();
    expect(result.depletionDate).toBeNull();
    expect(health({ velocity: null }).daysOfStock).toBeNull();
    expect(health({ velocity: rational(-1, 7) }).depletionDate).toBeNull();
  });

  it("is unknown when available stock isn't a whole number", () => {
    expect(health({ available: Number.NaN }).status).toBe("UNKNOWN");
    expect(health({ available: 2.5 }).status).toBe("UNKNOWN");
  });

  it("is unknown when available stock is unknown", () => {
    const result = health({ available: null, manualReorderPoint: 5 });
    expect(result.status).toBe("UNKNOWN");
    expect(result.reorderPoint).toBe(5);
    expect(result.reorderPointSource).toBe("MANUAL");
  });
});

describe("reorder point", () => {
  it("multiplies units per day by lead time and rounds up", () => {
    const result = health({
      velocity: rational(7, 10),
      leadTime: { days: 10, source: "SUPPLIER_DEFAULT" },
    });
    expect(result.reorderPoint).toBe(7);
    expect(result.reorderPointSource).toBe("AUTOMATIC");

    const fractional = health({
      velocity: rational(1, 3),
      leadTime: { days: 10, source: "SUPPLIER_DEFAULT" },
    });
    expect(fractional.reorderPoint).toBe(4);
  });

  it("adds safety stock only when the merchant set it", () => {
    expect(
      health({ leadTime: { days: 5, source: "VARIANT_RULE" } }).reorderPoint,
    ).toBe(10);
    expect(
      health({ leadTime: { days: 5, source: "VARIANT_RULE" }, safetyStock: 3 })
        .reorderPoint,
    ).toBe(13);
  });

  it("prefers a manual reorder point over the automatic one", () => {
    const result = health({
      leadTime: { days: 5, source: "VARIANT_RULE" },
      manualReorderPoint: 2,
    });
    expect(result.reorderPoint).toBe(2);
    expect(result.reorderPointSource).toBe("MANUAL");
  });

  it("has no automatic reorder point without a lead time and says why", () => {
    const result = health();
    expect(result.reorderPoint).toBeNull();
    expect(result.warnings.map((w) => w.code)).toEqual(["LEAD_TIME_MISSING"]);
  });

  it("has no automatic reorder point when the sales rate is unknown", () => {
    const result = health({
      velocity: null,
      leadTime: { days: 5, source: "SHOP_DEFAULT" },
    });
    expect(result.reorderPoint).toBeNull();
    expect(result.warnings).toEqual([]);
    expect(result.trace.map((step) => step.text)).toContain(
      "The sales rate is unknown, so there is no automatic reorder point.",
    );
  });

  it("treats a zero lead time as set", () => {
    const result = health({ leadTime: { days: 0, source: "SHOP_DEFAULT" } });
    expect(result.reorderPoint).toBe(0);
    expect(result.warnings).toEqual([]);
  });
});

describe("low stock", () => {
  it("is low when available plus incoming is at or below the reorder point", () => {
    const result = health({
      available: 8,
      incoming: 2,
      leadTime: { days: 5, source: "VARIANT_RULE" },
    });
    expect(result.reorderPoint).toBe(10);
    expect(result.status).toBe("LOW");
    expect(result.lowStockReasons).toEqual([
      "Stock 10 is at or below the reorder point 10.",
    ]);
  });

  it("counts incoming stock as cover", () => {
    const result = health({
      available: 8,
      incoming: 3,
      leadTime: { days: 5, source: "VARIANT_RULE" },
    });
    expect(result.status).toBe("OK");
  });

  it("is low below the minimum even without a reorder point", () => {
    const result = health({ available: 4, minimumQuantity: 5 });
    expect(result.status).toBe("LOW");
    expect(result.lowStockReasons).toEqual(["Stock 4 is below the minimum 5."]);
  });

  it("ignores a zero reorder point", () => {
    expect(
      health({
        available: 1,
        velocity: rational(0),
        leadTime: { days: 5, source: "VARIANT_RULE" },
      }).status,
    ).toBe("OK");
  });
});

describe("lead time resolution", () => {
  it("takes the most specific usable value", () => {
    expect(
      resolveLeadTime([
        { days: null, source: "VARIANT_RULE" },
        { days: 12, source: "SUPPLIER_VARIANT" },
        { days: 7, source: "SUPPLIER_DEFAULT" },
      ]),
    ).toEqual({ days: 12, source: "SUPPLIER_VARIANT" });
  });

  it("skips invalid values and returns null when nothing is set", () => {
    expect(
      resolveLeadTime([
        { days: -1, source: "VARIANT_RULE" },
        { days: 2.5, source: "SHOP_DEFAULT" },
      ]),
    ).toBeNull();
    expect(resolveLeadTime([])).toBeNull();
  });
});
