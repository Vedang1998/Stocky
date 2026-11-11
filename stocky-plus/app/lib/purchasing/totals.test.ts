import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { sum } from "./decimal";
import {
  computePurchaseOrderTotals,
  distributeCents,
  projectedMarginPercent,
  signedChargeAmount,
  toShopCurrency,
  type ChargeInput,
  type LineCostInput,
} from "./totals";

const dec = (value: string | number) => new Prisma.Decimal(value);
const strings = (values: Prisma.Decimal[]) => values.map((v) => v.toString());

function line(overrides: Partial<LineCostInput> & { id: string }): LineCostInput {
  return {
    position: 0,
    orderedQty: 1,
    cancelledQty: 0,
    unitCost: "0",
    discountPercent: null,
    taxRatePercent: null,
    weightGrams: null,
    volume: null,
    ...overrides,
  };
}

const shipping = (amount: string, allocate = true): ChargeInput => ({
  kind: "SHIPPING",
  amount,
  allocate,
});

describe("distributeCents", () => {
  it("gives leftover cents to the largest remainders, earliest first on a tie", () => {
    expect(strings(distributeCents(dec(100), [dec(1), dec(1), dec(1)]))).toEqual([
      "34",
      "33",
      "33",
    ]);
    // Raw shares 16.67 / 33.33 / 50.00: the single leftover cent goes to 16.67.
    expect(strings(distributeCents(dec(100), [dec(1), dec(2), dec(3)]))).toEqual([
      "17",
      "33",
      "50",
    ]);
  });

  it("always adds up to the total", () => {
    const weights = [dec("87.13"), dec("0.01"), dec("412.9"), dec("33.333")];
    for (const total of [1, 7, 99, 3500, 123457]) {
      const parts = distributeCents(dec(total), weights);
      expect(sum(parts).toString()).toBe(String(total));
      expect(parts.every((p) => p.isInteger() && p.gte(0))).toBe(true);
    }
  });

  it("mirrors the split for a negative total", () => {
    expect(strings(distributeCents(dec(-100), [dec(1), dec(1), dec(1)]))).toEqual([
      "-34",
      "-33",
      "-33",
    ]);
  });

  it("gives nothing to a zero weight", () => {
    expect(strings(distributeCents(dec(10), [dec(0), dec(5)]))).toEqual(["0", "10"]);
  });

  it("rejects fractional cents and an empty or zero basis", () => {
    expect(() => distributeCents(dec("10.5"), [dec(1)])).toThrow(RangeError);
    expect(() => distributeCents(dec(10), [])).toThrow(RangeError);
    expect(() => distributeCents(dec(10), [dec(0), dec(0)])).toThrow(RangeError);
  });
});

describe("signedChargeAmount", () => {
  it("treats a discount as negative and everything else as positive", () => {
    expect(signedChargeAmount({ kind: "DISCOUNT", amount: "10", allocate: true }).toString()).toBe("-10");
    expect(signedChargeAmount({ kind: "DUTY", amount: "10", allocate: true }).toString()).toBe("10");
  });
});

describe("computePurchaseOrderTotals", () => {
  it("allocates freight and duty onto a single line and derives the landed unit cost", () => {
    const totals = computePurchaseOrderTotals(
      [line({ id: "a", orderedQty: 12, unitCost: "7.25" })],
      [shipping("25"), { kind: "DUTY", amount: "10", allocate: true }],
      "COST",
    );

    const [a] = totals.lines;
    expect(a.netAmount.toString()).toBe("87");
    expect(a.allocatedCharges.toString()).toBe("35");
    expect(a.allocatedPerUnit.toString()).toBe("2.9167");
    expect(a.landedUnitCost.toString()).toBe("10.1667");
    expect(totals.merchandiseAmount.toString()).toBe("87");
    expect(totals.chargesAmount.toString()).toBe("35");
    expect(totals.totalAmount.toString()).toBe("122");
    expect(totals.allocation).toMatchObject({ requested: "COST", applied: "COST" });
    expect(totals.allocation.unallocatedAmount.toString()).toBe("0");
  });

  it("splits by line cost", () => {
    const totals = computePurchaseOrderTotals(
      [
        line({ id: "a", position: 0, orderedQty: 10, unitCost: "30" }),
        line({ id: "b", position: 1, orderedQty: 5, unitCost: "20" }),
      ],
      [shipping("40")],
      "COST",
    );

    expect(totals.lines.map((l) => l.allocatedCharges.toString())).toEqual(["30", "10"]);
    expect(totals.lines.map((l) => l.allocatedPerUnit.toString())).toEqual(["3", "2"]);
    expect(totals.lines.map((l) => l.landedUnitCost.toString())).toEqual(["33", "22"]);
  });

  it("splits by quantity", () => {
    const totals = computePurchaseOrderTotals(
      [
        line({ id: "a", position: 0, orderedQty: 10, unitCost: "30" }),
        line({ id: "b", position: 1, orderedQty: 30, unitCost: "1" }),
      ],
      [shipping("40")],
      "QUANTITY",
    );

    expect(totals.lines.map((l) => l.allocatedCharges.toString())).toEqual(["10", "30"]);
  });

  it("splits by total line weight and by total line volume", () => {
    const lines = [
      line({ id: "a", position: 0, orderedQty: 2, unitCost: "5", weightGrams: "500", volume: "3" }),
      line({ id: "b", position: 1, orderedQty: 1, unitCost: "5", weightGrams: "3000", volume: "2" }),
    ];

    const byWeight = computePurchaseOrderTotals(lines, [shipping("40")], "WEIGHT");
    const byVolume = computePurchaseOrderTotals(lines, [shipping("40")], "VOLUME");

    expect(byWeight.lines.map((l) => l.allocatedCharges.toString())).toEqual(["10", "30"]);
    expect(byVolume.lines.map((l) => l.allocatedCharges.toString())).toEqual(["30", "10"]);
  });

  it("falls back to quantity when no line has the requested basis, and says so", () => {
    const totals = computePurchaseOrderTotals(
      [
        line({ id: "a", position: 0, orderedQty: 1, unitCost: "5" }),
        line({ id: "b", position: 1, orderedQty: 3, unitCost: "5" }),
      ],
      [shipping("40")],
      "WEIGHT",
    );

    expect(totals.allocation.requested).toBe("WEIGHT");
    expect(totals.allocation.applied).toBe("QUANTITY");
    expect(totals.lines.map((l) => l.allocatedCharges.toString())).toEqual(["10", "30"]);
  });

  it("line shares always add up to the allocatable charges", () => {
    const totals = computePurchaseOrderTotals(
      [
        line({ id: "a", position: 0, orderedQty: 1, unitCost: "1" }),
        line({ id: "b", position: 1, orderedQty: 1, unitCost: "1" }),
        line({ id: "c", position: 2, orderedQty: 1, unitCost: "1" }),
      ],
      [shipping("100")],
      "COST",
    );

    expect(totals.lines.map((l) => l.allocatedCharges.toString())).toEqual([
      "33.34",
      "33.33",
      "33.33",
    ]);
    expect(sum(totals.lines.map((l) => l.allocatedCharges)).toString()).toBe("100");
  });

  it("breaks remainder ties by line position, not by input order", () => {
    const totals = computePurchaseOrderTotals(
      [
        line({ id: "late", position: 2, orderedQty: 1, unitCost: "1" }),
        line({ id: "first", position: 0, orderedQty: 1, unitCost: "1" }),
        line({ id: "middle", position: 1, orderedQty: 1, unitCost: "1" }),
      ],
      [shipping("0.01")],
      "QUANTITY",
    );

    expect(totals.lines.map((l) => [l.id, l.allocatedCharges.toString()])).toEqual([
      ["first", "0.01"],
      ["middle", "0"],
      ["late", "0"],
    ]);
  });

  it("nets a header discount against the charges it spreads", () => {
    const totals = computePurchaseOrderTotals(
      [line({ id: "a", orderedQty: 10, unitCost: "10" })],
      [shipping("30"), { kind: "DISCOUNT", amount: "10", allocate: true }],
      "COST",
    );

    expect(totals.chargesAmount.toString()).toBe("20");
    expect(totals.lines[0].allocatedCharges.toString()).toBe("20");
    expect(totals.totalAmount.toString()).toBe("120");
  });

  it("spreads a net credit as a negative allocation", () => {
    const totals = computePurchaseOrderTotals(
      [
        line({ id: "a", position: 0, orderedQty: 1, unitCost: "10" }),
        line({ id: "b", position: 1, orderedQty: 1, unitCost: "10" }),
      ],
      [{ kind: "DISCOUNT", amount: "5.01", allocate: true }],
      "COST",
    );

    expect(totals.lines.map((l) => l.allocatedCharges.toString())).toEqual(["-2.51", "-2.5"]);
    expect(totals.lines[0].landedUnitCost.toString()).toBe("7.49");
    expect(totals.totalAmount.toString()).toBe("14.99");
  });

  it("keeps a charge that is not allocated out of landed cost but in the total", () => {
    const totals = computePurchaseOrderTotals(
      [line({ id: "a", orderedQty: 4, unitCost: "10" })],
      [shipping("8"), { kind: "FEE", amount: "15", allocate: false }],
      "COST",
    );

    expect(totals.allocatableChargesAmount.toString()).toBe("8");
    expect(totals.chargesAmount.toString()).toBe("23");
    expect(totals.lines[0].landedUnitCost.toString()).toBe("12");
    expect(totals.totalAmount.toString()).toBe("63");
  });

  it("applies the line discount before tax and leaves tax out of landed cost", () => {
    const totals = computePurchaseOrderTotals(
      [
        line({
          id: "a",
          orderedQty: 10,
          unitCost: "10",
          discountPercent: "10",
          taxRatePercent: "8.25",
        }),
      ],
      [],
      "COST",
    );

    const [a] = totals.lines;
    expect(a.grossAmount.toString()).toBe("100");
    expect(a.discountAmount.toString()).toBe("10");
    expect(a.netAmount.toString()).toBe("90");
    // 90 × 8.25% = 7.425, rounded half away from zero.
    expect(a.taxAmount.toString()).toBe("7.43");
    expect(a.netUnitCost.toString()).toBe("9");
    expect(a.landedUnitCost.toString()).toBe("9");
    expect(totals.lineDiscountAmount.toString()).toBe("10");
    expect(totals.totalAmount.toString()).toBe("97.43");
    expect(totals.allocation.applied).toBeNull();
  });

  it("rounds each line to cents half away from zero", () => {
    const totals = computePurchaseOrderTotals(
      [line({ id: "a", orderedQty: 3, unitCost: "0.335" })],
      [],
      "COST",
    );

    // 3 × 0.335 = 1.005
    expect(totals.lines[0].netAmount.toString()).toBe("1.01");
  });

  it("costs only the quantity that is still on order", () => {
    const totals = computePurchaseOrderTotals(
      [
        line({ id: "a", position: 0, orderedQty: 10, cancelledQty: 4, unitCost: "5" }),
        line({ id: "b", position: 1, orderedQty: 6, cancelledQty: 6, unitCost: "5" }),
      ],
      [shipping("12")],
      "QUANTITY",
    );

    const [a, b] = totals.lines;
    expect(a.effectiveQty).toBe(6);
    expect(a.netAmount.toString()).toBe("30");
    expect(a.allocatedCharges.toString()).toBe("12");
    expect(b.effectiveQty).toBe(0);
    expect(b.netAmount.toString()).toBe("0");
    expect(b.allocatedCharges.toString()).toBe("0");
    expect(b.allocatedPerUnit.toString()).toBe("0");
    expect(totals.units).toBe(6);
  });

  it("reports charges it cannot spread when the order has no units", () => {
    const totals = computePurchaseOrderTotals([], [shipping("25")], "COST");

    expect(totals.allocation.applied).toBeNull();
    expect(totals.allocation.unallocatedAmount.toString()).toBe("25");
    expect(totals.totalAmount.toString()).toBe("25");
  });

  it("falls back to quantity for free goods, which have no cost basis", () => {
    const totals = computePurchaseOrderTotals(
      [line({ id: "a", orderedQty: 5, unitCost: "0" })],
      [shipping("10")],
      "COST",
    );

    expect(totals.allocation.applied).toBe("QUANTITY");
    expect(totals.lines[0].landedUnitCost.toString()).toBe("2");
  });
});

describe("projectedMarginPercent", () => {
  it("is the share of the retail price left after landed cost", () => {
    expect(projectedMarginPercent("20", "12")?.toString()).toBe("40");
    expect(projectedMarginPercent("19.99", "10.1667")?.toString()).toBe("49.1");
    expect(projectedMarginPercent("10", "12")?.toString()).toBe("-20");
  });

  it("is unknown without a positive price or a cost", () => {
    expect(projectedMarginPercent(null, "12")).toBeNull();
    expect(projectedMarginPercent("20", null)).toBeNull();
    expect(projectedMarginPercent("0", "12")).toBeNull();
  });
});

describe("toShopCurrency", () => {
  it("returns the amount unchanged in the shop's own currency", () => {
    expect(toShopCurrency(dec("10.1667"), null, true)?.toString()).toBe("10.1667");
  });

  it("applies the purchase order's exchange rate", () => {
    expect(toShopCurrency(dec("10"), "1.085", false)?.toString()).toBe("10.85");
  });

  it("is unknown for a foreign currency without a rate", () => {
    expect(toShopCurrency(dec("10"), null, false)).toBeNull();
  });
});
