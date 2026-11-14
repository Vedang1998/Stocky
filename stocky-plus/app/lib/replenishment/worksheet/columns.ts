/**
 * The worksheet columns a merchant can show or hide. Product, the suggested
 * and order quantities, status and the detail button are always shown: the
 * table is no use without them. The choice is saved for the shop.
 */
export const WORKSHEET_COLUMNS = [
  "sku",
  "supplier",
  "abc",
  "available",
  "onHand",
  "committed",
  "incoming",
  "netUnits",
  "revenue",
  "unitsPerDay",
  "daysOfStock",
  "leadTime",
  "reorderPoint",
] as const;

export type WorksheetColumn = (typeof WORKSHEET_COLUMNS)[number];

export const WORKSHEET_COLUMN_LABELS: Record<WorksheetColumn, string> = {
  sku: "SKU",
  supplier: "Supplier",
  abc: "ABC class",
  available: "Available",
  onHand: "On hand",
  committed: "Committed",
  incoming: "Incoming",
  netUnits: "Net units sold",
  revenue: "Net sales",
  unitsPerDay: "Units per day",
  daysOfStock: "Days of stock",
  leadTime: "Lead time",
  reorderPoint: "Reorder point",
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
