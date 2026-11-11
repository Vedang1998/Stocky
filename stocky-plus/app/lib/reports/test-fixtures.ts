/** Builders for report tests. Not imported by application code. */
import type { CatalogVariant } from "../analytics/catalog.server";
import { Decimal } from "../analytics/money";
import {
  CANCELLED_ORDERS_POLICY,
  NET_REVENUE_POLICY,
  NET_UNITS_POLICY,
  aggregateDaily,
  emptyNetUnitsDiagnostics,
  type NetUnitsDiagnostics,
  type UnitEvent,
  type UnitEventKind,
} from "../analytics/net-units";
import type { SalesHistory, SalesHistoryCoverage } from "../analytics/sales-history.server";
import type { StockLevel } from "../analytics/stock-levels.server";
import type { SalesReportInput } from "./sales-reports";
import { buildVariantDirectory } from "./variant-directory";

export const variantGid = (n: number) => `gid://shopify/ProductVariant/${n}`;
export const inventoryItemGid = (n: number) => `gid://shopify/InventoryItem/${n}`;
export const locationGid = (n: number) => `gid://shopify/Location/${n}`;

export function catalogVariant(
  n: number,
  overrides: Partial<CatalogVariant> = {},
): CatalogVariant {
  return {
    variantGid: variantGid(n),
    productGid: `gid://shopify/Product/${n}`,
    productTitle: `Product ${n}`,
    variantTitle: "Default Title",
    displayName: null,
    sku: `SKU-${n}`,
    barcode: null,
    vendor: "Northwind",
    productType: null,
    productStatus: "ACTIVE",
    priceAmount: new Decimal("20.00"),
    priceCurrencyCode: "USD",
    createdLocalDate: "2025-01-01",
    inventoryItemGid: inventoryItemGid(n),
    tracked: true,
    unitCost: new Decimal("8.00"),
    unitCostCurrencyCode: "USD",
    unitCostAccess: "PRESENT",
    ...overrides,
  };
}

export function stockLevel(
  item: number,
  location: number,
  onHand: number | null,
  overrides: Partial<StockLevel> = {},
): StockLevel {
  return {
    inventoryItemGid: inventoryItemGid(item),
    locationGid: locationGid(location),
    available: onHand,
    onHand,
    committed: 0,
    incoming: 0,
    shopifyUpdatedAt: new Date("2026-11-08T10:00:00Z"),
    ...overrides,
  };
}

let saleSequence = 0;

/** A unit event on line `<order>-<variant>`; revenue is units × `unitPrice`. */
export function unitEvent(input: {
  variant: number;
  order: number;
  localDate: string;
  kind?: UnitEventKind;
  units: number;
  unitPrice?: string | null;
  product?: number;
}): UnitEvent {
  saleSequence += 1;
  const unitPrice = input.unitPrice === undefined ? "10.00" : input.unitPrice;
  return {
    variantGid: variantGid(input.variant),
    productGid: `gid://shopify/Product/${input.product ?? input.variant}`,
    orderGid: `gid://shopify/Order/${input.order}`,
    lineGid: `gid://shopify/LineItem/${input.order}-${input.variant}`,
    saleGid: `gid://shopify/Sale/${saleSequence}`,
    localDate: input.localDate,
    kind: input.kind ?? "ORDERED",
    units: input.units,
    revenue: unitPrice === null ? null : new Decimal(unitPrice).times(input.units),
  };
}

export function coverage(overrides: Partial<SalesHistoryCoverage> = {}): SalesHistoryCoverage {
  return {
    earliestOrderLocalDate: "2025-01-01",
    latestOrderLocalDate: "2026-11-09",
    historyStartLocalDate: "2025-01-01",
    startsBeforeCoverage: false,
    latestOrderChangeAt: new Date("2026-11-09T15:00:00Z"),
    ...overrides,
  };
}

export function salesHistory(input: {
  events: UnitEvent[];
  startLocalDate?: string;
  endLocalDate?: string;
  orderDates?: Record<number, string>;
  lines?: SalesHistory["lines"];
  diagnostics?: Partial<NetUnitsDiagnostics>;
  coverage?: Partial<SalesHistoryCoverage>;
}): SalesHistory {
  const orders: SalesHistory["orders"] = new Map();
  for (const event of input.events) {
    if (orders.has(event.orderGid)) continue;
    const number = Number(event.orderGid.split("/").pop());
    const localDate = input.orderDates?.[number] ?? event.localDate;
    orders.set(event.orderGid, {
      orderGid: event.orderGid,
      name: `#${number}`,
      processedAt: new Date(`${localDate}T17:00:00Z`),
      localDate,
    });
  }
  return {
    policies: {
      netUnits: NET_UNITS_POLICY,
      cancelledOrders: CANCELLED_ORDERS_POLICY,
      revenue: NET_REVENUE_POLICY,
    },
    startLocalDate: input.startLocalDate ?? "2026-11-01",
    endLocalDate: input.endLocalDate ?? "2026-11-03",
    timeZone: "America/New_York",
    reportCurrency: "USD",
    events: input.events,
    daily: aggregateDaily(input.events),
    orders,
    lines: input.lines ?? new Map(),
    diagnostics: { ...emptyNetUnitsDiagnostics(), ...input.diagnostics },
    coverage: coverage(input.coverage),
  };
}

export function salesInput(
  history: SalesHistory,
  variants: CatalogVariant[],
): SalesReportInput {
  const catalog = new Map(variants.map((variant) => [variant.variantGid, variant]));
  return {
    history,
    catalog,
    directory: buildVariantDirectory(catalog, history),
    currencyCode: "USD",
  };
}

/** A report's rows as formatted cells keyed by column, in the report's default order. */
export function cellsByColumn<Row>(
  data: {
    columns: ReadonlyArray<{ key: string; value: (row: Row) => unknown }>;
  },
  row: Row,
): Record<string, unknown> {
  return Object.fromEntries(
    data.columns.map((column) => {
      const value = column.value(row);
      return [column.key, Decimal.isDecimal(value) ? value.toFixed(2) : value];
    }),
  );
}
