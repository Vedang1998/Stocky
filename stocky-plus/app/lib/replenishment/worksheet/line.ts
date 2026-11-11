/**
 * Builds one worksheet row from a variant's facts. Pure: the same facts and
 * run always give the same row, so a stored worksheet can be checked against
 * its inputs.
 */
import { ZERO, type Decimal } from "../../analytics/money";
import type { LocalDate } from "../local-date";
import { rational, toFixed } from "../rational";
import type { EffectiveRule } from "../rules.server";
import {
  computeStockHealth,
  resolveLeadTime,
  type ReorderPointSource,
  type StockStatus,
} from "../stock-health";
import { computeSuggestion } from "../suggestion";
import {
  SALES_BASED_METHODS,
  type HistoryCoverage,
  type IncomingSource,
  type LeadTimeSource,
  type MethodParameters,
  type RoundingOptions,
  type RuleAdjustment,
  type SampleWindow,
  type TraceStep,
  type Warning,
  type WarningCode,
} from "../types";
import type { SupplierLeadTimeSource, SupplierTerms } from "./sources";

const UNITS_PER_DAY_PLACES = 4;

const SUPPLIER_LEAD_TIME_SOURCES: Record<SupplierLeadTimeSource, LeadTimeSource> = {
  variant_override: "SUPPLIER_VARIANT",
  supplier_default: "SUPPLIER_DEFAULT",
  measured: "SUPPLIER_MEASURED",
};

/** Everything about the run that is the same for every row. */
export type LineContext = {
  params: MethodParameters;
  /**
   * The days whose sales the row reports. For a sales method this is the
   * method's own window; for a stock-level method it is the shop's default
   * recent period, used only for the sales rate and days of stock.
   */
  salesWindow: SampleWindow;
  coverage: HistoryCoverage;
  asOf: LocalDate;
  incomingSource: IncomingSource;
  rounding: RoundingOptions;
  shopLeadTimeDays: number | null;
};

export type LineVariant = {
  variantGid: string;
  productGid: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  barcode: string | null;
  vendor: string | null;
  productType: string | null;
  priceAmount: Decimal | null;
  priceCurrencyCode: string | null;
  unitCost: Decimal | null;
  unitCostCurrencyCode: string | null;
  /** Null when Shopify has not reported an inventory item for the variant. */
  tracked: boolean | null;
};

/** Stock at the planning scope. A null quantity has not been synced. */
export type StockPosition = {
  available: number | null;
  onHand: number | null;
  committed: number | null;
  incoming: number | null;
};

export type LineSales = {
  netUnits: number;
  distinctOrders: number;
  revenue: Decimal;
};

export type LineFacts = {
  variant: LineVariant;
  imageUrl: string | null;
  stock: StockPosition;
  /** Units on open purchase orders in this app; null when none are open. */
  appIncoming: number | null;
  /** Null when the variant has no sales in the window. */
  sales: LineSales | null;
  rule: EffectiveRule | null;
  /** The supplier the row would be ordered from. */
  supplier: SupplierTerms | null;
  suppliers: readonly SupplierTerms[];
};

export type WorksheetLineDetail = {
  trace: TraceStep[];
  healthTrace: TraceStep[];
  warnings: Warning[];
  adjustments: RuleAdjustment[];
  lowStockReasons: string[];
  baseNeed: string | null;
  levels: {
    minimumQuantity: number | null;
    shelfLimitQuantity: number | null;
    safetyStockQuantity: number | null;
    reorderPointQuantity: number | null;
  };
  suppliers: Array<{
    supplierId: string;
    supplierName: string;
    vendorSku: string | null;
    moq: number | null;
    packSize: number | null;
    supplierCost: string | null;
    currency: string | null;
    leadTimeDays: number | null;
    isPreferred: boolean;
  }>;
};

export type WorksheetLineRecord = {
  variantGid: string;
  productGid: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  barcode: string | null;
  vendor: string | null;
  productType: string | null;
  imageUrl: string | null;
  priceAmount: Decimal | null;
  priceCurrencyCode: string | null;
  unitCostAmount: Decimal | null;
  unitCostCurrencyCode: string | null;
  supplierCostAmount: string | null;
  supplierCostCurrencyCode: string | null;
  supplierId: string | null;
  supplierName: string | null;
  vendorSku: string | null;
  minimumOrderQuantity: number | null;
  packSize: number | null;
  supplierCount: number;
  tracked: boolean;
  availableQuantity: number | null;
  onHandQuantity: number | null;
  committedQuantity: number | null;
  incomingQuantity: number | null;
  netUnits: number | null;
  distinctOrders: number | null;
  revenueAmount: Decimal | null;
  unitsPerDay: string | null;
  stockStatus: StockStatus;
  daysOfStock: string | null;
  depletionDate: LocalDate | null;
  leadTimeDays: number | null;
  leadTimeSource: LeadTimeSource | null;
  reorderPoint: number | null;
  reorderPointSource: ReorderPointSource | null;
  forecastDemand: string | null;
  parityQuantity: number | null;
  suggestedQuantity: number | null;
  finalQuantity: null;
  orderQuantity: number;
  warningCodes: WarningCode[];
  detail: WorksheetLineDetail;
};

/** Supplier terms store "not set" as null or zero. */
function positiveOrNull(value: number | null): number | null {
  return value != null && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Lead times measured from deliveries can be fractional; plan for the whole day. */
function wholeDays(value: number | null): number | null {
  return value != null && Number.isFinite(value) && value >= 0
    ? Math.ceil(value)
    : null;
}

function incomingFor(facts: LineFacts, source: IncomingSource): number | null {
  switch (source) {
    case "SHOPIFY_INCOMING":
      return facts.stock.incoming;
    case "APP_PURCHASE_ORDERS":
      // A variant on no open purchase order has nothing incoming, which is
      // a known zero rather than a missing number.
      return facts.appIncoming ?? 0;
    case "NONE":
      return null;
  }
}

export function buildWorksheetLine(
  context: LineContext,
  facts: LineFacts,
): WorksheetLineRecord {
  const { variant, stock, rule, supplier } = facts;
  const { salesWindow, coverage } = context;

  const hasHistory = coverage.kind !== "NONE";
  const netUnits = hasHistory ? (facts.sales?.netUnits ?? 0) : null;
  const incoming = incomingFor(facts, context.incomingSource);
  const minimumOrderQuantity = positiveOrNull(supplier?.moq ?? null);
  const packSize = positiveOrNull(supplier?.packSize ?? null);
  // No inventory item yet means stock is unknown, not that it is untracked.
  const tracked = variant.tracked !== false;

  const suggestion = computeSuggestion(
    context.params,
    SALES_BASED_METHODS.has(context.params.method) ? salesWindow : null,
    {
      tracked,
      available: stock.available,
      incoming,
      incomingSource: context.incomingSource,
      netUnitsInWindow: netUnits,
      coverage,
      minimumQuantity: rule?.minimumQuantity ?? null,
      shelfLimitQuantity: rule?.shelfLimitQuantity ?? null,
      minimumOrderQuantity,
      packSize,
    },
    context.rounding,
  );

  const velocity = netUnits == null ? null : rational(netUnits, salesWindow.days);
  const health = computeStockHealth({
    asOf: context.asOf,
    available: tracked ? stock.available : null,
    incoming,
    velocity,
    leadTime: resolveLeadTime([
      { days: rule?.leadTimeDays, source: "VARIANT_RULE" },
      {
        days: wholeDays(supplier?.leadTimeDays ?? null),
        source: supplier?.leadTimeSource
          ? SUPPLIER_LEAD_TIME_SOURCES[supplier.leadTimeSource]
          : "SUPPLIER_DEFAULT",
      },
      { days: context.shopLeadTimeDays, source: "SHOP_DEFAULT" },
    ]),
    safetyStock: rule?.safetyStockQuantity ?? null,
    manualReorderPoint: rule?.reorderPointQuantity ?? null,
    minimumQuantity: rule?.minimumQuantity ?? null,
  });

  // A missing lead time is explained in the row's detail. It is not listed
  // as a row warning, or every row of a new shop would carry one.
  const warnings = [
    ...suggestion.warnings,
    ...health.warnings.filter((warning) => warning.code !== "LEAD_TIME_MISSING"),
  ];

  return {
    variantGid: variant.variantGid,
    productGid: variant.productGid,
    productTitle: variant.productTitle,
    variantTitle: variant.variantTitle,
    sku: variant.sku,
    barcode: variant.barcode,
    vendor: variant.vendor,
    productType: variant.productType,
    imageUrl: facts.imageUrl,
    priceAmount: variant.priceAmount,
    priceCurrencyCode: variant.priceCurrencyCode,
    unitCostAmount: variant.unitCost,
    unitCostCurrencyCode: variant.unitCost ? variant.unitCostCurrencyCode : null,
    supplierCostAmount: supplier?.supplierCost ?? null,
    supplierCostCurrencyCode: supplier?.supplierCost ? supplier.currency : null,
    supplierId: supplier?.supplierId ?? null,
    supplierName: supplier?.supplierName ?? null,
    vendorSku: supplier?.vendorSku ?? null,
    minimumOrderQuantity,
    packSize,
    supplierCount: facts.suppliers.length,
    tracked,
    availableQuantity: stock.available,
    onHandQuantity: stock.onHand,
    committedQuantity: stock.committed,
    incomingQuantity: incoming,
    netUnits,
    distinctOrders: hasHistory ? (facts.sales?.distinctOrders ?? 0) : null,
    revenueAmount: hasHistory ? (facts.sales?.revenue ?? ZERO) : null,
    unitsPerDay: velocity ? toFixed(velocity, UNITS_PER_DAY_PLACES) : null,
    stockStatus: health.status,
    daysOfStock: health.daysOfStock,
    depletionDate: health.depletionDate,
    leadTimeDays: health.leadTime?.days ?? null,
    leadTimeSource: health.leadTime?.source ?? null,
    reorderPoint: health.reorderPoint,
    reorderPointSource: health.reorderPointSource,
    forecastDemand: suggestion.forecastDemand,
    parityQuantity: suggestion.parityQuantity,
    suggestedQuantity: suggestion.suggestedQuantity,
    finalQuantity: null,
    orderQuantity: suggestion.suggestedQuantity ?? 0,
    warningCodes: [...new Set(warnings.map((warning) => warning.code))],
    detail: {
      trace: suggestion.trace,
      healthTrace: health.trace,
      warnings,
      adjustments: suggestion.adjustments,
      lowStockReasons: health.lowStockReasons,
      baseNeed: suggestion.baseNeed,
      levels: {
        minimumQuantity: rule?.minimumQuantity ?? null,
        shelfLimitQuantity: rule?.shelfLimitQuantity ?? null,
        safetyStockQuantity: rule?.safetyStockQuantity ?? null,
        reorderPointQuantity: rule?.reorderPointQuantity ?? null,
      },
      suppliers: facts.suppliers.map((terms) => ({
        supplierId: terms.supplierId,
        supplierName: terms.supplierName,
        vendorSku: terms.vendorSku,
        moq: positiveOrNull(terms.moq),
        packSize: positiveOrNull(terms.packSize),
        supplierCost: terms.supplierCost,
        currency: terms.currency,
        leadTimeDays: wholeDays(terms.leadTimeDays),
        isPreferred: terms.isPreferred,
      })),
    },
  };
}
