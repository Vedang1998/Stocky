import { describe, expect, it } from "vitest";
import { FormReader } from "../../lib/purchasing/form-input";
import {
  parseChargesForm,
  parseLineUpdateForm,
  parsePurchaseOrderHeaderForm,
} from "./purchase-orders.server";
import {
  parsePriceTierForm,
  parseSupplierProductForm,
  parseSupplierProfileForm,
} from "./suppliers.server";

const WIDGET = "gid://shopify/ProductVariant/201";

function reader(fields: Record<string, string>): FormReader {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return new FormReader(form);
}

describe("supplier product form", () => {
  it("reads terms and defaults quantity fields left blank to 1", () => {
    const form = reader({ variantGid: WIDGET, vendorSku: " ACME-1 ", supplierCost: "3.5", isPreferred: "on" });
    const input = parseSupplierProductForm(form);

    expect(input).toMatchObject({
      variantGid: WIDGET,
      vendorSku: "ACME-1",
      moq: 1,
      packSize: 1,
      leadTimeDaysOverride: null,
      orderUnit: null,
      isPreferred: true,
    });
    expect(input!.supplierCost!.toFixed(4)).toBe("3.5000");
  });

  it.each([
    ["packSize", "0"],
    ["packSize", "-6"],
    ["packSize", "NaN"],
    ["moq", "2.5"],
    ["supplierCost", "-1"],
    ["supplierCost", "1e3"],
    ["leadTimeDaysOverride", "-3"],
  ])("rejects %s of %j", (field, value) => {
    const form = reader({ variantGid: WIDGET, [field]: value });

    expect(parseSupplierProductForm(form)).toBeNull();
    expect(Object.keys(form.errors)).toEqual([field]);
  });
});

describe("price tier form", () => {
  it("reads an open-ended tier", () => {
    const input = parsePriceTierForm(reader({ variantGid: WIDGET, minQty: "10", unitCost: "2.75" }));

    expect(input).toMatchObject({ variantGid: WIDGET, minQty: 10, maxQty: null });
    expect(input!.unitCost.toFixed(2)).toBe("2.75");
  });

  it("rejects a range that ends before it starts, and a missing cost", () => {
    const form = reader({ variantGid: WIDGET, minQty: "10", maxQty: "5" });

    expect(parsePriceTierForm(form)).toBeNull();
    expect(form.errors).toMatchObject({
      maxQty: "To quantity cannot be less than the from quantity.",
    });
    expect(Object.keys(form.errors).sort()).toEqual(["maxQty", "unitCost"]);
  });
});

describe("supplier profile form", () => {
  it("requires a name and a currency and validates contact details", () => {
    const form = reader({ contactEmail: "not-an-email", countryCode: "USA", defaultLeadTimeDays: "-1" });

    expect(parseSupplierProfileForm(form)).toBeNull();
    expect(Object.keys(form.errors).sort()).toEqual([
      "contactEmail",
      "countryCode",
      "currency",
      "defaultLeadTimeDays",
      "name",
    ]);
  });

  it("reads a complete profile", () => {
    const input = parseSupplierProfileForm(
      reader({
        name: "Acme Supply",
        currency: "cad",
        contactEmail: "orders@acme.example",
        defaultLeadTimeDays: "14",
        minimumOrderValue: "250",
        defaultTaxRatePercent: "8.25",
      }),
    );

    expect(input).toMatchObject({
      name: "Acme Supply",
      currency: "CAD",
      contactEmail: "orders@acme.example",
      defaultLeadTimeDays: 14,
      accountNumber: null,
    });
    expect(input!.minimumOrderValue!.toFixed(2)).toBe("250.00");
    expect(input!.defaultTaxRatePercent!.toFixed(2)).toBe("8.25");
  });
});

describe("purchase order line form", () => {
  it("treats a blank cost as priced from supplier terms", () => {
    const input = parseLineUpdateForm(reader({ quantity: "24", discountPercent: "5" }));

    expect(input).toMatchObject({ quantity: 24, unitCost: null, taxRatePercent: null, note: null });
    expect(input!.discountPercent!.toFixed(0)).toBe("5");
  });

  it.each([
    ["quantity", ""],
    ["quantity", "0"],
    ["quantity", "-4"],
    ["quantity", "NaN"],
    ["quantity", "1000001"],
    ["unitCost", "-0.01"],
    ["unitCost", "Infinity"],
    ["unitCost", "1.00001"],
    ["discountPercent", "101"],
    ["taxRatePercent", "-1"],
  ])("rejects %s of %j", (field, value) => {
    const form = reader({ quantity: "1", [field]: value });

    expect(parseLineUpdateForm(form)).toBeNull();
    expect(Object.keys(form.errors)).toEqual([field]);
  });
});

describe("purchase order charges form", () => {
  it("reads charges in order with their allocation choice", () => {
    const input = parseChargesForm(
      reader({
        chargeCount: "2",
        landedCostMethod: "WEIGHT",
        "charge-kind-0": "SHIPPING",
        "charge-amount-0": "30",
        "charge-description-0": "Freight",
        "charge-allocate-0": "on",
        "charge-kind-1": "DISCOUNT",
        "charge-amount-1": "5.50",
      }),
    );

    expect(input!.landedCostMethod).toBe("WEIGHT");
    expect(
      input!.charges.map((charge) => [charge.kind, charge.amount.toFixed(2), charge.description, charge.allocate]),
    ).toEqual([
      ["SHIPPING", "30.00", "Freight", true],
      ["DISCOUNT", "5.50", null, false],
    ]);
  });

  it("rejects negative amounts, unknown types and too many charges", () => {
    const form = reader({
      chargeCount: "2",
      landedCostMethod: "COST",
      "charge-kind-0": "SHIPPING",
      "charge-amount-0": "-30",
      "charge-kind-1": "BRIBE",
      "charge-amount-1": "1",
    });
    expect(parseChargesForm(form)).toBeNull();
    expect(Object.keys(form.errors).sort()).toEqual(["charge-amount-0", "charge-kind-1"]);

    const tooMany = reader({ chargeCount: "21", landedCostMethod: "COST" });
    expect(parseChargesForm(tooMany)).toBeNull();
    expect(Object.keys(tooMany.errors)).toEqual(["chargeCount"]);
  });
});

describe("purchase order header form", () => {
  it("leaves commercial terms alone unless the form posts them", () => {
    const input = parsePurchaseOrderHeaderForm(
      reader({ expectedOn: "2026-11-20", supplierNotes: "Deliver to dock 2" }),
    );

    expect(input).not.toHaveProperty("locationGid");
    expect(input).not.toHaveProperty("currency");
    expect(input).not.toHaveProperty("exchangeRate");
    expect(input!.expectedOn?.toISOString()).toBe("2026-11-20T00:00:00.000Z");
    expect(input!.supplierNotes).toBe("Deliver to dock 2");
  });

  it("rejects impossible dates and a zero exchange rate", () => {
    const form = reader({ expectedOn: "2026-02-30", currency: "usd", exchangeRate: "0" });

    expect(parsePurchaseOrderHeaderForm(form)).toBeNull();
    expect(Object.keys(form.errors).sort()).toEqual(["exchangeRate", "expectedOn"]);
  });
});
