import { describe, expect, it } from "vitest";
import {
  Decimal,
  currencyFractionDigits,
  displayMoney,
  formatMoneyAmount,
  percentOf,
  sumDecimals,
  toDecimalOrNull,
} from "./money";

describe("money", () => {
  it("uses ISO 4217 minor units", () => {
    expect(currencyFractionDigits("USD")).toBe(2);
    expect(currencyFractionDigits("jpy")).toBe(0);
    expect(currencyFractionDigits("KWD")).toBe(3);
  });

  it("rounds half away from zero to the currency's minor unit", () => {
    expect(formatMoneyAmount("2.005", "USD")).toBe("2.01");
    expect(formatMoneyAmount("-2.005", "USD")).toBe("-2.01");
    expect(formatMoneyAmount("1234.5", "JPY")).toBe("1235");
    expect(formatMoneyAmount("1.0005", "KWD")).toBe("1.001");
    expect(formatMoneyAmount(new Decimal("7"), "USD")).toBe("7.00");
  });

  it("sums without binary floating-point error", () => {
    expect(sumDecimals(["0.1", "0.2", new Decimal("0.3")]).toString()).toBe("0.6");
    expect(sumDecimals([]).toString()).toBe("0");
  });

  it("computes percentages, or null for a zero denominator", () => {
    expect(percentOf("1", "3")).toBe("33.33");
    expect(percentOf("2", "3", 0)).toBe("67");
    expect(percentOf("1", "0")).toBeNull();
  });

  it("formats large amounts for display without precision loss", () => {
    expect(displayMoney("12345678901234567.89", "USD")).toBe("$12,345,678,901,234,567.89");
    expect(displayMoney("1500", "JPY")).toBe("¥1,500");
  });

  it("passes null through", () => {
    expect(toDecimalOrNull(null)).toBeNull();
    expect(toDecimalOrNull(undefined)).toBeNull();
    expect(toDecimalOrNull("1.5")?.toString()).toBe("1.5");
  });
});
