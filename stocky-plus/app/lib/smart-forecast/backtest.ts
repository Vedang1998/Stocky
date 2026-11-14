/**
 * Rolling-origin backtest. The history is cut at several past days; each
 * model forecasts the `horizon` days after a cut from only the days before
 * it, and the forecast is compared with what actually sold.
 *
 * Errors are measured on the horizon total, the figure an order quantity is
 * built from. Days the variant was out of stock are left out of both sides,
 * because what sold on them understates demand.
 */
import {
  forecastWith,
  minimumHistory,
  SMART_MODELS,
  type DemandHistory,
  type ModelSettings,
  type SmartModel,
} from "./models";

/** Days between one cut and the next. */
export const ORIGIN_STEP_DAYS = 7;
/** The most cuts a backtest makes, newest first. */
export const MAX_ORIGINS = 8;

export type OriginResult = {
  /** Index into the history of the first day forecast. */
  origin: number;
  forecast: number;
  actual: number;
};

export type ModelBacktest = {
  model: SmartModel;
  origins: OriginResult[];
  /** Sum of absolute errors over sum of actuals; null without actual sales. */
  wape: number | null;
  /** Sum of errors over sum of actuals: above zero forecasts too much. */
  bias: number | null;
};

export type Backtest = {
  horizon: number;
  /** Cut points used, oldest first. Every model is scored on the same ones. */
  origins: number[];
  models: ModelBacktest[];
};

/**
 * The cut points: every `ORIGIN_STEP_DAYS` back from the newest day whose
 * horizon is fully in the past, keeping only cuts with enough history for
 * the hungriest model so every model is scored on the same cuts.
 */
export function backtestOrigins(
  length: number,
  horizon: number,
  settings: ModelSettings,
): number[] {
  const needed = Math.max(...SMART_MODELS.map((model) => minimumHistory(model, settings)));
  const origins: number[] = [];
  for (
    let origin = length - horizon;
    origin >= needed && origins.length < MAX_ORIGINS;
    origin -= ORIGIN_STEP_DAYS
  ) {
    origins.push(origin);
  }
  return origins.reverse();
}

function score(origins: OriginResult[]): Pick<ModelBacktest, "wape" | "bias"> {
  let actual = 0;
  let absolute = 0;
  let signed = 0;
  for (const result of origins) {
    actual += result.actual;
    absolute += Math.abs(result.forecast - result.actual);
    signed += result.forecast - result.actual;
  }
  if (actual <= 0) return { wape: null, bias: null };
  return { wape: absolute / actual, bias: signed / actual };
}

export function runBacktest(
  history: DemandHistory,
  horizon: number,
  settings: ModelSettings,
): Backtest {
  const origins = backtestOrigins(history.length, horizon, settings);
  const models = SMART_MODELS.map((model): ModelBacktest => {
    const results: OriginResult[] = [];
    for (const origin of origins) {
      const forecast = forecastWith(model, history.slice(0, origin), horizon, settings);
      if (!forecast) continue;
      let forecastTotal = 0;
      let actualTotal = 0;
      for (let day = 0; day < horizon; day += 1) {
        const actual = history[origin + day];
        if (actual == null) continue;
        forecastTotal += forecast[day];
        actualTotal += actual;
      }
      results.push({ origin, forecast: forecastTotal, actual: actualTotal });
    }
    return { model, origins: results, ...score(results) };
  });
  return { horizon, origins, models };
}
