import { describe, expect, it } from "vitest";
import { formatDecimal, formatMoney, MISSING_VALUE } from "./decimal-format";

describe("formatMoney", () => {
  it("formats a decimal string in the given currency", () => {
    expect(formatMoney("7.25", "USD")).toBe("$7.25");
    expect(formatMoney("25", "USD")).toBe("$25.00");
    expect(formatMoney("1234567.5", "USD")).toBe("$1,234,567.50");
    expect(formatMoney("-12.5", "USD")).toBe("-$12.50");
    expect(formatMoney("7.25", "EUR")).toBe("€7.25");
  });

  it("rounds half away from zero on the decimal value, not on a float", () => {
    // Number("1.005").toFixed(2) is "1.00" because 1.005 has no exact binary form.
    expect(formatMoney("1.005", "USD")).toBe("$1.01");
    expect(formatMoney("2.675", "USD")).toBe("$2.68");
    expect(formatMoney("-1.005", "USD")).toBe("-$1.01");
    expect(formatMoney("2.9167", "USD")).toBe("$2.92");
  });

  it("keeps digits a float cannot hold", () => {
    expect(formatMoney("123456789012345678901234.565", "USD")).toBe(
      "$123,456,789,012,345,678,901,234.57",
    );
  });

  it("uses the currency's own number of decimals", () => {
    expect(formatMoney("1234.5", "JPY")).toBe("¥1,235");
  });

  it("shows unit-cost precision when asked", () => {
    expect(formatMoney("2.9167", "USD", { maximumFractionDigits: 4 })).toBe(
      "$2.9167",
    );
    expect(formatMoney("7.25", "USD", { maximumFractionDigits: 4 })).toBe(
      "$7.25",
    );
  });

  it("shows a placeholder for a missing amount", () => {
    expect(formatMoney(null, "USD")).toBe(MISSING_VALUE);
    expect(formatMoney(undefined, "USD")).toBe(MISSING_VALUE);
  });

  it("still shows the amount when the stored currency is not a valid code", () => {
    expect(formatMoney("7.25", "dollars")).toBe("7.25 dollars");
    expect(formatMoney("7.25", "")).toBe("7.25");
    expect(formatMoney("2.9167", "dollars", { maximumFractionDigits: 4 })).toBe(
      "2.9167 dollars",
    );
  });

  it("rejects anything that is not a plain decimal string", () => {
    for (const value of ["NaN", "[object Object]", "1e-9", "", " 7.25", "7.", "$7.25"]) {
      expect(() => formatMoney(value, "USD")).toThrow(TypeError);
    }
  });
});

describe("formatDecimal", () => {
  it("drops trailing zeros and groups thousands", () => {
    expect(formatDecimal("2.0000")).toBe("2");
    expect(formatDecimal("1.500000")).toBe("1.5");
    expect(formatDecimal("12500")).toBe("12,500");
    expect(formatDecimal("1.085")).toBe("1.085");
  });

  it("limits decimals when asked", () => {
    expect(formatDecimal("0.125", { maximumFractionDigits: 2 })).toBe("0.13");
  });

  it("shows a placeholder for a missing value and rejects non-decimals", () => {
    expect(formatDecimal(null)).toBe(MISSING_VALUE);
    expect(() => formatDecimal("NaN")).toThrow(TypeError);
  });
});
