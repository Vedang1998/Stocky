import { describe, expect, it } from "vitest";
import { parseBundleComponentForm } from "./component-form";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const VALID = { bundleVariantId: "v-bundle", componentVariantId: "v-part", quantity: "2" };

describe("parseBundleComponentForm", () => {
  it("keeps the quantity as the exact decimal that was typed", () => {
    for (const quantity of ["1", "0.1", "2.5000", "999999.9999", "0.0001"]) {
      expect(parseBundleComponentForm(form({ ...VALID, quantity }))).toEqual({
        ok: true,
        values: { ...VALID, quantity },
      });
    }
  });

  it("trims what was typed", () => {
    expect(
      parseBundleComponentForm(
        form({ bundleVariantId: " v-bundle ", componentVariantId: "v-part\n", quantity: " 3 " }),
      ),
    ).toEqual({ ok: true, values: { ...VALID, quantity: "3" } });
  });

  it("rejects a quantity that is zero, negative, not a number or too precise", () => {
    for (const quantity of ["0", "0.0000", "-1", "abc", "1e3", "1.23456", "1000000", "NaN", "1,5", ""]) {
      const parsed = parseBundleComponentForm(form({ ...VALID, quantity }));
      expect(parsed, quantity).toEqual({ ok: false, errors: { quantity: expect.any(String) } });
    }
  });

  it("rejects a bundle that contains itself", () => {
    expect(
      parseBundleComponentForm(form({ ...VALID, componentVariantId: VALID.bundleVariantId })),
    ).toEqual({ ok: false, errors: { componentVariantId: "A bundle can't contain itself." } });
  });

  it("reports every missing field", () => {
    expect(parseBundleComponentForm(new FormData())).toEqual({
      ok: false,
      errors: {
        bundleVariantId: expect.any(String),
        componentVariantId: expect.any(String),
        quantity: expect.any(String),
      },
    });
  });
});
