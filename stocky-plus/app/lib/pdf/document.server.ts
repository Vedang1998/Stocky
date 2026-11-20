/**
 * What every printed document in the app is built from: one set of page and
 * table styles, the labelled blocks at the top of a page, the page-number
 * footer, and the response that hands the PDF to the browser.
 */
import { createElement as h, type ReactElement, type ReactNode } from "react";
import type { DocumentProps, Styles } from "@react-pdf/renderer";
import { downloadHeaders } from "../http/download.server";

export type ReactPdf = typeof import("@react-pdf/renderer");

export const PDF_STYLES = {
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#444", marginBottom: 16 },
  blocks: { flexDirection: "row" as const, marginBottom: 14 },
  block: { flexGrow: 1, flexBasis: 0, paddingRight: 12 },
  label: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#555",
    marginBottom: 2,
    textTransform: "uppercase" as const,
  },
  headerRow: {
    flexDirection: "row" as const,
    borderBottomWidth: 1.5,
    borderBottomColor: "#111",
    paddingVertical: 5,
    fontFamily: "Helvetica-Bold",
  },
  row: {
    flexDirection: "row" as const,
    borderBottomWidth: 0.5,
    borderBottomColor: "#bbb",
    paddingVertical: 5,
  },
  detail: { fontSize: 8, color: "#555", marginTop: 1 },
  number: { textAlign: "right" as const },
  totals: { marginTop: 10, marginLeft: "55%" },
  totalRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    paddingVertical: 2,
  },
  grandTotal: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    borderTopWidth: 1.5,
    borderTopColor: "#111",
    marginTop: 4,
    paddingTop: 4,
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  notes: { marginTop: 18 },
  footer: {
    position: "absolute" as const,
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 8,
    color: "#777",
    textAlign: "center" as const,
  },
};

/** Settles when the document before this one is done, however it ended. */
let layoutQueue: Promise<void> = Promise.resolve();

/** Lets requests that are waiting on the event loop go first. */
const afterWaitingRequests = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

/**
 * Lays out one document. The renderer is loaded only when a document is
 * asked for; it is large.
 *
 * Documents are laid out one after another, in the order they were asked
 * for. The first part of layout runs without giving the event loop back
 * (just under a second for 250 rows), and documents asked for together ran
 * that part back to back: with twelve of them another request of the
 * process waited 9.9 seconds, measured here. In a queue the loop is free
 * again after each document's own layout, and the same request waited about
 * a second (0.9 with twelve documents, 1.3 at worst with six). The documents
 * themselves take as long as before.
 */
export function renderPdf(
  build: (pdf: ReactPdf) => ReactElement<DocumentProps>,
): Promise<Uint8Array<ArrayBuffer>> {
  const document = layoutQueue.then(afterWaitingRequests).then(async () => {
    const pdf = await import("@react-pdf/renderer");
    return new Uint8Array(await pdf.renderToBuffer(build(pdf)));
  });
  // A document that fails must not stop the ones behind it.
  layoutQueue = document.then(
    () => undefined,
    () => undefined,
  );
  return document;
}

/** A small headed block of lines; blank lines are dropped, and so is an empty block. */
export function labelled(
  { Text, View }: ReactPdf,
  label: string,
  lines: Array<string | null | undefined>,
): ReactNode {
  const shown = lines.filter((line): line is string => Boolean(line?.trim()));
  if (shown.length === 0) return null;
  return h(
    View,
    { style: PDF_STYLES.block },
    h(Text, { style: PDF_STYLES.label }, label),
    ...shown.map((line, index) => h(Text, { key: index }, line)),
  );
}

type CellStyle = Styles[string];

// A cell is one text run, with any second line as a smaller run inside it:
// a table row made of plain text lays out about twice as fast as one made of
// nested boxes, and a document can have hundreds of rows.
const DETAIL = { fontSize: 8, color: "#555" };

/** A table cell: its text, and a smaller second line when there is one. */
export function textCell(
  { Text }: ReactPdf,
  style: CellStyle,
  text: string,
  detail: string | null,
): ReactNode {
  return h(
    Text,
    { style },
    text,
    detail ? h(Text, { style: DETAIL }, "\n", detail) : null,
  );
}

/** What a person scans or reads to find the item: its barcode, with the SKU under it, or the SKU alone. */
export function codeCell(
  pdf: ReactPdf,
  style: CellStyle,
  item: { barcode: string | null; sku: string | null },
): ReactNode {
  return textCell(
    pdf,
    style,
    item.barcode || item.sku || "—",
    item.barcode && item.sku ? `SKU ${item.sku}` : null,
  );
}

const BOX_WIDTH = 40;
const BOX_GAP = 22;

/** The column that takes the width the others leave: the item's name. */
export const ITEM_COLUMN = { flexGrow: 1, flexBasis: 0, paddingRight: 6 };

/** The heading over a column of write-in boxes. */
export const BOX_HEADING = {
  width: BOX_WIDTH + BOX_GAP,
  textAlign: "right" as const,
};

/** An empty box somebody writes a counted quantity into. */
export function writeInBox({ View }: ReactPdf): ReactNode {
  return h(View, {
    style: {
      width: BOX_WIDTH,
      height: 14,
      marginLeft: BOX_GAP,
      borderWidth: 0.75,
      borderColor: "#111",
    },
  });
}

/** Two ruled lines under a label, for a name with signature and a date. */
export function signature({ Text, View }: ReactPdf, label: string): ReactNode {
  const rule = {
    borderBottomWidth: 0.75,
    borderBottomColor: "#111",
    height: 22,
  };
  return h(
    View,
    { style: { ...PDF_STYLES.block, paddingRight: 24 } },
    h(Text, { style: PDF_STYLES.label }, label),
    h(View, { style: rule }),
    h(Text, { style: PDF_STYLES.detail }, "Name and signature"),
    h(View, { style: rule }),
    h(Text, { style: PDF_STYLES.detail }, "Date"),
  );
}

export function pageFooter({ Text }: ReactPdf, text: string): ReactNode {
  return h(Text, {
    style: PDF_STYLES.footer,
    fixed: true,
    render: ({
      pageNumber,
      totalPages,
    }: {
      pageNumber: number;
      totalPages: number;
    }) => `${text} · Page ${pageNumber} of ${totalPages}`,
  });
}

/** A PDF answer the browser shows in a tab rather than saving straight away. */
export function pdfResponse(
  body: Uint8Array<ArrayBuffer>,
  filename: string,
): Response {
  return new Response(body, {
    headers: downloadHeaders({
      contentType: "application/pdf",
      filename,
      disposition: "inline",
    }),
  });
}

/**
 * The answer to an address that asks for a part the document does not have:
 * a sentence that says how many there are, as plain text.
 */
export function noSuchPartResponse(what: string, parts: number): Response {
  return new Response(
    parts === 1
      ? `This ${what} prints as one document, without parts.`
      : `This ${what} prints in ${parts} parts. Ask for a part from 1 to ${parts}.`,
    {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
