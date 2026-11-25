/**
 * Long documents print in parts. Laying out a PDF costs about a hundredth of
 * a second of server time for every table row, and the server answers nothing
 * else while it works, so a document with more rows than one part holds is
 * printed as several, one request each (`?part=2`).
 *
 * Pages use these to offer one link per part, so nothing here may depend on
 * server-only code.
 */
export const PDF_LINES_PER_PART = 250;

/** How many parts a document with this many rows prints in; at least one. */
export function pdfPartCount(lineCount: number): number {
  return Math.max(1, Math.ceil(lineCount / PDF_LINES_PER_PART));
}

export interface PdfPart<Line> {
  part: number;
  parts: number;
  lines: Line[];
  /** 1-based position of the part's first row among all rows. */
  first: number;
  total: number;
}

/** The rows of one part. A part past the last one has no rows. */
export function pdfPart<Line>(
  lines: readonly Line[],
  part: number,
): PdfPart<Line> {
  const start = (part - 1) * PDF_LINES_PER_PART;
  return {
    part,
    parts: pdfPartCount(lines.length),
    lines: lines.slice(start, start + PDF_LINES_PER_PART),
    first: start + 1,
    total: lines.length,
  };
}

export function isLastPart(shown: Pick<PdfPart<unknown>, "part" | "parts">) {
  return shown.part === shown.parts;
}

/**
 * The part an address asks for: 1 when it names none, null for anything but
 * a whole number from 1.
 */
export function readPdfPart(value: string | null): number | null {
  if (value === null) return 1;
  if (!/^[1-9]\d{0,3}$/.test(value)) return null;
  return Number(value);
}

/** "Transfer T-1 · Part 2 of 3"; the bare title for a document in one part. */
export function partTitle(
  title: string,
  shown: Pick<PdfPart<unknown>, "part" | "parts">,
): string {
  return shown.parts > 1
    ? `${title} · Part ${shown.part} of ${shown.parts}`
    : title;
}

const count = (value: number) => value.toLocaleString("en-US");

/** "Items 251 to 500 of 1,000" on a document in parts; null on one that is not. */
export function partRange(
  shown: PdfPart<unknown>,
  rows = "Items",
): string | null {
  if (shown.parts === 1) return null;
  const last = shown.first + shown.lines.length - 1;
  return `${rows} ${count(shown.first)} to ${count(last)} of ${count(shown.total)}`;
}

/** `?part=2` for a link to one part; nothing for a document in one part. */
export function partQuery(part: number, parts: number): string {
  return parts > 1 ? `?part=${part}` : "";
}

/** ", part 2 of 3" after a link's words; nothing for a document in one part. */
export function partLabel(part: number, parts: number): string {
  return parts > 1 ? `, part ${part} of ${parts}` : "";
}

/** `-part-2-of-3` for a file name; nothing for a document in one part. */
export function partFileSuffix(part: number, parts: number): string {
  return parts > 1 ? `-part-${part}-of-${parts}` : "";
}
