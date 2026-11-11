import { describe, expect, it } from "vitest";
import {
  LABEL_BARCODE_MAX_CHARS,
  MAX_LABEL_VARIANTS,
  MAX_LABELS_PER_REQUEST,
  parseLabelItems,
  printableBarcode,
  zplFieldText,
  zplLabel,
} from "./warehouse-labels.server";

const GID = "gid://shopify/ProductVariant/1002";

/** What `url.searchParams.get("items")` yields for a link built by the UI. */
function itemsParam(link: string): string {
  return new URL(`https://app.example/app/warehouse/labels?items=${link}`)
    .searchParams.get("items")!;
}

describe("parseLabelItems", () => {
  it("parses a GID that the UI encoded once", () => {
    const parsed = parseLabelItems(itemsParam(`${encodeURIComponent(GID)}:3`));
    expect(parsed).toEqual({ ok: true, items: [{ variantId: GID, count: 3 }] });
  });

  it("parses a GID that was encoded twice", () => {
    const twice = encodeURIComponent(encodeURIComponent(GID));
    const parsed = parseLabelItems(itemsParam(`${twice}:2`));
    expect(parsed).toEqual({ ok: true, items: [{ variantId: GID, count: 2 }] });
  });

  it("merges repeated variants and skips zero counts", () => {
    const parsed = parseLabelItems(`${GID}:2,${GID}:3,gid://shopify/ProductVariant/7:0`);
    expect(parsed).toEqual({ ok: true, items: [{ variantId: GID, count: 5 }] });
  });

  it("refuses a request above the total label limit", () => {
    const parsed = parseLabelItems(`${GID}:${MAX_LABELS_PER_REQUEST + 1}`);
    expect(parsed.ok).toBe(false);
  });

  it("refuses the 40,000,000-label request that crashed the server", () => {
    expect(parseLabelItems(`${GID}:40000000`).ok).toBe(false);
  });

  it("refuses limits reached through many entries", () => {
    const half = Math.ceil(MAX_LABELS_PER_REQUEST / 2) + 1;
    expect(parseLabelItems(`${GID}:${half},${GID}:${half}`).ok).toBe(false);

    const tooManyVariants = Array.from(
      { length: MAX_LABEL_VARIANTS + 1 },
      (_, i) => `gid://shopify/ProductVariant/${i + 1}:1`,
    ).join(",");
    expect(parseLabelItems(tooManyVariants).ok).toBe(false);
  });

  it("accepts the limits exactly", () => {
    expect(parseLabelItems(`${GID}:${MAX_LABELS_PER_REQUEST}`).ok).toBe(true);
    const maxVariants = Array.from(
      { length: MAX_LABEL_VARIANTS },
      (_, i) => `gid://shopify/ProductVariant/${i + 1}:1`,
    ).join(",");
    expect(parseLabelItems(maxVariants).ok).toBe(true);
  });

  it.each([
    "",
    ",,",
    `${GID}`,
    `${GID}:`,
    `${GID}:-1`,
    `${GID}:1.5`,
    `${GID}:1e3`,
    `${GID}:abc`,
    ":5",
    "%E0%A4%A:1",
    `${GID}:${"9".repeat(10)}`,
  ])("refuses malformed input %j", (input) => {
    expect(parseLabelItems(input).ok).toBe(false);
  });
});

describe("ZPL field safety", () => {
  it("strips ZPL command prefixes and control characters from text", () => {
    expect(zplFieldText("Widget ^XZ~JR\r\n^XA", 40)).toBe("Widget XZJRXA");
  });

  it("truncates by code point, not UTF-16 unit", () => {
    expect(zplFieldText("😀😀😀", 2)).toBe("😀😀");
  });

  it("prints barcodes only when they can be encoded exactly", () => {
    expect(printableBarcode("0123456789012")).toBe("0123456789012");
    expect(printableBarcode("12^XZ^XA^FDINJECTED")).toBeNull();
    expect(printableBarcode("~JR")).toBeNull();
    expect(printableBarcode("café")).toBeNull();
    expect(printableBarcode("1".repeat(LABEL_BARCODE_MAX_CHARS + 1))).toBeNull();
    expect(printableBarcode("")).toBeNull();
  });

  it("renders an injected barcode as a notice instead of ZPL commands", () => {
    const label = zplLabel({ title: "Alpha Widget", barcode: "12^XZ^XA^FDINJECTED" });
    expect(label).not.toContain("INJECTED");
    expect(label.match(/\^XA/g)).toHaveLength(1);
    expect(label.match(/\^XZ/g)).toHaveLength(1);
    expect(label).toContain("^FDBarcode not printable^FS");
  });

  it("renders a normal label", () => {
    expect(zplLabel({ title: "Alpha Widget", barcode: "111" })).toBe(
      [
        "^XA",
        "^PW457",
        "^LL254",
        "^FO20,20^A0N,24,24^FDAlpha Widget^FS",
        "^FO20,60^BY2^BCN,120,Y,N,N^FD111^FS",
        "^XZ",
      ].join("\n"),
    );
  });

  it("keeps the no-barcode notice for empty values", () => {
    expect(zplLabel({ title: "T", barcode: "" })).toContain(
      "^FDNo barcode on file^FS",
    );
  });
});
