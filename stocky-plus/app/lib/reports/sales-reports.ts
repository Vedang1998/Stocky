/**
 * Sales reports built from dated unit events. Every figure here comes from
 * `app/lib/analytics`; these functions only group, label and total it.
 */
import type { CatalogVariant } from "../analytics/catalog.server";
import { Decimal, ZERO } from "../analytics/money";
import {
  aggregateVariantWindow,
  type UnitEvent,
  type UnitEventKind,
  type VariantWindowSales,
} from "../analytics/net-units";
import type { SalesHistory } from "../analytics/sales-history.server";
import {
  enumerateLocalDates,
  type LocalDate,
} from "../analytics/shop-calendar";
import { countOf, formatCell } from "./present";
import type { ReportData, ReportNotice, ReportTile } from "./types";
import type { VariantDirectory, VariantInfo } from "./variant-directory";

export type SalesReportInput = {
  history: SalesHistory;
  catalog: ReadonlyMap<string, CatalogVariant>;
  directory: VariantDirectory;
  currencyCode: string;
};

export const NET_UNITS_DEFINITION =
  "Units ordered and added, minus units refunded, returned or removed by an edit. Refunds count against the day of the original order.";
export const NET_REVENUE_DEFINITION =
  "Net units × the unit price after all discounts. Excludes shipping and duties.";
const ORDERS_DEFINITION =
  "Orders in which the item's net units are above zero. Test and cancelled orders are never counted.";

export const SALES_METHOD_NOTES = [
  "Days are calendar days in your store's time zone.",
  "Refunds, returns and items removed by an order edit are subtracted on the day of the original order. Items added by an edit count on the day they were added.",
  "Test orders, cancelled orders, gift cards and custom items without a variant are left out.",
  "Revenue is net units × the unit price after all discounts. It excludes shipping and duties, and includes tax only if your prices include tax.",
];

function money(value: Decimal, currencyCode: string): string {
  return formatCell("money", value, currencyCode);
}

function count(value: number): string {
  return formatCell("integer", value, "");
}

export const NO_ORDERS_NOTICE: ReportNotice = {
  tone: "info",
  heading: "No orders have been synced yet",
  body: "Sales appear here once your Shopify orders have been imported.",
};

/** Banners for orders the sales figures had to leave out or could not price. */
export function diagnosticNotices(
  diagnostics: SalesHistory["diagnostics"],
): ReportNotice[] {
  const notices: ReportNotice[] = [];

  if (diagnostics.ordersExcludedSignInconsistent > 0) {
    notices.push({
      tone: "warning",
      heading: `${countOf(diagnostics.ordersExcludedSignInconsistent, "order was", "orders were")} left out`,
      body: "Shopify's records of an order left out here contradict each other, so its quantities cannot be trusted. It is included again once a sync corrects it.",
    });
  }

  const incomplete =
    diagnostics.ordersWithoutLedger +
    diagnostics.salesWithoutLine +
    diagnostics.salesWithoutAgreement;
  if (incomplete > 0) {
    notices.push({
      tone: "warning",
      heading: "Some orders are still syncing",
      body: `Orders or sales in this period that are not fully imported yet, and so are not counted: ${count(incomplete)}.`,
    });
  }

  if (diagnostics.eventsWithoutRevenue > 0) {
    notices.push({
      tone: "info",
      heading: `${countOf(diagnostics.eventsWithoutRevenue, "sale has", "sales have")} units but no revenue`,
      body: "A sale without a price in your store currency counts toward units and adds no revenue.",
    });
  }
  return notices;
}

/** Banners every date-range sales report shows when it cannot be read at face value. */
export function salesNotices(
  source: Pick<SalesHistory, "coverage" | "diagnostics">,
): ReportNotice[] {
  const { coverage } = source;
  const notices: ReportNotice[] = [];
  if (coverage.historyStartLocalDate == null) {
    notices.push(NO_ORDERS_NOTICE);
  } else if (coverage.startsBeforeCoverage) {
    notices.push({
      tone: "warning",
      heading: "Part of this date range is before your imported order history",
      body: `Order history starts on ${coverage.historyStartLocalDate}. Earlier days are missing from this report, not zero.`,
    });
  }
  return [...notices, ...diagnosticNotices(source.diagnostics)];
}

function sumRevenue(rows: ReadonlyArray<{ revenue: Decimal }>): Decimal {
  return rows.reduce((sum, row) => sum.plus(row.revenue), ZERO);
}

function share(part: Decimal, whole: Decimal): Decimal | null {
  return whole.greaterThan(0) && part.greaterThan(0)
    ? part.dividedBy(whole)
    : null;
}

function returnedUnits(sales: VariantWindowSales): number {
  return (
    sales.refundedUnits + sales.removedUnits + sales.returnedUnclassifiedUnits
  );
}

export function identityColumns<Row extends { info: VariantInfo }>() {
  return [
    {
      key: "product",
      label: "Product",
      kind: "text",
      value: (r: Row) => r.info.product,
    },
    {
      key: "variant",
      label: "Variant",
      kind: "text",
      value: (r: Row) => r.info.variant,
    },
    { key: "sku", label: "SKU", kind: "text", value: (r: Row) => r.info.sku },
    {
      key: "vendor",
      label: "Vendor",
      kind: "text",
      value: (r: Row) => r.info.vendor,
    },
  ] as const;
}

export const VENDOR_FACET = {
  key: "vendor",
  label: "Vendor",
  value: (row: { info: VariantInfo }) => row.info.vendor,
};

export const IDENTITY_SEARCH_KEYS = ["product", "variant", "sku", "vendor"];

// --- Best and worst sellers --------------------------------------------------

export type SellerRow = {
  info: VariantInfo;
  netUnits: number;
  revenue: Decimal;
  revenueShare: Decimal | null;
  orders: number;
  lastSaleDate: LocalDate | null;
};

export const SELLER_VIEWS = [
  { value: "best", label: "Best sellers" },
  { value: "worst", label: "Worst sellers" },
] as const;

/**
 * Variants ranked by sales. The worst-sellers view also lists active catalog
 * variants that sold nothing, which are the ones it exists to surface.
 */
export function buildSellersReport(
  input: SalesReportInput,
  view: string,
): ReportData<SellerRow> {
  const windows = aggregateVariantWindow(input.history.events);
  const totalRevenue = sumRevenue(
    windows.filter((w) => w.revenue.greaterThan(0)),
  );
  const rows: SellerRow[] = windows.map((sales) => ({
    info: input.directory(sales.variantGid),
    netUnits: sales.netUnits,
    revenue: sales.revenue,
    revenueShare: share(sales.revenue, totalRevenue),
    orders: sales.distinctOrders,
    lastSaleDate: sales.lastSaleDate,
  }));

  const worst = view === "worst";
  if (worst) {
    const sold = new Set(windows.map((w) => w.variantGid));
    for (const variant of input.catalog.values()) {
      if (sold.has(variant.variantGid) || variant.productStatus !== "ACTIVE")
        continue;
      rows.push({
        info: input.directory(variant.variantGid),
        netUnits: 0,
        revenue: ZERO,
        revenueShare: null,
        orders: 0,
        lastSaleDate: null,
      });
    }
  }

  const summarize = (shown: readonly SellerRow[]): ReportTile[] => {
    const tiles: ReportTile[] = [
      {
        label: "Net revenue",
        value: money(sumRevenue(shown), input.currencyCode),
      },
      {
        label: "Net units",
        value: count(shown.reduce((n, r) => n + r.netUnits, 0)),
      },
      {
        label: "Variants sold",
        value: count(shown.filter((r) => r.netUnits > 0).length),
      },
    ];
    if (worst) {
      tiles.push({
        label: "Active variants with no sales",
        value: count(shown.filter((r) => r.lastSaleDate === null).length),
      });
    }
    return tiles;
  };

  return {
    columns: [
      ...identityColumns<SellerRow>(),
      {
        key: "netUnits",
        label: "Net units",
        kind: "integer",
        definition: NET_UNITS_DEFINITION,
        value: (r) => r.netUnits,
      },
      {
        key: "revenue",
        label: "Net revenue",
        kind: "money",
        definition: NET_REVENUE_DEFINITION,
        value: (r) => r.revenue,
      },
      {
        key: "revenueShare",
        label: "Share of revenue",
        kind: "percent",
        definition:
          "The variant's net revenue ÷ the net revenue of all variants in the range.",
        value: (r) => r.revenueShare,
      },
      {
        key: "orders",
        label: "Orders",
        kind: "integer",
        definition: ORDERS_DEFINITION,
        value: (r) => r.orders,
      },
      {
        key: "lastSaleDate",
        label: "Last sold",
        kind: "date",
        definition:
          "The most recent day in the range on which the variant was ordered.",
        value: (r) => r.lastSaleDate,
      },
    ],
    rows,
    rowKey: (row) => row.info.variantGid,
    defaultSort: worst
      ? { key: "netUnits", direction: "asc" }
      : { key: "revenue", direction: "desc" },
    facets: [VENDOR_FACET],
    searchKeys: IDENTITY_SEARCH_KEYS,
    summarize,
    notices: salesNotices(input.history),
    dataAsOf: input.history.coverage.latestOrderChangeAt,
    methodNotes: worst
      ? [
          ...SALES_METHOD_NOTES,
          "Worst sellers also lists variants of active products that sold nothing in the range.",
        ]
      : SALES_METHOD_NOTES,
  };
}

// --- Sales by variant --------------------------------------------------------

export type VariantSalesRow = {
  info: VariantInfo;
  sales: VariantWindowSales;
  averagePrice: Decimal | null;
};

export function buildVariantSalesReport(
  input: SalesReportInput,
): ReportData<VariantSalesRow> {
  const windows = aggregateVariantWindow(input.history.events);
  const rows = windows.map((sales) => ({
    info: input.directory(sales.variantGid),
    sales,
    averagePrice:
      sales.netUnits > 0 && sales.eventsWithoutRevenue === 0
        ? sales.revenue.dividedBy(sales.netUnits)
        : null,
  }));

  return {
    columns: [
      ...identityColumns<VariantSalesRow>(),
      {
        key: "orderedUnits",
        label: "Ordered",
        kind: "integer",
        definition: "Units on orders placed in the range.",
        value: (r) => r.sales.orderedUnits,
      },
      {
        key: "addedUnits",
        label: "Added",
        kind: "integer",
        definition:
          "Units added to an order by a later edit or exchange, on the day they were added.",
        value: (r) => r.sales.addedUnits,
      },
      {
        key: "returnedUnits",
        label: "Returned",
        kind: "integer",
        definition:
          "Units refunded, returned or removed by an edit, counted on the day of the original order.",
        value: (r) => returnedUnits(r.sales),
      },
      {
        key: "netUnits",
        label: "Net units",
        kind: "integer",
        definition: "Ordered + added − returned.",
        value: (r) => r.sales.netUnits,
      },
      {
        key: "revenue",
        label: "Net revenue",
        kind: "money",
        definition: NET_REVENUE_DEFINITION,
        value: (r) => r.sales.revenue,
      },
      {
        key: "averagePrice",
        label: "Average price",
        kind: "money",
        definition:
          "Net revenue ÷ net units. Blank when net units are zero or a sale has no price.",
        value: (r) => r.averagePrice,
      },
      {
        key: "orders",
        label: "Orders",
        kind: "integer",
        definition: ORDERS_DEFINITION,
        value: (r) => r.sales.distinctOrders,
      },
      {
        key: "firstSaleDate",
        label: "First sold",
        kind: "date",
        value: (r) => r.sales.firstSaleDate,
      },
      {
        key: "lastSaleDate",
        label: "Last sold",
        kind: "date",
        value: (r) => r.sales.lastSaleDate,
      },
    ],
    rows,
    rowKey: (row) => row.info.variantGid,
    defaultSort: { key: "netUnits", direction: "desc" },
    facets: [VENDOR_FACET],
    searchKeys: IDENTITY_SEARCH_KEYS,
    summarize: (shown) => [
      {
        label: "Net revenue",
        value: money(sumRevenue(shown.map((r) => r.sales)), input.currencyCode),
      },
      {
        label: "Net units",
        value: count(shown.reduce((n, r) => n + r.sales.netUnits, 0)),
      },
      {
        label: "Units returned",
        value: count(shown.reduce((n, r) => n + returnedUnits(r.sales), 0)),
      },
      { label: "Variants", value: count(shown.length) },
    ],
    notices: salesNotices(input.history),
    dataAsOf: input.history.coverage.latestOrderChangeAt,
    methodNotes: SALES_METHOD_NOTES,
  };
}

// --- Sales by product --------------------------------------------------------

export type ProductSalesRow = {
  productKey: string;
  product: string;
  vendor: string | null;
  variantsSold: number;
  netUnits: number;
  revenue: Decimal;
  revenueShare: Decimal | null;
  orders: number;
};

export function buildProductSalesReport(
  input: SalesReportInput,
): ReportData<ProductSalesRow> {
  type Bucket = ProductSalesRow & {
    variants: Set<string>;
    orderUnits: Map<string, number>;
  };
  const buckets = new Map<string, Bucket>();

  for (const event of input.history.events) {
    const info = input.directory(event.variantGid);
    const productKey =
      input.catalog.get(event.variantGid)?.productGid ??
      event.productGid ??
      event.variantGid;
    let bucket = buckets.get(productKey);
    if (!bucket) {
      bucket = {
        productKey,
        product: info.product,
        vendor: info.vendor,
        variantsSold: 0,
        netUnits: 0,
        revenue: ZERO,
        revenueShare: null,
        orders: 0,
        variants: new Set(),
        orderUnits: new Map(),
      };
      buckets.set(productKey, bucket);
    }
    bucket.variants.add(event.variantGid);
    bucket.netUnits += event.units;
    if (event.revenue) bucket.revenue = bucket.revenue.plus(event.revenue);
    bucket.orderUnits.set(
      event.orderGid,
      (bucket.orderUnits.get(event.orderGid) ?? 0) + event.units,
    );
  }

  const totalRevenue = sumRevenue(
    [...buckets.values()].filter((b) => b.revenue.greaterThan(0)),
  );
  const rows: ProductSalesRow[] = [...buckets.values()].map((bucket) => ({
    productKey: bucket.productKey,
    product: bucket.product,
    vendor: bucket.vendor,
    variantsSold: bucket.variants.size,
    netUnits: bucket.netUnits,
    revenue: bucket.revenue,
    revenueShare: share(bucket.revenue, totalRevenue),
    orders: [...bucket.orderUnits.values()].filter((units) => units > 0).length,
  }));

  return {
    columns: [
      {
        key: "product",
        label: "Product",
        kind: "text",
        value: (r) => r.product,
      },
      { key: "vendor", label: "Vendor", kind: "text", value: (r) => r.vendor },
      {
        key: "variantsSold",
        label: "Variants sold",
        kind: "integer",
        definition:
          "Variants of the product with at least one sale or return in the range.",
        value: (r) => r.variantsSold,
      },
      {
        key: "netUnits",
        label: "Net units",
        kind: "integer",
        definition: NET_UNITS_DEFINITION,
        value: (r) => r.netUnits,
      },
      {
        key: "revenue",
        label: "Net revenue",
        kind: "money",
        definition: NET_REVENUE_DEFINITION,
        value: (r) => r.revenue,
      },
      {
        key: "revenueShare",
        label: "Share of revenue",
        kind: "percent",
        definition:
          "The product's net revenue ÷ the net revenue of all products in the range.",
        value: (r) => r.revenueShare,
      },
      {
        key: "orders",
        label: "Orders",
        kind: "integer",
        definition: ORDERS_DEFINITION,
        value: (r) => r.orders,
      },
    ],
    rows,
    rowKey: (row) => row.productKey,
    defaultSort: { key: "revenue", direction: "desc" },
    facets: [{ key: "vendor", label: "Vendor", value: (row) => row.vendor }],
    searchKeys: ["product", "vendor"],
    summarize: (shown) => [
      {
        label: "Net revenue",
        value: money(sumRevenue(shown), input.currencyCode),
      },
      {
        label: "Net units",
        value: count(shown.reduce((n, r) => n + r.netUnits, 0)),
      },
      { label: "Products", value: count(shown.length) },
    ],
    notices: salesNotices(input.history),
    dataAsOf: input.history.coverage.latestOrderChangeAt,
    methodNotes: SALES_METHOD_NOTES,
  };
}

// --- Sale items --------------------------------------------------------------

const EVENT_LABELS: Record<UnitEventKind, string> = {
  ORDERED: "Sold",
  ADDED: "Added by edit",
  REFUNDED: "Refunded",
  REMOVED: "Removed by edit",
  RETURNED_UNCLASSIFIED: "Returned",
};

export type SaleItemRow = {
  event: UnitEvent;
  orderName: string;
  product: string;
  variant: string;
  sku: string | null;
  vendor: string | null;
  unitPrice: Decimal | null;
};

/** One row per unit event, described as the line was sold. */
export function buildSaleItemsReport(
  input: SalesReportInput,
): ReportData<SaleItemRow> {
  const { history } = input;
  const rows: SaleItemRow[] = history.events.map((event) => {
    const line = history.lines.get(event.lineGid);
    const info = input.directory(event.variantGid);
    return {
      event,
      orderName: history.orders.get(event.orderGid)?.name ?? "",
      product: line?.title ?? info.product,
      variant: line ? (line.variantTitle ?? "") : info.variant,
      sku: line ? line.sku : info.sku,
      vendor: line ? line.vendor : info.vendor,
      unitPrice: event.revenue ? event.revenue.dividedBy(event.units) : null,
    };
  });

  return {
    columns: [
      {
        key: "date",
        label: "Date",
        kind: "date",
        definition:
          "The day the units count on: the order's day, or the day an edit added them.",
        value: (r) => r.event.localDate,
      },
      { key: "order", label: "Order", kind: "text", value: (r) => r.orderName },
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
        key: "type",
        label: "Type",
        kind: "text",
        value: (r) => EVENT_LABELS[r.event.kind],
      },
      {
        key: "units",
        label: "Units",
        kind: "integer",
        definition:
          "Positive for units sold or added, negative for units refunded, returned or removed.",
        value: (r) => r.event.units,
      },
      {
        key: "unitPrice",
        label: "Unit price",
        kind: "money",
        definition: "The line's unit price after all discounts.",
        value: (r) => r.unitPrice,
      },
      {
        key: "revenue",
        label: "Net revenue",
        kind: "money",
        definition: "Units × unit price.",
        value: (r) => r.event.revenue,
      },
    ],
    rows,
    rowKey: (row) => row.event.saleGid,
    defaultSort: { key: "date", direction: "desc" },
    facets: [
      {
        key: "type",
        label: "Type",
        value: (row) => EVENT_LABELS[row.event.kind],
      },
      { key: "vendor", label: "Vendor", value: (row) => row.vendor },
    ],
    searchKeys: ["order", "product", "variant", "sku", "vendor"],
    summarize: (shown) => [
      {
        label: "Net revenue",
        value: money(
          shown.reduce(
            (sum, r) => (r.event.revenue ? sum.plus(r.event.revenue) : sum),
            ZERO,
          ),
          input.currencyCode,
        ),
      },
      {
        label: "Net units",
        value: count(shown.reduce((n, r) => n + r.event.units, 0)),
      },
      { label: "Sale items", value: count(shown.length) },
    ],
    notices: salesNotices(history),
    dataAsOf: input.history.coverage.latestOrderChangeAt,
    methodNotes: [
      ...SALES_METHOD_NOTES,
      "Products, variants and SKUs are shown as they were on the order, which can differ from your catalog today.",
    ],
  };
}

// --- Orders ------------------------------------------------------------------

export type OrderRow = {
  orderGid: string;
  orderName: string;
  orderDate: LocalDate | null;
  variants: number;
  unitsSold: number;
  unitsReturned: number;
  netUnits: number;
  revenue: Decimal;
};

export function buildOrdersReport(
  input: SalesReportInput,
): ReportData<OrderRow> {
  type Bucket = OrderRow & { variantGids: Set<string> };
  const buckets = new Map<string, Bucket>();
  for (const event of input.history.events) {
    let bucket = buckets.get(event.orderGid);
    if (!bucket) {
      const order = input.history.orders.get(event.orderGid);
      bucket = {
        orderGid: event.orderGid,
        orderName: order?.name ?? "",
        orderDate: order?.localDate ?? null,
        variants: 0,
        unitsSold: 0,
        unitsReturned: 0,
        netUnits: 0,
        revenue: ZERO,
        variantGids: new Set(),
      };
      buckets.set(event.orderGid, bucket);
    }
    bucket.variantGids.add(event.variantGid);
    if (event.units > 0) bucket.unitsSold += event.units;
    else bucket.unitsReturned += -event.units;
    bucket.netUnits += event.units;
    if (event.revenue) bucket.revenue = bucket.revenue.plus(event.revenue);
  }
  const rows: OrderRow[] = [...buckets.values()].map(
    ({ variantGids, ...row }) => ({
      ...row,
      variants: variantGids.size,
    }),
  );
  return {
    columns: [
      {
        key: "orderDate",
        label: "Order date",
        kind: "date",
        definition:
          "The day the order was placed. An older order appears when an edit added items to it inside the range.",
        value: (r) => r.orderDate,
      },
      { key: "order", label: "Order", kind: "text", value: (r) => r.orderName },
      {
        key: "variants",
        label: "Variants",
        kind: "integer",
        definition:
          "Different variants on the order with a sale or return in the range.",
        value: (r) => r.variants,
      },
      {
        key: "unitsSold",
        label: "Units sold",
        kind: "integer",
        value: (r) => r.unitsSold,
      },
      {
        key: "unitsReturned",
        label: "Units returned",
        kind: "integer",
        value: (r) => r.unitsReturned,
      },
      {
        key: "netUnits",
        label: "Net units",
        kind: "integer",
        definition: "Units sold − units returned.",
        value: (r) => r.netUnits,
      },
      {
        key: "revenue",
        label: "Net product revenue",
        kind: "money",
        definition: `${NET_REVENUE_DEFINITION} This is not the order total.`,
        value: (r) => r.revenue,
      },
    ],
    rows,
    rowKey: (row) => row.orderGid,
    defaultSort: { key: "orderDate", direction: "desc" },
    facets: [],
    searchKeys: ["order"],
    summarize: (shown) => {
      const revenue = sumRevenue(shown);
      const counted = shown.filter((row) => row.netUnits > 0).length;
      return [
        { label: "Orders", value: count(shown.length) },
        {
          label: "Net product revenue",
          value: money(revenue, input.currencyCode),
        },
        {
          label: "Average per order",
          value:
            counted > 0
              ? money(revenue.dividedBy(counted), input.currencyCode)
              : "—",
          detail: "Net product revenue ÷ orders with net units above zero",
        },
      ];
    },
    notices: salesNotices(input.history),
    dataAsOf: input.history.coverage.latestOrderChangeAt,
    methodNotes: [
      ...SALES_METHOD_NOTES,
      "Only orders with at least one product sale or return in the range are listed. Customer details are not stored or shown.",
    ],
  };
}

// --- Statistics --------------------------------------------------------------

export type StatisticsRow = {
  localDate: LocalDate;
  orders: number;
  unitsSold: number;
  unitsReturned: number;
  netUnits: number;
  revenue: Decimal;
  averageOrderValue: Decimal | null;
};

export function buildStatisticsReport(
  input: SalesReportInput,
): ReportData<StatisticsRow> {
  const { history } = input;
  const days = new Map<string, StatisticsRow & { orderGids: Set<string> }>();
  for (const localDate of enumerateLocalDates(
    history.startLocalDate,
    history.endLocalDate,
  )) {
    days.set(localDate, {
      localDate,
      orders: 0,
      unitsSold: 0,
      unitsReturned: 0,
      netUnits: 0,
      revenue: ZERO,
      averageOrderValue: null,
      orderGids: new Set(),
    });
  }

  const variantsSold = new Set<string>();
  for (const event of history.events) {
    const day = days.get(event.localDate);
    if (!day) continue;
    if (event.kind === "ORDERED") {
      day.orderGids.add(event.orderGid);
    }
    if (event.units > 0) {
      day.unitsSold += event.units;
      variantsSold.add(event.variantGid);
    } else {
      day.unitsReturned += -event.units;
    }
    day.netUnits += event.units;
    if (event.revenue) day.revenue = day.revenue.plus(event.revenue);
  }

  const rows: StatisticsRow[] = [...days.values()].map(
    ({ orderGids, ...day }) => ({
      ...day,
      orders: orderGids.size,
      averageOrderValue:
        orderGids.size > 0 ? day.revenue.dividedBy(orderGids.size) : null,
    }),
  );

  return {
    columns: [
      { key: "date", label: "Date", kind: "date", value: (r) => r.localDate },
      {
        key: "orders",
        label: "Orders",
        kind: "integer",
        definition:
          "Orders placed that day with at least one product sale. Test and cancelled orders are not counted.",
        value: (r) => r.orders,
      },
      {
        key: "unitsSold",
        label: "Units sold",
        kind: "integer",
        value: (r) => r.unitsSold,
      },
      {
        key: "unitsReturned",
        label: "Units returned",
        kind: "integer",
        definition:
          "Units refunded, returned or removed from orders placed that day, whenever the return happened.",
        value: (r) => r.unitsReturned,
      },
      {
        key: "netUnits",
        label: "Net units",
        kind: "integer",
        value: (r) => r.netUnits,
      },
      {
        key: "revenue",
        label: "Net revenue",
        kind: "money",
        definition: NET_REVENUE_DEFINITION,
        value: (r) => r.revenue,
      },
      {
        key: "averageOrderValue",
        label: "Average order value",
        kind: "money",
        definition: "Net revenue ÷ orders, for the day.",
        value: (r) => r.averageOrderValue,
      },
    ],
    rows,
    rowKey: (row) => row.localDate,
    defaultSort: { key: "date", direction: "desc" },
    facets: [],
    searchKeys: [],
    // An order's sales all fall on its order date, so daily order counts add up
    // to the number of orders. This report has no filters: `shown` is every day.
    summarize: (shown) => {
      const revenue = sumRevenue(shown);
      const orders = shown.reduce((n, r) => n + r.orders, 0);
      const unitsSold = shown.reduce((n, r) => n + r.unitsSold, 0);
      const unitsReturned = shown.reduce((n, r) => n + r.unitsReturned, 0);
      const netUnits = unitsSold - unitsReturned;
      const best = shown.reduce<StatisticsRow | null>(
        (top, row) =>
          row.revenue.greaterThan(top?.revenue ?? ZERO) ? row : top,
        null,
      );
      return [
        { label: "Net revenue", value: money(revenue, input.currencyCode) },
        { label: "Orders", value: count(orders) },
        {
          label: "Average order value",
          value:
            orders > 0
              ? money(revenue.dividedBy(orders), input.currencyCode)
              : "—",
          detail: "Net revenue ÷ orders",
        },
        { label: "Net units", value: count(netUnits) },
        {
          label: "Units per order",
          value:
            orders > 0
              ? new Decimal(netUnits)
                  .dividedBy(orders)
                  .toDecimalPlaces(2)
                  .toFixed(2)
              : "—",
          detail: "Net units ÷ orders",
        },
        {
          label: "Return rate",
          value:
            unitsSold > 0
              ? formatCell(
                  "percent",
                  new Decimal(unitsReturned).dividedBy(unitsSold),
                  "",
                )
              : "—",
          detail: "Units returned ÷ units sold",
        },
        { label: "Variants sold", value: count(variantsSold.size) },
        {
          label: "Best day",
          value: best ? best.localDate : "—",
          detail: best ? money(best.revenue, input.currencyCode) : undefined,
        },
      ];
    },
    notices: salesNotices(history),
    dataAsOf: input.history.coverage.latestOrderChangeAt,
    methodNotes: SALES_METHOD_NOTES,
  };
}
