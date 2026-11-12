/**
 * Days of stock, depletion date, reorder point and low-stock status for one
 * variant (PRD §3.4 worksheet columns, §3.6 low-stock fields).
 *
 * Reorder point:
 *   manual    = the merchant's reorder point for this variant, when set
 *   automatic = ceil(units_per_day × lead_time_days + safety_stock)
 * Safety stock is 0 unless the merchant sets it for the variant; lead time
 * has no app-wide default. With no lead time there is no automatic reorder
 * point, and the row says so instead of guessing.
 *
 * A variant is low on stock when available + incoming is at or below its
 * reorder point, or below its minimum.
 */
import { addDays, type LocalDate } from "./local-date";
import {
  add,
  ceil,
  div,
  mul,
  rational,
  sign,
  toFixed,
  toSafeInteger,
  type Rational,
} from "./rational";
import {
  LEAD_TIME_SOURCE_LABELS,
  type LeadTimeSource,
  type TraceStep,
  type Warning,
} from "./types";

export type LeadTime = { days: number; source: LeadTimeSource };

export type StockHealthInput = {
  asOf: LocalDate;
  available: number | null;
  incoming: number | null;
  /** Units per day from the run's sales window; null when unknown. */
  velocity: Rational | null;
  leadTime: LeadTime | null;
  safetyStock: number | null;
  manualReorderPoint: number | null;
  minimumQuantity: number | null;
};

export type StockStatus = "OUT_OF_STOCK" | "LOW" | "OK" | "UNKNOWN";

export type ReorderPointSource = "MANUAL" | "AUTOMATIC";

export type StockHealth = {
  status: StockStatus;
  /** Available ÷ units per day, one decimal; null when not selling. */
  daysOfStock: string | null;
  /** First day stock is expected to run out; null when not selling. */
  depletionDate: LocalDate | null;
  reorderPoint: number | null;
  reorderPointSource: ReorderPointSource | null;
  leadTime: LeadTime | null;
  lowStockReasons: string[];
  trace: TraceStep[];
  warnings: Warning[];
};

function wholeOrNull(value: number | null): number | null {
  return value != null && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

export function computeStockHealth(input: StockHealthInput): StockHealth {
  const trace: TraceStep[] = [];
  const warnings: Warning[] = [];
  const leadTime =
    input.leadTime && wholeOrNull(input.leadTime.days) != null
      ? input.leadTime
      : null;
  const manualReorderPoint = wholeOrNull(input.manualReorderPoint);
  const safetyStock = wholeOrNull(input.safetyStock) ?? 0;
  const minimum = wholeOrNull(input.minimumQuantity);
  const selling = input.velocity != null && sign(input.velocity) > 0;

  if (input.available == null || !Number.isSafeInteger(input.available)) {
    return {
      status: "UNKNOWN",
      daysOfStock: null,
      depletionDate: null,
      reorderPoint: manualReorderPoint,
      reorderPointSource: manualReorderPoint != null ? "MANUAL" : null,
      leadTime,
      lowStockReasons: [],
      trace: [{ key: "health.unknown", text: "Available stock is unknown." }],
      warnings,
    };
  }
  const available = input.available;
  const position = available + (input.incoming ?? 0);

  let daysOfStock: string | null = null;
  let depletionDate: LocalDate | null = null;
  if (selling) {
    const velocity = input.velocity as Rational;
    if (available <= 0) {
      daysOfStock = "0.0";
      depletionDate = input.asOf;
      trace.push({ key: "health.depletion", text: "Out of stock now." });
    } else {
      const cover = div(rational(available), velocity);
      daysOfStock = toFixed(cover, 1);
      // Whole days of cover, then the day stock is expected to run out.
      const wholeDays = toSafeInteger(cover.num / cover.den, "Days of stock");
      depletionDate = addDays(input.asOf, wholeDays);
      trace.push({
        key: "health.depletion",
        text: `${available} available ÷ ${toFixed(velocity, 2)} per day = ${daysOfStock} days of stock (runs out around ${depletionDate}).`,
      });
    }
  } else {
    trace.push({
      key: "health.depletion",
      text: "No net sales in the window, so stock isn't depleting.",
    });
  }

  let reorderPoint: number | null = null;
  let reorderPointSource: ReorderPointSource | null = null;
  if (manualReorderPoint != null) {
    reorderPoint = manualReorderPoint;
    reorderPointSource = "MANUAL";
    trace.push({
      key: "health.rop",
      text: `Reorder point ${reorderPoint} (set manually).`,
    });
  } else if (leadTime == null) {
    warnings.push({
      code: "LEAD_TIME_MISSING",
      message: "Set a lead time to get an automatic reorder point.",
    });
    trace.push({
      key: "health.rop",
      text: "No lead time is set, so there is no automatic reorder point.",
    });
  } else if (input.velocity != null) {
    const velocity = sign(input.velocity) > 0 ? input.velocity : rational(0);
    const demandOverLeadTime = mul(velocity, rational(leadTime.days));
    reorderPoint = toSafeInteger(
      ceil(add(demandOverLeadTime, rational(safetyStock))),
      "Reorder point",
    );
    reorderPointSource = "AUTOMATIC";
    const safetyText = safetyStock > 0 ? ` + ${safetyStock} safety stock` : "";
    trace.push({
      key: "health.rop",
      text: `Reorder point: ${toFixed(velocity, 2)} per day × ${leadTime.days} days lead time (${LEAD_TIME_SOURCE_LABELS[leadTime.source].toLowerCase()})${safetyText} = ${reorderPoint} after rounding up.`,
    });
  } else {
    trace.push({
      key: "health.rop",
      text: "The sales rate is unknown, so there is no automatic reorder point.",
    });
  }

  const lowStockReasons: string[] = [];
  if (reorderPoint != null && reorderPoint > 0 && position <= reorderPoint) {
    lowStockReasons.push(
      `Stock ${position} is at or below the reorder point ${reorderPoint}.`,
    );
  }
  if (minimum != null && position < minimum) {
    lowStockReasons.push(`Stock ${position} is below the minimum ${minimum}.`);
  }

  const status: StockStatus =
    available <= 0 ? "OUT_OF_STOCK" : lowStockReasons.length > 0 ? "LOW" : "OK";

  return {
    status,
    daysOfStock,
    depletionDate,
    reorderPoint,
    reorderPointSource,
    leadTime,
    lowStockReasons,
    trace,
    warnings,
  };
}

/** First lead time found, most specific first. */
export function resolveLeadTime(
  candidates: ReadonlyArray<{
    days: number | null | undefined;
    source: LeadTimeSource;
  }>,
): LeadTime | null {
  for (const candidate of candidates) {
    const days = candidate.days;
    if (days != null && Number.isSafeInteger(days) && days >= 0) {
      return { days, source: candidate.source };
    }
  }
  return null;
}
