import { describe, expect, it } from "vitest";
import { code128ModuleCount } from "./code128";
import {
  estimateTextWidth,
  fitText,
  labelText,
  layoutLabel,
  wrapText,
  type LabelContent,
  type LabelElement,
  type LabelLayout,
} from "./layout";
import { LABEL_FIELDS, LABEL_SIZES, type LabelTemplate } from "./template";

const ALL_FIELDS = LABEL_FIELDS.map((field) => field.id);

const SNOWBOARD: LabelContent = {
  productTitle: "The Multi-managed Snowboard",
  variantTitle: "Large / Blue",
  sku: "SNOW-LG-BLU",
  barcode: "036000291452",
  price: "$729.95",
  compareAtPrice: "$899.00",
  supplier: "Snowboard Vendor",
  location: "Snow City Warehouse",
};

function template(sizeId: string, fields = ALL_FIELDS): LabelTemplate {
  return { sizeId, fields };
}

function box(element: LabelElement) {
  const width =
    element.kind === "text"
      ? element.width
      : code128ModuleCount(element.value) * element.moduleWidth;
  const height = element.kind === "text" ? element.fontHeight : element.height;
  return {
    left: element.x,
    right: element.x + width,
    top: element.y,
    bottom: element.y + height,
  };
}

function expectPrintable(layout: LabelLayout) {
  const boxes = layout.elements.map(box);
  for (const b of boxes) {
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.top).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(layout.widthDots);
    expect(b.bottom).toBeLessThanOrEqual(layout.heightDots);
  }
  for (const [i, a] of boxes.entries()) {
    for (const b of boxes.slice(i + 1)) {
      const apart =
        a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
      expect(apart, `${JSON.stringify(a)} overlaps ${JSON.stringify(b)}`).toBe(true);
    }
  }
}

const texts = (layout: LabelLayout) =>
  layout.elements.flatMap((element) => (element.kind === "text" ? [element.text] : []));
const bars = (layout: LabelLayout) =>
  layout.elements.flatMap((element) => (element.kind === "barcode" ? [element] : []));

describe("labelText", () => {
  it("removes printer command characters and control characters", () => {
    expect(labelText("Tea^XA~JA\u0000\n Pot\u0085")).toBe("Tea XA JA Pot");
  });

  it("keeps accented and non-Latin text", () => {
    expect(labelText("  Crème brûlée – 北海道  ")).toBe("Crème brûlée – 北海道");
  });

  it("treats a missing value as empty", () => {
    expect(labelText(null)).toBe("");
    expect(labelText(undefined)).toBe("");
  });
});

describe("text fitting", () => {
  it("keeps text that fits and cuts text that does not, never mid-space", () => {
    expect(fitText("Tea", 20, 400)).toBe("Tea");
    const cut = fitText("Organic Darjeeling First Flush Loose Leaf", 20, 150);
    expect(cut.length).toBeLessThan(41);
    expect(cut).toBe(cut.trimEnd());
    expect(estimateTextWidth(cut, 20)).toBeLessThanOrEqual(150);
  });

  it("counts wide scripts as wider than Latin", () => {
    expect(estimateTextWidth("北海道", 20)).toBeGreaterThan(estimateTextWidth("abc", 20));
  });

  it("wraps at spaces and cuts the last line", () => {
    const lines = wrapText("The Multi-managed Snowboard Limited Edition", 26, 300, 2);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("The Multi-managed");
    for (const line of lines) expect(estimateTextWidth(line, 26)).toBeLessThanOrEqual(300);
  });

  it("cuts a single word that is wider than the line", () => {
    const [line, ...rest] = wrapText("Supercalifragilisticexpialidocious", 26, 120, 2);
    expect(rest).toEqual([]);
    expect(estimateTextWidth(line, 26)).toBeLessThanOrEqual(120);
  });

  it("returns short text as one line", () => {
    expect(wrapText("Ski Wax", 26, 400, 2)).toEqual(["Ski Wax"]);
  });
});

describe("layoutLabel", () => {
  it.each(LABEL_SIZES.map((size) => size.id))(
    "keeps every element on a %s label and apart from the others",
    (sizeId) => {
      expectPrintable(layoutLabel(template(sizeId), SNOWBOARD));
      expectPrintable(
        layoutLabel(template(sizeId), {
          ...SNOWBOARD,
          productTitle: "Extra Long Product Name ".repeat(8),
          variantTitle: "Extra Large / Midnight Blue / Wide",
          sku: "SKU-WITH-A-VERY-LONG-CODE-0001",
          barcode: "5901234123457",
          price: "CA$12,345.67",
        }),
      );
    },
  );

  it.each(LABEL_SIZES.map((size) => size.id))(
    "prints a UPC as scannable bars with clear space either side on a %s label",
    (sizeId) => {
      const layout = layoutLabel(template(sizeId), SNOWBOARD);
      const [barcode] = bars(layout);
      expect(barcode.value).toBe("036000291452");
      expect(barcode.moduleWidth).toBeGreaterThanOrEqual(2);
      expect(barcode.height).toBeGreaterThanOrEqual(51);
      const width = code128ModuleCount(barcode.value) * barcode.moduleWidth;
      expect(barcode.x).toBeGreaterThanOrEqual(10 * barcode.moduleWidth);
      expect(layout.widthDots - barcode.x - width).toBeGreaterThanOrEqual(10 * barcode.moduleWidth);
      expect(texts(layout)).toContain("036000291452");
    },
  );

  it("prints the product, variant, price and barcode of the default kind of label", () => {
    const layout = layoutLabel(
      template("2.25x1.25", ["product", "variant", "barcode", "price"]),
      SNOWBOARD,
    );
    expect(layout).toMatchObject({ widthDots: 457, heightDots: 254, issues: [] });
    expect(texts(layout)).toEqual([
      "The Multi-managed Snowboard",
      "Large / Blue",
      "$729.95",
      "036000291452",
    ]);
  });

  it("prints only the fields that were chosen", () => {
    const layout = layoutLabel(template("3x2", ["product", "price"]), SNOWBOARD);
    expect(texts(layout)).toEqual(["The Multi-managed Snowboard", "$729.95"]);
    expect(bars(layout)).toEqual([]);
    expect(layout.issues).toEqual([]);
  });

  it("shows the compare-at price as a 'Was' line", () => {
    const layout = layoutLabel(template("3x2"), SNOWBOARD);
    expect(texts(layout)).toContain("Was $899.00");
  });

  it("skips fields the product has no value for without reporting a problem", () => {
    const layout = layoutLabel(template("3x2"), {
      ...SNOWBOARD,
      variantTitle: null,
      supplier: null,
      location: "",
      compareAtPrice: null,
    });
    expect(texts(layout)).toEqual([
      "The Multi-managed Snowboard",
      "$729.95",
      "SNOW-LG-BLU",
      "036000291452",
    ]);
    expect(layout.issues).toEqual([]);
  });

  it("uses a second title line only where the label is tall enough", () => {
    const content = { ...SNOWBOARD, productTitle: "The Multi-managed Snowboard Limited Edition" };
    const fields = ["product" as const, "barcode" as const];
    const tall = layoutLabel(template("2.25x1.25", fields), content);
    const short = layoutLabel(template("2x1", fields), content);
    expect(texts(tall).slice(0, 2).join(" ")).toBe(content.productTitle);
    expect(texts(short)).toHaveLength(2);
  });

  it("encodes the SKU when there is no barcode, and does not print the SKU twice", () => {
    const layout = layoutLabel(template("3x2"), { ...SNOWBOARD, barcode: null });
    expect(bars(layout)[0].value).toBe("SNOW-LG-BLU");
    expect(texts(layout).filter((text) => text === "SNOW-LG-BLU")).toHaveLength(1);
  });

  it("reports a product with nothing to encode and still prints its text", () => {
    const layout = layoutLabel(template("2.25x1.25"), { ...SNOWBOARD, barcode: " ", sku: null });
    expect(layout.issues).toContainEqual({ kind: "no_barcode" });
    expect(bars(layout)).toEqual([]);
    expect(texts(layout)).toContain("The Multi-managed Snowboard");
    expectPrintable(layout);
  });

  it.each(["ÅÄÖ-123", "AB^FD12", "AB~12", "A\u0007B"])(
    "prints %j as text instead of bars that would scan as something else",
    (barcode) => {
      const layout = layoutLabel(template("3x2"), { ...SNOWBOARD, barcode });
      expect(layout.issues).toContainEqual({ kind: "barcode_unprintable" });
      expect(bars(layout)).toEqual([]);
      for (const text of texts(layout)) {
        expect(text).not.toMatch(/[\^~]/);
        expect(text).not.toContain("\u0007");
      }
      expectPrintable(layout);
    },
  );

  it("reports a code too long for the label and prints it as text", () => {
    const barcode = "LONG-ALPHANUMERIC-CODE-0001";
    const small = layoutLabel(template("1.5x1"), { ...SNOWBOARD, barcode });
    expect(small.issues).toContainEqual({ kind: "barcode_too_long" });
    expect(bars(small)).toEqual([]);
    expect(texts(small).some((text) => barcode.startsWith(text) && text.length > 4)).toBe(true);

    const large = layoutLabel(template("3x2"), { ...SNOWBOARD, barcode: "LONG-CODE-0001" });
    expect(bars(large)).toHaveLength(1);
  });

  it("leaves the least important fields off a small label and says which", () => {
    const layout = layoutLabel(template("1.5x1"), SNOWBOARD);
    const issue = layout.issues.find((entry) => entry.kind === "fields_left_off");
    expect(issue).toBeDefined();
    const left = issue?.kind === "fields_left_off" ? issue.fields : [];
    expect(left[0]).toBe("location");
    expect(left).not.toContain("product");
    expect(left).not.toContain("price");
    expect(texts(layout)).not.toContain("Snow City Warehouse");
    expect(texts(layout)).toContain("$729.95");
    expect(bars(layout)).toHaveLength(1);
    expectPrintable(layout);
  });

  it("fits everything on the largest label", () => {
    expect(layoutLabel(template("3x2"), SNOWBOARD).issues).toEqual([]);
  });

  it("falls back to the default size for an unknown size", () => {
    expect(layoutLabel(template("9x9"), SNOWBOARD)).toMatchObject({
      widthDots: 457,
      heightDots: 254,
    });
  });
});
