/**
 * Printed transfer papers: the pick list the source location pulls stock
 * from, and the transfer document that travels with the stock and is filed
 * once the transfer is finished. Both render from the same read model as the
 * transfer page, so the paper and the screen show the same quantities.
 */
import { createElement as h, type ReactElement, type ReactNode } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import {
  BOX_HEADING,
  ITEM_COLUMN,
  PDF_STYLES,
  codeCell,
  labelled,
  pageFooter,
  renderPdf,
  signature,
  textCell,
  writeInBox,
  type ReactPdf,
} from "../../lib/pdf/document.server";
import {
  isLastPart,
  partFileSuffix,
  partRange,
  partTitle,
  pdfPart,
  pdfPartCount,
  type PdfPart,
} from "../../lib/pdf/parts";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { formatShopTime } from "../inventory-writes/shop-time";
import { itemCount } from "../stocktakes/stocktake-display";
import {
  transferReference,
  transferStatusBadge,
  unitCount,
} from "./transfer-display";
import { transferTotals, type TransferTotals } from "./transfer-quantities";
import {
  getTransfer,
  listTransferLinesForExport,
  type TransferHeader,
  type TransferLineView,
} from "./transfer-read.server";

export interface TransferPlace {
  name: string;
  /** Street, then town with region and postcode, then country code; only the parts Shopify has. */
  addressLines: string[];
}

export interface TransferPaper {
  reference: string;
  transfer: TransferHeader;
  statusLabel: string;
  source: TransferPlace;
  destination: TransferPlace;
  /** Every line, in the order the lines were added. */
  lines: TransferLineView[];
  totals: TransferTotals;
}

interface LocationRow {
  shopifyGid: string;
  name: string;
  address1: string | null;
  city: string | null;
  provinceCode: string | null;
  zip: string | null;
  countryCode: string | null;
}

const UNKNOWN_PLACE: TransferPlace = {
  name: "Location no longer in Shopify",
  addressLines: [],
};

function filled(...parts: Array<string | null | undefined>): string[] {
  return parts.map((part) => part?.trim() ?? "").filter((part) => part !== "");
}

function placeOf(row: LocationRow | undefined): TransferPlace {
  if (!row) return UNKNOWN_PLACE;
  const town = filled(
    row.city,
    filled(row.provinceCode, row.zip).join(" "),
  ).join(", ");
  return {
    name: row.name,
    addressLines: filled(row.address1, town, row.countryCode),
  };
}

/** Everything the transfer papers show, or null when the shop has no such transfer. */
export async function readTransferPaper(
  db: TenantDb,
  transferId: string,
): Promise<TransferPaper | null> {
  const transfer = await getTransfer(db, transferId);
  if (!transfer) return null;

  const [lines, locations] = await Promise.all([
    listTransferLinesForExport(db, transfer),
    db.shopifyLocationFact.findMany({
      where: {
        shopifyGid: {
          in: [transfer.sourceLocationId, transfer.destinationLocationId],
        },
        existenceState: "LIVE",
      },
      select: {
        shopifyGid: true,
        name: true,
        address1: true,
        city: true,
        provinceCode: true,
        zip: true,
        countryCode: true,
      },
    }) as Promise<LocationRow[]>,
  ]);
  const place = (locationId: string) =>
    placeOf(locations.find((row) => row.shopifyGid === locationId));
  const totals = transferTotals(transfer.status, lines, transfer.shipsInParts);

  return {
    reference: transferReference(transfer.id),
    transfer,
    statusLabel: transferStatusBadge(transfer.status, totals).label,
    source: place(transfer.sourceLocationId),
    destination: place(transfer.destinationLocationId),
    lines,
    totals,
  };
}

/** The parts that have text, on one line. */
function joined(...parts: Array<string | false | null | undefined>): string {
  return parts
    .filter(
      (part): part is string => typeof part === "string" && part.trim() !== "",
    )
    .join(" · ");
}

function dateLines(
  transfer: TransferHeader,
  totals: TransferTotals,
  timeZone: string | null,
): string[] {
  const closedShort = totals.returnedUnits + totals.writtenOffUnits > 0;
  return filled(
    `Created ${formatShopTime(transfer.createdAt, timeZone)}`,
    transfer.shippedAt &&
      `Shipped ${formatShopTime(transfer.shippedAt, timeZone)}`,
    transfer.status === "RECEIVED" && transfer.receivedAt
      ? `${closedShort ? "Closed" : "Received"} ${formatShopTime(transfer.receivedAt, timeZone)}`
      : null,
    transfer.status === "CANCELLED" && transfer.cancelledAt
      ? `Cancelled ${formatShopTime(transfer.cancelledAt, timeZone)}`
      : null,
  );
}

/** The lines one part shows, and where they sit in the whole transfer. */
type PaperPart = PdfPart<TransferLineView>;

const number = (value: number) => value.toLocaleString("en-US");

function heading(
  pdf: ReactPdf,
  paper: TransferPaper,
  input: { title: string; summary: string; timeZone: string | null },
): ReactNode[] {
  const { Text, View } = pdf;
  return [
    h(Text, { style: PDF_STYLES.title, key: "title" }, input.title),
    h(Text, { style: PDF_STYLES.subtitle, key: "summary" }, input.summary),
    h(
      View,
      { style: PDF_STYLES.blocks, key: "blocks" },
      labelled(pdf, "From", [paper.source.name, ...paper.source.addressLines]),
      labelled(pdf, "To", [
        paper.destination.name,
        ...paper.destination.addressLines,
      ]),
      labelled(
        pdf,
        "Dates",
        dateLines(paper.transfer, paper.totals, input.timeZone),
      ),
    ),
  ];
}

function noItems({ Text }: ReactPdf): ReactNode {
  return h(
    Text,
    { style: { ...PDF_STYLES.row, color: "#555" } },
    "No items on this transfer.",
  );
}

function notes({ Text, View }: ReactPdf, text: string | null): ReactNode {
  if (!text?.trim()) return null;
  return h(
    View,
    { style: PDF_STYLES.notes },
    h(Text, { style: PDF_STYLES.label }, "Notes"),
    h(Text, null, text),
  );
}

/**
 * The copy that travels with the stock: what was sent, with a box per line
 * for the units that arrive and the units that arrive damaged.
 */
function travelCopy(
  pdf: ReactPdf,
  paper: TransferPaper,
  shown: PaperPart,
): ReactNode[] {
  const { Text, View } = pdf;
  const columns = {
    code: { width: "24%", paddingRight: 6 },
    sent: { width: "10%", ...PDF_STYLES.number },
  };

  return [
    h(
      View,
      { style: PDF_STYLES.headerRow, fixed: true, key: "head" },
      h(Text, { style: ITEM_COLUMN }, "Item"),
      h(Text, { style: columns.code }, "Barcode / SKU"),
      h(
        Text,
        { style: columns.sent },
        paper.transfer.status === "DRAFT" ? "To send" : "Sent",
      ),
      h(Text, { style: BOX_HEADING }, "Received"),
      h(Text, { style: BOX_HEADING }, "Damaged"),
    ),
    ...shown.lines.map((line) =>
      h(
        View,
        { style: PDF_STYLES.row, key: line.id, wrap: false },
        textCell(pdf, ITEM_COLUMN, line.title, null),
        codeCell(pdf, columns.code, line),
        h(Text, { style: columns.sent }, number(line.shipQty)),
        writeInBox(pdf),
        writeInBox(pdf),
      ),
    ),
    shown.total === 0 ? noItems(pdf) : null,
    isLastPart(shown)
      ? h(
          View,
          {
            style: { ...PDF_STYLES.blocks, marginTop: 28 },
            key: "signatures",
            wrap: false,
          },
          signature(pdf, "Packed by"),
          signature(pdf, "Received by"),
        )
      : null,
  ];
}

/** The copy for the file once a transfer is finished: where every unit ended up. */
function recordCopy(
  pdf: ReactPdf,
  paper: TransferPaper,
  shown: PaperPart,
): ReactNode[] {
  const { Text, View } = pdf;
  const count = { width: "8.6%", ...PDF_STYLES.number };
  const columns = {
    code: { width: "18%", paddingRight: 6 },
    writtenOff: { width: "11%", ...PDF_STYLES.number },
  };
  const { totals } = paper;

  return [
    h(
      View,
      { style: PDF_STYLES.headerRow, fixed: true, key: "head" },
      h(Text, { style: ITEM_COLUMN }, "Item"),
      h(Text, { style: columns.code }, "Barcode / SKU"),
      h(Text, { style: count }, "Asked"),
      h(Text, { style: count }, "Sent"),
      h(Text, { style: count }, "Received"),
      h(Text, { style: count }, "Rejected"),
      h(Text, { style: count }, "Returned"),
      h(Text, { style: columns.writtenOff }, "Written off"),
    ),
    ...shown.lines.map((line) =>
      h(
        View,
        { style: PDF_STYLES.row, key: line.id, wrap: false },
        textCell(
          pdf,
          ITEM_COLUMN,
          line.title,
          line.rejectedQty > 0 && line.rejectNote
            ? `Rejected: ${line.rejectNote}`
            : null,
        ),
        codeCell(pdf, columns.code, line),
        h(Text, { style: count }, number(line.quantity)),
        h(Text, { style: count }, number(line.shipQty)),
        h(Text, { style: count }, number(line.receivedQty)),
        h(Text, { style: count }, number(line.rejectedQty)),
        h(Text, { style: count }, number(line.returnedQty)),
        h(Text, { style: columns.writtenOff }, number(line.writtenOffQty)),
      ),
    ),
    shown.total === 0 ? noItems(pdf) : null,
    // The totals cover the whole transfer, so they close its last part.
    shown.total > 0 && isLastPart(shown)
      ? h(
          View,
          {
            style: { ...PDF_STYLES.headerRow, borderBottomWidth: 0 },
            key: "totals",
            wrap: false,
          },
          h(
            Text,
            { style: ITEM_COLUMN },
            shown.parts > 1 ? "Total units, all parts" : "Total units",
          ),
          h(Text, { style: columns.code }, ""),
          h(Text, { style: count }, number(totals.requestedUnits)),
          h(Text, { style: count }, number(totals.shipUnits)),
          h(Text, { style: count }, number(totals.receivedUnits)),
          h(Text, { style: count }, number(totals.rejectedUnits)),
          h(Text, { style: count }, number(totals.returnedUnits)),
          h(
            Text,
            { style: columns.writtenOff },
            number(totals.writtenOffUnits),
          ),
        )
      : null,
  ];
}

function travels(paper: TransferPaper): boolean {
  return (
    paper.transfer.status === "DRAFT" || paper.transfer.status === "IN_TRANSIT"
  );
}

function transferSummary(paper: TransferPaper): string {
  const { totals, transfer } = paper;
  if (totals.lineCount === 0) return "No items yet";
  const items = itemCount(totals.lineCount);
  switch (transfer.status) {
    case "DRAFT": {
      // A transfer that ships in parts sends only the units entered for its
      // first shipment; the rest of what it asks for follows later.
      const later = transfer.shipsInParts
        ? totals.requestedUnits - totals.shipUnits
        : 0;
      return later > 0
        ? `${items}, ${unitCount(totals.shipUnits)} to send now, ${number(later)} to ship later`
        : `${items}, ${unitCount(totals.shipUnits)} to send`;
    }
    case "CANCELLED":
      return `${items}, ${unitCount(totals.requestedUnits)} asked for, none sent`;
    case "IN_TRANSIT": {
      const arrived =
        totals.receivedUnits + totals.countedInUnits + totals.rejectedUnits;
      const sent =
        totals.toShipUnits > 0
          ? `${items}, ${unitCount(totals.shipUnits)} sent so far, ${number(totals.toShipUnits)} still to ship`
          : `${items}, ${unitCount(totals.shipUnits)} sent`;
      return arrived > 0
        ? `${sent}, ${number(arrived)} already counted at the destination`
        : sent;
    }
    case "RECEIVED":
      return `${items}, ${unitCount(totals.shipUnits)} sent, ${number(totals.receivedUnits)} received`;
  }
}

export interface TransferPaperSetting {
  shopName: string | null;
  /** The shop's IANA time zone; null prints times in UTC. */
  timeZone: string | null;
  /** Which part to print, from 1; a transfer of up to 250 items has one part. */
  part?: number;
}

export function transferDocument(
  pdf: ReactPdf,
  paper: TransferPaper,
  setting: TransferPaperSetting,
): ReactElement<DocumentProps> {
  const { Document, Page } = pdf;
  const shown = pdfPart(paper.lines, setting.part ?? 1);
  const title = partTitle(`Transfer ${paper.reference}`, shown);
  return h(
    Document,
    { title },
    h(
      Page,
      { size: "LETTER", style: PDF_STYLES.page },
      ...heading(pdf, paper, {
        title,
        summary: joined(
          setting.shopName,
          paper.statusLabel,
          transferSummary(paper),
          partRange(shown),
        ),
        timeZone: setting.timeZone,
      }),
      ...(travels(paper)
        ? travelCopy(pdf, paper, shown)
        : recordCopy(pdf, paper, shown)),
      isLastPart(shown) ? notes(pdf, paper.transfer.notes) : null,
      pageFooter(pdf, title),
    ),
  );
}

/** One part of the transfer document as a PDF. */
export function transferDocumentPdf(
  paper: TransferPaper,
  setting: TransferPaperSetting,
): Promise<Uint8Array<ArrayBuffer>> {
  return renderPdf((pdf) => transferDocument(pdf, paper, setting));
}

/**
 * Lines in the order a picker walks them: by SKU, then by name, with items
 * that have no SKU at the end.
 */
export function pickOrder(
  lines: readonly TransferLineView[],
): TransferLineView[] {
  const compare = (left: string, right: string) =>
    left.localeCompare(right, "en", { numeric: true, sensitivity: "base" });
  return [...lines].sort((left, right) => {
    const leftSku = left.sku?.trim() ?? "";
    const rightSku = right.sku?.trim() ?? "";
    if ((leftSku === "") !== (rightSku === "")) return leftSku === "" ? 1 : -1;
    return (
      compare(leftSku, rightSku) ||
      compare(left.title, right.title) ||
      compare(left.id, right.id)
    );
  });
}

/** The pick list of a draft: what to pull at the source, with a box for what was pulled. */
export function pickListDocument(
  pdf: ReactPdf,
  paper: TransferPaper,
  setting: TransferPaperSetting,
): ReactElement<DocumentProps> {
  const { Document, Page, Text, View } = pdf;
  // Sorted over the whole transfer first, so the parts follow one walk.
  const shown = pdfPart(pickOrder(paper.lines), setting.part ?? 1);
  const title = partTitle(`Pick list ${paper.reference}`, shown);
  const columns = {
    code: { width: "28%", paddingRight: 6 },
    toPick: { width: "12%", ...PDF_STYLES.number },
  };
  const { totals } = paper;

  return h(
    Document,
    { title },
    h(
      Page,
      { size: "LETTER", style: PDF_STYLES.page },
      ...heading(pdf, paper, {
        title,
        summary: joined(
          setting.shopName,
          totals.lineCount === 0
            ? "No items yet"
            : `${itemCount(totals.lineCount)}, ${unitCount(totals.requestedUnits)} to pick`,
          totals.lineCount > 1 && "In SKU order",
          partRange(shown),
        ),
        timeZone: setting.timeZone,
      }),
      h(
        View,
        { style: PDF_STYLES.headerRow, fixed: true },
        h(Text, { style: ITEM_COLUMN }, "Item"),
        h(Text, { style: columns.code }, "Barcode / SKU"),
        h(Text, { style: columns.toPick }, "To pick"),
        h(Text, { style: BOX_HEADING }, "Picked"),
      ),
      ...shown.lines.map((line) =>
        h(
          View,
          { style: PDF_STYLES.row, key: line.id, wrap: false },
          textCell(
            pdf,
            ITEM_COLUMN,
            line.title,
            line.pickedQty > 0
              ? `${number(line.pickedQty)} already entered as picked`
              : null,
          ),
          codeCell(pdf, columns.code, line),
          h(Text, { style: columns.toPick }, number(line.quantity)),
          writeInBox(pdf),
        ),
      ),
      shown.total === 0 ? noItems(pdf) : null,
      isLastPart(shown) ? notes(pdf, paper.transfer.notes) : null,
      pageFooter(pdf, title),
    ),
  );
}

/** One part of the pick list as a PDF. */
export function pickListPdf(
  paper: TransferPaper,
  setting: TransferPaperSetting,
): Promise<Uint8Array<ArrayBuffer>> {
  return renderPdf((pdf) => pickListDocument(pdf, paper, setting));
}

export function transferPaperFilename(
  paper: Pick<TransferPaper, "reference" | "lines">,
  kind: "document" | "pick-list",
  part = 1,
): string {
  const name =
    kind === "document"
      ? `transfer-${paper.reference}`
      : `transfer-${paper.reference}-pick-list`;
  return `${name}${partFileSuffix(part, pdfPartCount(paper.lines.length))}.pdf`;
}
