/**
 * The printed count sheet. While a count is open it is the paper staff take
 * to the shelves: every item with a box for the units found. Once the count
 * is completed or cancelled it is the record for the file: expected, counted
 * and the difference for every item. It renders from the same read model as
 * the count page, so the paper and the screen show the same lines in the same
 * order.
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
  PDF_LINES_PER_PART,
  isLastPart,
  partFileSuffix,
  partRange,
  partTitle,
  pdfPartCount,
  type PdfPart,
} from "../../lib/pdf/parts";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { listSyncedLocations } from "../inventory-writes/locations.server";
import type { PaperSetting } from "../inventory-writes/paper.server";
import { formatShopTime, shopDay } from "../inventory-writes/shop-time";
import {
  STOCKTAKE_SCOPE_LABEL,
  STOCKTAKE_STATUS_BADGE,
  itemCount,
  signed,
  staffText,
} from "./stocktake-display";
import {
  getStocktake,
  getStocktakeLineRange,
  getStocktakeProgress,
  type StocktakeHeader,
  type StocktakeLineView,
  type StocktakeProgress,
} from "./stocktake-read.server";
import {
  differenceValueAmount,
  differenceValueNote,
  type DifferenceValue,
} from "./stocktake-value";
import { getStocktakeDifferenceValue } from "./stocktake-value.server";

export interface CountSheet {
  stocktake: StocktakeHeader;
  locationName: string;
  progress: StocktakeProgress;
  /**
   * What the differences of a completed count were worth at the unit costs
   * kept when it was completed. Null for an open or cancelled count.
   */
  value: DifferenceValue | null;
  /** The lines of the part asked for, in the order of the count page. */
  shown: PdfPart<StocktakeLineView>;
}

const UNKNOWN_LOCATION = "Location no longer in Shopify";

/**
 * One part of a count's sheet, or null when the shop has no such count. A
 * part past the last one comes back with no lines; `shown.parts` says how
 * many there are.
 */
export async function readCountSheet(
  db: TenantDb,
  stocktakeId: string,
  part: number,
): Promise<CountSheet | null> {
  const stocktake = await getStocktake(db, stocktakeId);
  if (!stocktake) return null;

  const first = (part - 1) * PDF_LINES_PER_PART;
  const [range, progress, locations, value] = await Promise.all([
    getStocktakeLineRange(db, {
      stocktakeId: stocktake.id,
      skip: first,
      take: PDF_LINES_PER_PART,
    }),
    getStocktakeProgress(db, stocktake.id),
    listSyncedLocations(db),
    stocktake.status === "COMPLETED"
      ? getStocktakeDifferenceValue(db, stocktake)
      : null,
  ]);

  return {
    stocktake,
    locationName:
      locations.find((location) => location.id === stocktake.locationId)
        ?.name ?? UNKNOWN_LOCATION,
    progress,
    value,
    shown: {
      part,
      parts: pdfPartCount(range.total),
      lines: range.lines,
      first: first + 1,
      total: range.total,
    },
  };
}

/** A count that is still being counted prints as a sheet to write on; a closed one as a record. */
function open(stocktake: StocktakeHeader): boolean {
  return stocktake.status === "DRAFT" || stocktake.status === "IN_PROGRESS";
}

/**
 * A blind count keeps expected quantities, and anything that gives them
 * away, off the paper until it is closed, as the page and the CSV report do.
 */
function expectedHidden(stocktake: StocktakeHeader): boolean {
  return stocktake.blind && open(stocktake);
}

const number = (value: number) => value.toLocaleString("en-US");

function joined(...parts: Array<string | false | null | undefined>): string {
  return parts
    .filter(
      (part): part is string => typeof part === "string" && part.trim() !== "",
    )
    .join(" · ");
}

function countSummary({ stocktake, progress }: CountSheet): string {
  if (progress.lineCount === 0) return "No items yet";
  const items = itemCount(progress.lineCount);
  const counted = `${number(progress.countedCount)} counted`;
  if (open(stocktake)) return `${items}, ${counted} so far`;
  return `${items}, ${counted}, ${number(progress.differenceCount)} with a difference`;
}

const BASIS_TEXT: Record<StocktakeHeader["quantityBasis"], string> = {
  ON_HAND:
    "Units on the shelf, including units already committed to orders (on hand).",
  AVAILABLE: "Units available to sell.",
};

function dateLines(
  stocktake: StocktakeHeader,
  timeZone: string | null,
): string[] {
  const at = (value: Date | null) => formatShopTime(value, timeZone);
  return [
    `Started ${at(stocktake.startedAt ?? stocktake.createdAt)} by ${staffText(stocktake.startedByUserId)}`,
    ...(stocktake.status === "COMPLETED" && stocktake.completedAt
      ? [
          `Completed ${at(stocktake.completedAt)} by ${staffText(stocktake.completedByUserId)}`,
        ]
      : []),
    ...(stocktake.status === "CANCELLED" && stocktake.cancelledAt
      ? [
          `Cancelled ${at(stocktake.cancelledAt)} by ${staffText(stocktake.cancelledByUserId)}`,
        ]
      : []),
  ];
}

function noItems({ Text }: ReactPdf): ReactNode {
  return h(
    Text,
    { style: { ...PDF_STYLES.row, color: "#555" } },
    "No items on this count.",
  );
}

const QUANTITY_COLUMN = { width: "12%", ...PDF_STYLES.number };
const CODE_COLUMN = { width: "26%", paddingRight: 6 };

/** The sheet to count from: a box per item for the units found. */
function writeOnSheet(pdf: ReactPdf, sheet: CountSheet): ReactNode[] {
  const { Text, View } = pdf;
  const { shown, stocktake } = sheet;
  const blind = expectedHidden(stocktake);

  return [
    h(
      Text,
      { style: { ...PDF_STYLES.detail, marginBottom: 8 }, key: "how" },
      "Write the units you find in the box. Write 0 for an item with none on the shelf. Leave the box empty for an item you did not count.",
    ),
    // A large location starts from synced quantities; the page says the same.
    !blind && stocktake.expectedSource === "SYNC"
      ? h(
          Text,
          { style: { ...PDF_STYLES.detail, marginBottom: 8 }, key: "synced" },
          "Expected quantities are from the last sync, not from a read of Shopify. Each one is read from Shopify when the item's count is entered.",
        )
      : null,
    h(
      View,
      { style: PDF_STYLES.headerRow, fixed: true, key: "head" },
      h(Text, { style: ITEM_COLUMN }, "Item"),
      h(Text, { style: CODE_COLUMN }, "Barcode / SKU"),
      blind ? null : h(Text, { style: QUANTITY_COLUMN }, "Expected"),
      h(Text, { style: BOX_HEADING }, "Counted"),
    ),
    ...shown.lines.map((line) =>
      h(
        View,
        { style: PDF_STYLES.row, key: line.id, wrap: false },
        textCell(
          pdf,
          ITEM_COLUMN,
          line.title,
          line.countedQty === null
            ? null
            : `Already entered: ${number(line.countedQty)}`,
        ),
        codeCell(pdf, CODE_COLUMN, line),
        blind
          ? null
          : h(Text, { style: QUANTITY_COLUMN }, number(line.expectedQty)),
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
          signature(pdf, "Counted by"),
          signature(pdf, "Checked by"),
        )
      : null,
  ];
}

/**
 * Why a line's difference is not counted minus expected: stock moved in
 * Shopify during the count and the count was taken after the movement.
 */
function movementNote(line: StocktakeLineView): string | null {
  return line.countedQty !== null && line.movementBaselineQty !== null
    ? `Stock moved during the count. Difference measured from ${number(line.movementBaselineQty)}.`
    : null;
}

/** The record of a closed count: what was expected, what was found, and the difference. */
function record(pdf: ReactPdf, sheet: CountSheet): ReactNode[] {
  const { Text, View } = pdf;
  const { progress, shown, stocktake, value } = sheet;
  const valueNote = value && differenceValueNote(value);
  const total = (label: string, figure: string) =>
    h(
      View,
      { style: PDF_STYLES.totalRow, key: label },
      h(Text, null, label),
      h(Text, null, figure),
    );

  return [
    h(
      View,
      { style: PDF_STYLES.headerRow, fixed: true, key: "head" },
      h(Text, { style: ITEM_COLUMN }, "Item"),
      h(Text, { style: CODE_COLUMN }, "Barcode / SKU"),
      h(Text, { style: QUANTITY_COLUMN }, "Expected"),
      h(Text, { style: QUANTITY_COLUMN }, "Counted"),
      h(Text, { style: QUANTITY_COLUMN }, "Difference"),
    ),
    ...shown.lines.map((line) =>
      h(
        View,
        { style: PDF_STYLES.row, key: line.id, wrap: false },
        textCell(pdf, ITEM_COLUMN, line.title, movementNote(line)),
        codeCell(pdf, CODE_COLUMN, line),
        h(Text, { style: QUANTITY_COLUMN }, number(line.expectedQty)),
        h(
          Text,
          { style: QUANTITY_COLUMN },
          line.countedQty === null ? "Not counted" : number(line.countedQty),
        ),
        h(
          Text,
          { style: QUANTITY_COLUMN },
          line.delta === null ? "—" : signed(line.delta),
        ),
      ),
    ),
    shown.total === 0 ? noItems(pdf) : null,
    // The totals cover the whole count, so they close its last part.
    shown.total > 0 && isLastPart(shown)
      ? h(
          View,
          { style: PDF_STYLES.totals, key: "totals", wrap: false },
          total(
            shown.parts > 1 ? "Items counted, all parts" : "Items counted",
            `${number(progress.countedCount)} of ${number(progress.lineCount)}`,
          ),
          total("Items with a difference", number(progress.differenceCount)),
          total("Units over", number(progress.unitsOver)),
          total("Units short", number(progress.unitsShort)),
          valueNote
            ? total(
                "Value of differences",
                differenceValueAmount(value!) ?? "Not known",
              )
            : null,
        )
      : null,
    shown.total > 0 && isLastPart(shown) && valueNote
      ? h(Text, { style: PDF_STYLES.notes, key: "value" }, valueNote)
      : null,
    isLastPart(shown) && stocktake.status === "CANCELLED"
      ? h(
          Text,
          { style: PDF_STYLES.notes, key: "cancelled" },
          "This count was cancelled. Nothing was changed in Shopify.",
        )
      : null,
  ];
}

export interface CountSheetSetting extends PaperSetting {
  /** When the paper is printed; a sheet to count from says so, because counts entered later are not on it. */
  printedAt: Date;
}

export function countSheetDocument(
  pdf: ReactPdf,
  sheet: CountSheet,
  setting: CountSheetSetting,
): ReactElement<DocumentProps> {
  const { Document, Page, Text, View } = pdf;
  const { shown, stocktake } = sheet;
  const sheetOpen = open(stocktake);
  const title = partTitle(
    `${sheetOpen ? "Count sheet" : "Count record"}: ${stocktake.name}`,
    shown,
  );

  return h(
    Document,
    { title },
    h(
      Page,
      { size: "LETTER", style: PDF_STYLES.page },
      h(Text, { style: PDF_STYLES.title }, title),
      h(
        Text,
        { style: PDF_STYLES.subtitle },
        joined(
          setting.shopName,
          STOCKTAKE_STATUS_BADGE[stocktake.status].label,
          `${STOCKTAKE_SCOPE_LABEL[stocktake.scope]}${stocktake.blind ? ", blind" : ""}`,
          countSummary(sheet),
          partRange(shown),
        ),
      ),
      h(
        View,
        { style: PDF_STYLES.blocks },
        labelled(pdf, "Location", [sheet.locationName]),
        labelled(pdf, "What is counted", [BASIS_TEXT[stocktake.quantityBasis]]),
        labelled(pdf, "Dates", [
          ...dateLines(stocktake, setting.timeZone),
          sheetOpen
            ? `Printed ${formatShopTime(setting.printedAt, setting.timeZone)}`
            : null,
        ]),
      ),
      ...(sheetOpen ? writeOnSheet(pdf, sheet) : record(pdf, sheet)),
      pageFooter(pdf, title),
    ),
  );
}

/** One part of the count sheet as a PDF. */
export function countSheetPdf(
  sheet: CountSheet,
  setting: CountSheetSetting,
): Promise<Uint8Array<ArrayBuffer>> {
  return renderPdf((pdf) => countSheetDocument(pdf, sheet, setting));
}

const MAX_NAME_IN_FILENAME = 60;

/** The count's name as far as a file name can carry it: unaccented letters and digits, hyphens between. */
function nameForFile(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .slice(0, MAX_NAME_IN_FILENAME)
    .replace(/^-+|-+$/g, "");
}

/** `count-sheet-Cellar-count-2026-11-12-part-2-of-3.pdf`; the day is the day the count started on the shop's clock. */
export function countSheetFilename(
  sheet: Pick<CountSheet, "stocktake" | "shown">,
  timeZone: string | null,
): string {
  const { stocktake, shown } = sheet;
  return [
    open(stocktake) ? "count-sheet" : "count-record",
    nameForFile(stocktake.name),
    `${shopDay(stocktake.startedAt ?? stocktake.createdAt, timeZone)}${partFileSuffix(shown.part, shown.parts)}.pdf`,
  ]
    .filter((piece) => piece !== "")
    .join("-");
}
