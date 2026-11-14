import { describe, expect, it } from "vitest";
import {
  DEFAULT_LABEL_TEMPLATE,
  LABEL_SIZES,
  inchesToDots,
  labelSize,
  parseLabelTemplate,
  withField,
} from "./template";

describe("label sizes", () => {
  it("converts stock sizes to whole printer dots at 203 dpi", () => {
    expect(LABEL_SIZES.map((size) => [inchesToDots(size.widthIn), inchesToDots(size.heightIn)])).toEqual([
      [305, 203],
      [406, 203],
      [457, 254],
      [609, 406],
    ]);
  });

  it("falls back to the default size for an unknown ID", () => {
    expect(labelSize("3x2").id).toBe("3x2");
    expect(labelSize("nope").id).toBe(DEFAULT_LABEL_TEMPLATE.sizeId);
  });
});

describe("parseLabelTemplate", () => {
  it("accepts a saved template and puts its fields in the standard order", () => {
    expect(parseLabelTemplate({ sizeId: "3x2", fields: ["price", "product", "sku"] })).toEqual({
      sizeId: "3x2",
      fields: ["product", "sku", "price"],
    });
  });

  it("drops unknown fields and duplicate fields", () => {
    expect(
      parseLabelTemplate({ sizeId: "2x1", fields: ["cost", "price", "price", 7, null] }),
    ).toEqual({ sizeId: "2x1", fields: ["price"] });
  });

  it("keeps a template with no fields, so every box can be unticked", () => {
    expect(parseLabelTemplate({ sizeId: "2x1", fields: [] })).toEqual({ sizeId: "2x1", fields: [] });
  });

  it("replaces an unknown size and keeps the fields", () => {
    expect(parseLabelTemplate({ sizeId: "A4", fields: ["sku"] })).toEqual({
      sizeId: DEFAULT_LABEL_TEMPLATE.sizeId,
      fields: ["sku"],
    });
  });

  it.each([null, undefined, "2x1", 4, [], { sizeId: "2x1" }, { fields: "price" }])(
    "returns the default template for %j",
    (value) => {
      expect(parseLabelTemplate(value)).toEqual(DEFAULT_LABEL_TEMPLATE);
    },
  );
});

describe("withField", () => {
  it("adds a field in the standard order and removes one", () => {
    const added = withField(DEFAULT_LABEL_TEMPLATE, "supplier", true);
    expect(added.fields).toEqual(["product", "variant", "supplier", "barcode", "price"]);
    expect(withField(added, "product", false).fields).toEqual([
      "variant",
      "supplier",
      "barcode",
      "price",
    ]);
  });

  it("leaves the template it was given unchanged", () => {
    withField(DEFAULT_LABEL_TEMPLATE, "sku", true);
    expect(DEFAULT_LABEL_TEMPLATE.fields).toEqual(["product", "variant", "barcode", "price"]);
  });
});
