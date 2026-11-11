/**
 * CSV encoding for merchant exports.
 *
 * Text that reaches an export (product titles, supplier names, notes, SKUs)
 * is merchant- or integration-controlled, and spreadsheet applications
 * evaluate cells that start with a formula trigger. Text cells that could be
 * read as a formula are prefixed with an apostrophe so they open as text.
 * Numeric values (numbers, bigints, Prisma Decimals and strictly numeric
 * strings such as "-12.50") are emitted verbatim so they stay numeric.
 *
 * Output follows RFC 4180: comma separated, CRLF line endings, and fields
 * quoted when they contain a delimiter, quote, line break or edge whitespace.
 */

import { Prisma } from "@prisma/client";
import { downloadHeaders } from "./http/download.server";

export type CsvCell =
  | string
  | number
  | bigint
  | boolean
  | Prisma.Decimal
  | Date
  | null
  | undefined;

/** ASCII and full-width characters that make spreadsheets treat a cell as a formula. */
const FORMULA_TRIGGERS = new Set([
  "=",
  "+",
  "-",
  "@",
  "\t",
  "\r",
  "\n",
  "＝", // FULLWIDTH EQUALS SIGN
  "＋", // FULLWIDTH PLUS SIGN
  "－", // FULLWIDTH HYPHEN-MINUS
  "＠", // FULLWIDTH COMMERCIAL AT
]);

/** A plain decimal literal cannot carry a formula, so it is safe verbatim. */
const NUMERIC_LITERAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

const NEEDS_QUOTING = /[",\r\n]|^\s|\s$/;

function neutralizeFormula(text: string): string {
  if (NUMERIC_LITERAL.test(text)) return text;
  const firstVisible = text.trimStart().charAt(0);
  const first = text.charAt(0);
  if (FORMULA_TRIGGERS.has(first) || FORMULA_TRIGGERS.has(firstVisible)) {
    return `'${text}`;
  }
  return text;
}

function quote(text: string): string {
  return NEEDS_QUOTING.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Encode one value as a CSV field. */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  if (Prisma.Decimal.isDecimal(value)) {
    return value.toString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  return quote(neutralizeFormula(value));
}

/** Encode one row (no trailing line break). */
export function csvRow(cells: readonly CsvCell[]): string {
  return cells.map(csvCell).join(",");
}

/** Encode a header row and data rows as a complete CSV document. */
export function toCsv(
  headers: readonly string[],
  rows: Iterable<readonly CsvCell[]>,
): string {
  const lines = [csvRow(headers)];
  for (const row of rows) lines.push(csvRow(row));
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * Build a private, non-cacheable CSV download. `filename` is sanitized; pass
 * the full name including the `.csv` extension.
 */
export function csvDownloadResponse(
  body: string | ReadableStream<Uint8Array>,
  filename: string,
): Response {
  return new Response(body, {
    headers: downloadHeaders({
      contentType: "text/csv; charset=utf-8",
      filename,
    }),
  });
}
