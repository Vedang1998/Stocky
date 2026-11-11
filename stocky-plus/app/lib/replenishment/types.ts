import type { LocalDate } from "./local-date";

/**
 * Stocky Parity forecast methods (PRD §3.4). These are the only methods the
 * parity engine runs; Smart Forecast models live elsewhere and never replace
 * a parity result.
 */
export const PARITY_METHODS = [
  "LAST_X_DAYS",
  "CUSTOM_RANGE",
  "SAME_PERIOD_LAST_YEAR",
  "FILL_SHELVES",
  "FILL_SHELVES_IF_BELOW_MIN",
  "TARGET_STOCK_LEVEL",
] as const;

export type ParityMethod = (typeof PARITY_METHODS)[number];

export const SALES_BASED_METHODS: ReadonlySet<ParityMethod> = new Set([
  "LAST_X_DAYS",
  "CUSTOM_RANGE",
  "SAME_PERIOD_LAST_YEAR",
]);

export const PARITY_METHOD_LABELS: Record<ParityMethod, string> = {
  LAST_X_DAYS: "Last X days",
  CUSTOM_RANGE: "Custom date range",
  SAME_PERIOD_LAST_YEAR: "Same period last year",
  FILL_SHELVES: "Fill shelves",
  FILL_SHELVES_IF_BELOW_MIN: "Fill shelves if below minimum",
  TARGET_STOCK_LEVEL: "Target stock level",
};

/** Bounds on merchant-entered day counts. Wide enough for any real plan. */
export const MIN_DAYS = 1;
export const MAX_SAMPLE_DAYS = 730;
export const MAX_SUGGEST_DAYS = 365;
export const MAX_QUANTITY = 10_000_000;

export type MethodParameters =
  | { method: "LAST_X_DAYS"; sampleDays: number; suggestDays: number }
  | {
      method: "CUSTOM_RANGE";
      startDate: LocalDate;
      endDate: LocalDate;
      suggestDays: number;
    }
  | { method: "SAME_PERIOD_LAST_YEAR"; suggestDays: number }
  | { method: "FILL_SHELVES" }
  | { method: "FILL_SHELVES_IF_BELOW_MIN" }
  | { method: "TARGET_STOCK_LEVEL"; targetQuantity: number };

/**
 * Optional supplier rules. Both default off: the app never rounds to a pack
 * or raises to a minimum order unless the merchant asks for it on this run.
 */
export type RoundingOptions = {
  applyMinimumOrderQuantity: boolean;
  roundUpToPackSize: boolean;
};

export const NO_ROUNDING: RoundingOptions = {
  applyMinimumOrderQuantity: false,
  roundUpToPackSize: false,
};

/** Inclusive range of shop-local calendar days. */
export type SampleWindow = {
  start: LocalDate;
  end: LocalDate;
  days: number;
};

/** How much of a sample window is backed by stored order history. */
export type HistoryCoverage =
  | { kind: "FULL" }
  | { kind: "PARTIAL"; coveredDays: number }
  | { kind: "NONE" };

export const INCOMING_SOURCES = [
  "SHOPIFY_INCOMING",
  "APP_PURCHASE_ORDERS",
  "NONE",
] as const;

export type IncomingSource = (typeof INCOMING_SOURCES)[number];

export const INCOMING_SOURCE_LABELS: Record<IncomingSource, string> = {
  SHOPIFY_INCOMING: "Shopify incoming",
  APP_PURCHASE_ORDERS: "Open ProPo purchase orders",
  NONE: "Not counted",
};

export const LEAD_TIME_SOURCES = [
  "VARIANT_RULE",
  "SUPPLIER_VARIANT",
  "SUPPLIER_DEFAULT",
  "SUPPLIER_MEASURED",
  "SHOP_DEFAULT",
] as const;

export type LeadTimeSource = (typeof LEAD_TIME_SOURCES)[number];

export const LEAD_TIME_SOURCE_LABELS: Record<LeadTimeSource, string> = {
  VARIANT_RULE: "Variant setting",
  SUPPLIER_VARIANT: "Supplier product setting",
  SUPPLIER_DEFAULT: "Supplier default",
  SUPPLIER_MEASURED: "Measured from past deliveries",
  SHOP_DEFAULT: "Store default",
};

export type WarningCode =
  | "NOT_TRACKED"
  | "INVENTORY_UNKNOWN"
  | "INCOMING_UNKNOWN"
  | "HISTORY_UNAVAILABLE"
  | "HISTORY_PARTIAL"
  | "SALES_EVIDENCE_UNTRUSTED"
  | "NEGATIVE_NET_SALES"
  | "NEGATIVE_AVAILABLE"
  | "SHELF_LIMIT_MISSING"
  | "MINIMUM_MISSING"
  | "MINIMUM_ABOVE_SHELF_LIMIT"
  | "PACK_SIZE_MISSING"
  | "MOQ_MISSING"
  | "LEAD_TIME_MISSING";

export type Warning = { code: WarningCode; message: string };

export type TraceStep = {
  /** Stable key for tests and UI grouping. */
  key: string;
  /** Plain-language sentence a merchant can read without the formula. */
  text: string;
};

/** Facts about one variant at the planning location scope. */
export type VariantPlanningInput = {
  tracked: boolean;
  /** Shopify available quantity summed over the scope; null when not synced. */
  available: number | null;
  /** Incoming quantity from the run's chosen source; null when unknown. */
  incoming: number | null;
  incomingSource: IncomingSource;
  /** Net units sold in the method's sample window; null when not loaded. */
  netUnitsInWindow: number | null;
  coverage: HistoryCoverage;
  /** True when some sales in the window came from facts flagged inconsistent. */
  salesEvidenceUntrusted?: boolean;
  minimumQuantity: number | null;
  shelfLimitQuantity: number | null;
  packSize: number | null;
  minimumOrderQuantity: number | null;
};

export type RuleAdjustment = {
  rule: "MINIMUM_ORDER_QUANTITY" | "PACK_SIZE";
  before: number;
  after: number;
};

export type SuggestionResult = {
  method: ParityMethod;
  window: SampleWindow | null;
  /** Units per day to four decimal places; null for non-sales methods. */
  dailyVelocity: string | null;
  /** Forecast demand to four decimal places, before stock is subtracted. */
  forecastDemand: string | null;
  /** Need before rounding up, to four decimal places (may be negative). */
  baseNeed: string | null;
  /** The Stocky parity quantity: ceil(max(0, need)) on the exact value. */
  parityQuantity: number | null;
  /** Parity quantity after any opt-in supplier rules. */
  suggestedQuantity: number | null;
  adjustments: RuleAdjustment[];
  trace: TraceStep[];
  warnings: Warning[];
};
