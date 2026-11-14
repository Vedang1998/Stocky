import { describe, expect, it } from "vitest";
import { applySupplierRules } from "./supplier-rules";
import { NO_ROUNDING } from "./types";

const supplier = { minimumOrderQuantity: 12, packSize: 6 };
const both = { applyMinimumOrderQuantity: true, roundUpToPackSize: true };

describe("supplier ordering rules", () => {
  it("changes nothing unless the merchant opts in", () => {
    expect(applySupplierRules(5, supplier, NO_ROUNDING)).toEqual({
      quantity: 5,
      adjustments: [],
      missing: [],
    });
  });

  it("raises to the minimum order without rounding to packs", () => {
    const result = applySupplierRules(
      5,
      { minimumOrderQuantity: 8, packSize: 6 },
      { applyMinimumOrderQuantity: true, roundUpToPackSize: false },
    );
    expect(result.quantity).toBe(8);
    expect(result.adjustments).toEqual([
      { rule: "MINIMUM_ORDER_QUANTITY", before: 5, after: 8 },
    ]);
  });

  it("rounds up to packs without applying the minimum order", () => {
    const result = applySupplierRules(7, supplier, {
      applyMinimumOrderQuantity: false,
      roundUpToPackSize: true,
    });
    expect(result.quantity).toBe(12);
    expect(result.adjustments).toEqual([
      { rule: "PACK_SIZE", before: 7, after: 12 },
    ]);
  });

  it("applies the minimum order first, then packs", () => {
    const result = applySupplierRules(
      3,
      { minimumOrderQuantity: 10, packSize: 6 },
      both,
    );
    expect(result.quantity).toBe(12);
    expect(result.adjustments).toEqual([
      { rule: "MINIMUM_ORDER_QUANTITY", before: 3, after: 10 },
      { rule: "PACK_SIZE", before: 10, after: 12 },
    ]);
  });

  it("leaves quantities that already satisfy the rules", () => {
    expect(applySupplierRules(18, supplier, both).adjustments).toEqual([]);
  });

  it("never turns zero into an order", () => {
    expect(applySupplierRules(0, supplier, both).quantity).toBe(0);
  });

  it("reports rules that have no supplier value instead of guessing one", () => {
    const result = applySupplierRules(
      5,
      { minimumOrderQuantity: null, packSize: 0 },
      both,
    );
    expect(result.quantity).toBe(5);
    expect(result.missing).toEqual(["MINIMUM_ORDER_QUANTITY", "PACK_SIZE"]);
  });
});
