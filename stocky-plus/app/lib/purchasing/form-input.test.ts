import { describe, expect, it } from "vitest";
import {
  FormReader,
  formatCalendarDate,
  parseCalendarDate,
  todayInTimeZone,
} from "./form-input";

function reader(fields: Record<string, string>): FormReader {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return new FormReader(form);
}

const QUANTITY = { min: 1, max: 1_000_000, label: "Quantity" };
const UNIT_COST = { scale: 4, min: 0, max: 999_999, label: "Unit cost" };

describe("FormReader.integer", () => {
  it("reads a whole number", () => {
    const form = reader({ quantity: " 12 " });
    expect(form.integer("quantity", QUANTITY)).toBe(12);
    expect(form.ok).toBe(true);
  });

  it.each(["1.5", "abc", "NaN", "Infinity", "1e3", "0x10", "12 units", "١٢"])(
    "rejects %j as not a whole number",
    (value) => {
      const form = reader({ quantity: value });
      expect(form.integer("quantity", QUANTITY)).toBeNull();
      expect(form.errors.quantity).toBe("Quantity must be a whole number.");
    },
  );

  it.each(["0", "-1", "1000001"])("rejects %j as out of range", (value) => {
    const form = reader({ quantity: value });
    expect(form.integer("quantity", QUANTITY)).toBeNull();
    expect(form.errors.quantity).toBe("Quantity must be between 1 and 1000000.");
  });

  it("rejects a number too large to hold exactly", () => {
    const form = reader({ quantity: "9007199254740993" });
    expect(form.integer("quantity", QUANTITY)).toBeNull();
    expect(form.errors.quantity).toBe("Quantity is too large.");
  });

  it("distinguishes a missing optional value from a missing required one", () => {
    const optional = reader({ packSize: "   " });
    expect(optional.integer("packSize", { min: 1, max: 9999 })).toBeNull();
    expect(optional.ok).toBe(true);

    const required = reader({});
    expect(required.integer("quantity", { ...QUANTITY, required: true })).toBeNull();
    expect(required.errors.quantity).toBe("Quantity is required.");
  });
});

describe("FormReader.decimal", () => {
  it("keeps the value exact", () => {
    const form = reader({ unitCost: "7.2500", big: "999999.9999" });
    expect(form.decimal("unitCost", UNIT_COST)?.toString()).toBe("7.25");
    expect(form.decimal("big", { ...UNIT_COST, max: 1_000_000 })?.toString()).toBe(
      "999999.9999",
    );
    expect(form.ok).toBe(true);
  });

  it.each(["NaN", "Infinity", "-Infinity", "1e5", "7,25", "$7.25", ".5", "7.", "0x1A"])(
    "rejects %j as not a number",
    (value) => {
      const form = reader({ unitCost: value });
      expect(form.decimal("unitCost", UNIT_COST)).toBeNull();
      expect(form.errors.unitCost).toBe("Unit cost must be a number like 12.50.");
    },
  );

  it("rejects more decimals than the column stores instead of rounding", () => {
    const form = reader({ unitCost: "7.12345", amount: "10.999" });
    expect(form.decimal("unitCost", UNIT_COST)).toBeNull();
    expect(form.errors.unitCost).toBe("Unit cost can have at most 4 decimal places.");
    expect(form.decimal("amount", { scale: 2, min: 0, max: 100, label: "Amount" })).toBeNull();
    expect(form.errors.amount).toBe("Amount can have at most 2 decimal places.");
  });

  it("rejects negative and oversized values", () => {
    const form = reader({ negative: "-0.01", huge: "1000000" });
    expect(form.decimal("negative", UNIT_COST)).toBeNull();
    expect(form.errors.negative).toBe("Unit cost must be between 0 and 999999.");
    expect(form.decimal("huge", UNIT_COST)).toBeNull();
    expect(form.errors.huge).toBe("Unit cost must be between 0 and 999999.");
  });

  it("supports an exclusive lower bound for rates that cannot be zero", () => {
    const options = {
      scale: 6,
      min: 0,
      max: 100000,
      minExclusive: true,
      label: "Exchange rate",
    };
    const form = reader({ zero: "0", fine: "0.000001" });
    expect(form.decimal("zero", options)).toBeNull();
    expect(form.errors.zero).toBe(
      "Exchange rate must be greater than 0 and at most 100000.",
    );
    expect(form.decimal("fine", options)?.toString()).toBe("0.000001");
  });
});

describe("FormReader.percent", () => {
  it("accepts 0 to 100 with up to four decimals", () => {
    const form = reader({ a: "0", b: "100", c: "8.2575" });
    expect(form.percent("a", {})?.toString()).toBe("0");
    expect(form.percent("b", {})?.toString()).toBe("100");
    expect(form.percent("c", {})?.toString()).toBe("8.2575");
    expect(form.ok).toBe(true);
  });

  it("rejects values outside 0 to 100", () => {
    const form = reader({ discount: "100.01", tax: "-1" });
    expect(form.percent("discount", { label: "Discount" })).toBeNull();
    expect(form.errors.discount).toBe("Discount must be between 0 and 100.");
    expect(form.percent("tax", { label: "Tax rate" })).toBeNull();
    expect(form.errors.tax).toBe("Tax rate must be between 0 and 100.");
  });
});

describe("FormReader.date", () => {
  it("reads a calendar date as UTC midnight", () => {
    const form = reader({ expectedOn: "2026-11-24" });
    expect(form.date("expectedOn", {})?.toISOString()).toBe("2026-11-24T00:00:00.000Z");
  });

  it.each(["2026-02-30", "2026-13-01", "24/11/2026", "2026-11-24T10:00", "1999-12-31", "2101-01-01"])(
    "rejects %j",
    (value) => {
      const form = reader({ expectedOn: value });
      expect(form.date("expectedOn", { label: "Expected date" })).toBeNull();
      expect(form.errors.expectedOn).toBe(
        "Expected date must be a valid date (YYYY-MM-DD).",
      );
    },
  );

  it("accepts a leap day only in a leap year", () => {
    expect(parseCalendarDate("2028-02-29")?.toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(parseCalendarDate("2027-02-29")).toBeNull();
  });
});

describe("FormReader text-like fields", () => {
  it("trims text and enforces its length", () => {
    const form = reader({ name: "  Acme Wholesale  ", note: "x".repeat(11) });
    expect(form.text("name", { maxLength: 255, required: true })).toBe("Acme Wholesale");
    expect(form.text("note", { maxLength: 10, label: "Note" })).toBeNull();
    expect(form.errors.note).toBe("Note must be 10 characters or fewer.");
  });

  it("only accepts listed choices", () => {
    const methods = ["COST", "QUANTITY"] as const;
    const form = reader({ method: "QUANTITY", bad: "constructor" });
    expect(form.choice("method", methods, {})).toBe("QUANTITY");
    expect(form.choice("bad", methods, { label: "Allocation" })).toBeNull();
    expect(form.errors.bad).toBe("Allocation is not a valid option.");
  });

  it("reads checkboxes", () => {
    const form = reader({ a: "on", b: "TRUE", c: "off", d: "" });
    expect(form.checkbox("a")).toBe(true);
    expect(form.checkbox("b")).toBe(true);
    expect(form.checkbox("c")).toBe(false);
    expect(form.checkbox("d")).toBe(false);
    expect(form.checkbox("missing")).toBe(false);
  });

  it("normalises currency and country codes", () => {
    const form = reader({ currency: "eur", country: "ca", bad: "dollars", zone: "USA" });
    expect(form.currency("currency", {})).toBe("EUR");
    expect(form.country("country", {})).toBe("CA");
    expect(form.currency("bad", {})).toBeNull();
    expect(form.errors.bad).toBe("Currency must be a 3-letter code such as USD.");
    expect(form.country("zone", {})).toBeNull();
    expect(form.errors.zone).toBe("Country must be a 2-letter code such as US.");
  });

  it("validates email addresses and web links", () => {
    const form = reader({
      email: "orders@acme.example",
      badEmail: "orders@acme",
      site: "https://acme.example/portal",
      script: "javascript:alert(1)",
      bare: "acme.example",
    });
    expect(form.email("email", {})).toBe("orders@acme.example");
    expect(form.email("badEmail", { label: "Contact email" })).toBeNull();
    expect(form.errors.badEmail).toBe("Contact email is not a valid address.");
    expect(form.url("site", {})).toBe("https://acme.example/portal");
    expect(form.url("script", {})).toBeNull();
    expect(form.url("bare", {})).toBeNull();
    expect(form.errors.script).toBe("Website must start with https://");
    expect(form.errors.bare).toBe("Website must start with https://");
  });

  it("keeps the first error recorded for a field", () => {
    const form = reader({});
    form.fail("quantity", "First");
    form.fail("quantity", "Second");
    expect(form.errors).toEqual({ quantity: "First" });
    expect(form.ok).toBe(false);
  });

  it("ignores uploaded files where text is expected", () => {
    const form = new FormData();
    form.set("name", new Blob(["x"]), "name.txt");
    expect(new FormReader(form).raw("name")).toBeNull();
  });
});

describe("calendar helpers", () => {
  it("formats a stored date back to YYYY-MM-DD", () => {
    expect(formatCalendarDate(new Date("2026-11-24T00:00:00.000Z"))).toBe("2026-11-24");
    expect(formatCalendarDate("2026-11-24T00:00:00.000Z")).toBe("2026-11-24");
    expect(formatCalendarDate(null)).toBeNull();
    expect(formatCalendarDate("not a date")).toBeNull();
  });

  it("works out today in the merchant's time zone", () => {
    const instant = new Date("2026-11-11T03:30:00.000Z");
    expect(todayInTimeZone("America/New_York", instant)).toBe("2026-11-10");
    expect(todayInTimeZone("Asia/Tokyo", instant)).toBe("2026-11-11");
  });

  it("does not guess when the time zone is missing or invalid", () => {
    expect(todayInTimeZone(null)).toBeNull();
    expect(todayInTimeZone("Mars/Olympus")).toBeNull();
  });
});
