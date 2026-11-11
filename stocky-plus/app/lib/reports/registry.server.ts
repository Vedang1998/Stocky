/**
 * The reports the app offers and the one way to run them. Routes never call a
 * report builder directly: they resolve a report here, so the page and its CSV
 * export always come from the same computation.
 */
import { readShopReportingProfile } from "../../tenant/bootstrap.server";
import type { TenantAuthority } from "../../tenant/authority.server";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { loadAbcParityRun } from "../analytics/abc-parity.server";
import { loadCatalogVariants } from "../analytics/catalog.server";
import { requireShopCurrency } from "../analytics/errors";
import {
  loadSalesCoverage,
  loadSalesHistory,
} from "../analytics/sales-history.server";
import {
  addLocalDays,
  localDateOf,
  requireShopTimeZone,
} from "../analytics/shop-calendar";
import {
  loadLastOrderedAt,
  loadStockLevels,
  loadStockLocations,
} from "../analytics/stock-levels.server";
import { buildAbcReport } from "./abc-report";
import {
  parseReportRequest,
  parseReportView,
  type ReportViewRequest,
} from "./params";
import {
  REPORT_EXPORT_ROW_LIMIT,
  exportTable,
  facetChoices,
  formatShopInstant,
  tablePage,
  type FacetChoices,
  type ReportExport,
  type ReportTablePage,
} from "./present";
import {
  SELLER_VIEWS,
  buildOrdersReport,
  buildProductSalesReport,
  buildSaleItemsReport,
  buildSellersReport,
  buildStatisticsReport,
  buildVariantSalesReport,
  type SalesReportInput,
} from "./sales-reports";
import {
  DEAD_STOCK_WINDOWS,
  DEFAULT_DEAD_STOCK_DAYS,
  STOCK_FILTERS,
  buildDeadStockReport,
  buildStockOnHandReport,
  stockedVariants,
} from "./stock-reports";
import type {
  ColumnKind,
  ReportContext,
  ReportDefinition,
  ReportGroup,
  ReportNotice,
  ReportOption,
  ReportRequest,
} from "./types";
import { buildVariantDirectory } from "./variant-directory";

/**
 * Resolve what every report needs to know about the shop. Throws
 * `AnalyticsPrerequisiteError` until the shop's time zone and currency have
 * been synced; a report never falls back to UTC or a guessed currency.
 */
export async function loadReportContext(input: {
  tenant: TenantAuthority;
  db: TenantDb;
  now?: Date;
}): Promise<ReportContext> {
  const profile = await readShopReportingProfile(input.tenant);
  const timeZone = requireShopTimeZone(profile.ianaTimezone);
  const currencyCode = requireShopCurrency(profile.currencyCode);
  const now = input.now ?? new Date();
  return {
    db: input.db,
    timeZone,
    currencyCode,
    installedAt: profile.installedAt,
    today: localDateOf(now, timeZone),
    now,
  };
}

async function loadSales(
  context: ReportContext,
  request: ReportRequest,
  catalogScope: "sold" | "all",
): Promise<SalesReportInput> {
  const history = await loadSalesHistory(context.db, {
    startLocalDate: request.range.startLocalDate,
    endLocalDate: request.range.endLocalDate,
    timeZone: context.timeZone,
    reportCurrency: context.currencyCode,
    installedAt: context.installedAt,
  });
  const variants = await loadCatalogVariants(context.db, {
    timeZone: context.timeZone,
    variantGids:
      catalogScope === "sold"
        ? [...new Set(history.events.map((event) => event.variantGid))]
        : undefined,
  });
  const catalog = new Map(
    variants.map((variant) => [variant.variantGid, variant]),
  );
  return {
    history,
    catalog,
    directory: buildVariantDirectory(catalog, history),
    currencyCode: context.currencyCode,
  };
}

const SELLER_VIEW_OPTION: ReportOption = {
  key: "view",
  label: "Show",
  choices: SELLER_VIEWS,
  defaultValue: "best",
};

const STOCK_FILTER_OPTION: ReportOption = {
  key: "stock",
  label: "Show",
  choices: STOCK_FILTERS,
  defaultValue: "stocked",
};

const DEAD_STOCK_OPTION: ReportOption = {
  key: "days",
  label: "No orders for",
  choices: DEAD_STOCK_WINDOWS.map((days) => ({
    value: String(days),
    label: `${days} days`,
  })),
  defaultValue: String(DEFAULT_DEAD_STOCK_DAYS),
};

export type ReportSummary = {
  id: string;
  title: string;
  description: string;
  group: ReportGroup;
  usesDateRange: boolean;
  options: readonly ReportOption[];
};

/** Everything the report page renders. Plain data: safe to return from a loader. */
export type ReportPage = {
  report: ReportSummary;
  request: ReportRequest;
  view: ReportViewRequest;
  problems: string[];
  columns: Array<{
    key: string;
    label: string;
    kind: ColumnKind;
    definition: string | null;
  }>;
  facets: Array<{
    key: string;
    label: string;
    choices: FacetChoices;
    selected: string;
  }>;
  table: ReportTablePage;
  /** Labels of the columns the free-text search reads; empty when there is none. */
  searchLabels: string[];
  notices: ReportNotice[];
  methodNotes: string[];
  /** The most recent Shopify change the figures reflect, in the shop's time zone. */
  dataAsOf: string | null;
  timeZone: string;
  exportRowLimit: number;
};

export type RegisteredReport = ReportSummary & {
  page: (
    context: ReportContext,
    searchParams: URLSearchParams,
  ) => Promise<ReportPage>;
  export: (
    context: ReportContext,
    searchParams: URLSearchParams,
  ) => Promise<ReportExport & { request: ReportRequest }>;
};

function register<Row>(definition: ReportDefinition<Row>): RegisteredReport {
  const { load, ...report } = definition;

  async function run(context: ReportContext, searchParams: URLSearchParams) {
    const parsed = parseReportRequest({
      searchParams,
      usesDateRange: report.usesDateRange,
      options: report.options,
      today: context.today,
    });
    const data = await load(context, parsed.request);
    const view = parseReportView(
      searchParams,
      data.facets.map((facet) => facet.key),
    );
    return { parsed, data, view };
  }

  return {
    ...report,
    async page(context, searchParams) {
      const { parsed, data, view } = await run(context, searchParams);
      const table = tablePage(data, view, context.currencyCode);
      return {
        report,
        request: parsed.request,
        view: { ...view, page: table.page },
        problems: parsed.problems,
        columns: data.columns.map((column) => ({
          key: column.key,
          label: column.label,
          kind: column.kind,
          definition: column.definition ?? null,
        })),
        facets: data.facets.map((facet) => ({
          key: facet.key,
          label: facet.label,
          choices: facetChoices(facet, data.rows),
          selected: view.facets[facet.key] ?? "",
        })),
        table,
        searchLabels: data.columns
          .filter((column) => data.searchKeys.includes(column.key))
          .map((column) => column.label),
        notices: data.notices,
        methodNotes: data.methodNotes,
        dataAsOf: data.dataAsOf
          ? formatShopInstant(data.dataAsOf, context.timeZone)
          : null,
        timeZone: context.timeZone,
        exportRowLimit: REPORT_EXPORT_ROW_LIMIT,
      };
    },
    async export(context, searchParams) {
      const { parsed, data, view } = await run(context, searchParams);
      return {
        ...exportTable(data, view, context.currencyCode),
        request: parsed.request,
      };
    },
  };
}

const REPORTS: readonly RegisteredReport[] = [
  register({
    id: "best-sellers",
    title: "Best and worst sellers",
    description:
      "Variants ranked by net revenue and units, including active variants that sold nothing.",
    group: "Sales",
    usesDateRange: true,
    options: [SELLER_VIEW_OPTION],
    load: async (context, request) => {
      const view = request.options[SELLER_VIEW_OPTION.key];
      return buildSellersReport(
        await loadSales(context, request, view === "worst" ? "all" : "sold"),
        view,
      );
    },
  }),
  register({
    id: "sales-by-variant",
    title: "Sales by variant",
    description:
      "Units ordered, added and returned, net units, revenue and average price for each variant.",
    group: "Sales",
    usesDateRange: true,
    options: [],
    load: async (context, request) =>
      buildVariantSalesReport(await loadSales(context, request, "sold")),
  }),
  register({
    id: "sales-by-product",
    title: "Sales by product",
    description:
      "Net units and revenue for each product, across all of its variants.",
    group: "Sales",
    usesDateRange: true,
    options: [],
    load: async (context, request) =>
      buildProductSalesReport(await loadSales(context, request, "sold")),
  }),
  register({
    id: "sale-items",
    title: "Sale items",
    description: "Every sale, refund and order edit, line by line.",
    group: "Sales",
    usesDateRange: true,
    options: [],
    load: async (context, request) =>
      buildSaleItemsReport(await loadSales(context, request, "sold")),
  }),
  register({
    id: "orders",
    title: "Orders",
    description: "Units and net product revenue for each order.",
    group: "Sales",
    usesDateRange: true,
    options: [],
    load: async (context, request) =>
      buildOrdersReport(await loadSales(context, request, "sold")),
  }),
  register({
    id: "sales-statistics",
    title: "Sales statistics",
    description:
      "Day-by-day orders, units, revenue, average order value and return rate.",
    group: "Sales",
    usesDateRange: true,
    options: [],
    load: async (context, request) =>
      buildStatisticsReport(await loadSales(context, request, "sold")),
  }),
  register({
    id: "abc-analysis",
    title: "ABC analysis",
    description:
      "Grades every variant A, B or C by its share of revenue over the last 56 days.",
    group: "Inventory",
    usesDateRange: false,
    options: [],
    load: async (context) =>
      buildAbcReport(
        await loadAbcParityRun(context.db, {
          timeZone: context.timeZone,
          currencyCode: context.currencyCode,
          installedAt: context.installedAt,
          now: context.now,
        }),
      ),
  }),
  register({
    id: "stock-on-hand",
    title: "Stock on hand",
    description:
      "Current quantities at each location with their cost and retail value.",
    group: "Inventory",
    usesDateRange: false,
    options: [STOCK_FILTER_OPTION],
    load: async (context, request) => {
      const [catalog, levels, locations] = await Promise.all([
        loadCatalogVariants(context.db, { timeZone: context.timeZone }),
        loadStockLevels(context.db),
        loadStockLocations(context.db),
      ]);
      return buildStockOnHandReport({
        catalog,
        levels,
        locations,
        currencyCode: context.currencyCode,
        filter: request.options[STOCK_FILTER_OPTION.key],
      });
    },
  }),
  register({
    id: "dead-stock",
    title: "Dead stock",
    description:
      "Variants with units on hand that have not been ordered for a while, and the money tied up in them.",
    group: "Inventory",
    usesDateRange: false,
    options: [DEAD_STOCK_OPTION],
    load: async (context, request) => {
      const days = Number(request.options[DEAD_STOCK_OPTION.key]);
      const [catalog, levels, coverage] = await Promise.all([
        loadCatalogVariants(context.db, { timeZone: context.timeZone }),
        loadStockLevels(context.db),
        loadSalesCoverage(
          context.db,
          context.timeZone,
          addLocalDays(context.today, -days),
          context.installedAt,
        ),
      ]);
      const lastOrderedAt = await loadLastOrderedAt(context.db, [
        ...stockedVariants(catalog, levels).keys(),
      ]);
      return buildDeadStockReport({
        catalog,
        levels,
        lastOrderedAt,
        coverage,
        timeZone: context.timeZone,
        currencyCode: context.currencyCode,
        today: context.today,
        days,
      });
    },
  }),
];

export const REPORT_GROUPS: readonly ReportGroup[] = ["Sales", "Inventory"];

export function listReports(): readonly RegisteredReport[] {
  return REPORTS;
}

export function findReport(id: string | undefined): RegisteredReport | null {
  return REPORTS.find((report) => report.id === id) ?? null;
}
