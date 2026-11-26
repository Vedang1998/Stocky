/**
 * Low stock by variant, product or vendor, from the shop's latest replenishment
 * worksheet.
 *
 * The worksheet decides what is low and what to order; this report only groups
 * what it recorded. Nothing is worked out a second time, so the two screens can
 * never disagree.
 */
import { Decimal, ZERO } from "../analytics/money";
import type { LowStock, LowStockLine } from "../analytics/low-stock.server";
import { countOf, formatCell, formatShopInstant } from "./present";
import type {
  CellValue,
  ReportColumn,
  ReportData,
  ReportFacet,
  ReportNotice,
} from "./types";

export const LOW_STOCK_VIEWS = [
  { value: "variants", label: "Variants" },
  { value: "products", label: "Products" },
  { value: "vendors", label: "Vendors" },
] as const;

export type LowStockView = (typeof LOW_STOCK_VIEWS)[number]["value"];

const NO_VENDOR = "No vendor";

export type LowStockRow = {
  key: string;
  product: string;
  variant: string;
  sku: string | null;
  vendor: string | null;
  supplier: string | null;
  /** Variants in the group that are low or out of stock. */
  variants: number;
  /** Distinct products in the group. */
  products: number;
  outOfStock: number;
  status: "Out of stock" | "Low" | null;
  available: number | null;
  onHand: number | null;
  committed: number | null;
  incoming: number | null;
  unitsPerDay: Decimal | null;
  daysOfStock: Decimal | null;
  /** The earliest day any variant in the group is expected to run out. */
  depletionDate: string | null;
  leadTimeDays: number | null;
  reorderPoint: number | null;
  suggested: number | null;
  onOrder: string | null;
  lostRevenuePerDay: Decimal | null;
};

export type LowStockInput = {
  lowStock: LowStock;
  view: string;
  timeZone: string;
  currencyCode: string;
};

function sumKnown(
  lines: readonly LowStockLine[],
  value: (line: LowStockLine) => number | null,
): number | null {
  let total: number | null = null;
  for (const line of lines) {
    const amount = value(line);
    if (amount !== null) total = (total ?? 0) + amount;
  }
  return total;
}

/** What an out-of-stock variant is losing each day: selling rate × price. */
function lostRevenue(line: LowStockLine, shopCurrency: string): Decimal | null {
  if (
    line.status !== "OUT_OF_STOCK" ||
    !line.unitsPerDay?.greaterThan(0) ||
    !line.price ||
    line.priceCurrencyCode !== shopCurrency
  ) {
    return null;
  }
  return line.unitsPerDay.times(line.price);
}

function sumLost(
  lines: readonly LowStockLine[],
  currencyCode: string,
): Decimal | null {
  let total: Decimal | null = null;
  for (const line of lines) {
    const lost = lostRevenue(line, currencyCode);
    if (lost) total = (total ?? ZERO).plus(lost);
  }
  return total;
}

function earliest(dates: ReadonlyArray<string | null>): string | null {
  const known = dates.filter((date): date is string => date !== null);
  return known.length === 0 ? null : known.reduce((a, b) => (a < b ? a : b));
}

function variantRow(line: LowStockLine, currencyCode: string): LowStockRow {
  return {
    key: line.variantGid,
    product: line.productTitle,
    variant: line.variantTitle === "Default Title" ? "" : line.variantTitle,
    sku: line.sku,
    vendor: line.vendor,
    supplier: line.supplierName,
    variants: 1,
    products: 1,
    outOfStock: line.status === "OUT_OF_STOCK" ? 1 : 0,
    status: line.status === "OUT_OF_STOCK" ? "Out of stock" : "Low",
    available: line.available,
    onHand: line.onHand,
    committed: line.committed,
    incoming: line.incoming,
    unitsPerDay: line.unitsPerDay,
    daysOfStock: line.daysOfStock,
    depletionDate: line.depletionDate,
    leadTimeDays: line.leadTimeDays,
    reorderPoint: line.reorderPoint,
    suggested: line.suggestedQuantity,
    onOrder: line.purchaseOrderNumber,
    lostRevenuePerDay: lostRevenue(line, currencyCode),
  };
}

function groupRow(
  key: string,
  lines: readonly LowStockLine[],
  currencyCode: string,
): LowStockRow {
  const first = lines[0]!;
  return {
    key,
    product: first.productTitle,
    variant: "",
    sku: null,
    vendor: first.vendor,
    supplier: null,
    variants: lines.length,
    products: new Set(lines.map((line) => line.productGid)).size,
    outOfStock: lines.filter((line) => line.status === "OUT_OF_STOCK").length,
    status: null,
    available: sumKnown(lines, (line) => line.available),
    onHand: sumKnown(lines, (line) => line.onHand),
    committed: sumKnown(lines, (line) => line.committed),
    incoming: sumKnown(lines, (line) => line.incoming),
    unitsPerDay: null,
    daysOfStock: null,
    depletionDate: earliest(lines.map((line) => line.depletionDate)),
    leadTimeDays: null,
    reorderPoint: null,
    suggested: sumKnown(lines, (line) => line.suggestedQuantity),
    onOrder: null,
    lostRevenuePerDay: sumLost(lines, currencyCode),
  };
}

function groupBy(
  lines: readonly LowStockLine[],
  keyOf: (line: LowStockLine) => string,
): Map<string, LowStockLine[]> {
  const groups = new Map<string, LowStockLine[]>();
  for (const line of lines) {
    const key = keyOf(line);
    const group = groups.get(key);
    if (group) group.push(line);
    else groups.set(key, [line]);
  }
  return groups;
}

const text = (
  key: string,
  label: string,
  value: (row: LowStockRow) => CellValue,
  definition?: string,
): ReportColumn<LowStockRow> => ({
  key,
  label,
  kind: "text",
  value,
  definition,
});

const integer = (
  key: string,
  label: string,
  value: (row: LowStockRow) => CellValue,
  definition?: string,
): ReportColumn<LowStockRow> => ({
  key,
  label,
  kind: "integer",
  value,
  definition,
});

const AVAILABLE = integer(
  "available",
  "Available",
  (r) => r.available,
  "Units that can be sold now, at the locations the worksheet counted.",
);
const INCOMING = integer(
  "incoming",
  "Incoming",
  (r) => r.incoming,
  "Units on the way, from the source the worksheet was set to count.",
);
const SUGGESTED = integer(
  "suggested",
  "Suggested order",
  (r) => r.suggested,
  "The quantity the worksheet suggests ordering.",
);
const LOST = {
  key: "lostRevenue",
  label: "Lost revenue per day",
  kind: "money",
  definition:
    "For a variant that is out of stock: units sold per day over the worksheet's sales period × the price saved when the worksheet was generated. Blank when it has no positive selling rate or no price in your store currency. Low variants are not losing sales yet.",
  value: (r: LowStockRow) => r.lostRevenuePerDay,
} satisfies ReportColumn<LowStockRow>;
const DEPLETES: ReportColumn<LowStockRow> = {
  key: "depletion",
  label: "Runs out on",
  kind: "date",
  definition:
    "The first day the stock is expected to run out at the recent selling rate. Blank when the variant is not selling.",
  value: (r) => r.depletionDate,
};
const VARIANTS_LOW = integer(
  "variants",
  "Variants low or out",
  (r) => r.variants,
);
const OUT = integer("outOfStock", "Out of stock", (r) => r.outOfStock);

function columnsFor(view: LowStockView): ReportColumn<LowStockRow>[] {
  switch (view) {
    case "variants":
      return [
        text("product", "Product", (r) => r.product),
        text("variant", "Variant", (r) => r.variant),
        text("sku", "SKU", (r) => r.sku),
        text("vendor", "Vendor", (r) => r.vendor),
        text("supplier", "Supplier", (r) => r.supplier),
        text(
          "status",
          "Status",
          (r) => r.status,
          "Out of stock: nothing available. Low: available plus incoming is at or below the reorder point, or below the minimum, as the worksheet works it out.",
        ),
        AVAILABLE,
        integer("onHand", "On hand", (r) => r.onHand),
        integer("committed", "Committed", (r) => r.committed),
        INCOMING,
        {
          key: "unitsPerDay",
          label: "Units per day",
          kind: "text",
          definition:
            "Net units sold per day over the worksheet's sales period.",
          value: (r) => r.unitsPerDay?.toFixed(2) ?? null,
        },
        {
          key: "daysOfStock",
          label: "Days of stock",
          kind: "text",
          definition: "Available units ÷ units per day, to one decimal.",
          value: (r) => r.daysOfStock?.toFixed(1) ?? null,
        },
        DEPLETES,
        integer(
          "leadTime",
          "Lead time (days)",
          (r) => r.leadTimeDays,
          "Days from ordering to delivery, from the source the worksheet used.",
        ),
        integer("reorderPoint", "Reorder point", (r) => r.reorderPoint),
        SUGGESTED,
        text(
          "onOrder",
          "On purchase order",
          (r) => r.onOrder,
          "The purchase order already made from this worksheet for the variant, if any.",
        ),
        LOST,
      ];
    case "products":
      return [
        text("product", "Product", (r) => r.product),
        text("vendor", "Vendor", (r) => r.vendor),
        VARIANTS_LOW,
        OUT,
        AVAILABLE,
        INCOMING,
        DEPLETES,
        SUGGESTED,
        LOST,
      ];
    case "vendors":
      return [
        text("vendor", "Vendor", (r) => r.vendor ?? NO_VENDOR),
        integer("products", "Products", (r) => r.products),
        VARIANTS_LOW,
        OUT,
        AVAILABLE,
        INCOMING,
        DEPLETES,
        SUGGESTED,
        LOST,
      ];
  }
}

function facetsFor(view: LowStockView): ReportFacet<LowStockRow>[] {
  const vendor: ReportFacet<LowStockRow> = {
    key: "vendor",
    label: "Vendor",
    value: (row) => row.vendor,
  };
  if (view === "variants") {
    return [
      { key: "status", label: "Status", value: (row) => row.status },
      vendor,
      { key: "supplier", label: "Supplier", value: (row) => row.supplier },
    ];
  }
  return view === "products" ? [vendor] : [];
}

function noticesFor(input: LowStockInput): ReportNotice[] {
  const { worksheet } = input.lowStock;
  if (!worksheet) {
    return [
      {
        tone: "info",
        heading: "No replenishment worksheet yet",
        body: "Low stock comes from your latest replenishment worksheet. Generate one from Replenishment and this report will list what is low or out of stock.",
      },
    ];
  }
  const notices: ReportNotice[] = [
    {
      tone: "info",
      heading: `From the worksheet generated ${formatShopInstant(worksheet.generatedAt, input.timeZone)}`,
      body: "Stock, sales and supplier terms are as they were when that worksheet was generated. Generate a new worksheet from Replenishment to refresh them.",
    },
  ];
  if (!worksheet.allLocations) {
    notices.push({
      tone: "warning",
      heading: "Counted at one location",
      body: `That worksheet counted stock at ${worksheet.locationName ?? "a single location"} only.`,
    });
  }
  const selection = worksheet.selection;
  if (!selection) {
    notices.push({
      tone: "warning",
      heading: "The worksheet's settings could not be read",
      body: "It may cover only some of your products. Generate a new worksheet from Replenishment.",
    });
  } else {
    const limits = [
      selection.vendor ? `vendor ${selection.vendor}` : null,
      selection.productType ? `product type ${selection.productType}` : null,
      selection.supplierId ? "one supplier" : null,
    ].filter((limit): limit is string => limit !== null);
    if (limits.length > 0) {
      notices.push({
        tone: "warning",
        heading: "The worksheet covers only part of your products",
        body: `It was limited to ${limits.join(" and ")}, so products outside that are not listed here even if they are low. Generate a worksheet for all products to see everything.`,
      });
    }
  }
  return notices;
}

export function buildLowStockReport(
  input: LowStockInput,
): ReportData<LowStockRow> {
  const view = LOW_STOCK_VIEWS.some((v) => v.value === input.view)
    ? (input.view as LowStockView)
    : "variants";
  const { lines } = input.lowStock;
  const { currencyCode } = input;

  let rows: LowStockRow[];
  if (view === "variants") {
    rows = lines.map((line) => variantRow(line, currencyCode));
  } else if (view === "products") {
    rows = [...groupBy(lines, (line) => line.productGid)].map(([key, group]) =>
      groupRow(key, group, currencyCode),
    );
  } else {
    rows = [...groupBy(lines, (line) => line.vendor ?? "")].map(
      ([key, group]) => groupRow(key, group, currencyCode),
    );
  }

  return {
    columns: columnsFor(view),
    rows,
    rowKey: (row) => row.key,
    defaultSort:
      view === "variants"
        ? { key: "depletion", direction: "asc" }
        : { key: "outOfStock", direction: "desc" },
    facets: facetsFor(view),
    searchKeys:
      view === "variants"
        ? ["product", "variant", "sku", "vendor", "supplier"]
        : view === "products"
          ? ["product", "vendor"]
          : ["vendor"],
    summarize: (shown) => {
      const variants = shown.reduce((t, r) => t + r.variants, 0);
      const out = shown.reduce((t, r) => t + r.outOfStock, 0);
      const suggested = shown.reduce((t, r) => t + (r.suggested ?? 0), 0);
      const lost = shown.reduce<Decimal | null>(
        (t, r) =>
          r.lostRevenuePerDay ? (t ?? ZERO).plus(r.lostRevenuePerDay) : t,
        null,
      );
      return [
        {
          label: "Variants low or out",
          value: formatCell("integer", variants, ""),
        },
        { label: "Out of stock", value: formatCell("integer", out, "") },
        {
          label: "Suggested order units",
          value: formatCell("integer", suggested, ""),
          detail: "Includes variants already on a purchase order",
        },
        {
          label: "Lost revenue per day",
          value: lost ? formatCell("money", lost, currencyCode) : "—",
          detail:
            out === 0
              ? undefined
              : `From ${countOf(out, "out-of-stock variant", "out-of-stock variants")}, where a selling rate and price are known`,
        },
      ];
    },
    notices: noticesFor(input),
    // A snapshot: the worksheet's own time, not "as they are now".
    dataAsOf: input.lowStock.worksheet?.generatedAt ?? null,
    methodNotes: [
      "Low stock is read from your latest replenishment worksheet, not worked out again here, so it always matches what you order from.",
      "A variant is low when available plus incoming stock is at or below its reorder point or below its minimum; the worksheet explains the calculation for each one.",
      "Products and vendors group the variants listed; a product or vendor with no low variant is not shown.",
    ],
  };
}
