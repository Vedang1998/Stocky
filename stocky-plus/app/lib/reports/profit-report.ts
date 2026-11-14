/**
 * Gross profit by variant: net revenue minus what the units sold cost.
 *
 * Shopify keeps one cost per item and no history of it, so the cost here is
 * today's cost applied to every unit in the range. The report says so wherever
 * it shows a figure that depends on it.
 */
import { ZERO, type Decimal } from "../analytics/money";
import {
  aggregateVariantWindow,
  type VariantWindowSales,
} from "../analytics/net-units";
import { countOf, formatCell } from "./present";
import {
  IDENTITY_SEARCH_KEYS,
  NET_REVENUE_DEFINITION,
  NET_UNITS_DEFINITION,
  SALES_METHOD_NOTES,
  VENDOR_FACET,
  identityColumns,
  salesNotices,
  type SalesReportInput,
} from "./sales-reports";
import { unitCostIn } from "./stock-reports";
import type { ReportData, ReportNotice, ReportTile } from "./types";
import type { VariantInfo } from "./variant-directory";

export type ProfitRow = {
  info: VariantInfo;
  sales: VariantWindowSales;
  /** Today's Shopify cost per item in the shop currency; null when there is none. */
  unitCost: Decimal | null;
  cost: Decimal | null;
  /** Null when the cost is unknown or part of the revenue is missing. */
  profit: Decimal | null;
  margin: Decimal | null;
};

const PROFIT_METHOD_NOTES = [
  "Cost is today's cost per item in Shopify, applied to every unit sold in the range. Shopify does not keep past costs, so if a cost changed during or after the range the profit shown is an estimate.",
  "Profit covers the cost of goods only. Shipping, payment fees, duties and other expenses are not subtracted.",
  "If your prices include tax, net revenue includes that tax and so does the profit shown.",
];

function profitOf(sales: VariantWindowSales, cost: Decimal | null) {
  if (cost === null || sales.eventsWithoutRevenue > 0) return null;
  return sales.revenue.minus(cost);
}

function sumKnown(values: Iterable<Decimal | null>): Decimal {
  let total = ZERO;
  for (const value of values) {
    if (value !== null) total = total.plus(value);
  }
  return total;
}

function profitTiles(
  shown: readonly ProfitRow[],
  currencyCode: string,
): ReportTile[] {
  const money = (value: Decimal) => formatCell("money", value, currencyCode);
  const costed = shown.filter((row) => row.profit !== null);
  const costedRevenue = sumKnown(costed.map((row) => row.sales.revenue));
  const profit = sumKnown(costed.map((row) => row.profit));
  const partial =
    costed.length < shown.length
      ? `From ${countOf(costed.length, "variant", "variants")} of ${shown.length}`
      : undefined;

  return [
    {
      label: "Net revenue",
      value: money(sumKnown(shown.map((row) => row.sales.revenue))),
    },
    {
      label: "Estimated cost of goods",
      value: money(sumKnown(shown.map((row) => row.cost))),
    },
    { label: "Estimated gross profit", value: money(profit), detail: partial },
    {
      label: "Margin",
      value: formatCell(
        "percent",
        costedRevenue.greaterThan(0) ? profit.dividedBy(costedRevenue) : null,
        currencyCode,
      ),
      detail: partial,
    },
  ];
}

function missingCostNotice(variants: number): ReportNotice {
  return {
    tone: "warning",
    heading: `${countOf(variants, "variant sold has", "variants sold have")} no cost`,
    body: "Cost and profit are blank for a variant without a cost in your store currency, and it is left out of the profit and margin totals. Add a cost per item in Shopify to include it.",
  };
}

export function buildProfitReport(
  input: SalesReportInput,
): ReportData<ProfitRow> {
  const rows = aggregateVariantWindow(input.history.events).map((sales) => {
    const variant = input.catalog.get(sales.variantGid);
    const unitCost = variant ? unitCostIn(variant, input.currencyCode) : null;
    const cost = unitCost ? unitCost.times(sales.netUnits) : null;
    const profit = profitOf(sales, cost);
    return {
      info: input.directory(sales.variantGid),
      sales,
      unitCost,
      cost,
      profit,
      margin:
        profit !== null && sales.revenue.greaterThan(0)
          ? profit.dividedBy(sales.revenue)
          : null,
    };
  });

  const notices = salesNotices(input.history);
  const uncosted = rows.filter((row) => row.unitCost === null).length;
  if (uncosted > 0) notices.push(missingCostNotice(uncosted));

  return {
    columns: [
      ...identityColumns<ProfitRow>(),
      {
        key: "netUnits",
        label: "Net units",
        kind: "integer",
        definition: NET_UNITS_DEFINITION,
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
        key: "unitCost",
        label: "Cost per item",
        kind: "money",
        definition:
          "Today's cost per item in Shopify. Blank when the variant has no cost, has been deleted, or its cost is in another currency.",
        value: (r) => r.unitCost,
      },
      {
        key: "cost",
        label: "Estimated cost of goods",
        kind: "money",
        definition: "Net units × cost per item.",
        value: (r) => r.cost,
      },
      {
        key: "profit",
        label: "Estimated gross profit",
        kind: "money",
        definition:
          "Net revenue − estimated cost of goods. Blank when the cost is unknown or a sale has no price.",
        value: (r) => r.profit,
      },
      {
        key: "margin",
        label: "Margin",
        kind: "percent",
        definition:
          "Estimated gross profit ÷ net revenue. Blank when net revenue is zero.",
        value: (r) => r.margin,
      },
    ],
    rows,
    rowKey: (row) => row.info.variantGid,
    defaultSort: { key: "profit", direction: "desc" },
    facets: [VENDOR_FACET],
    searchKeys: IDENTITY_SEARCH_KEYS,
    summarize: (shown) => profitTiles(shown, input.currencyCode),
    notices,
    dataAsOf: input.history.coverage.latestOrderChangeAt,
    methodNotes: [...PROFIT_METHOD_NOTES, ...SALES_METHOD_NOTES],
  };
}
