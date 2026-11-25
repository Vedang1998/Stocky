/**
 * The worksheet columns a merchant can show or hide. Product, the suggested
 * and order quantities, status and the detail button are always shown: the
 * table is no use without them. The choice is saved for the shop.
 */
export const WORKSHEET_COLUMNS = [
  "sku",
  "barcode",
  "supplier",
  "vendorSku",
  "abc",
  "price",
  "shopifyCost",
  "supplierCost",
  "margin",
  "markup",
  "available",
  "onHand",
  "committed",
  "incoming",
  "netUnits",
  "orders",
  "revenue",
  "unitsPerDay",
  "revenuePerDay",
  "daysOfStock",
  "leadTime",
  "reorderPoint",
  "forecastDemand",
  "smartForecast",
  "packSize",
] as const;

export type WorksheetColumn = (typeof WORKSHEET_COLUMNS)[number];

export const WORKSHEET_COLUMN_LABELS: Record<WorksheetColumn, string> = {
  sku: "SKU",
  barcode: "Barcode",
  supplier: "Supplier",
  vendorSku: "Supplier SKU",
  abc: "ABC class",
  price: "Price",
  shopifyCost: "Shopify unit cost",
  supplierCost: "Supplier cost",
  margin: "Margin",
  markup: "Markup",
  available: "Available",
  onHand: "On hand",
  committed: "Committed",
  incoming: "Incoming",
  netUnits: "Net units sold",
  orders: "Sales orders",
  revenue: "Net sales",
  unitsPerDay: "Units per day",
  revenuePerDay: "Net sales per day",
  daysOfStock: "Days of stock",
  leadTime: "Lead time",
  reorderPoint: "Reorder point",
  forecastDemand: "Forecast demand",
  smartForecast: "Smart Forecast (Pro plan)",
  packSize: "Pack size",
};

/** What a shop sees before it chooses. */
export const DEFAULT_WORKSHEET_COLUMNS: readonly WorksheetColumn[] = [
  "sku",
  "supplier",
  "abc",
  "available",
  "incoming",
  "netUnits",
  "unitsPerDay",
  "daysOfStock",
];

/**
 * The known columns among `values`, once each and in table order. Unknown
 * names are dropped, so a stored list from an older version still reads.
 */
export function readWorksheetColumns(values: readonly unknown[]): WorksheetColumn[] {
  const chosen = new Set(values.filter((value): value is string => typeof value === "string"));
  return WORKSHEET_COLUMNS.filter((column) => chosen.has(column));
}
