/**
 * Smart Forecast for one variant: backtest every model on the variant's own
 * history, pick one only when it beat the Stocky-style average by a clear
 * margin without leaning high or low, and say why in plain words.
 *
 * Smart Forecast is advice shown beside the parity suggestion. It never
 * changes a parity quantity; the merchant decides whether to use it.
 */
import { addDays, type LocalDate } from "../replenishment/local-date";
import { runBacktest, type Backtest, type ModelBacktest } from "./backtest";
import {
  forecastWith,
  SMART_MODELS,
  SMART_MODEL_LABELS,
  type ModelSettings,
  type SmartModel,
} from "./models";

/** A model needs this many backtest cuts before it can be chosen. */
export const MIN_ORIGINS = 4;
/** A model must cut the average's error by at least this share. */
export const MIN_IMPROVEMENT = 0.1;
/** A model whose forecasts ran this far high or low on average is refused. */
export const MAX_ABS_BIAS = 0.2;

export type DemandDay = {
  date: LocalDate;
  /** Net units sold that day. */
  units: number;
  /** False when the variant was out of stock all day; null when unknown. */
  inStock: boolean | null;
};

export type SmartForecastInput = {
  /** Consecutive days, oldest first, ending on the last complete day. */
  days: readonly DemandDay[];
  /** Days the order should cover: the worksheet's days to cover. */
  horizonDays: number;
  /** Days in the Stocky-style average: the worksheet's sales period. */
  averageDays: number;
  /** Stock available now and already incoming; null when not known. */
  available: number | null;
  incoming: number | null;
};

export type SmartForecastOutcome =
  | "SELECTED"
  | "KEPT_SHORT_HISTORY"
  | "KEPT_NO_SALES"
  | "KEPT_NO_IMPROVEMENT";

export type ModelScore = {
  model: SmartModel;
  label: string;
  /** Cuts the model could forecast; fewer than the backtest's means it is not comparable. */
  origins: number;
  /** Typical error as a percentage of actual demand, one decimal. */
  errorPercent: string | null;
  /** Average lean as a percentage: above zero forecast too much. */
  biasPercent: string | null;
  chosen: boolean;
};

export type SmartForecast = {
  outcome: SmartForecastOutcome;
  /** The model used: the chosen one, or the average when none was chosen. */
  model: SmartModel;
  label: string;
  horizonDays: number;
  /** Units expected over the horizon, two decimals; null with too little history. */
  forecastUnits: string | null;
  /** What the Stocky-style average expects over the same horizon. */
  parityForecastUnits: string | null;
  /** Units to order on this forecast; null when stock is not known. */
  suggestedQuantity: number | null;
  /**
   * In the backtest, actual demand ran between these percentages of the
   * chosen model's forecast. Null when the average was kept.
   */
  backtestRange: { lowPercent: string; highPercent: string } | null;
  backtestCuts: number;
  scores: ModelScore[];
  explanation: string[];
};

function fixed(value: number, places: number): string {
  // Avoid "-0.00" for a value that rounds to zero.
  const text = value.toFixed(places);
  return Number(text) === 0 ? (0).toFixed(places) : text;
}

function percent(value: number | null): string | null {
  return value == null ? null : fixed(value * 100, 1);
}

function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

/** Demand for the models: unknown on out-of-stock days, never below zero. */
function toHistory(days: readonly DemandDay[]): (number | null)[] {
  for (let index = 1; index < days.length; index += 1) {
    if (days[index].date !== addDays(days[index - 1].date, 1)) {
      throw new RangeError(
        `Demand history must be consecutive days; ${days[index].date} follows ${days[index - 1].date}`,
      );
    }
  }
  return days.map((day) => {
    if (!Number.isSafeInteger(day.units)) {
      throw new RangeError(`Units on ${day.date} must be a whole number`);
    }
    return day.inStock === false ? null : Math.max(0, day.units);
  });
}

function choose(backtest: Backtest): { model: SmartModel | null; outcome: SmartForecastOutcome } {
  if (backtest.origins.length < MIN_ORIGINS) {
    return { model: null, outcome: "KEPT_SHORT_HISTORY" };
  }
  const byModel = new Map(backtest.models.map((result) => [result.model, result]));
  const baseline = byModel.get("PARITY_AVERAGE") as ModelBacktest;
  if (baseline.wape == null || baseline.origins.length < backtest.origins.length) {
    return { model: null, outcome: "KEPT_NO_SALES" };
  }
  const limit = baseline.wape * (1 - MIN_IMPROVEMENT);
  let best: ModelBacktest | null = null;
  for (const model of SMART_MODELS) {
    if (model === "PARITY_AVERAGE") continue;
    const result = byModel.get(model) as ModelBacktest;
    if (
      result.origins.length < backtest.origins.length ||
      result.wape == null ||
      result.bias == null ||
      Math.abs(result.bias) > MAX_ABS_BIAS ||
      result.wape >= baseline.wape ||
      result.wape > limit
    ) {
      continue;
    }
    // Ties keep the earlier, simpler model.
    if (!best || (best.wape as number) > result.wape) best = result;
  }
  return best
    ? { model: best.model, outcome: "SELECTED" }
    : { model: null, outcome: "KEPT_NO_IMPROVEMENT" };
}

function range(result: ModelBacktest): SmartForecast["backtestRange"] {
  const ratios = result.origins
    .filter((origin) => origin.forecast > 0)
    .map((origin) => origin.actual / origin.forecast);
  if (ratios.length === 0) return null;
  return {
    lowPercent: fixed(Math.min(...ratios) * 100, 0),
    highPercent: fixed(Math.max(...ratios) * 100, 0),
  };
}

export function smartForecast(input: SmartForecastInput): SmartForecast {
  const { horizonDays, averageDays } = input;
  if (!Number.isSafeInteger(averageDays) || averageDays < 1) {
    throw new RangeError("averageDays must be a positive whole number of days");
  }
  const settings: ModelSettings = { averageDays };
  const history = toHistory(input.days);
  const backtest = runBacktest(history, horizonDays, settings);
  const { model: chosen, outcome } = choose(backtest);
  const model = chosen ?? "PARITY_AVERAGE";

  const parity = forecastWith("PARITY_AVERAGE", history, horizonDays, settings);
  const parityTotal = parity ? sum(parity) : null;
  const forecast = chosen ? forecastWith(chosen, history, horizonDays, settings) : parity;
  const total = forecast ? sum(forecast) : null;

  const suggestedQuantity =
    total == null || input.available == null
      ? null
      : Math.max(0, Math.ceil(total - input.available - (input.incoming ?? 0)));

  const scores: ModelScore[] = backtest.models.map((result) => ({
    model: result.model,
    label: SMART_MODEL_LABELS[result.model],
    origins: result.origins.length,
    errorPercent: percent(result.wape),
    biasPercent: percent(result.bias),
    chosen: result.model === chosen,
  }));

  const chosenResult = backtest.models.find((result) => result.model === chosen);
  const parityScore = scores.find((score) => score.model === "PARITY_AVERAGE") as ModelScore;
  const explanation: string[] = [];
  switch (outcome) {
    case "SELECTED": {
      const bias = chosenResult?.bias ?? 0;
      explanation.push(
        `${SMART_MODEL_LABELS[model]} was chosen: over ${backtest.origins.length} past periods of ${horizonDays} days its forecasts were off by ${percent(chosenResult?.wape ?? null)}% of actual demand, against ${parityScore.errorPercent}% for the recent average.`,
        `Its forecasts leaned ${bias >= 0 ? "high" : "low"} by ${fixed(Math.abs(bias) * 100, 1)}% on average.`,
      );
      break;
    }
    case "KEPT_SHORT_HISTORY":
      explanation.push(
        `The recent average is kept: there is not enough sales history to test other methods on ${MIN_ORIGINS} past periods of ${horizonDays} days.`,
      );
      break;
    case "KEPT_NO_SALES":
      explanation.push(
        "The recent average is kept: the variant sold nothing in the periods used for testing, so no method can be judged better.",
      );
      break;
    case "KEPT_NO_IMPROVEMENT":
      explanation.push(
        `The recent average is kept: no other method cut its error of ${parityScore.errorPercent}% by at least ${fixed(MIN_IMPROVEMENT * 100, 0)}% without leaning more than ${fixed(MAX_ABS_BIAS * 100, 0)}% high or low.`,
      );
      break;
  }
  if (history.some((value) => value == null)) {
    explanation.push(
      "Days the variant was out of stock are left out of the methods and the test, because sales on those days understate demand. The recent average still counts them, as Stocky does.",
    );
  }

  return {
    outcome,
    model,
    label: SMART_MODEL_LABELS[model],
    horizonDays,
    forecastUnits: total == null ? null : fixed(total, 2),
    parityForecastUnits: parityTotal == null ? null : fixed(parityTotal, 2),
    suggestedQuantity,
    backtestRange: chosenResult ? range(chosenResult) : null,
    backtestCuts: backtest.origins.length,
    scores,
    explanation,
  };
}
