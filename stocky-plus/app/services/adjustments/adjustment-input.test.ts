import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_REASONS,
  MAX_ADJUSTMENT_LINES,
  MAX_ADJUSTMENT_TEXT_LENGTH,
  adjustmentReasonLabel,
  isAdjustmentMode,
  isAdjustmentReason,
  parseAdjustmentLines,
} from "./adjustment-input";
import { SHOPIFY_INVENTORY_REASONS } from "../inventory-writes/types";

const lines = (text: string, mode: "ADJUST" | "SET" = "ADJUST") => {
  const parsed = parseAdjustmentLines(text, mode);
  if (!parsed.ok) throw new Error(parsed.errors.join(" | "));
  return parsed.lines;
};

const errors = (text: string, mode: "ADJUST" | "SET" = "ADJUST") => {
  const parsed = parseAdjustmentLines(text, mode);
  if (parsed.ok) throw new Error("expected the lines to be refused");
  return parsed.errors;
};

describe("parseAdjustmentLines", () => {
  it("reads a code and a signed quantity separated by a comma, tab or semicolon", () => {
    expect(lines("ABC-1, 5\nABC-2\t-3\nABC-3;+2")).toEqual([
      { lineNumber: 1, code: "ABC-1", quantity: 5 },
      { lineNumber: 2, code: "ABC-2", quantity: -3 },
      { lineNumber: 3, code: "ABC-3", quantity: 2 },
    ]);
  });

  it("accepts Windows line endings and skips blank lines, keeping the pasted line numbers", () => {
    expect(lines("\r\nABC-1,1\r\n\r\n  ABC-2 , 2  \r\n")).toEqual([
      { lineNumber: 2, code: "ABC-1", quantity: 1 },
      { lineNumber: 4, code: "ABC-2", quantity: 2 },
    ]);
  });

  it("takes the quantity from the last field, so a code may contain a comma", () => {
    expect(lines("Wine, red 75cl, 4")).toEqual([
      { lineNumber: 1, code: "Wine, red 75cl", quantity: 4 },
    ]);
  });

  it("keeps a barcode's leading zeros", () => {
    expect(lines("0012345678905,1")[0].code).toBe("0012345678905");
  });

  it.each([
    ["ABC-1", "no quantity"],
    ["ABC-1,", "an empty quantity"],
    [",5", "no code"],
  ])("refuses %j (%s) and names the line", (row) => {
    expect(errors(`OK-1,1\n${row}`)).toEqual([
      "Line 2: enter a SKU or barcode, a comma, then a quantity.",
    ]);
  });

  it.each(["1.5", "1e3", "five", "0x10", "1 000", "12345678", "--1", "1-"])(
    "refuses the quantity %j",
    (quantity) => {
      expect(errors(`ABC-1,${quantity}`)).toEqual([
        `Line 1: "${quantity}" is not a whole number of at most 1,000,000.`,
      ]);
    },
  );

  it("refuses a quantity above the limit in either direction", () => {
    expect(errors("ABC-1,1000001")).toHaveLength(1);
    expect(errors("ABC-1,-1000001")).toHaveLength(1);
    expect(lines("ABC-1,1000000\nABC-2,-1000000")).toHaveLength(2);
  });

  it("refuses a change of 0, but lets a quantity be set to 0", () => {
    expect(errors("ABC-1,0")).toEqual(["Line 1: a change of 0 does nothing."]);
    expect(lines("ABC-1,0", "SET")).toEqual([
      { lineNumber: 1, code: "ABC-1", quantity: 0 },
    ]);
  });

  it("refuses setting a quantity below 0", () => {
    expect(errors("ABC-1,-1", "SET")).toEqual([
      "Line 1: a quantity cannot be set below 0.",
    ]);
  });

  it("refuses the same code twice and says where it was first", () => {
    expect(errors("ABC-1,1\nABC-2,1\nABC-1,3")).toEqual([
      "Line 3: ABC-1 is already on line 1.",
    ]);
  });

  it("reports every bad line at once", () => {
    expect(errors("ABC-1\nABC-2,x\nABC-3,1")).toHaveLength(2);
  });

  it("refuses an overlong code", () => {
    expect(errors(`${"A".repeat(256)},1`)).toEqual([
      "Line 1: the SKU or barcode is too long.",
    ]);
    expect(lines(`${"A".repeat(255)},1`)).toHaveLength(1);
  });

  it("refuses empty input", () => {
    expect(errors("")).toEqual(["Enter at least one line."]);
    expect(errors(" \n\t\n")).toEqual(["Enter at least one line."]);
  });

  it("refuses more lines than one adjustment may hold", () => {
    const text = (count: number) =>
      Array.from({ length: count }, (_, i) => `SKU-${i},1`).join("\n");
    expect(lines(text(MAX_ADJUSTMENT_LINES))).toHaveLength(
      MAX_ADJUSTMENT_LINES,
    );
    expect(errors(text(MAX_ADJUSTMENT_LINES + 1))).toEqual([
      `One adjustment can change at most ${MAX_ADJUSTMENT_LINES} items. Split the rest into another adjustment.`,
    ]);
  });

  it("refuses text too long to be a list of items without reading it", () => {
    expect(errors("A".repeat(MAX_ADJUSTMENT_TEXT_LENGTH + 1))).toEqual([
      `That is too much text for one adjustment. Enter at most ${MAX_ADJUSTMENT_LINES} lines.`,
    ]);
  });
});

describe("adjustment reasons and modes", () => {
  it("offers only reason codes Shopify accepts, each once", () => {
    const codes = ADJUSTMENT_REASONS.map((reason) => reason.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(SHOPIFY_INVENTORY_REASONS).toContain(code);
    }
  });

  it("recognises its own reasons and modes only", () => {
    expect(isAdjustmentReason("damaged")).toBe(true);
    expect(isAdjustmentReason("movement_created")).toBe(false);
    expect(isAdjustmentReason(null)).toBe(false);
    expect(isAdjustmentMode("SET")).toBe(true);
    expect(isAdjustmentMode("set")).toBe(false);
    expect(isAdjustmentMode(undefined)).toBe(false);
  });

  it("labels a reason, and falls back to the code for one it does not offer", () => {
    expect(adjustmentReasonLabel("shrinkage")).toBe("Theft or loss");
    expect(adjustmentReasonLabel("correction")).toBe("Correction");
    expect(adjustmentReasonLabel("movement_created")).toBe("movement_created");
  });
});
