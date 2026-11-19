import { describe, expect, it } from "vitest";
import { backtestOrigins, MAX_ORIGINS, runBacktest } from "./backtest";

const SETTINGS = { averageDays: 30 };

describe("backtestOrigins", () => {
  it("steps back a week at a time, keeping only cuts every model can forecast from", () => {
    // The trend and Croston models need 56 days, the most of any model.
    expect(backtestOrigins(100, 14, SETTINGS)).toEqual([58, 65, 72, 79, 86]);
  });

  it("stops at the most cuts it makes", () => {
    const origins = backtestOrigins(400, 7, SETTINGS);
    expect(origins).toHaveLength(MAX_ORIGINS);
    expect(origins.at(-1)).toBe(393);
  });

  it("makes no cut when the history is too short", () => {
    expect(backtestOrigins(60, 14, SETTINGS)).toEqual([]);
  });
});

describe("runBacktest", () => {
  it("scores each cut on the horizon total", () => {
    const history = Array<number>(100).fill(2);
    const result = runBacktest(history, 14, SETTINGS);
    const parity = result.models.find((model) => model.model === "PARITY_AVERAGE");
    expect(parity?.origins).toHaveLength(5);
    expect(parity?.origins[0]).toEqual({ origin: 58, forecast: 28, actual: 28 });
    expect(parity).toMatchObject({ wape: 0, bias: 0 });
  });

  it("leaves out-of-stock days out of both the forecast and the actual", () => {
    const history: (number | null)[] = Array<number | null>(100).fill(2);
    history[90] = null;
    history[91] = null;
    const parity = runBacktest(history, 14, SETTINGS).models.find(
      (model) => model.model === "PARITY_AVERAGE",
    );
    // The last cut forecasts days 86 to 99; two of them are left out.
    expect(parity?.origins.at(-1)).toMatchObject({ origin: 86, actual: 24 });
    expect(parity?.origins.at(-1)?.forecast).toBeCloseTo(24, 10);
  });

  it("has no error figure when nothing sold in the tested periods", () => {
    const result = runBacktest(Array<number>(100).fill(0), 14, SETTINGS);
    for (const model of result.models) expect(model).toMatchObject({ wape: null, bias: null });
  });
});
