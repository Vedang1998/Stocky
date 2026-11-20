/**
 * Reports over the daily stock history. Shopify serves no past inventory
 * levels, so these read the app's own end-of-day copies. A day the app did not
 * capture is shown as not captured: its figures are blank, never zero, and no
 * other day stands in for it.
 */
import { Decimal, ZERO } from "../analytics/money";
import { formatShopInstant, countOf, formatCell } from "./present";
import {
  enumerateLocalDates,
  type LocalDate,
} from "../analytics/shop-calendar";
import type {
  HistoricalStockLevel,
  StockDayTotals,
  StockSnapshotDay,
} from "../analytics/stock-history.server";
import type { StockLocation } from "../analytics/stock-levels.server";
import type { VariantDirectory } from "./variant-directory";
import type { ReportData, ReportNotice, ReportTile } from "./types";

export const STOCK_HISTORY_METHOD_NOTES = [
  "Each day is the stock the app read from Shopify just after the shop's local midnight, in the shop's own time zone.",
  "Shopify keeps no stock history of its own, so the app saves a copy once a day. History starts the day the app first saved one.",
  "A day the app did not save is shown as not captured and left blank. It is not zero, and no other day is used in its place.",
  "Only variants with inventory tracking turned on are saved.",
];

function count(value: number): string {
  return formatCell("integer", value, "");
}

function money(value: Decimal, currencyCode: string): string {
  return formatCell("money", value, currencyCode);
}

function historyStartNotice(first: LocalDate | null): ReportNotice | null {
  return first === null
    ? {
        tone: "info",
        heading: "No stock history has been saved yet",
        body: "The app saves each shop's stock once a day, after the day ends in your store's time zone. This report fills in from the first saved day onwards. Earlier days cannot be rebuilt.",
      }
    : null;
}

// --- Stock history by day ----------------------------------------------------

export type StockHistoryDayRow = {
  localDate: LocalDate;
  captured: boolean;
  /** Null when the day was not captured or Shopify reported no quantity. */
  onHand: number | null;
  /** Variant-and-location rows saved for the day; null when not captured. */
  levelCount: number | null;
  /** Saved rows without an on-hand quantity from Shopify. */
  unreportedLevels: number | null;
  capturedAt: Date | null;
};

export type StockHistoryInput = {
  start: LocalDate;
  end: LocalDate;
  snapshots: readonly StockSnapshotDay[];
  totals: readonly StockDayTotals[];
  firstCapturedDate: LocalDate | null;
  timeZone: string;
};

/** One row per calendar day in the range, captured or not. */
export function buildStockHistoryReport(
  input: StockHistoryInput,
): ReportData<StockHistoryDayRow> {
  const snapshots = new Map(input.snapshots.map((s) => [s.localDate, s]));
  const totals = new Map(input.totals.map((t) => [t.localDate, t]));

  const rows: StockHistoryDayRow[] = enumerateLocalDates(
    input.start,
    input.end,
  ).map((localDate) => {
    const snapshot = snapshots.get(localDate);
    if (!snapshot) {
      return {
        localDate,
        captured: false,
        onHand: null,
        levelCount: null,
        unreportedLevels: null,
        capturedAt: null,
      };
    }
    const total = totals.get(localDate);
    return {
      localDate,
      captured: true,
      // A captured day with no tracked stock really holds zero units.
      onHand: snapshot.levelCount === 0 ? 0 : (total?.onHand ?? null),
      levelCount: snapshot.levelCount,
      unreportedLevels: total?.unreportedLevels ?? 0,
      capturedAt: snapshot.capturedAt,
    };
  });

  const notices: ReportNotice[] = [];
  const first = historyStartNotice(input.firstCapturedDate);
  if (first) notices.push(first);
  const missing = rows.filter((row) => !row.captured).length;
  if (first === null && missing > 0) {
    notices.push({
      tone: "warning",
      heading: `${countOf(missing, "day was", "days were")} not captured`,
      body:
        input.firstCapturedDate !== null &&
        input.start < input.firstCapturedDate
          ? `The first saved day is ${input.firstCapturedDate}. Days before it, and any day the app did not run, are blank, not zero.`
          : "The app did not save stock on these days, so they are blank, not zero.",
    });
  }
  const unreported = rows.reduce(
    (n, row) => n + (row.unreportedLevels ?? 0),
    0,
  );
  if (unreported > 0) {
    notices.push({
      tone: "info",
      heading: `${countOf(unreported, "saved stock level has", "saved stock levels have")} no quantity`,
      body: "Where Shopify had not reported an on-hand quantity, it is left out of the day's total, not counted as zero.",
    });
  }

  let latest: Date | null = null;
  for (const row of rows) {
    if (row.capturedAt && (!latest || row.capturedAt > latest)) {
      latest = row.capturedAt;
    }
  }

  return {
    columns: [
      {
        key: "date",
        label: "Date",
        kind: "date",
        definition: "The calendar day in your store's time zone.",
        value: (r) => r.localDate,
      },
      {
        key: "status",
        label: "Status",
        kind: "text",
        value: (r) => (r.captured ? "Captured" : "Not captured"),
      },
      {
        key: "onHand",
        label: "Units on hand",
        kind: "integer",
        definition:
          "Sum of the on-hand quantities of every saved variant and location at the end of the day. Blank when the day was not captured.",
        value: (r) => r.onHand,
      },
      {
        key: "levelCount",
        label: "Stock levels saved",
        kind: "integer",
        definition: "Variant-and-location rows saved for the day.",
        value: (r) => r.levelCount,
      },
      {
        key: "unreported",
        label: "Without a quantity",
        kind: "integer",
        definition:
          "Saved rows whose on-hand quantity Shopify had not reported. They are not part of Units on hand.",
        value: (r) => r.unreportedLevels,
      },
      {
        key: "capturedAt",
        label: "Saved at",
        kind: "text",
        definition: "When the app read the stock, in your store's time zone.",
        value: (r) =>
          r.capturedAt ? formatShopInstant(r.capturedAt, input.timeZone) : null,
      },
    ],
    rows,
    rowKey: (row) => row.localDate,
    defaultSort: { key: "date", direction: "desc" },
    facets: [
      {
        key: "status",
        label: "Status",
        value: (r) => (r.captured ? "Captured" : "Not captured"),
      },
    ],
    searchKeys: ["date"],
    summarize: (shown): ReportTile[] => {
      const captured = shown.filter((r) => r.captured);
      const newest = captured.reduce<StockHistoryDayRow | null>(
        (best, row) => (!best || row.localDate > best.localDate ? row : best),
        null,
      );
      return [
        { label: "Days shown", value: count(shown.length) },
        { label: "Days captured", value: count(captured.length) },
        {
          label: "Days not captured",
          value: count(shown.length - captured.length),
        },
        {
          label: "Units on hand, latest day",
          value: newest && newest.onHand !== null ? count(newest.onHand) : "—",
          detail: newest ? newest.localDate : undefined,
        },
      ];
    },
    notices,
    dataAsOf: latest,
    methodNotes: STOCK_HISTORY_METHOD_NOTES,
  };
}

// --- Stock on a past date ----------------------------------------------------

export type StockOnDateRow = {
  variantGid: string;
  product: string;
  variant: string;
  sku: string | null;
  vendor: string | null;
  locationGid: string;
  location: string;
  level: HistoricalStockLevel;
  unitCost: Decimal | null;
  costValue: Decimal | null;
  price: Decimal | null;
  retailValue: Decimal | null;
};

export type StockOnDateInput = {
  /** The day asked for, in the shop's time zone. */
  date: LocalDate;
  /** Today in the shop's time zone. */
  today: LocalDate;
  /** The saved day, or null when that day was not captured. */
  snapshot: StockSnapshotDay | null;
  firstCapturedDate: LocalDate | null;
  levels: readonly HistoricalStockLevel[];
  directory: VariantDirectory;
  locations: readonly StockLocation[];
  currencyCode: string;
  timeZone: string;
};

function valueOf(onHand: number | null, unit: Decimal | null): Decimal | null {
  if (onHand === null || unit === null) return null;
  return unit.times(Math.max(onHand, 0));
}

function sumValues(values: Iterable<Decimal | null>): Decimal {
  let total = ZERO;
  for (const value of values) if (value) total = total.plus(value);
  return total;
}

function notCapturedNotice(input: StockOnDateInput): ReportNotice {
  if (input.date >= input.today) {
    return {
      tone: "info",
      heading: `${input.date} has not ended yet`,
      body: "The app saves each day's stock after the day ends in your store's time zone. Pick yesterday or an earlier day, or open Stock on hand for the current quantities.",
    };
  }
  const first = input.firstCapturedDate;
  if (first === null) {
    return historyStartNotice(null) as ReportNotice;
  }
  return {
    tone: "warning",
    heading: `Stock was not captured on ${input.date}`,
    body:
      input.date < first
        ? `The first saved day is ${first}. Shopify keeps no stock history, so earlier days cannot be rebuilt. Nothing is shown rather than zeros.`
        : "The app did not save stock on that day, so nothing is shown rather than zeros. Pick another day.",
  };
}

/** One row per saved variant and location for one past day. */
export function buildStockOnDateReport(
  input: StockOnDateInput,
): ReportData<StockOnDateRow> {
  const { currencyCode } = input;
  const locationNames = new Map(
    input.locations.map((l) => [l.locationGid, l.name]),
  );

  const rows: StockOnDateRow[] = [];
  let unknownQuantity = 0;
  if (input.snapshot) {
    for (const level of input.levels) {
      if (level.onHand === null) unknownQuantity += 1;
      // Like the current report's default, rows at exactly zero are left out.
      if (level.onHand === 0) continue;
      const info = input.directory(level.variantGid);
      const unitCost =
        level.unitCost && level.unitCostCurrencyCode === currencyCode
          ? level.unitCost
          : null;
      const price =
        level.priceCurrencyCode === currencyCode ? level.price : null;
      rows.push({
        variantGid: level.variantGid,
        product: info.product,
        variant: info.variant,
        sku: info.sku,
        vendor: info.vendor,
        locationGid: level.locationGid,
        location: locationNames.get(level.locationGid) ?? "Unknown location",
        level,
        unitCost,
        costValue: valueOf(level.onHand, unitCost),
        price,
        retailValue: valueOf(level.onHand, price),
      });
    }
  }

  const notices: ReportNotice[] = [];
  if (!input.snapshot) notices.push(notCapturedNotice(input));
  else {
    if (input.snapshot.levelCount === 0) {
      notices.push({
        tone: "info",
        heading: `No tracked stock on ${input.date}`,
        body: "The day was saved, and no variant had inventory tracking turned on.",
      });
    }
    const uncosted = new Set(
      rows
        .filter((row) => (row.level.onHand ?? 0) > 0 && row.unitCost === null)
        .map((row) => row.variantGid),
    ).size;
    if (uncosted > 0) {
      notices.push({
        tone: "warning",
        heading: `${countOf(uncosted, "variant with stock has", "variants with stock have")} no cost`,
        body: "Cost value is blank for a variant that had no cost in your store currency that day, and is not part of the total.",
      });
    }
    if (unknownQuantity > 0) {
      notices.push({
        tone: "info",
        heading: `${countOf(unknownQuantity, "stock level had", "stock levels had")} no quantity`,
        body: "Where Shopify had not reported an on-hand quantity that day, the row is blank, not zero.",
      });
    }
    const zoneNote =
      input.snapshot.timeZone !== input.timeZone
        ? ` The store's time zone was ${input.snapshot.timeZone} when this day was saved.`
        : "";
    if (zoneNote) {
      notices.push({
        tone: "info",
        heading: "Time zone changed since this day was saved",
        body: `The day is the one the app saved, not a recalculation.${zoneNote}`,
      });
    }
  }

  return {
    columns: [
      {
        key: "product",
        label: "Product",
        kind: "text",
        value: (r) => r.product,
      },
      {
        key: "variant",
        label: "Variant",
        kind: "text",
        value: (r) => r.variant,
      },
      { key: "sku", label: "SKU", kind: "text", value: (r) => r.sku },
      { key: "vendor", label: "Vendor", kind: "text", value: (r) => r.vendor },
      {
        key: "location",
        label: "Location",
        kind: "text",
        value: (r) => r.location,
      },
      {
        key: "available",
        label: "Available",
        kind: "integer",
        definition: "Units that could be sold at the end of the day.",
        value: (r) => r.level.available,
      },
      {
        key: "onHand",
        label: "On hand",
        kind: "integer",
        definition:
          "Units at the location at the end of the day, as Shopify reported them.",
        value: (r) => r.level.onHand,
      },
      {
        key: "unitCost",
        label: "Cost per item",
        kind: "money",
        definition:
          "The cost per item saved on the variant in Shopify on that day. Blank when it was not in your store currency.",
        value: (r) => r.unitCost,
      },
      {
        key: "costValue",
        label: "Cost value",
        kind: "money",
        definition:
          "On hand × that day's cost per item. Blank without a cost. Negative on-hand counts as zero.",
        value: (r) => r.costValue,
      },
      {
        key: "price",
        label: "Price",
        kind: "money",
        definition: "The variant's price on that day.",
        value: (r) => r.price,
      },
      {
        key: "retailValue",
        label: "Retail value",
        kind: "money",
        definition:
          "On hand × that day's price. Negative on-hand counts as zero.",
        value: (r) => r.retailValue,
      },
    ],
    rows,
    rowKey: (row) => `${row.variantGid}|${row.locationGid}`,
    defaultSort: { key: "product", direction: "asc" },
    facets: [
      { key: "location", label: "Location", value: (row) => row.location },
      { key: "vendor", label: "Vendor", value: (row) => row.vendor },
    ],
    searchKeys: ["product", "variant", "sku", "vendor"],
    summarize: (shown): ReportTile[] =>
      input.snapshot
        ? [
            {
              label: "Units on hand",
              value: count(
                shown.reduce((n, r) => n + (r.level.onHand ?? 0), 0),
              ),
              detail: input.date,
            },
            {
              label: "Cost value",
              value: money(
                sumValues(shown.map((r) => r.costValue)),
                currencyCode,
              ),
              detail: "Variants without a cost are not included",
            },
            {
              label: "Retail value",
              value: money(
                sumValues(shown.map((r) => r.retailValue)),
                currencyCode,
              ),
            },
            {
              label: "Variants",
              value: count(new Set(shown.map((r) => r.variantGid)).size),
            },
          ]
        : [{ label: "Day", value: input.date, detail: "Not captured" }],
    notices,
    dataAsOf: input.snapshot?.capturedAt ?? null,
    methodNotes: [
      ...STOCK_HISTORY_METHOD_NOTES,
      "Cost and price are the values saved with the day, not today's. Rows with exactly zero on hand are not listed.",
    ],
  };
}
