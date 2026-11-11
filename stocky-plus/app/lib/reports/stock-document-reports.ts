/**
 * Reports over the app's own stock documents: transfers between locations and
 * completed stocktakes. Quantities are read as recorded; nothing here is a
 * Shopify fact except the names and today's cost used to label and value them.
 */
import type { CatalogVariant } from "../analytics/catalog.server";
import { ZERO, type Decimal } from "../analytics/money";
import { localDateOf, type LocalDate } from "../analytics/shop-calendar";
import type {
  StocktakeLine,
  TransferLine,
  TransferStatus,
} from "../analytics/stock-documents.server";
import type { StockLocation } from "../analytics/stock-levels.server";
import { countOf, formatCell } from "./present";
import { IDENTITY_SEARCH_KEYS, identityColumns } from "./sales-reports";
import { unitCostIn } from "./stock-reports";
import type { ReportData, ReportNotice } from "./types";
import type { VariantDirectory, VariantInfo } from "./variant-directory";

const UNKNOWN_LOCATION = "Unknown location";

function count(value: number): string {
  return formatCell("integer", value, "");
}

function locationNamer(locations: readonly StockLocation[]) {
  const names = new Map(locations.map((l) => [l.locationGid, l.name]));
  return (locationGid: string) => names.get(locationGid) ?? UNKNOWN_LOCATION;
}

function sumOf<Row>(rows: readonly Row[], value: (row: Row) => number): number {
  return rows.reduce((total, row) => total + value(row), 0);
}

// --- Transfers ---------------------------------------------------------------

const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  DRAFT: "Draft",
  IN_TRANSIT: "In transit",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

export type TransferRow = {
  line: TransferLine;
  info: VariantInfo;
  from: string;
  to: string;
  status: string;
  createdDate: LocalDate;
  shippedDate: LocalDate | null;
  receivedDate: LocalDate | null;
  /** Null until the transfer ships. */
  shippedUnits: number | null;
  /** Null until the transfer is received. */
  receivedUnits: number | null;
  inTransitUnits: number;
};

export type TransfersInput = {
  lines: readonly TransferLine[];
  directory: VariantDirectory;
  locations: readonly StockLocation[];
  timeZone: string;
};

/** What left the source: the picked quantity, or all of it when nothing was picked. */
function shippedUnitsOf(line: TransferLine): number | null {
  if (line.status !== "IN_TRANSIT" && line.status !== "RECEIVED") return null;
  return line.pickedQty > 0 ? line.pickedQty : line.quantity;
}

/** One row per line of every transfer created in the range. */
export function buildTransfersReport(
  input: TransfersInput,
): ReportData<TransferRow> {
  const locationName = locationNamer(input.locations);
  const localDate = (instant: Date | null) =>
    instant ? localDateOf(instant, input.timeZone) : null;

  const rows = input.lines.map((line): TransferRow => {
    const shippedUnits = shippedUnitsOf(line);
    return {
      line,
      info: input.directory(line.variantGid),
      from: locationName(line.sourceLocationGid),
      to: locationName(line.destinationLocationGid),
      status: TRANSFER_STATUS_LABELS[line.status] ?? line.status,
      createdDate: localDateOf(line.createdAt, input.timeZone),
      shippedDate: localDate(line.shippedAt),
      receivedDate: localDate(line.receivedAt),
      shippedUnits,
      receivedUnits: line.status === "RECEIVED" ? line.receivedQty : null,
      inTransitUnits: line.status === "IN_TRANSIT" ? (shippedUnits ?? 0) : 0,
    };
  });

  return {
    columns: [
      {
        key: "created",
        label: "Created",
        kind: "date",
        value: (r) => r.createdDate,
      },
      { key: "from", label: "From", kind: "text", value: (r) => r.from },
      { key: "to", label: "To", kind: "text", value: (r) => r.to },
      { key: "status", label: "Status", kind: "text", value: (r) => r.status },
      ...identityColumns<TransferRow>(),
      {
        key: "requested",
        label: "Requested",
        kind: "integer",
        definition: "Units the transfer asks for.",
        value: (r) => r.line.quantity,
      },
      {
        key: "shipped",
        label: "Shipped",
        kind: "integer",
        definition:
          "Units that left the source location: the picked quantity, or the requested quantity when nothing was picked. Blank until the transfer ships.",
        value: (r) => r.shippedUnits,
      },
      {
        key: "received",
        label: "Received",
        kind: "integer",
        definition:
          "Units recorded at the destination. Blank until the transfer is received.",
        value: (r) => r.receivedUnits,
      },
      {
        key: "inTransit",
        label: "In transit",
        kind: "integer",
        definition: "Units shipped on a transfer that has not been received.",
        value: (r) => r.inTransitUnits,
      },
      {
        key: "shippedDate",
        label: "Shipped on",
        kind: "date",
        value: (r) => r.shippedDate,
      },
      {
        key: "receivedDate",
        label: "Received on",
        kind: "date",
        value: (r) => r.receivedDate,
      },
    ],
    rows,
    rowKey: (row) => row.line.lineId,
    defaultSort: { key: "created", direction: "desc" },
    facets: [
      { key: "status", label: "Status", value: (row) => row.status },
      { key: "from", label: "From", value: (row) => row.from },
      { key: "to", label: "To", value: (row) => row.to },
    ],
    searchKeys: IDENTITY_SEARCH_KEYS,
    summarize: (shown) => [
      {
        label: "Transfers",
        value: count(new Set(shown.map((r) => r.line.transferId)).size),
      },
      {
        label: "Units requested",
        value: count(sumOf(shown, (r) => r.line.quantity)),
      },
      {
        label: "Units shipped",
        value: count(sumOf(shown, (r) => r.shippedUnits ?? 0)),
      },
      {
        label: "Units received",
        value: count(sumOf(shown, (r) => r.receivedUnits ?? 0)),
      },
      {
        label: "Units in transit",
        value: count(sumOf(shown, (r) => r.inTransitUnits)),
      },
    ],
    notices: [],
    dataAsOf: null,
    methodNotes: [
      "A transfer is listed by the day it was created, in your store's time zone.",
      "Only transfers made in this app are listed. Transfers created directly in Shopify are not included.",
      "A cancelled transfer keeps its requested units and has no shipped or received units.",
    ],
  };
}

// --- Stocktake variances -----------------------------------------------------

export const STOCKTAKE_VIEWS = [
  { value: "variances", label: "Lines with a variance" },
  { value: "all", label: "All counted lines" },
] as const;

export type StocktakeVarianceRow = {
  line: StocktakeLine;
  info: VariantInfo;
  location: string;
  completedDate: LocalDate;
  countedQty: number;
  variance: number;
  unitCost: Decimal | null;
  varianceValue: Decimal | null;
};

export type StocktakeVarianceInput = {
  lines: readonly StocktakeLine[];
  catalog: ReadonlyMap<string, CatalogVariant>;
  directory: VariantDirectory;
  locations: readonly StockLocation[];
  timeZone: string;
  currencyCode: string;
  /** `variances` keeps lines whose count differs from the expected quantity; `all` keeps every counted line. */
  view: string;
};

function sumValues(values: Iterable<Decimal | null>): Decimal {
  let total = ZERO;
  for (const value of values) {
    if (value !== null) total = total.plus(value);
  }
  return total;
}

/** One row per counted line of every stocktake completed in the range. */
export function buildStocktakeVarianceReport(
  input: StocktakeVarianceInput,
): ReportData<StocktakeVarianceRow> {
  const { currencyCode } = input;
  const locationName = locationNamer(input.locations);

  const rows: StocktakeVarianceRow[] = [];
  let uncounted = 0;
  for (const line of input.lines) {
    if (line.countedQty === null) {
      uncounted += 1;
      continue;
    }
    const variance = line.countedQty - line.expectedQty;
    if (input.view !== "all" && variance === 0) continue;
    const variant = input.catalog.get(line.variantGid);
    const unitCost = variant ? unitCostIn(variant, currencyCode) : null;
    rows.push({
      line,
      info: input.directory(line.variantGid),
      location: locationName(line.locationGid),
      completedDate: localDateOf(line.completedAt, input.timeZone),
      countedQty: line.countedQty,
      variance,
      unitCost,
      varianceValue: unitCost ? unitCost.times(variance) : null,
    });
  }

  const notices: ReportNotice[] = [];
  if (uncounted > 0) {
    notices.push({
      tone: "info",
      heading: `${countOf(uncounted, "line was", "lines were")} never counted`,
      body: "A line that was added to a stocktake but left without a count has no variance and is not listed.",
    });
  }
  const uncosted = new Set(
    rows
      .filter((row) => row.variance !== 0 && row.unitCost === null)
      .map((row) => row.line.variantGid),
  ).size;
  if (uncosted > 0) {
    notices.push({
      tone: "warning",
      heading: `${countOf(uncosted, "variant with a variance has", "variants with a variance have")} no cost`,
      body: "Variance value is blank for a variant without a cost in your store currency and is not part of the total. Add a cost per item in Shopify to value it.",
    });
  }

  return {
    columns: [
      {
        key: "completed",
        label: "Completed",
        kind: "date",
        value: (r) => r.completedDate,
      },
      {
        key: "stocktake",
        label: "Stocktake",
        kind: "text",
        value: (r) => r.line.stocktakeName,
      },
      {
        key: "location",
        label: "Location",
        kind: "text",
        value: (r) => r.location,
      },
      ...identityColumns<StocktakeVarianceRow>(),
      {
        key: "expected",
        label: "Expected",
        kind: "integer",
        definition:
          "The available quantity on record when the item was added to the stocktake.",
        value: (r) => r.line.expectedQty,
      },
      {
        key: "counted",
        label: "Counted",
        kind: "integer",
        value: (r) => r.countedQty,
      },
      {
        key: "variance",
        label: "Variance",
        kind: "integer",
        definition:
          "Counted − expected. Above zero means more stock was found than expected; below zero means less.",
        value: (r) => r.variance,
      },
      {
        key: "unitCost",
        label: "Cost per item",
        kind: "money",
        definition: "Today's cost per item in Shopify.",
        value: (r) => r.unitCost,
      },
      {
        key: "varianceValue",
        label: "Variance value",
        kind: "money",
        definition: "Variance × cost per item.",
        value: (r) => r.varianceValue,
      },
    ],
    rows,
    rowKey: (row) => row.line.lineId,
    defaultSort: { key: "completed", direction: "desc" },
    facets: [
      { key: "location", label: "Location", value: (row) => row.location },
      {
        key: "stocktake",
        label: "Stocktake",
        value: (row) => row.line.stocktakeName,
      },
    ],
    searchKeys: [...IDENTITY_SEARCH_KEYS, "stocktake"],
    summarize: (shown) => [
      {
        label: "Stocktakes",
        value: count(new Set(shown.map((r) => r.line.stocktakeId)).size),
      },
      {
        label: "Units over",
        value: count(sumOf(shown, (r) => Math.max(r.variance, 0))),
      },
      {
        label: "Units short",
        value: count(sumOf(shown, (r) => Math.max(-r.variance, 0))),
      },
      {
        label: "Net variance value",
        value: formatCell(
          "money",
          sumValues(shown.map((r) => r.varianceValue)),
          currencyCode,
        ),
        detail: "At today's cost. Variants without a cost are not included",
      },
    ],
    notices,
    dataAsOf: null,
    methodNotes: [
      "A stocktake is listed by the day it was completed, in your store's time zone. Stocktakes still in progress and cancelled stocktakes are not included.",
      "Variance value uses today's cost per item in Shopify, not the cost on the day of the count.",
      "This report shows what was counted. It does not show whether the quantity in Shopify was changed to match.",
    ],
  };
}
