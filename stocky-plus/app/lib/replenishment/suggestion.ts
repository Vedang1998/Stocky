/**
 * Stocky Parity suggestion math (PRD §3.4). One function, one variant, no I/O.
 *
 *   daily_velocity  = net_units_sold / sample_calendar_days
 *   forecast_demand = daily_velocity × suggest_days
 *   base_need       = forecast_demand − available − incoming
 *   suggested       = ceil(max(0, base_need))
 *
 * Same period last year uses last year's net units for the window as the
 * forecast directly. The three stock-level methods subtract from a shelf
 * limit or target instead of a forecast.
 *
 * Every number is exact until it is displayed, and every result carries a
 * trace a merchant can read to see where the quantity came from.
 */
import {
  ceil,
  max,
  mul,
  rational,
  sign,
  sub,
  toFixed,
  toSafeInteger,
  type Rational,
} from "./rational";
import { applySupplierRules, type SupplierRuleResult } from "./supplier-rules";
import {
  INCOMING_SOURCE_LABELS,
  SALES_BASED_METHODS,
  type MethodParameters,
  type RoundingOptions,
  type SampleWindow,
  type SuggestionResult,
  type TraceStep,
  type VariantPlanningInput,
  type Warning,
} from "./types";

const DISPLAY_PLACES = 2;
const RESULT_PLACES = 4;

function units(n: number): string {
  return `${n} ${Math.abs(n) === 1 ? "unit" : "units"}`;
}

function days(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

function show(value: Rational): string {
  return toFixed(value, DISPLAY_PLACES);
}

function emptyResult(
  params: MethodParameters,
  window: SampleWindow | null,
  trace: TraceStep[],
  warnings: Warning[],
): SuggestionResult {
  return {
    method: params.method,
    window,
    dailyVelocity: null,
    forecastDemand: null,
    baseNeed: null,
    parityQuantity: null,
    suggestedQuantity: null,
    adjustments: [],
    trace,
    warnings,
  };
}

function nonNegativeOrNull(value: number | null): number | null {
  return value != null && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function describeSupplierRules(
  result: SupplierRuleResult,
  packSize: number | null,
  trace: TraceStep[],
  warnings: Warning[],
): void {
  for (const rule of result.missing) {
    warnings.push(
      rule === "MINIMUM_ORDER_QUANTITY"
        ? {
            code: "MOQ_MISSING",
            message:
              "No supplier minimum order quantity is set, so none was applied.",
          }
        : {
            code: "PACK_SIZE_MISSING",
            message:
              "No pack size is set, so the quantity was not rounded to packs.",
          },
    );
  }
  for (const { rule, before, after } of result.adjustments) {
    trace.push(
      rule === "MINIMUM_ORDER_QUANTITY"
        ? {
            key: "adjust.moq",
            text: `Raised from ${before} to the supplier minimum order of ${after}.`,
          }
        : {
            key: "adjust.pack",
            text: `Rounded up from ${before} to ${after} (${after / (packSize as number)} packs of ${packSize}).`,
          },
    );
  }
}

export function computeSuggestion(
  params: MethodParameters,
  window: SampleWindow | null,
  input: VariantPlanningInput,
  rounding: RoundingOptions,
): SuggestionResult {
  const trace: TraceStep[] = [];
  const warnings: Warning[] = [];
  const salesBased = SALES_BASED_METHODS.has(params.method);

  if (salesBased && window == null) {
    throw new Error(`${params.method} needs a sample window`);
  }

  if (!input.tracked) {
    warnings.push({
      code: "NOT_TRACKED",
      message: "Shopify isn't tracking inventory for this variant.",
    });
    trace.push({
      key: "skip.untracked",
      text: "Inventory isn't tracked in Shopify, so no quantity is suggested.",
    });
    return emptyResult(params, window, trace, warnings);
  }

  if (input.available == null || !Number.isSafeInteger(input.available)) {
    warnings.push({
      code: "INVENTORY_UNKNOWN",
      message: "Available stock hasn't been synced for this location yet.",
    });
    trace.push({
      key: "skip.inventory",
      text: "Available stock is unknown, so no quantity is suggested.",
    });
    return emptyResult(params, window, trace, warnings);
  }
  const available = input.available;

  const sourceLabel = INCOMING_SOURCE_LABELS[input.incomingSource];
  const incomingKnown =
    input.incomingSource !== "NONE" &&
    input.incoming != null &&
    Number.isSafeInteger(input.incoming);
  const incoming = incomingKnown ? (input.incoming as number) : 0;
  const stockOnHandAndIncoming = available + incoming;

  let positionText: string;
  if (input.incomingSource === "NONE") {
    positionText = `In stock: ${available} available (incoming not counted on this run).`;
  } else if (!incomingKnown) {
    warnings.push({
      code: "INCOMING_UNKNOWN",
      message: `${sourceLabel} is unknown and was counted as 0.`,
    });
    positionText = `In stock: ${available} available; incoming (${sourceLabel}) is unknown and counted as 0.`;
  } else {
    positionText = `In stock: ${available} available + ${incoming} incoming (${sourceLabel}) = ${stockOnHandAndIncoming}.`;
  }
  trace.push({ key: "stock.position", text: positionText });

  if (available < 0) {
    warnings.push({
      code: "NEGATIVE_AVAILABLE",
      message: `Available is ${available} (oversold); the suggestion also covers the shortfall.`,
    });
  }

  const stockText = `${stockOnHandAndIncoming} in stock`;

  let forecast: Rational | null = null;
  let velocity: Rational | null = null;
  let baseNeed: Rational;

  switch (params.method) {
    case "LAST_X_DAYS":
    case "CUSTOM_RANGE":
    case "SAME_PERIOD_LAST_YEAR": {
      const sample = window as SampleWindow;
      trace.push({
        key: "sales.window",
        text: `Sales window: ${sample.start} to ${sample.end} (${days(sample.days)}).`,
      });

      if (input.netUnitsInWindow == null || input.coverage.kind === "NONE") {
        warnings.push({
          code: "HISTORY_UNAVAILABLE",
          message: "No order history is stored for this sales window.",
        });
        trace.push({
          key: "skip.history",
          text: "There is no stored order history for this window, so missing sales are not treated as zero and no quantity is suggested.",
        });
        return emptyResult(params, window, trace, warnings);
      }
      if (input.coverage.kind === "PARTIAL") {
        warnings.push({
          code: "HISTORY_PARTIAL",
          message: `Order history covers ${days(input.coverage.coveredDays)} of the ${days(sample.days)} in the sales window.`,
        });
      }
      if (input.salesEvidenceUntrusted) {
        warnings.push({
          code: "SALES_EVIDENCE_UNTRUSTED",
          message:
            "Some orders in the window have inconsistent unit records from Shopify; review the sales total.",
        });
      }

      const netUnits = input.netUnitsInWindow;
      if (netUnits < 0) {
        warnings.push({
          code: "NEGATIVE_NET_SALES",
          message: `Net sales in the window are ${netUnits} (more returned than sold).`,
        });
      }
      trace.push({
        key: "sales.net",
        text: `Net ${units(netUnits)} sold in the window.`,
      });

      velocity = rational(netUnits, sample.days);
      if (params.method === "SAME_PERIOD_LAST_YEAR") {
        forecast = rational(netUnits);
        trace.push({
          key: "forecast.demand",
          text: `Forecast for the next ${days(params.suggestDays)}: the same ${units(netUnits)} sold in this period last year.`,
        });
      } else {
        forecast = mul(velocity, rational(params.suggestDays));
        trace.push({
          key: "forecast.demand",
          text: `Forecast: ${netUnits} ÷ ${days(sample.days)} × ${days(params.suggestDays)} = ${show(forecast)} units (${show(velocity)} per day).`,
        });
      }
      baseNeed = sub(forecast, rational(stockOnHandAndIncoming));
      trace.push({
        key: "need.base",
        text: `Need: ${show(forecast)} forecast − ${stockText} = ${show(baseNeed)}.`,
      });
      break;
    }

    case "FILL_SHELVES": {
      const shelf = nonNegativeOrNull(input.shelfLimitQuantity);
      if (shelf == null) {
        warnings.push({
          code: "SHELF_LIMIT_MISSING",
          message: "Set a shelf limit to use Fill shelves.",
        });
        trace.push({
          key: "skip.shelf",
          text: "No shelf limit is set, so no quantity is suggested.",
        });
        return emptyResult(params, window, trace, warnings);
      }
      baseNeed = rational(shelf - stockOnHandAndIncoming);
      trace.push({
        key: "need.base",
        text: `Need: shelf limit ${shelf} − ${stockText} = ${shelf - stockOnHandAndIncoming}.`,
      });
      break;
    }

    case "FILL_SHELVES_IF_BELOW_MIN": {
      const shelf = nonNegativeOrNull(input.shelfLimitQuantity);
      const minimum = nonNegativeOrNull(input.minimumQuantity);
      if (shelf == null || minimum == null) {
        if (shelf == null) {
          warnings.push({
            code: "SHELF_LIMIT_MISSING",
            message: "Set a shelf limit to use this method.",
          });
        }
        if (minimum == null) {
          warnings.push({
            code: "MINIMUM_MISSING",
            message: "Set a minimum to use this method.",
          });
        }
        trace.push({
          key: "skip.levels",
          text: "Both a minimum and a shelf limit are needed, so no quantity is suggested.",
        });
        return emptyResult(params, window, trace, warnings);
      }
      if (minimum > shelf) {
        warnings.push({
          code: "MINIMUM_ABOVE_SHELF_LIMIT",
          message: `The minimum (${minimum}) is higher than the shelf limit (${shelf}).`,
        });
      }
      if (stockOnHandAndIncoming < minimum) {
        baseNeed = rational(shelf - stockOnHandAndIncoming);
        trace.push({
          key: "need.base",
          text: `${stockOnHandAndIncoming} in stock is below the minimum ${minimum}. Need: shelf limit ${shelf} − ${stockText} = ${shelf - stockOnHandAndIncoming}.`,
        });
      } else {
        baseNeed = rational(0);
        trace.push({
          key: "need.base",
          text: `${stockOnHandAndIncoming} in stock is not below the minimum ${minimum}, so nothing is needed.`,
        });
      }
      break;
    }

    case "TARGET_STOCK_LEVEL": {
      const target = params.targetQuantity;
      baseNeed = rational(target - stockOnHandAndIncoming);
      trace.push({
        key: "need.base",
        text: `Need: target ${target} − ${stockText} = ${target - stockOnHandAndIncoming}.`,
      });
      break;
    }
  }

  const parityQuantity = toSafeInteger(
    ceil(max(baseNeed, rational(0))),
    "Suggested quantity",
  );
  if (parityQuantity === 0) {
    trace.push({
      key: "suggest.parity",
      text: "Suggested: 0. Current and incoming stock already cover the need.",
    });
  } else if (sign(sub(rational(parityQuantity), baseNeed)) !== 0) {
    trace.push({
      key: "suggest.parity",
      text: `Suggested: ${show(baseNeed)} rounded up to ${parityQuantity}.`,
    });
  } else {
    trace.push({
      key: "suggest.parity",
      text: `Suggested: ${parityQuantity}.`,
    });
  }

  const supplierRules = applySupplierRules(parityQuantity, input, rounding);
  describeSupplierRules(supplierRules, input.packSize, trace, warnings);

  return {
    method: params.method,
    window,
    dailyVelocity: velocity ? toFixed(velocity, RESULT_PLACES) : null,
    forecastDemand: forecast ? toFixed(forecast, RESULT_PLACES) : null,
    baseNeed: toFixed(baseNeed, RESULT_PLACES),
    parityQuantity,
    suggestedQuantity: supplierRules.quantity,
    adjustments: supplierRules.adjustments,
    trace,
    warnings,
  };
}
