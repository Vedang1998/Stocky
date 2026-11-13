import { describe, expect, it } from "vitest";
import { parseChoice, parseWholeNumber, type FieldErrors } from "./form";
import {
  isScopeKey,
  isVariantGid,
  parseVariantRuleForm,
  SHOP_SCOPE,
} from "./rules.server";
import { parseDefaultsForm } from "./settings.server";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("whole number fields", () => {
  function parse(raw: string | null, optional = true) {
    const errors: FieldErrors = {};
    const value = parseWholeNumber(
      raw,
      "qty",
      "Quantity",
      { min: 0, max: 100 },
      errors,
      { optional },
    );
    return { value, error: errors.qty };
  }

  it("accepts plain digits in range and trims spaces", () => {
    expect(parse("0")).toEqual({ value: 0, error: undefined });
    expect(parse(" 42 ")).toEqual({ value: 42, error: undefined });
    expect(parse("100").value).toBe(100);
  });

  it("treats a blank optional field as not set", () => {
    expect(parse("")).toEqual({ value: null, error: undefined });
    expect(parse("   ")).toEqual({ value: null, error: undefined });
    expect(parse(null)).toEqual({ value: null, error: undefined });
  });

  it("requires a value when the field is not optional", () => {
    expect(parse("", false).error).toBe("Quantity is required.");
  });

  it("rejects anything that is not a plain whole number", () => {
    for (const raw of ["1.5", "-1", "+1", "1e2", "0x10", "ten", "1,000", "٣"]) {
      expect(parse(raw)).toEqual({
        value: null,
        error: "Quantity must be a whole number.",
      });
    }
  });

  it("rejects values outside the range, however long", () => {
    expect(parse("101").error).toBe("Quantity must be between 0 and 100.");
    expect(parse("9".repeat(40)).error).toBe(
      "Quantity must be between 0 and 100.",
    );
  });
});

describe("choice fields", () => {
  it("returns only values from the allowed list", () => {
    const allowed = ["A", "B"] as const;
    expect(parseChoice("A", allowed)).toBe("A");
    expect(parseChoice("C", allowed)).toBeNull();
    expect(parseChoice(null, allowed)).toBeNull();
  });
});

describe("shop defaults form", () => {
  const valid = {
    defaultMethod: "LAST_X_DAYS",
    incomingSource: "SHOPIFY_INCOMING",
    sampleDays: "30",
    suggestDays: "14",
    targetQuantity: "",
    defaultLeadTimeDays: "",
  };

  it("parses a complete form", () => {
    expect(
      parseDefaultsForm(
        form({ ...valid, defaultLeadTimeDays: "7", roundUpToPackSize: "on" }),
      ),
    ).toEqual({
      ok: true,
      values: {
        defaultMethod: "LAST_X_DAYS",
        sampleDays: 30,
        suggestDays: 14,
        targetQuantity: null,
        incomingSource: "SHOPIFY_INCOMING",
        defaultLeadTimeDays: 7,
        applyMinimumOrderQuantity: false,
        roundUpToPackSize: true,
      },
    });
  });

  it("leaves supplier rounding off unless the box is ticked", () => {
    const result = parseDefaultsForm(
      form({ ...valid, applyMinimumOrderQuantity: "true" }),
    );
    expect(result.ok && result.values.applyMinimumOrderQuantity).toBe(false);
  });

  it("does not accept a custom date range as a stored default", () => {
    const result = parseDefaultsForm(
      form({ ...valid, defaultMethod: "CUSTOM_RANGE" }),
    );
    expect(result).toEqual({
      ok: false,
      errors: { defaultMethod: "Choose a forecast method." },
    });
  });

  it("needs a target quantity only for the target stock level method", () => {
    expect(
      parseDefaultsForm(
        form({ ...valid, defaultMethod: "TARGET_STOCK_LEVEL" }),
      ),
    ).toEqual({
      ok: false,
      errors: { targetQuantity: "Target quantity is required." },
    });
    const withTarget = parseDefaultsForm(
      form({
        ...valid,
        defaultMethod: "TARGET_STOCK_LEVEL",
        targetQuantity: "25",
      }),
    );
    expect(withTarget.ok && withTarget.values.targetQuantity).toBe(25);
  });

  it("reports every invalid field together", () => {
    const result = parseDefaultsForm(
      form({
        defaultMethod: "",
        incomingSource: "BOTH",
        sampleDays: "0",
        suggestDays: "366",
        defaultLeadTimeDays: "400",
      }),
    );
    expect(result.ok).toBe(false);
    expect(Object.keys(result.ok ? {} : result.errors).sort()).toEqual([
      "defaultLeadTimeDays",
      "defaultMethod",
      "incomingSource",
      "sampleDays",
      "suggestDays",
    ]);
  });
});

describe("variant rule form", () => {
  const variantGid = "gid://shopify/ProductVariant/7001";

  it("parses levels for the shop or one location", () => {
    expect(
      parseVariantRuleForm(
        form({
          variantGid,
          scopeKey: "gid://shopify/Location/8001",
          minimumQuantity: "5",
          shelfLimitQuantity: "20",
          leadTimeDays: "0",
        }),
      ),
    ).toEqual({
      ok: true,
      variantGid,
      scopeKey: "gid://shopify/Location/8001",
      values: {
        minimumQuantity: 5,
        shelfLimitQuantity: 20,
        reorderPointQuantity: null,
        safetyStockQuantity: null,
        leadTimeDays: 0,
      },
    });
  });

  it("accepts an all-blank form so a rule can be cleared", () => {
    const result = parseVariantRuleForm(
      form({ variantGid, scopeKey: SHOP_SCOPE }),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects unknown ids and out-of-range levels", () => {
    const result = parseVariantRuleForm(
      form({
        variantGid: "7001",
        scopeKey: "default",
        minimumQuantity: "-1",
        leadTimeDays: "366",
      }),
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        variantGid: "Unknown variant.",
        scopeKey: "Unknown stock scope.",
        minimumQuantity: "Minimum must be a whole number.",
        leadTimeDays: "Lead time must be between 0 and 365.",
      },
    });
  });
});

describe("variant and scope ids", () => {
  it("accepts only Shopify variant ids", () => {
    expect(isVariantGid("gid://shopify/ProductVariant/1")).toBe(true);
    expect(isVariantGid("gid://shopify/ProductVariant/1\n")).toBe(false);
    expect(isVariantGid("gid://shopify/Product/1")).toBe(false);
    expect(isVariantGid(`gid://shopify/ProductVariant/${"1".repeat(21)}`)).toBe(
      false,
    );
    expect(isVariantGid(1)).toBe(false);
  });

  it("accepts the shop scope or a Shopify location id", () => {
    expect(isScopeKey(SHOP_SCOPE)).toBe(true);
    expect(isScopeKey("gid://shopify/Location/9")).toBe(true);
    expect(isScopeKey("shop")).toBe(false);
    expect(isScopeKey("gid://shopify/Location/")).toBe(false);
    expect(isScopeKey(null)).toBe(false);
  });
});
