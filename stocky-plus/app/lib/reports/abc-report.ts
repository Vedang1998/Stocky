/**
 * The ABC analysis report: the Stocky-parity classification from
 * `app/lib/analytics/abc-parity`, labelled for the page and the export.
 */
import {
  ABC_A_CUMULATIVE_PERCENT,
  ABC_B_CUMULATIVE_PERCENT,
  ABC_WINDOW_DAYS,
  type AbcClass,
  type AbcRow,
  type AbcUnclassifiedReason,
} from "../analytics/abc-parity";
import type { AbcParityRun } from "../analytics/abc-parity.server";
import { ZERO } from "../analytics/money";
import { formatCell } from "./present";
import { diagnosticNotices, NO_ORDERS_NOTICE } from "./sales-reports";
import type { ReportData, ReportNotice, ReportTile } from "./types";
import { buildVariantDirectory, type VariantInfo } from "./variant-directory";

const UNCLASSIFIED_REASONS: Record<AbcUnclassifiedReason, string> = {
  shop_history_short: `Less than ${ABC_WINDOW_DAYS} days of order history`,
  variant_too_new: `Created less than ${ABC_WINDOW_DAYS} days ago`,
  variant_age_unknown: "Creation date unknown",
};

const CLASS_ORDER: readonly AbcClass[] = ["A", "B", "C", "U"];

export type AbcReportRow = {
  info: VariantInfo;
  abc: AbcRow;
};

export function buildAbcReport(run: AbcParityRun): ReportData<AbcReportRow> {
  const directory = buildVariantDirectory(run.catalog);
  const rows: AbcReportRow[] = run.rows.map((abc) => ({
    info: directory(abc.variantGid),
    abc,
  }));

  const notices: ReportNotice[] = [];
  if (run.coverage.historyStartLocalDate == null) {
    notices.push(NO_ORDERS_NOTICE);
  } else if (run.coverage.startsBeforeCoverage) {
    notices.push({
      tone: "warning",
      heading: "Not enough order history to grade your catalog yet",
      body: `ABC grades need ${ABC_WINDOW_DAYS} days of orders. Your order history starts on ${run.coverage.historyStartLocalDate}, so every variant is ungraded (U) for now.`,
    });
  }
  notices.push(...diagnosticNotices(run.salesDiagnostics));
  if (run.revenueOutsideCatalog.greaterThan(0)) {
    notices.push({
      tone: "info",
      heading: "Some revenue came from variants that no longer exist",
      body: `${formatCell("money", run.revenueOutsideCatalog, run.currencyCode)} of net revenue in the period is from deleted variants. It is not graded and is not part of the shares below.`,
    });
  }

  return {
    columns: [
      {
        key: "rank",
        label: "Rank",
        kind: "integer",
        definition: "Position by net revenue among graded variants, highest first. Ties go to the variant with more net units.",
        value: (r) => r.abc.rank,
      },
      {
        key: "grade",
        label: "Grade",
        kind: "text",
        definition: `A: variants that make up the first ${ABC_A_CUMULATIVE_PERCENT}% of revenue. B: the next ${ABC_B_CUMULATIVE_PERCENT - ABC_A_CUMULATIVE_PERCENT}%. C: the rest, including variants with no sales. U: ungraded. The variant that crosses a threshold keeps the higher grade.`,
        value: (r) => r.abc.abcClass,
      },
      { key: "product", label: "Product", kind: "text", value: (r) => r.info.product },
      { key: "variant", label: "Variant", kind: "text", value: (r) => r.info.variant },
      { key: "sku", label: "SKU", kind: "text", value: (r) => r.info.sku },
      { key: "vendor", label: "Vendor", kind: "text", value: (r) => r.info.vendor },
      {
        key: "netUnits",
        label: "Net units",
        kind: "integer",
        definition: "Units ordered and added, minus units refunded, returned or removed by an edit, in the period.",
        value: (r) => r.abc.netUnits,
      },
      {
        key: "revenue",
        label: "Net revenue",
        kind: "money",
        definition: "Net units × the unit price after all discounts. Excludes shipping and duties.",
        value: (r) => r.abc.revenue,
      },
      {
        key: "revenueShare",
        label: "Share of revenue",
        kind: "percent",
        definition: "The variant's net revenue ÷ the net revenue of all graded variants.",
        value: (r) => r.abc.revenueShare,
      },
      {
        key: "cumulativeShare",
        label: "Cumulative share",
        kind: "percent",
        definition: "The combined share of this variant and every variant ranked above it.",
        value: (r) => r.abc.cumulativeShare,
      },
      {
        key: "ungradedReason",
        label: "Why ungraded",
        kind: "text",
        value: (r) =>
          r.abc.unclassifiedReason ? UNCLASSIFIED_REASONS[r.abc.unclassifiedReason] : null,
      },
    ],
    rows,
    rowKey: (row) => row.abc.variantGid,
    defaultSort: { key: "rank", direction: "asc" },
    facets: [
      { key: "grade", label: "Grade", value: (row) => row.abc.abcClass },
      { key: "vendor", label: "Vendor", value: (row) => row.info.vendor },
    ],
    searchKeys: ["product", "variant", "sku", "vendor"],
    summarize: (shown): ReportTile[] =>
      CLASS_ORDER.map((abcClass) => {
        const graded = shown.filter((row) => row.abc.abcClass === abcClass);
        const revenue = graded.reduce((sum, row) => sum.plus(row.abc.revenue), ZERO);
        return {
          label: abcClass === "U" ? "Ungraded (U)" : `Grade ${abcClass}`,
          value: `${formatCell("integer", graded.length, "")} variants`,
          detail: `${formatCell("money", revenue, run.currencyCode)} net revenue`,
        };
      }),
    notices,
    dataAsOf: run.coverage.latestOrderChangeAt,
    methodNotes: [
      `Grades use net revenue over the ${ABC_WINDOW_DAYS} days from ${run.windowStartLocalDate} to ${run.windowEndLocalDate}, in your store's time zone.`,
      `Variants are ranked by net revenue. Grade A covers the first ${ABC_A_CUMULATIVE_PERCENT}% of revenue, B the next ${ABC_B_CUMULATIVE_PERCENT - ABC_A_CUMULATIVE_PERCENT}% and C the rest.`,
      `A variant created less than ${ABC_WINDOW_DAYS} days ago is ungraded (U) because it has not had a full period to sell.`,
      "Test orders, cancelled orders, gift cards and custom items without a variant are left out.",
    ],
  };
}
