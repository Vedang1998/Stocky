import { describe, expect, it } from "vitest";
import {
  CODE128_PATTERNS,
  code128ModuleCount,
  code128Symbols,
  code128Widths,
  isCode128Encodable,
} from "./code128";

/** Reads bar widths back into text, independently of the encoder's set choice. */
function decode(widths: number[]): string {
  const joined = widths.join("");
  const symbols: number[] = [];
  for (let i = 0; i + 7 < joined.length; i += 6) {
    symbols.push(CODE128_PATTERNS.indexOf(joined.slice(i, i + 6)));
  }
  expect(joined.slice(-7)).toBe(CODE128_PATTERNS[106]);
  const check = symbols.pop();
  expect(check).toBe(
    symbols.reduce((sum, symbol, index) => sum + symbol * Math.max(index, 1), 0) % 103,
  );

  let digits = symbols[0] === 105;
  let text = "";
  for (const symbol of symbols.slice(1)) {
    if (digits && symbol === 100) digits = false;
    else if (!digits && symbol === 99) digits = true;
    else text += digits ? String(symbol).padStart(2, "0") : String.fromCharCode(symbol + 32);
  }
  return text;
}

describe("Code 128 pattern table", () => {
  it("has 107 distinct symbols of 11 modules and a 13-module stop", () => {
    expect(CODE128_PATTERNS).toHaveLength(107);
    expect(new Set(CODE128_PATTERNS).size).toBe(107);
    const width = (pattern: string) => Array.from(pattern, Number).reduce((a, b) => a + b, 0);
    expect(CODE128_PATTERNS.slice(0, 106).every((p) => p.length === 6 && width(p) === 11)).toBe(true);
    expect(width(CODE128_PATTERNS[106])).toBe(13);
  });
});

describe("code128Widths", () => {
  // Bar/space widths checked against an independent Code 128 encoder.
  it.each([
    ["036000291452", "2112321212233141112122223222111222312133111312222331112"],
    ["CB-12", "2112141313211311231221321232212232111141132331112"],
  ])("encodes %s", (value, widths) => {
    expect(code128Widths(value).join("")).toBe(widths);
  });

  it("uses the digit set for all-digit values, halving their width", () => {
    expect(code128Symbols("036000291452")).toEqual([105, 3, 60, 0, 29, 14, 52, 5]);
    expect(code128ModuleCount("036000291452")).toBe(8 * 11 + 13);
    expect(code128ModuleCount("ABCDEFGHIJKL")).toBe(14 * 11 + 13);
  });

  it.each([
    "12345",
    "12345678-A",
    "0360002914521",
    "AB12345678",
    "A",
    " ~!",
    "123",
    "12",
    "SKU-000123/RED",
  ])("round-trips %s", (value) => {
    expect(decode(code128Widths(value))).toBe(value);
  });

  it("always starts and ends with a bar", () => {
    expect(code128Widths("CB-12").length % 2).toBe(1);
  });

  it("refuses values it cannot encode exactly", () => {
    expect(isCode128Encodable("Café")).toBe(false);
    expect(isCode128Encodable("")).toBe(false);
    expect(isCode128Encodable("TAB\there")).toBe(false);
    expect(() => code128Widths("Café")).toThrow(RangeError);
  });
});
