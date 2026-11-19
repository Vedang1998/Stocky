import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { decimalToWire, serializeDecimals } from "./decimal-wire.server";

const decimal = (value: string) => new Prisma.Decimal(value);

describe("serializeDecimals", () => {
  it("replaces Decimals at every depth with exact strings", () => {
    const orderedAt = new Date("2026-11-10T12:00:00.000Z");
    const result = serializeDecimals({
      id: "po_1",
      freightCost: decimal("25.00"),
      customsCost: null,
      exchangeRate: decimal("1.085000"),
      orderedAt,
      lineItems: [
        {
          id: "line_1",
          orderedQty: 12,
          unitCost: decimal("7.2500"),
          allocatedLandedCost: decimal("2.9167"),
          manualCostOverride: false,
        },
      ],
      supplier: { name: "Acme", minimumOrderValue: decimal("0.00") },
    });

    expect(result).toEqual({
      id: "po_1",
      freightCost: "25",
      customsCost: null,
      exchangeRate: "1.085",
      orderedAt,
      lineItems: [
        {
          id: "line_1",
          orderedQty: 12,
          unitCost: "7.25",
          allocatedLandedCost: "2.9167",
          manualCostOverride: false,
        },
      ],
      supplier: { name: "Acme", minimumOrderValue: "0" },
    });
    expect(result.orderedAt).toBe(orderedAt);
  });

  it("keeps every digit and never uses exponent notation", () => {
    expect(decimalToWire(decimal("0.000000001"))).toBe("0.000000001");
    expect(decimalToWire(decimal("123456789012345678901234.565"))).toBe(
      "123456789012345678901234.565",
    );
    expect(decimalToWire(decimal("-0.0050"))).toBe("-0.005");
  });

  it("does not modify the value it was given", () => {
    const unitCost = decimal("7.2500");
    const line = { unitCost };
    const input = { lineItems: [line] };

    serializeDecimals(input);

    expect(input.lineItems[0]).toBe(line);
    expect(line.unitCost).toBe(unitCost);
  });

  it("passes primitives, null and undefined through", () => {
    expect(serializeDecimals(null)).toBeNull();
    expect(serializeDecimals(undefined)).toBeUndefined();
    expect(serializeDecimals(3)).toBe(3);
    expect(serializeDecimals("7.25")).toBe("7.25");
    expect(serializeDecimals(decimal("7.25"))).toBe("7.25");
  });

  it("leaves class instances other than Decimal untouched", () => {
    const tags = new Set(["a"]);
    const result = serializeDecimals({ tags, cost: decimal("1.5") });

    expect(result.tags).toBe(tags);
    expect(result.cost).toBe("1.5");
  });
});
