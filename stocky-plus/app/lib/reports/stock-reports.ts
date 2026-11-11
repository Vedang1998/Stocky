/**
 * Inventory reports built from Shopify's current stock levels. Shopify is the
 * authority for every quantity; nothing here is counted or adjusted by the app.
 */
import type { CatalogVariant } from "../analytics/catalog.server";
import { Decimal, ZERO } from "../analytics/money";
import type { SalesHistoryCoverage } from "../analytics/sales-history.server";
import {
  addLocalDays,
  diffLocalDays,
  localDateOf,
  type LocalDate,
} from "../analytics/shop-calendar";
import type {
  StockLevel,
  StockLocation,
} from "../analytics/stock-levels.server";
import { countOf, formatCell } from "./present";
import type { ReportData, ReportNotice, ReportTile } from "./types";

const ON_HAND_DEFINITION =
  "Units physically at the location, as Shopify reports them. Includes units committed to open orders.";
const COST_VALUE_DEFINITION =
  "On hand × Shopify's cost per item. Blank when the variant has no cost in your store currency. Negative on-hand counts as zero.";
const RETAIL_VALUE_DEFINITION =
  "On hand × the variant's current price. Negative on-hand counts as zero.";

export const STOCK_METHOD_NOTES = [
  "Quantities are Shopify's current inventory levels, read from the last sync.",
  "Only variants with inventory tracking turned on are listed.",
  "Cost is the cost per item saved on the variant in Shopify. It is not a landed or average cost.",
  "A negative on-hand quantity is shown as it is and valued at zero.",
];

function money(value: Decimal, currencyCode: string): string {
  return formatCell("money", value, currencyCode);
}

function count(value: number): string {
  return formatCell("integer", value, "");
}

function variantName(variant: CatalogVariant): string {
  return !variant.variantTitle || variant.variantTitle === "Default Title"
    ? ""
    : variant.variantTitle;
}

/** The variant's Shopify cost, when it is in the currency the report totals in. */
function unitCostIn(
  variant: CatalogVariant,
  currencyCode: string,
): Decimal | null {
  return variant.unitCost && variant.unitCostCurrencyCode === currencyCode
    ? variant.unitCost
    : null;
}

function priceIn(
  variant: CatalogVariant,
  currencyCode: string,
): Decimal | null {
  return variant.priceCurrencyCode === currencyCode
    ? variant.priceAmount
    : null;
}

function valueOf(onHand: number | null, unit: Decimal | null): Decimal | null {
  if (onHand === null || unit === null) return null;
  return unit.times(Math.max(onHand, 0));
}

function sumValues(values: Iterable<Decimal | null>): Decimal {
  let total = ZERO;
  for (const value of values) if (value) total = total.plus(value);
  return total;
}

/** Tracked catalog variants by the inventory item that carries their stock. */
function trackedByInventoryItem(
  catalog: Iterable<CatalogVariant>,
): Map<string, CatalogVariant> {
  const tracked = new Map<string, CatalogVariant>();
  for (const variant of catalog) {
    if (variant.inventoryItemGid && variant.tracked === true) {
      tracked.set(variant.inventoryItemGid, variant);
    }
  }
  return tracked;
}

function latestLevelChange(levels: readonly StockLevel[]): Date | null {
  let latest: Date | null = null;
  for (const level of levels) {
    if (
      level.shopifyUpdatedAt &&
      (!latest || level.shopifyUpdatedAt > latest)
    ) {
      latest = level.shopifyUpdatedAt;
    }
  }
  return latest;
}

function missingCostNotice(variants: number): ReportNotice {
  return {
    tone: "warning",
    heading: `${countOf(variants, "variant with stock has", "variants with stock have")} no cost`,
    body: "Cost value is blank for a variant without a cost and is not part of the total. Add a cost per item in Shopify to value it.",
  };
}

// --- Stock on hand -----------------------------------------------------------

export type StockOnHandRow = {
  variant: CatalogVariant;
  locationGid: string;
  location: string;
  level: StockLevel;
  unitCost: Decimal | null;
  costValue: Decimal | null;
  price: Decimal | null;
  retailValue: Decimal | null;
};

export const STOCK_FILTERS = [
  { value: "stocked", label: "Variants with stock" },
  { value: "all", label: "All tracked variants" },
] as const;

export type StockOnHandInput = {
  catalog: Iterable<CatalogVariant>;
  levels: readonly StockLevel[];
  locations: readonly StockLocation[];
  currencyCode: string;
  /** `stocked` keeps rows whose on-hand quantity is not zero; `all` keeps every row. */
  filter: string;
};

/** One row per tracked variant and location with an active inventory level. */
export function buildStockOnHandReport(
  input: StockOnHandInput,
): ReportData<StockOnHandRow> {
  const { currencyCode } = input;
  const tracked = trackedByInventoryItem(input.catalog);
  const locationNames = new Map(
    input.locations.map((l) => [l.locationGid, l.name]),
  );

  const rows: StockOnHandRow[] = [];
  let unknownQuantity = 0;
  for (const level of input.levels) {
    const variant = tracked.get(level.inventoryItemGid);
    if (!variant) continue;
    if (level.onHand === null) unknownQuantity += 1;
    if (input.filter !== "all" && (level.onHand === null || level.onHand === 0))
      continue;
    const unitCost = unitCostIn(variant, currencyCode);
    const price = priceIn(variant, currencyCode);
    rows.push({
      variant,
      locationGid: level.locationGid,
      location: locationNames.get(level.locationGid) ?? "Unknown location",
      level,
      unitCost,
      costValue: valueOf(level.onHand, unitCost),
      price,
      retailValue: valueOf(level.onHand, price),
    });
  }

  const notices: ReportNotice[] = [];
  if (input.levels.length === 0) {
    notices.push({
      tone: "info",
      heading: "No inventory levels have been synced yet",
      body: "Stock appears here once your Shopify products and locations have been imported.",
    });
  }
  const negative = rows.filter((row) => (row.level.onHand ?? 0) < 0).length;
  if (negative > 0) {
    notices.push({
      tone: "warning",
      heading: `${countOf(negative, "stock level is", "stock levels are")} below zero`,
      body: "A negative on-hand quantity is listed as Shopify reports it and valued at zero.",
    });
  }
  const uncosted = new Set(
    rows
      .filter((row) => (row.level.onHand ?? 0) > 0 && row.unitCost === null)
      .map((row) => row.variant.variantGid),
  ).size;
  if (uncosted > 0) notices.push(missingCostNotice(uncosted));
  if (unknownQuantity > 0) {
    notices.push({
      tone: "info",
      heading: `${countOf(unknownQuantity, "stock level has", "stock levels have")} no quantity yet`,
      body: "Where Shopify has not reported an on-hand quantity, the row is blank, not zero.",
    });
  }

  return {
    columns: [
      {
        key: "product",
        label: "Product",
        kind: "text",
        value: (r) => r.variant.productTitle,
      },
      {
        key: "variant",
        label: "Variant",
        kind: "text",
        value: (r) => variantName(r.variant),
      },
      { key: "sku", label: "SKU", kind: "text", value: (r) => r.variant.sku },
      {
        key: "vendor",
        label: "Vendor",
        kind: "text",
        value: (r) => r.variant.vendor,
      },
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
        definition:
          "Units that can be sold now: on hand minus committed, unavailable and reserved units.",
        value: (r) => r.level.available,
      },
      {
        key: "onHand",
        label: "On hand",
        kind: "integer",
        definition: ON_HAND_DEFINITION,
        value: (r) => r.level.onHand,
      },
      {
        key: "committed",
        label: "Committed",
        kind: "integer",
        definition: "Units on open orders that have not been fulfilled.",
        value: (r) => r.level.committed,
      },
      {
        key: "incoming",
        label: "Incoming",
        kind: "integer",
        definition:
          "Units on the way to the location, as Shopify reports them.",
        value: (r) => r.level.incoming,
      },
      {
        key: "unitCost",
        label: "Cost per item",
        kind: "money",
        definition: "The cost per item saved on the variant in Shopify.",
        value: (r) => r.unitCost,
      },
      {
        key: "costValue",
        label: "Cost value",
        kind: "money",
        definition: COST_VALUE_DEFINITION,
        value: (r) => r.costValue,
      },
      { key: "price", label: "Price", kind: "money", value: (r) => r.price },
      {
        key: "retailValue",
        label: "Retail value",
        kind: "money",
        definition: RETAIL_VALUE_DEFINITION,
        value: (r) => r.retailValue,
      },
    ],
    rows,
    rowKey: (row) => `${row.variant.variantGid}|${row.locationGid}`,
    defaultSort: { key: "product", direction: "asc" },
    facets: [
      { key: "location", label: "Location", value: (row) => row.location },
      { key: "vendor", label: "Vendor", value: (row) => row.variant.vendor },
    ],
    searchKeys: ["product", "variant", "sku", "vendor"],
    summarize: (shown): ReportTile[] => [
      {
        label: "Units on hand",
        value: count(shown.reduce((n, r) => n + (r.level.onHand ?? 0), 0)),
      },
      {
        label: "Cost value",
        value: money(sumValues(shown.map((r) => r.costValue)), currencyCode),
        detail: "Variants without a cost are not included",
      },
      {
        label: "Retail value",
        value: money(sumValues(shown.map((r) => r.retailValue)), currencyCode),
      },
      {
        label: "Variants",
        value: count(new Set(shown.map((r) => r.variant.variantGid)).size),
      },
    ],
    notices,
    dataAsOf: latestLevelChange(input.levels),
    methodNotes: STOCK_METHOD_NOTES,
  };
}

// --- Dead stock --------------------------------------------------------------

export const DEAD_STOCK_WINDOWS = [30, 60, 90, 180, 365] as const;
export const DEFAULT_DEAD_STOCK_DAYS = 90;

export type DeadStockRow = {
  variant: CatalogVariant;
  onHand: number;
  lastOrderedDate: LocalDate | null;
  daysSinceOrdered: number | null;
  unitCost: Decimal | null;
  costValue: Decimal | null;
  retailValue: Decimal | null;
};

export type DeadStockInput = {
  catalog: Iterable<CatalogVariant>;
  levels: readonly StockLevel[];
  /** Most recent order per variant, from `loadLastOrderedAt`. */
  lastOrderedAt: ReadonlyMap<string, Date>;
  coverage: Pick<SalesHistoryCoverage, "historyStartLocalDate">;
  timeZone: string;
  currencyCode: string;
  today: LocalDate;
  /** Days without an order before stock counts as dead. */
  days: number;
};

/** On-hand units per tracked variant across all locations, positive totals only. */
export function stockedVariants(
  catalog: Iterable<CatalogVariant>,
  levels: readonly StockLevel[],
): Map<string, { variant: CatalogVariant; onHand: number }> {
  const tracked = trackedByInventoryItem(catalog);
  const totals = new Map<string, { variant: CatalogVariant; onHand: number }>();
  for (const level of levels) {
    const variant = tracked.get(level.inventoryItemGid);
    if (!variant || level.onHand === null) continue;
    const entry = totals.get(variant.variantGid) ?? { variant, onHand: 0 };
    entry.onHand += level.onHand;
    totals.set(variant.variantGid, entry);
  }
  for (const [variantGid, entry] of totals) {
    if (entry.onHand <= 0) totals.delete(variantGid);
  }
  return totals;
}

/**
 * Variants with stock on hand that have not been ordered for `days` days.
 * A variant created inside that window is left out: it has not had the time to
 * prove it does not sell.
 */
export function buildDeadStockReport(
  input: DeadStockInput,
): ReportData<DeadStockRow> {
  const { currencyCode, today } = input;
  const cutoff = addLocalDays(today, -input.days);
  const rows: DeadStockRow[] = [];

  for (const { variant, onHand } of stockedVariants(
    input.catalog,
    input.levels,
  ).values()) {
    if (variant.createdLocalDate !== null && variant.createdLocalDate > cutoff)
      continue;
    const orderedAt = input.lastOrderedAt.get(variant.variantGid);
    const lastOrderedDate = orderedAt
      ? localDateOf(orderedAt, input.timeZone)
      : null;
    if (lastOrderedDate !== null && lastOrderedDate > cutoff) continue;
    const unitCost = unitCostIn(variant, currencyCode);
    rows.push({
      variant,
      onHand,
      lastOrderedDate,
      daysSinceOrdered: lastOrderedDate
        ? diffLocalDays(lastOrderedDate, today)
        : null,
      unitCost,
      costValue: valueOf(onHand, unitCost),
      retailValue: valueOf(onHand, priceIn(variant, currencyCode)),
    });
  }

  const notices: ReportNotice[] = [];
  const { historyStartLocalDate } = input.coverage;
  if (historyStartLocalDate === null) {
    notices.push({
      tone: "warning",
      heading: "No orders have been synced yet",
      body: "Every variant with stock looks unsold until your Shopify orders have been imported.",
    });
  } else if (historyStartLocalDate > cutoff) {
    notices.push({
      tone: "warning",
      heading: "Your imported order history is shorter than this period",
      body: `Order history starts on ${historyStartLocalDate}, less than ${input.days} days ago. A variant that last sold before that date is listed here although it may have sold inside the period.`,
    });
  }
  const uncosted = rows.filter((row) => row.unitCost === null).length;
  if (uncosted > 0) notices.push(missingCostNotice(uncosted));

  return {
    columns: [
      {
        key: "product",
        label: "Product",
        kind: "text",
        value: (r) => r.variant.productTitle,
      },
      {
        key: "variant",
        label: "Variant",
        kind: "text",
        value: (r) => variantName(r.variant),
      },
      { key: "sku", label: "SKU", kind: "text", value: (r) => r.variant.sku },
      {
        key: "vendor",
        label: "Vendor",
        kind: "text",
        value: (r) => r.variant.vendor,
      },
      {
        key: "onHand",
        label: "On hand",
        kind: "integer",
        definition:
          "Units on hand across all locations, as Shopify reports them.",
        value: (r) => r.onHand,
      },
      {
        key: "lastOrderedDate",
        label: "Last ordered",
        kind: "date",
        definition:
          "The day of the most recent order containing the variant. Test and cancelled orders are ignored. Blank when it has never been ordered in your imported history.",
        value: (r) => r.lastOrderedDate,
      },
      {
        key: "daysSinceOrdered",
        label: "Days since ordered",
        kind: "integer",
        value: (r) => r.daysSinceOrdered,
      },
      {
        key: "unitCost",
        label: "Cost per item",
        kind: "money",
        definition: "The cost per item saved on the variant in Shopify.",
        value: (r) => r.unitCost,
      },
      {
        key: "costValue",
        label: "Cost value",
        kind: "money",
        definition: COST_VALUE_DEFINITION,
        value: (r) => r.costValue,
      },
      {
        key: "retailValue",
        label: "Retail value",
        kind: "money",
        definition: RETAIL_VALUE_DEFINITION,
        value: (r) => r.retailValue,
      },
    ],
    rows,
    rowKey: (row) => row.variant.variantGid,
    defaultSort: { key: "costValue", direction: "desc" },
    facets: [
      { key: "vendor", label: "Vendor", value: (row) => row.variant.vendor },
    ],
    searchKeys: ["product", "variant", "sku", "vendor"],
    summarize: (shown): ReportTile[] => [
      { label: "Variants", value: count(shown.length) },
      {
        label: "Units on hand",
        value: count(shown.reduce((n, r) => n + r.onHand, 0)),
      },
      {
        label: "Cost value",
        value: money(sumValues(shown.map((r) => r.costValue)), currencyCode),
        detail: "Variants without a cost are not included",
      },
      {
        label: "Retail value",
        value: money(sumValues(shown.map((r) => r.retailValue)), currencyCode),
      },
    ],
    notices,
    dataAsOf: latestLevelChange(input.levels),
    methodNotes: [
      ...STOCK_METHOD_NOTES,
      `Stock is dead when the variant has units on hand and its most recent order was ${input.days} days ago or more, or it has never been ordered.`,
      `Variants created in the last ${input.days} days are left out.`,
      "Refunds do not change the last ordered date.",
    ],
  };
}
