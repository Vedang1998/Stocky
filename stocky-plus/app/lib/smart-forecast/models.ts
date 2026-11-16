/**
 * Smart Forecast candidate models. Each one reads a daily demand history and
 * returns a forecast for each of the next `horizon` days.
 *
 * History is oldest first, one entry per shop-local day, ending on the last
 * complete day. `null` marks a day whose demand is unknown because the
 * variant was out of stock (censored): models skip those days instead of
 * reading them as zero demand.
 *
 * Only addition, subtraction, multiplication and division are used, so a run
 * gives the same numbers on every platform. Nothing here calls a language
 * model.
 */

export const SMART_MODELS = [
  "PARITY_AVERAGE",
  "SEASONAL_NAIVE_WEEKLY",
  "TREND_BLEND",
  "CROSTON_SBA",
] as const;

export type SmartModel = (typeof SMART_MODELS)[number];

export const SMART_MODEL_LABELS: Record<SmartModel, string> = {
  PARITY_AVERAGE: "Recent average (the Stocky method)",
  SEASONAL_NAIVE_WEEKLY: "Same weekday, recent weeks",
  TREND_BLEND: "Recent average with trend",
  CROSTON_SBA: "Occasional sales (Croston–SBA)",
};

/** Days per week, for the weekday pattern. */
const WEEK = 7;
/** Weeks the weekday model averages over. */
const SEASONAL_WEEKS = 4;
/** Days the trend line is fitted to. */
const TREND_DAYS = 56;
/** Share of the forecast taken from the trend line; the rest is the level. */
const TREND_WEIGHT = 0.5;
/** Croston smoothing constant; SBA multiplies by 1 − α/2 to remove its bias. */
const CROSTON_ALPHA = 0.1;

export type DemandHistory = readonly (number | null)[];

export type ModelSettings = {
  /** Days in the Stocky-style average: the worksheet's sales period. */
  averageDays: number;
};

/** The fewest days of history a model needs before it can be tried. */
export function minimumHistory(model: SmartModel, settings: ModelSettings): number {
  switch (model) {
    case "PARITY_AVERAGE":
      return settings.averageDays;
    case "SEASONAL_NAIVE_WEEKLY":
      return WEEK * SEASONAL_WEEKS;
    case "TREND_BLEND":
      return TREND_DAYS;
    case "CROSTON_SBA":
      return TREND_DAYS;
  }
}

function constant(value: number, horizon: number): number[] {
  return Array.from({ length: horizon }, () => value);
}

function observed(values: DemandHistory): number[] {
  return values.filter((value): value is number => value != null);
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/**
 * Units over the last `averageDays` divided by `averageDays`, exactly as the
 * parity method counts: out-of-stock days count as the zero they sold.
 */
function parityAverage(history: DemandHistory, horizon: number, settings: ModelSettings) {
  const window = history.slice(-settings.averageDays);
  let sum = 0;
  for (const value of window) sum += value ?? 0;
  return constant(sum / settings.averageDays, horizon);
}

/**
 * Each future day gets the average of the same weekday over the last four
 * weeks it was in stock. Falls back to the overall in-stock average for a
 * weekday that was out of stock all four weeks.
 */
function seasonalNaiveWeekly(history: DemandHistory, horizon: number): number[] | null {
  const n = history.length;
  const recent = history.slice(-WEEK * SEASONAL_WEEKS);
  const overall = mean(observed(recent));
  if (overall == null) return null;
  const byWeekday: number[] = [];
  for (let offset = 0; offset < WEEK; offset += 1) {
    const sameDay: number[] = [];
    for (let week = 1; week <= SEASONAL_WEEKS; week += 1) {
      const value = history[n - week * WEEK + offset];
      if (value != null) sameDay.push(value);
    }
    byWeekday.push(mean(sameDay) ?? overall);
  }
  return Array.from({ length: horizon }, (_, day) => byWeekday[day % WEEK]);
}

/**
 * Half the recent level, half a straight line fitted by least squares to the
 * last eight weeks of in-stock days. Never forecasts below zero.
 */
function trendBlend(history: DemandHistory, horizon: number, settings: ModelSettings) {
  const recent = history.slice(-TREND_DAYS);
  const points: Array<[number, number]> = [];
  recent.forEach((value, index) => {
    if (value != null) points.push([index, value]);
  });
  if (points.length < 2) return null;

  let sumX = 0;
  let sumY = 0;
  for (const [x, y] of points) {
    sumX += x;
    sumY += y;
  }
  const meanX = sumX / points.length;
  const meanY = sumY / points.length;
  let sxx = 0;
  let sxy = 0;
  for (const [x, y] of points) {
    sxx += (x - meanX) * (x - meanX);
    sxy += (x - meanX) * (y - meanY);
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = meanY - slope * meanX;
  const level = mean(observed(recent.slice(-settings.averageDays))) ?? meanY;

  return Array.from({ length: horizon }, (_, day) => {
    const line = intercept + slope * (recent.length + day);
    return Math.max(0, (1 - TREND_WEIGHT) * level + TREND_WEIGHT * line);
  });
}

/**
 * Croston's method with the Syntetos–Boylan correction, for items that sell
 * on only some days: it smooths the size of a sale and the gap between
 * sales separately, then forecasts their ratio as a daily rate.
 */
function crostonSba(history: DemandHistory, horizon: number): number[] | null {
  let size: number | null = null;
  let interval: number | null = null;
  let gap = 1;
  for (const value of history) {
    if (value == null) continue;
    if (value > 0) {
      if (size == null || interval == null) {
        size = value;
        interval = gap;
      } else {
        size += CROSTON_ALPHA * (value - size);
        interval += CROSTON_ALPHA * (gap - interval);
      }
      gap = 1;
    } else {
      gap += 1;
    }
  }
  if (size == null || interval == null) return constant(0, horizon);
  return constant((1 - CROSTON_ALPHA / 2) * (size / interval), horizon);
}

/**
 * The model's daily forecasts for the next `horizon` days, or null when the
 * history has nothing it can use (for example, every day out of stock).
 */
export function forecastWith(
  model: SmartModel,
  history: DemandHistory,
  horizon: number,
  settings: ModelSettings,
): number[] | null {
  if (!Number.isSafeInteger(horizon) || horizon < 1) {
    throw new RangeError("horizon must be a positive whole number of days");
  }
  if (history.length < minimumHistory(model, settings)) return null;
  switch (model) {
    case "PARITY_AVERAGE":
      return parityAverage(history, horizon, settings);
    case "SEASONAL_NAIVE_WEEKLY":
      return seasonalNaiveWeekly(history, horizon);
    case "TREND_BLEND":
      return trendBlend(history, horizon, settings);
    case "CROSTON_SBA":
      return crostonSba(history, horizon);
  }
}
