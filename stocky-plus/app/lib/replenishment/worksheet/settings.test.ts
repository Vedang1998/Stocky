import { describe, expect, it } from "vitest";
import {
  parseWorksheetSetup,
  readWorksheetSettings,
  setupFormFromDefaults,
  setupFormFromSettings,
  type SetupDefaults,
  type WorksheetSettings,
} from "./settings";

const AS_OF = "2026-11-10";

const DEFAULTS: SetupDefaults = {
  defaultMethod: "LAST_X_DAYS",
  sampleDays: 30,
  suggestDays: 14,
  targetQuantity: null,
  incomingSource: "SHOPIFY_INCOMING",
  applyMinimumOrderQuantity: false,
  roundUpToPackSize: false,
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const LAST_30 = {
  method: "LAST_X_DAYS",
  sampleDays: "30",
  suggestDays: "14",
  scopeKey: "SHOP",
  incomingSource: "SHOPIFY_INCOMING",
};

describe("parseWorksheetSetup", () => {
  it("reads a last-X-days run with rounding off unless ticked", () => {
    expect(parseWorksheetSetup(form(LAST_30), AS_OF)).toEqual({
      ok: true,
      settings: {
        params: { method: "LAST_X_DAYS", sampleDays: 30, suggestDays: 14 },
        scopeKey: "SHOP",
        incomingSource: "SHOPIFY_INCOMING",
        rounding: { applyMinimumOrderQuantity: false, roundUpToPackSize: false },
        selection: { vendor: null, productType: null, supplierId: null },
      },
    });
  });

  it("turns a supplier rule on only for the box that was ticked", () => {
    const parsed = parseWorksheetSetup(form({ ...LAST_30, roundUpToPackSize: "on" }), AS_OF);
    expect(parsed.ok && parsed.settings.rounding).toEqual({
      applyMinimumOrderQuantity: false,
      roundUpToPackSize: true,
    });
  });

  it("keeps the product selection and trims it", () => {
    const parsed = parseWorksheetSetup(
      form({
        ...LAST_30,
        scopeKey: "gid://shopify/Location/7",
        vendor: "  Acme  ",
        productType: "Wine",
        supplierId: "sup_1",
      }),
      AS_OF,
    );
    expect(parsed.ok && parsed.settings.scopeKey).toBe("gid://shopify/Location/7");
    expect(parsed.ok && parsed.settings.selection).toEqual({
      vendor: "Acme",
      productType: "Wine",
      supplierId: "sup_1",
    });
  });

  it("reports every invalid field instead of substituting a default", () => {
    const parsed = parseWorksheetSetup(
      form({
        method: "LAST_X_DAYS",
        sampleDays: "0",
        suggestDays: "abc",
        scopeKey: "gid://shopify/Product/1",
        incomingSource: "EVERYTHING",
      }),
      AS_OF,
    );
    expect(parsed).toEqual({
      ok: false,
      errors: {
        sampleDays: "Sales period must be between 1 and 730.",
        suggestDays: "Days to cover must be a whole number.",
        scopeKey: "Choose a location.",
        incomingSource: "Choose which incoming stock to count.",
      },
    });
  });

  it("requires a method", () => {
    const parsed = parseWorksheetSetup(form({ ...LAST_30, method: "GUESS" }), AS_OF);
    expect(parsed).toEqual({ ok: false, errors: { method: "Choose a forecast method." } });
  });

  it("rejects a custom range that ends after today", () => {
    const parsed = parseWorksheetSetup(
      form({
        ...LAST_30,
        method: "CUSTOM_RANGE",
        startDate: "2026-11-01",
        endDate: "2026-11-11",
      }),
      AS_OF,
    );
    expect(parsed).toEqual({
      ok: false,
      errors: { endDate: "End date cannot be in the future." },
    });
  });

  it("rejects a custom range with a date that does not exist", () => {
    const parsed = parseWorksheetSetup(
      form({
        ...LAST_30,
        method: "CUSTOM_RANGE",
        startDate: "2026-02-30",
        endDate: "2026-03-10",
      }),
      AS_OF,
    );
    expect(parsed).toEqual({
      ok: false,
      errors: { startDate: "Enter a valid start date." },
    });
  });

  it("needs a target quantity for target stock level and nothing else", () => {
    const missing = parseWorksheetSetup(
      form({ method: "TARGET_STOCK_LEVEL", incomingSource: "NONE" }),
      AS_OF,
    );
    expect(missing).toEqual({
      ok: false,
      errors: { targetQuantity: "Target quantity is required." },
    });

    const parsed = parseWorksheetSetup(
      form({ method: "TARGET_STOCK_LEVEL", incomingSource: "NONE", targetQuantity: "0" }),
      AS_OF,
    );
    expect(parsed.ok && parsed.settings.params).toEqual({
      method: "TARGET_STOCK_LEVEL",
      targetQuantity: 0,
    });
    expect(parsed.ok && parsed.settings.scopeKey).toBe("SHOP");
  });

  it("ignores period fields a stock-level method does not use", () => {
    const parsed = parseWorksheetSetup(
      form({ ...LAST_30, method: "FILL_SHELVES", sampleDays: "not a number" }),
      AS_OF,
    );
    expect(parsed.ok && parsed.settings.params).toEqual({ method: "FILL_SHELVES" });
  });
});

describe("setup form values", () => {
  it("opens with the shop defaults and no product restriction", () => {
    expect(setupFormFromDefaults({ ...DEFAULTS, targetQuantity: 12 })).toEqual({
      method: "LAST_X_DAYS",
      sampleDays: "30",
      suggestDays: "14",
      startDate: "",
      endDate: "",
      targetQuantity: "12",
      scopeKey: "SHOP",
      incomingSource: "SHOPIFY_INCOMING",
      applyMinimumOrderQuantity: false,
      roundUpToPackSize: false,
      vendor: "",
      productType: "",
      supplierId: "",
    });
  });

  it("round-trips a worksheet's settings through the form", () => {
    const settings: WorksheetSettings = {
      params: {
        method: "CUSTOM_RANGE",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        suggestDays: 21,
      },
      scopeKey: "gid://shopify/Location/7",
      incomingSource: "APP_PURCHASE_ORDERS",
      rounding: { applyMinimumOrderQuantity: true, roundUpToPackSize: false },
      selection: { vendor: "Acme", productType: null, supplierId: "sup_1" },
    };
    const values = setupFormFromSettings(settings, DEFAULTS);
    const resubmitted = form({
      method: values.method,
      sampleDays: values.sampleDays,
      suggestDays: values.suggestDays,
      startDate: values.startDate,
      endDate: values.endDate,
      scopeKey: values.scopeKey,
      incomingSource: values.incomingSource,
      vendor: values.vendor,
      supplierId: values.supplierId,
      ...(values.applyMinimumOrderQuantity ? { applyMinimumOrderQuantity: "on" } : {}),
    });
    expect(parseWorksheetSetup(resubmitted, AS_OF)).toEqual({ ok: true, settings });
  });
});

describe("readWorksheetSettings", () => {
  const stored: WorksheetSettings = {
    params: { method: "SAME_PERIOD_LAST_YEAR", suggestDays: 30 },
    scopeKey: "SHOP",
    incomingSource: "NONE",
    rounding: { applyMinimumOrderQuantity: false, roundUpToPackSize: true },
    selection: { vendor: null, productType: "Wine", supplierId: null },
  };

  it("reads back what was stored", () => {
    expect(readWorksheetSettings(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });

  it.each([
    ["nothing", null],
    ["a list", []],
    ["an unknown method", { ...stored, params: { method: "MAGIC" } }],
    ["a day count out of range", { ...stored, params: { ...stored.params, suggestDays: 900 } }],
    ["an unknown incoming source", { ...stored, incomingSource: "BOTH" }],
    ["a scope that is not a location", { ...stored, scopeKey: "gid://shopify/Shop/1" }],
    ["missing rounding", { ...stored, rounding: undefined }],
  ])("returns null for %s", (_name, value) => {
    expect(readWorksheetSettings(value)).toBeNull();
  });

  it("never turns a supplier rule on from a value that is not exactly true", () => {
    const read = readWorksheetSettings({
      ...stored,
      rounding: { applyMinimumOrderQuantity: "yes", roundUpToPackSize: 1 },
    });
    expect(read?.rounding).toEqual({
      applyMinimumOrderQuantity: false,
      roundUpToPackSize: false,
    });
  });
});
