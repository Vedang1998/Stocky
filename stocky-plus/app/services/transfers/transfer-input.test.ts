import { describe, expect, it } from "vitest";
import { parseTransferItems } from "./transfer-input";

describe("parseTransferItems", () => {
  it("reads one code per row, with a quantity after a tab, comma or semicolon", () => {
    expect(
      parseTransferItems("RED-750\t3\r\nWHT-750, 2\n5010003;10\nROSE-750"),
    ).toEqual({
      ok: true,
      items: [
        { lineNumber: 1, code: "RED-750", quantity: 3 },
        { lineNumber: 2, code: "WHT-750", quantity: 2 },
        { lineNumber: 3, code: "5010003", quantity: 10 },
        { lineNumber: 4, code: "ROSE-750", quantity: 1 },
      ],
    });
  });

  it("adds up a code listed more than once and skips blank rows", () => {
    expect(parseTransferItems("5010001\n\n5010001\n  \n5010001,4\n")).toEqual({
      ok: true,
      items: [{ lineNumber: 1, code: "5010001", quantity: 6 }],
    });
  });

  it("keeps a comma that is part of the code", () => {
    expect(parseTransferItems("WINE,RED\nWINE,RED,2")).toEqual({
      ok: true,
      items: [{ lineNumber: 1, code: "WINE,RED", quantity: 3 }],
    });
  });

  it("names every row it cannot read", () => {
    expect(
      parseTransferItems("RED-750,0\n,3\nWHT-750,-2\nROSE-750,1.5"),
    ).toEqual({
      ok: false,
      errors: [
        'Line 1: "0" is not a whole number from 1 to 1,000,000.',
        "Line 2: enter a SKU or barcode.",
        'Line 3: "-2" is not a whole number from 1 to 1,000,000.',
      ],
    });
    expect(parseTransferItems(`${"X".repeat(256)},1`)).toEqual({
      ok: false,
      errors: ["Line 1: the SKU or barcode is too long."],
    });
  });

  it("treats a last field that is not a number as part of the code", () => {
    expect(parseTransferItems("ROSE-750,1.5")).toEqual({
      ok: true,
      items: [{ lineNumber: 1, code: "ROSE-750,1.5", quantity: 1 }],
    });
  });

  it("refuses units that add up past the limit of a line", () => {
    expect(parseTransferItems("RED-750,600000\nRED-750,600000")).toEqual({
      ok: false,
      errors: ["Line 1: RED-750 adds up to more than 1,000,000 units."],
    });
  });

  it("refuses an empty list, too many items and too much text", () => {
    expect(parseTransferItems(" \n\t\n")).toEqual({
      ok: false,
      errors: ["Enter at least one SKU or barcode."],
    });
    const codes = Array.from({ length: 251 }, (_, n) => `SKU-${n}`);
    expect(parseTransferItems(codes.join("\n"))).toEqual({
      ok: false,
      errors: ["Add at most 250 items at a time. This list has 251."],
    });
    expect(parseTransferItems(codes.slice(0, 250).join("\n"))).toMatchObject({
      ok: true,
    });
    expect(parseTransferItems("x".repeat(50_001))).toEqual({
      ok: false,
      errors: [
        "That is too much text for one list. Add at most 250 items at a time.",
      ],
    });
  });
});
