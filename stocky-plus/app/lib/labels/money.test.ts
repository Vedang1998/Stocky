import { describe, expect, it } from "vitest";
import { formatLabelMoney } from "./money";

describe("formatLabelMoney", () => {
  it("formats an amount in its currency", () => {
    expect(formatLabelMoney("729.950000", "USD")).toBe("$729.95");
    expect(formatLabelMoney("5", "USD")).toBe("$5.00");
    expect(formatLabelMoney("1234.5", "EUR")).toBe("€1,234.50");
    expect(formatLabelMoney("1000", "JPY")).toBe("¥1,000");
  });

  it("shows the code for a currency the runtime does not know", () => {
    expect(formatLabelMoney("12", "ZZZZ")).toBe("12.00 ZZZZ");
  });

  it("returns nothing for an amount that is not a number", () => {
    expect(formatLabelMoney("", "USD")).toBeNull();
    expect(formatLabelMoney("abc", "USD")).toBeNull();
  });
});
