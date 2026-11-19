/**
 * Reports over purchase orders: one row per order, and one row per order line.
 *
 * Money is shown in the shop's currency. An order placed in another currency
 * is converted with the exchange rate frozen on that order; an order with no
 * rate cannot be converted, so its amounts are left blank and counted in a
 * notice instead of being guessed.
 */
import { Decimal, ZERO } from "../analytics/money";
import type {
  PurchaseOrderFact,
  PurchaseOrderLineFact,
} from "../analytics/purchase-orders.server";
import { localDateOf, type LocalDate } from "../analytics/shop-calendar";
import { STATUS_LABELS } from "../purchasing/status";
import { toShopCurrency } from "../purchasing/totals";
import { countOf, formatCell } from "./present";
import { IDENTITY_SEARCH_KEYS, identityColumns } from "./sales-reports";
import type { ReportData, ReportNotice } from "./types";
import type { VariantDirectory, VariantInfo } from "./variant-directory";

/** Orders that are still waiting on a delivery. */
const INCOMING = new Set(["SENT", "ORDERED", "PARTIAL"]);
/** Orders that are not commitments: nothing is owed on them. */
const NOT_COMMITTED = new Set(["DRAFT", "CANCELLED"]);

export type PurchaseOrderReportInput = {
  orders: readonly PurchaseOrderFact[];
  timeZone: string;
  currencyCode: string;
  /** Shop-local date of the request, to decide what is overdue. */
  today: LocalDate;
};

function count(value: number): string {
  return formatCell("integer", value, "");
}

function sumOf<Row>(rows: readonly Row[], value: (row: Row) => number): number {
  return rows.reduce((total, row) => total + value(row), 0);
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status;
}

/** The amount in shop currency, or null when the order has no rate to convert it. */
function inShopCurrency(
  amount: Decimal,
  order: Pick<PurchaseOrderFact, "currency" | "exchangeRate">,
  shopCurrency: string,
): Decimal | null {
  return toShopCurrency(
    amount,
    order.exchangeRate,
    order.currency === shopCurrency,
  );
}

function isOverdue(
  order: Pick<PurchaseOrderFact, "status" | "archived" | "expectedOn">,
  today: LocalDate,
): boolean {
  return (
    !order.archived &&
    INCOMING.has(order.status) &&
    order.expectedOn !== null &&
    order.expectedOn.toISOString().slice(0, 10) < today
  );
}

function expectedDate(order: Pick<PurchaseOrderFact, "expectedOn">) {
  return order.expectedOn
    ? (order.expectedOn.toISOString().slice(0, 10) as LocalDate)
    : null;
}

function unconvertibleNotice(
  orders: readonly PurchaseOrderFact[],
  shopCurrency: string,
): ReportNotice[] {
  const unconvertible = orders.filter(
    (order) => order.currency !== shopCurrency && order.exchangeRate === null,
  );
  if (unconvertible.length === 0) return [];
  return [
    {
      tone: "warning",
      heading: "Some amounts are blank",
      body: `${countOf(unconvertible.length, "purchase order is", "purchase orders are")} in a currency other than ${shopCurrency} and ${unconvertible.length === 1 ? "has" : "have"} no exchange rate, so ${unconvertible.length === 1 ? "its" : "their"} amounts cannot be shown in ${shopCurrency}.`,
    },
  ];
}

const SHARED_METHOD_NOTES = [
  "A purchase order is listed by the day it was created, in your store's time zone.",
  "Amounts are in your store's currency. An order in another currency is converted at the exchange rate saved on that order.",
  "Drafts and cancelled orders are listed but are not counted in the value ordered.",
];

const OVERDUE_DEFINITION =
  "Yes for an order that is sent, ordered or partly received, not archived, and expected before today.";

// --- Purchase orders ---------------------------------------------------------

export type PurchaseOrderRow = {
  order: PurchaseOrderFact;
  status: string;
  createdDate: LocalDate;
  expectedDate: LocalDate | null;
  overdue: boolean;
  receivedDate: LocalDate | null;
  /** Null when the order cannot be converted to the shop currency. */
  merchandise: Decimal | null;
  total: Decimal | null;
};

export function buildPurchaseOrdersReport(
  input: PurchaseOrderReportInput,
): ReportData<PurchaseOrderRow> {
  const rows = input.orders.map((order): PurchaseOrderRow => ({
    order,
    status: statusLabel(order.status),
    createdDate: localDateOf(order.createdAt, input.timeZone),
    expectedDate: expectedDate(order),
    overdue: isOverdue(order, input.today),
    receivedDate: order.fullyReceivedAt
      ? localDateOf(order.fullyReceivedAt, input.timeZone)
      : null,
    merchandise: inShopCurrency(
      order.merchandiseAmount,
      order,
      input.currencyCode,
    ),
    total: inShopCurrency(order.totalAmount, order, input.currencyCode),
  }));

  return {
    columns: [
      {
        key: "created",
        label: "Created",
        kind: "date",
        value: (r) => r.createdDate,
      },
      {
        key: "po",
        label: "Purchase order",
        kind: "text",
        value: (r) => r.order.poNumber,
      },
      {
        key: "supplier",
        label: "Supplier",
        kind: "text",
        value: (r) => r.order.supplierName,
      },
      { key: "status", label: "Status", kind: "text", value: (r) => r.status },
      {
        key: "expected",
        label: "Expected",
        kind: "date",
        value: (r) => r.expectedDate,
      },
      {
        key: "overdue",
        label: "Overdue",
        kind: "text",
        definition: OVERDUE_DEFINITION,
        value: (r) => (r.overdue ? "Yes" : "No"),
      },
      {
        key: "received",
        label: "Fully received on",
        kind: "date",
        value: (r) => r.receivedDate,
      },
      {
        key: "ordered",
        label: "Units ordered",
        kind: "integer",
        definition: "Units ordered less units cancelled.",
        value: (r) => r.order.orderedUnits,
      },
      {
        key: "receivedUnits",
        label: "Units received",
        kind: "integer",
        value: (r) => r.order.receivedUnits,
      },
      {
        key: "remaining",
        label: "Units outstanding",
        kind: "integer",
        definition: "Units ordered, less cancelled, less received.",
        value: (r) => r.order.remainingUnits,
      },
      {
        key: "merchandise",
        label: "Merchandise",
        kind: "money",
        definition:
          "Line amounts after line discounts, before tax and order charges.",
        value: (r) => r.merchandise,
      },
      {
        key: "total",
        label: "Order total",
        kind: "money",
        definition:
          "Merchandise plus tax plus shipping, duties and other order charges, less order discounts: the total on the purchase order.",
        value: (r) => r.total,
      },
    ],
    rows,
    rowKey: (row) => row.order.id,
    defaultSort: { key: "created", direction: "desc" },
    facets: [
      { key: "status", label: "Status", value: (row) => row.status },
      {
        key: "supplier",
        label: "Supplier",
        value: (row) => row.order.supplierName,
      },
      {
        key: "overdue",
        label: "Overdue",
        value: (row) => (row.overdue ? "Yes" : "No"),
      },
    ],
    searchKeys: ["po", "supplier"],
    summarize: (shown) => {
      const committed = shown.filter((r) => !NOT_COMMITTED.has(r.order.status));
      const convertible = committed.filter((r) => r.total !== null);
      const value = convertible.reduce((t, r) => t.plus(r.total!), ZERO);
      return [
        { label: "Purchase orders", value: count(shown.length) },
        {
          label: "Units ordered",
          value: count(sumOf(committed, (r) => r.order.orderedUnits)),
        },
        {
          label: "Units outstanding",
          value: count(
            sumOf(
              committed.filter((r) => !r.order.archived),
              (r) => r.order.remainingUnits,
            ),
          ),
        },
        {
          label: "Value ordered",
          value: formatCell("money", value, input.currencyCode),
          detail:
            convertible.length === committed.length
              ? undefined
              : `From ${convertible.length} of ${committed.length} orders`,
        },
        {
          label: "Overdue",
          value: count(shown.filter((r) => r.overdue).length),
        },
      ];
    },
    notices: unconvertibleNotice(input.orders, input.currencyCode),
    dataAsOf: "live",
    methodNotes: [
      ...SHARED_METHOD_NOTES,
      "Units outstanding count orders that are not archived and not cancelled. Cancelled quantities are never outstanding.",
    ],
  };
}

// --- Purchase order items ----------------------------------------------------

export type PurchaseOrderItemRow = {
  order: PurchaseOrderFact;
  line: PurchaseOrderLineFact;
  info: VariantInfo;
  status: string;
  createdDate: LocalDate;
  expectedDate: LocalDate | null;
  overdue: boolean;
  unitCost: Decimal | null;
  landedUnitCost: Decimal | null;
  netAmount: Decimal | null;
};

export type PurchaseOrderItemsInput = PurchaseOrderReportInput & {
  directory: VariantDirectory;
};

/** Today's catalog name, or what the line called the item when it was added. */
function lineInfo(
  line: PurchaseOrderLineFact,
  directory: VariantDirectory,
): VariantInfo {
  const known = directory(line.variantGid);
  if (known.inCatalog || !line.productTitle) return known;
  const variant = line.variantTitle;
  return {
    ...known,
    product: line.productTitle,
    variant: !variant || variant === "Default Title" ? "" : variant,
    sku: line.sku,
  };
}

export function buildPurchaseOrderItemsReport(
  input: PurchaseOrderItemsInput,
): ReportData<PurchaseOrderItemRow> {
  const rows = input.orders.flatMap((order) =>
    order.lines.map((line): PurchaseOrderItemRow => ({
      order,
      line,
      info: lineInfo(line, input.directory),
      status: statusLabel(order.status),
      createdDate: localDateOf(order.createdAt, input.timeZone),
      expectedDate: expectedDate(order),
      overdue: isOverdue(order, input.today),
      unitCost: inShopCurrency(line.unitCost, order, input.currencyCode),
      landedUnitCost: inShopCurrency(
        line.landedUnitCost,
        order,
        input.currencyCode,
      ),
      netAmount: inShopCurrency(line.netAmount, order, input.currencyCode),
    })),
  );

  return {
    columns: [
      {
        key: "created",
        label: "Created",
        kind: "date",
        value: (r) => r.createdDate,
      },
      {
        key: "po",
        label: "Purchase order",
        kind: "text",
        value: (r) => r.order.poNumber,
      },
      {
        key: "supplier",
        label: "Supplier",
        kind: "text",
        value: (r) => r.order.supplierName,
      },
      { key: "status", label: "Status", kind: "text", value: (r) => r.status },
      ...identityColumns<PurchaseOrderItemRow>(),
      {
        key: "expected",
        label: "Expected",
        kind: "date",
        value: (r) => r.expectedDate,
      },
      {
        key: "overdue",
        label: "Overdue",
        kind: "text",
        definition: OVERDUE_DEFINITION,
        value: (r) => (r.overdue ? "Yes" : "No"),
      },
      {
        key: "ordered",
        label: "Ordered",
        kind: "integer",
        definition: "Units ordered on the line, less units cancelled.",
        value: (r) => Math.max(0, r.line.orderedQty - r.line.cancelledQty),
      },
      {
        key: "cancelled",
        label: "Cancelled",
        kind: "integer",
        value: (r) => r.line.cancelledQty,
      },
      {
        key: "receivedUnits",
        label: "Received",
        kind: "integer",
        value: (r) => r.line.receivedQty,
      },
      {
        key: "remaining",
        label: "Outstanding",
        kind: "integer",
        definition: "Units ordered, less cancelled, less received.",
        value: (r) => r.line.remainingQty,
      },
      {
        key: "unitCost",
        label: "Unit cost",
        kind: "money",
        definition: "The cost per unit on the line, before discounts and tax.",
        value: (r) => r.unitCost,
      },
      {
        key: "landedUnitCost",
        label: "Landed unit cost",
        kind: "money",
        definition:
          "Unit cost after the line discount, plus the line's share of the allocated order charges. Tax is not included.",
        value: (r) => r.landedUnitCost,
      },
      {
        key: "netAmount",
        label: "Line amount",
        kind: "money",
        definition:
          "Units ordered, less cancelled, times unit cost, after the line discount and before tax.",
        value: (r) => r.netAmount,
      },
    ],
    rows,
    rowKey: (row) => row.line.lineId,
    defaultSort: { key: "created", direction: "desc" },
    facets: [
      { key: "status", label: "Status", value: (row) => row.status },
      {
        key: "supplier",
        label: "Supplier",
        value: (row) => row.order.supplierName,
      },
      {
        key: "overdue",
        label: "Overdue",
        value: (row) => (row.overdue ? "Yes" : "No"),
      },
    ],
    searchKeys: ["po", "supplier", ...IDENTITY_SEARCH_KEYS],
    summarize: (shown) => {
      const committed = shown.filter((r) => !NOT_COMMITTED.has(r.order.status));
      const convertible = committed.filter((r) => r.netAmount !== null);
      const value = convertible.reduce((t, r) => t.plus(r.netAmount!), ZERO);
      return [
        {
          label: "Purchase orders",
          value: count(new Set(shown.map((r) => r.order.id)).size),
        },
        { label: "Lines", value: count(shown.length) },
        {
          label: "Units ordered",
          value: count(
            sumOf(committed, (r) =>
              Math.max(0, r.line.orderedQty - r.line.cancelledQty),
            ),
          ),
        },
        {
          label: "Units outstanding",
          value: count(
            sumOf(
              committed.filter((r) => !r.order.archived),
              (r) => r.line.remainingQty,
            ),
          ),
        },
        {
          label: "Line value ordered",
          value: formatCell("money", value, input.currencyCode),
          detail:
            convertible.length === committed.length
              ? undefined
              : `From ${convertible.length} of ${committed.length} lines`,
        },
      ];
    },
    notices: unconvertibleNotice(input.orders, input.currencyCode),
    dataAsOf: "live",
    methodNotes: [
      ...SHARED_METHOD_NOTES,
      "Line amounts are before tax and do not include order charges; the order total on the Purchase orders report does.",
      "An item's name is today's name in Shopify. An item that has since been deleted keeps the name it had when it was added to the order.",
    ],
  };
}
