import { describe, expect, it } from "vitest";
import { parseWholeNumber, readFormId } from "./form-values";

describe("parseWholeNumber", () => {
  const range = { min: 0, max: 1000 };

  it.each([
    ["0", 0],
    ["42", 42],
    [" 7 ", 7],
    ["1000", 1000],
  ])("reads %j as %d", (value, expected) => {
    expect(parseWholeNumber(value, range)).toBe(expected);
  });

  it.each([
    "",
    " ",
    "1.5",
    "1e3",
    "12abc",
    "0x10",
    "NaN",
    "Infinity",
    "-1",
    "1001",
    "99999999999",
    "１２",
  ])("rejects %j", (value) => {
    expect(parseWholeNumber(value, range)).toBeNull();
  });

  it("rejects values that are not strings, such as an uploaded file or a missing field", () => {
    expect(parseWholeNumber(null, range)).toBeNull();
    expect(parseWholeNumber(undefined, range)).toBeNull();
    expect(parseWholeNumber(5, range)).toBeNull();
    expect(parseWholeNumber(new Blob(["5"]), range)).toBeNull();
  });

  it("accepts negatives only when the range allows them", () => {
    expect(parseWholeNumber("-3", { min: -10, max: 10 })).toBe(-3);
    expect(parseWholeNumber("-11", { min: -10, max: 10 })).toBeNull();
  });
});

describe("readFormId", () => {
  it("returns the trimmed value", () => {
    expect(readFormId("  abc123 ")).toBe("abc123");
  });

  it("rejects empty, oversized and non-string values", () => {
    expect(readFormId("")).toBeNull();
    expect(readFormId("   ")).toBeNull();
    expect(readFormId("x".repeat(192))).toBeNull();
    expect(readFormId("x".repeat(191))).toHaveLength(191);
    expect(readFormId(null)).toBeNull();
    expect(readFormId(new Blob(["id"]))).toBeNull();
  });
});
