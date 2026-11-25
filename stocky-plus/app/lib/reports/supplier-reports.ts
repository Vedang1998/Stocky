/**
 * Supplier performance: one row per supplier over the purchase orders created
 * in the range.
 *
 * Everything here is derived from the same purchase order facts as the
 * purchase order reports, so a supplier's figures always add up to the rows of
 * those reports.
 */
import { Decimal, ZERO } from "../analytics/money";
import type { PurchaseOrderFact } from "../analytics/purchase-orders.server";
import {
  compareLocalDates,
  diffLocalDays,
  localDateOf,
} from "../analytics/shop-calendar";
import { toShopCurrency } from "../purchasing/totals";
import { countOf, formatCell } from "./present";
import {
  expectedDate,
  isOverdue,
  type PurchaseOrderReportInput,
} from "./purchase-order-reports";
import type { ReportData, ReportNotice } from "./types";

const NOT_COMMITTED = new Set(["DRAFT", "CANCELLED"]);

export type SupplierRow = {
  supplierId: string;
  supplierName: string;
  orders: number;
  unitsOrdered: number;
  unitsReceived: number;
  fillRate: Decimal | null;
  /** Null when any of the supplier's orders cannot be converted. */
  spend: Decimal | null;
  receivedOrders: number;
  /** Whole days, rounded half up; null when no order has been fully received. */
  averageDaysToReceive: number | null;
  onTimeRate: Decimal | null;
  overdueOrders: number;
};

function ratio(part: number, whole: number): Decimal | null {
  return whole === 0 ? null : new Decimal(part).dividedBy(whole);
}

function summarizeSupplier(
  orders: readonly PurchaseOrderFact[],
  input: PurchaseOrderReportInput,
): SupplierRow {
  const committed = orders.filter((o) => !NOT_COMMITTED.has(o.status));
  const unitsOrdered = committed.reduce((t, o) => t + o.orderedUnits, 0);
  const unitsReceived = committed.reduce((t, o) => t + o.receivedUnits, 0);

  let spend: Decimal | null = ZERO;
  for (const order of committed) {
    const amount = toShopCurrency(
      order.totalAmount,
      order.exchangeRate,
      order.currency === input.currencyCode,
    );
    spend = spend && amount ? spend.plus(amount) : null;
  }

  const received = committed.filter((o) => o.fullyReceivedAt !== null);
  const days = received.map((o) =>
    Math.max(
      0,
      diffLocalDays(
        localDateOf(o.createdAt, input.timeZone),
        localDateOf(o.fullyReceivedAt!, input.timeZone),
      ),
    ),
  );
  const promised = received.filter((o) => expectedDate(o) !== null);
  const onTime = promised.filter(
    (o) =>
      compareLocalDates(
        localDateOf(o.fullyReceivedAt!, input.timeZone),
        expectedDate(o)!,
      ) <= 0,
  );

  return {
    supplierId: orders[0]!.supplierId,
    supplierName: orders[0]!.supplierName,
    orders: committed.length,
    unitsOrdered,
    unitsReceived,
    fillRate: ratio(unitsReceived, unitsOrdered),
    spend,
    receivedOrders: received.length,
    averageDaysToReceive:
      days.length === 0
        ? null
        : new Decimal(days.reduce((t, d) => t + d, 0))
            .dividedBy(days.length)
            .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
            .toNumber(),
    onTimeRate: ratio(onTime.length, promised.length),
    overdueOrders: committed.filter((o) => isOverdue(o, input.today)).length,
  };
}

export function buildSuppliersReport(
  input: PurchaseOrderReportInput,
): ReportData<SupplierRow> {
  const bySupplier = new Map<string, PurchaseOrderFact[]>();
  for (const order of input.orders) {
    const list = bySupplier.get(order.supplierId) ?? [];
    list.push(order);
    bySupplier.set(order.supplierId, list);
  }
  const rows = [...bySupplier.values()]
    .map((orders) => summarizeSupplier(orders, input))
    .filter((row) => row.orders > 0);

  const blank = rows.filter((row) => row.spend === null);
  const notices: ReportNotice[] =
    blank.length === 0
      ? []
      : [
          {
            tone: "warning",
            heading: "Some spend is blank",
            body: `${countOf(blank.length, "supplier has", "suppliers have")} a purchase order in a currency other than ${input.currencyCode} with no exchange rate, so spend cannot be shown for ${blank.length === 1 ? "it" : "them"}. Add the rate on the purchase order to include it.`,
          },
        ];

  return {
    columns: [
      {
        key: "supplier",
        label: "Supplier",
        kind: "text",
        value: (r) => r.supplierName,
      },
      {
        key: "orders",
        label: "Purchase orders",
        kind: "integer",
        definition:
          "Orders created in the range that are not drafts or cancelled.",
        value: (r) => r.orders,
      },
      {
        key: "unitsOrdered",
        label: "Units ordered",
        kind: "integer",
        definition: "Units ordered less units cancelled.",
        value: (r) => r.unitsOrdered,
      },
      {
        key: "unitsReceived",
        label: "Units received",
        kind: "integer",
        value: (r) => r.unitsReceived,
      },
      {
        key: "fillRate",
        label: "Fill rate",
        kind: "percent",
        definition:
          "Units received ÷ units ordered (less cancelled), on the same orders. Blank when nothing was ordered.",
        value: (r) => r.fillRate,
      },
      {
        key: "spend",
        label: "Spend",
        kind: "money",
        definition:
          "Order totals (merchandise, tax and charges) in your store currency. Blank when one of the supplier's orders is in another currency with no exchange rate.",
        value: (r) => r.spend,
      },
      {
        key: "receivedOrders",
        label: "Fully received",
        kind: "integer",
        value: (r) => r.receivedOrders,
      },
      {
        key: "daysToReceive",
        label: "Days to receive",
        kind: "integer",
        definition:
          "Average whole days from the day an order was created to the day it was fully received, in your store's time zone, over fully received orders. Blank when none has been.",
        value: (r) => r.averageDaysToReceive,
      },
      {
        key: "onTime",
        label: "On time",
        kind: "percent",
        definition:
          "Share of fully received orders with an expected date that were fully received on or before it. Blank when none qualifies.",
        value: (r) => r.onTimeRate,
      },
      {
        key: "overdue",
        label: "Overdue now",
        kind: "integer",
        definition:
          "Orders that are sent, ordered or partly received, not archived, and expected before today.",
        value: (r) => r.overdueOrders,
      },
    ],
    rows,
    rowKey: (row) => row.supplierId,
    defaultSort: { key: "spend", direction: "desc" },
    facets: [],
    searchKeys: ["supplier"],
    summarize: (shown) => {
      const spend = shown.reduce(
        (t, r) => (r.spend ? t.plus(r.spend) : t),
        ZERO,
      );
      const ordered = shown.reduce((t, r) => t + r.unitsOrdered, 0);
      const received = shown.reduce((t, r) => t + r.unitsReceived, 0);
      const missing = shown.filter((r) => r.spend === null).length;
      return [
        { label: "Suppliers", value: formatCell("integer", shown.length, "") },
        {
          label: "Spend",
          value: formatCell("money", spend, input.currencyCode),
          detail:
            missing === 0
              ? undefined
              : `Without ${countOf(missing, "supplier", "suppliers")} that cannot be converted`,
        },
        {
          label: "Fill rate",
          value: formatCell("percent", ratio(received, ordered), ""),
        },
        {
          label: "Overdue now",
          value: formatCell(
            "integer",
            shown.reduce((t, r) => t + r.overdueOrders, 0),
            "",
          ),
        },
      ];
    },
    notices,
    dataAsOf: "live",
    methodNotes: [
      "A supplier is listed when it has at least one purchase order created in the range that is not a draft or cancelled.",
      "Figures come from purchase orders created in the range, so units received are those received so far on those orders, not receipts made in the range.",
      "Amounts are in your store's currency, converted at the exchange rate saved on each order.",
    ],
  };
}
