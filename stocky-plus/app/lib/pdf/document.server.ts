/**
 * What every printed document in the app is built from: one set of page and
 * table styles, the labelled blocks at the top of a page, the page-number
 * footer, and the response that hands the PDF to the browser.
 */
import { createElement as h, type ReactElement, type ReactNode } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
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

/** Loads the renderer only when a document is asked for; it is large. */
export async function renderPdf(
  build: (pdf: ReactPdf) => ReactElement<DocumentProps>,
): Promise<Uint8Array<ArrayBuffer>> {
  const pdf = await import("@react-pdf/renderer");
  return new Uint8Array(await pdf.renderToBuffer(build(pdf)));
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
