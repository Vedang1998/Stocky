import { describe, expect, it } from "vitest";
import {
  MAX_SCANNED_CODE_LENGTH,
  barcodeLookupKeys,
  compressUpcA,
  expandUpcE,
  gtinCheckDigit,
  isValidGtin,
  normalizeScannedCode,
} from "./barcode";

describe("normalizeScannedCode", () => {
  it("strips scanner terminators and surrounding whitespace", () => {
    expect(normalizeScannedCode("  036000291452\r\n")).toEqual({
      ok: true,
      code: "036000291452",
    });
    expect(normalizeScannedCode("SKU-RED-M\t")).toEqual({
      ok: true,
      code: "SKU-RED-M",
    });
  });

  it("keeps internal spaces and letter case of non-numeric codes", () => {
    expect(normalizeScannedCode("Shelf A 12")).toEqual({
      ok: true,
      code: "Shelf A 12",
    });
  });

  it("removes an AIM symbology identifier", () => {
    expect(normalizeScannedCode("]E04006381333931")).toEqual({
      ok: true,
      code: "4006381333931",
    });
    expect(normalizeScannedCode("]A0CODE39")).toEqual({
      ok: true,
      code: "CODE39",
    });
  });

  it("reduces a GS1 element string with AI (01) to its GTIN", () => {
    expect(
      normalizeScannedCode("]C1010400638133393117271231\u001d10LOT42"),
    ).toEqual({ ok: true, code: "04006381333931" });
  });

  it("leaves a GS1 payload alone when the embedded GTIN is invalid", () => {
    expect(normalizeScannedCode("]C10104006381333932")).toEqual({
      ok: true,
      code: "0104006381333932",
    });
  });

  it("does not treat a plain 01-prefixed number as a GS1 element string", () => {
    expect(normalizeScannedCode("0104006381333931")).toEqual({
      ok: true,
      code: "0104006381333931",
    });
  });

  it("rejects empty and oversized input", () => {
    expect(normalizeScannedCode(" \r\n")).toEqual({ ok: false, reason: "empty" });
    expect(normalizeScannedCode("]E0")).toEqual({ ok: false, reason: "empty" });
    expect(normalizeScannedCode("9".repeat(MAX_SCANNED_CODE_LENGTH))).toEqual({
      ok: true,
      code: "9".repeat(MAX_SCANNED_CODE_LENGTH),
    });
    expect(
      normalizeScannedCode("9".repeat(MAX_SCANNED_CODE_LENGTH + 1)),
    ).toEqual({ ok: false, reason: "too_long" });
  });
});

describe("GTIN check digits", () => {
  it("matches published reference codes", () => {
    expect(gtinCheckDigit("03600029145")).toBe(2);
    expect(gtinCheckDigit("400638133393")).toBe(1);
    expect(gtinCheckDigit("9638507")).toBe(4);
  });

  it("rejects non-digit bodies", () => {
    expect(() => gtinCheckDigit("12A4")).toThrow(RangeError);
  });

  it("validates GTIN-8/12/13/14 only", () => {
    expect(isValidGtin("96385074")).toBe(true);
    expect(isValidGtin("036000291452")).toBe(true);
    expect(isValidGtin("4006381333931")).toBe(true);
    expect(isValidGtin("04006381333931")).toBe(true);
    expect(isValidGtin("036000291453")).toBe(false);
    expect(isValidGtin("3600029145")).toBe(false);
    expect(isValidGtin("0360002914521")).toBe(false);
    expect(isValidGtin("03600029145A")).toBe(false);
  });
});

describe("UPC-E", () => {
  it("expands each zero-suppression pattern", () => {
    expect(expandUpcE("04252614")).toBe("042100005264");
    expect(expandUpcE("01234565")).toBe("012345000065");
  });

  it("rejects bad check digits, number systems and lengths", () => {
    expect(expandUpcE("04252615")).toBeNull();
    expect(expandUpcE("24252614")).toBeNull();
    expect(expandUpcE("0425261")).toBeNull();
  });

  it("round-trips every compressible pattern", () => {
    const withCheckDigit = (body: string) => body + gtinCheckDigit(body);
    const upcAs = [
      "04210000526", // manufacturer ends 100, last UPC-E digit 1
      "01200000123", // manufacturer ends 000 with third digit 0..2
      "01530000047", // third manufacturer digit 3..9 -> UPC-E digit 3
      "01234000005", // manufacturer ends in one zero -> UPC-E digit 4
      "01111100005", // no manufacturer zeros, product 5..9 -> UPC-E digit 5..9
      "11200000123", // number system 1
    ].map(withCheckDigit);

    for (const upcA of upcAs) {
      const upcE = compressUpcA(upcA);
      expect(upcE, upcA).not.toBeNull();
      expect(expandUpcE(upcE!)).toBe(upcA);
    }
  });

  it("does not compress codes without the zero pattern or number system", () => {
    expect(compressUpcA("036000291452")).toBeNull();
    expect(compressUpcA("43600029145" + gtinCheckDigit("43600029145"))).toBeNull();
  });
});

describe("barcodeLookupKeys", () => {
  it("returns only the exact code for non-GTIN values", () => {
    expect(barcodeLookupKeys("SKU-RED-M")).toEqual(["SKU-RED-M"]);
    expect(barcodeLookupKeys("12345")).toEqual(["12345"]);
    expect(barcodeLookupKeys("036000291453")).toEqual(["036000291453"]);
  });

  it("links UPC-A, EAN-13 and GTIN-14 spellings in both directions", () => {
    const fromUpcA = barcodeLookupKeys("036000291452");
    expect(fromUpcA[0]).toBe("036000291452");
    expect(fromUpcA).toEqual(
      expect.arrayContaining(["0036000291452", "00036000291452"]),
    );

    const fromGtin14 = barcodeLookupKeys("00036000291452");
    expect(fromGtin14[0]).toBe("00036000291452");
    expect(fromGtin14).toEqual(
      expect.arrayContaining(["036000291452", "0036000291452"]),
    );
  });

  it("keeps an EAN-13 with a non-zero prefix out of the 12-digit space", () => {
    expect(barcodeLookupKeys("4006381333931").sort()).toEqual(
      ["04006381333931", "4006381333931"].sort(),
    );
  });

  it("does not equate a case-level GTIN-14 with its unit GTIN", () => {
    expect(barcodeLookupKeys("10036000291459")).toEqual(["10036000291459"]);
  });

  it("links a UPC-E with its expanded UPC-A", () => {
    expect(barcodeLookupKeys("04252614")).toEqual(
      expect.arrayContaining([
        "04252614",
        "042100005264",
        "0042100005264",
        "00042100005264",
      ]),
    );
    expect(barcodeLookupKeys("042100005264")).toContain("04252614");
  });

  it("pads an EAN-8 without inventing a UPC-E spelling", () => {
    const keys = barcodeLookupKeys("96385074");
    expect(keys).toEqual(
      expect.arrayContaining(["96385074", "000096385074", "00000096385074"]),
    );
    expect(keys.filter((key) => key.length === 8)).toEqual(["96385074"]);
  });

  it("returns unique keys with the exact spelling first", () => {
    const keys = barcodeLookupKeys("012345000065");
    expect(keys[0]).toBe("012345000065");
    expect(new Set(keys).size).toBe(keys.length);
  });
});
