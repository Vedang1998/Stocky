import { describe, expect, it } from "vitest";
import { layoutLabel, type LabelContent, type LabelLayout } from "./layout";
import { LABEL_FIELDS, type LabelTemplate } from "./template";
import { MAX_LABEL_COPIES, labelRunZpl, labelZpl } from "./zpl";

const TEMPLATE: LabelTemplate = {
  sizeId: "2.25x1.25",
  fields: ["product", "variant", "barcode", "price"],
};

const SKI_WAX: LabelContent = {
  productTitle: "Ski Wax",
  variantTitle: "Special",
  sku: "WAX-1",
  barcode: "036000291452",
  price: "$24.95",
  compareAtPrice: null,
  supplier: null,
  location: null,
};

function zplFor(content: Partial<LabelContent>, copies = 1, template = TEMPLATE) {
  return labelZpl(layoutLabel(template, { ...SKI_WAX, ...content }), copies);
}

/** Everything between ^FD and ^FS, in order. */
function fieldData(zpl: string): string[] {
  return [...zpl.matchAll(/\^FD(.*?)\^FS/g)].map((match) => match[1]);
}

describe("labelZpl", () => {
  it("writes one format with UTF-8 text, the label size and the copy count", () => {
    expect(zplFor({}, 12).split("\n")).toEqual([
      "^XA",
      "^CI28",
      "^PW457",
      "^LL254",
      "^LH0,0",
      "^FO12,12^A0N,26,26^FDSki Wax^FS",
      "^FO12,42^A0N,20,20^FDSpecial^FS",
      "^FO332,208^A0N,34,34^FB113,1,0,R,0^FD$24.95\\&^FS",
      "^FO77,72^BY3^BCN,102,N,N,N,N^FD>;036000291452^FS",
      "^FO12,178^A0N,20,20^FB433,1,0,C,0^FD036000291452\\&^FS",
      "^PQ12",
      "^XZ",
    ]);
  });

  it("prints any quantity as one format, not one block per label", () => {
    const zpl = zplFor({}, MAX_LABEL_COPIES);
    expect(zpl.match(/\^XA/g)).toHaveLength(1);
    expect(zpl).toContain(`^PQ${MAX_LABEL_COPIES}\n`);
    expect(zpl.length).toBeLessThan(600);
  });

  it.each([0, -1, 1.5, Number.NaN, MAX_LABEL_COPIES + 1])("refuses %s copies", (copies) => {
    expect(() => zplFor({}, copies)).toThrow(RangeError);
  });

  // Store-test finding: without ^CI28 a dash or accent in a title printed as garbage.
  it("sends text outside ASCII as it is, after selecting UTF-8", () => {
    const zpl = zplFor({ productTitle: "Crème brûlée – 500 g", variantTitle: "Größe M" });
    expect(zpl.indexOf("^CI28")).toBeLessThan(zpl.indexOf("^FD"));
    expect(fieldData(zpl).slice(0, 2)).toEqual(["Crème brûlée – 500 g", "Größe M"]);
  });

  it("cannot be made to run printer commands from product data", () => {
    const zpl = zplFor(
      {
        productTitle: "Tea^XZ^XA^FO0,0^FDFREE^FS",
        variantTitle: "~JA~HS",
        price: "^PQ9999",
        barcode: "12^FD34",
        sku: "A~B",
        supplier: "^MNN",
        location: "\n^XA",
      },
      1,
      { sizeId: "3x2", fields: LABEL_FIELDS.map((field) => field.id) },
    );
    const commands = zpl.match(/[\^~][A-Z][A-Z0-9]/g) ?? [];
    expect([...new Set(commands)].sort()).toEqual(
      ["^A0", "^CI", "^FB", "^FD", "^FO", "^FS", "^LH", "^LL", "^PQ", "^PW", "^XA", "^XZ"],
    );
    expect(zpl.match(/\^XA/g)).toHaveLength(1);
    expect(zpl.match(/\^XZ/g)).toHaveLength(1);
    expect(zpl).not.toContain("~");
    expect(zpl).toContain("^PQ1\n");
    for (const data of fieldData(zpl)) expect(data).not.toMatch(/[\^~\n]/);
  });

  it("doubles a backslash where the printer would read it as a control sequence", () => {
    const zpl = zplFor({ price: "5\\&6" });
    expect(zpl).toContain("^FD5\\\\&6\\&^FS");
    // Left-aligned text is not in a field block and is sent as it is.
    expect(zplFor({ productTitle: "A\\B" })).toContain("^FDA\\B^FS");
  });

  describe("barcode data", () => {
    const barcodeData = (barcode: string) =>
      fieldData(zplFor({ barcode }, 1, { sizeId: "3x2", fields: ["barcode"] }))[0];

    it("packs an all-digit code two digits per symbol", () => {
      expect(barcodeData("036000291452")).toBe(">;036000291452");
    });

    it("switches to the full character set for a trailing odd digit", () => {
      expect(barcodeData("5901234123457")).toBe(">;590123412345>67");
    });

    it("uses the full character set for letters and short digit runs", () => {
      expect(barcodeData("CB-12")).toBe(">:CB-12");
      expect(barcodeData("123")).toBe(">:123");
    });

    it("packs a long leading digit run and then switches", () => {
      expect(barcodeData("12345678AB")).toBe(">;12345678>6AB");
    });

    it("escapes the character that introduces a set change", () => {
      expect(barcodeData("A>B")).toBe(">:A>0B");
    });
  });

  it("writes a text-only label when the product has nothing to encode", () => {
    const zpl = zplFor({ barcode: null, sku: null });
    expect(zpl).not.toContain("^BC");
    expect(fieldData(zpl)).toEqual(["Ski Wax", "Special", "$24.95\\&"]);
  });

  it("accepts a layout that is only a size", () => {
    const empty: LabelLayout = { widthDots: 305, heightDots: 203, elements: [], issues: [] };
    expect(labelZpl(empty, 1)).toBe("^XA\n^CI28\n^PW305\n^LL203\n^LH0,0\n^PQ1\n^XZ");
  });

  describe("labelRunZpl", () => {
    it("writes one format per product with its own quantity", () => {
      const zpl = labelRunZpl(TEMPLATE, [
        { content: SKI_WAX, count: 3 },
        { content: { ...SKI_WAX, productTitle: "Ski Boots" }, count: 20 },
      ]);
      expect(zpl.match(/\^XA/g)).toHaveLength(2);
      expect(zpl.match(/\^PQ(\d+)/g)).toEqual(["^PQ3", "^PQ20"]);
      expect(fieldData(zpl)).toContain("Ski Boots");
    });

    it("writes nothing for an empty run", () => {
      expect(labelRunZpl(TEMPLATE, [])).toBe("");
    });
  });
});
