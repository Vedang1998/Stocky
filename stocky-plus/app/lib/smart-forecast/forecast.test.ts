import { describe, expect, it } from "vitest";
import { addDays } from "../replenishment/local-date";
import { smartForecast, type DemandDay } from "./forecast";

function days(
  units: (index: number) => number,
  count: number,
  inStock: (index: number) => boolean | null = () => true,
): DemandDay[] {
  return Array.from({ length: count }, (_, index) => ({
    date: addDays("2026-06-01", index),
    units: units(index),
    inStock: inStock(index),
  }));
}

const RUN = { horizonDays: 7, averageDays: 30, available: 12, incoming: 5 };

describe("smartForecast", () => {
  it("chooses the weekday model for a strong weekly pattern and shows the evidence", () => {
    const result = smartForecast({
      ...RUN,
      days: days((i) => (i % 7 >= 5 ? 10 : 2), 140),
    });
    expect(result).toMatchObject({
      outcome: "SELECTED",
      model: "SEASONAL_NAIVE_WEEKLY",
      forecastUnits: "30.00",
      parityForecastUnits: "32.67",
      // 30 expected, less 12 available and 5 incoming.
      suggestedQuantity: 13,
      backtestCuts: 8,
      backtestRange: { lowPercent: "100", highPercent: "100" },
    });
    expect(result.scores.find((score) => score.chosen)).toMatchObject({
      model: "SEASONAL_NAIVE_WEEKLY",
      errorPercent: "0.0",
    });
    expect(result.scores.find((score) => score.model === "PARITY_AVERAGE")).toMatchObject({
      errorPercent: "8.9",
      biasPercent: "8.9",
    });
    expect(result.explanation[0]).toBe(
      "Same weekday, recent weeks was chosen: over 8 past periods of 7 days its forecasts were off by 0.0% of actual demand, against 8.9% for the recent average.",
    );
  });

  it("chooses the trend model when demand keeps growing", () => {
    const result = smartForecast({ ...RUN, days: days((i) => i, 140) });
    expect(result).toMatchObject({
      outcome: "SELECTED",
      model: "TREND_BLEND",
      forecastUnits: "936.25",
      parityForecastUnits: "871.50",
      backtestRange: { lowPercent: "107", highPercent: "112" },
    });
    expect(result.explanation[1]).toBe("Its forecasts leaned low by 8.3% on average.");
  });

  it("keeps the recent average when nothing beats it", () => {
    const result = smartForecast({ ...RUN, days: days(() => 3, 120) });
    expect(result).toMatchObject({
      outcome: "KEPT_NO_IMPROVEMENT",
      model: "PARITY_AVERAGE",
      forecastUnits: "21.00",
      parityForecastUnits: "21.00",
      backtestRange: null,
    });
    expect(result.scores.some((score) => score.chosen)).toBe(false);
  });

  it("refuses a model that beats the average but leans too far one way", () => {
    // Croston halves the error on these occasional sales but forecasts about
    // a third too much.
    const result = smartForecast({ ...RUN, days: days((i) => (i % 9 === 0 ? 9 : 0), 140) });
    const croston = result.scores.find((score) => score.model === "CROSTON_SBA");
    expect(croston).toMatchObject({ errorPercent: "39.7", biasPercent: "35.3", chosen: false });
    expect(result.outcome).toBe("KEPT_NO_IMPROVEMENT");
  });

  it("keeps the average when the history is too short to test", () => {
    const result = smartForecast({ ...RUN, days: days(() => 2, 40) });
    expect(result).toMatchObject({
      outcome: "KEPT_SHORT_HISTORY",
      forecastUnits: "14.00",
      backtestCuts: 0,
    });
  });

  it("forecasts nothing when there is less history than the sales period", () => {
    const result = smartForecast({ ...RUN, days: days(() => 2, 10) });
    expect(result).toMatchObject({
      outcome: "KEPT_SHORT_HISTORY",
      forecastUnits: null,
      parityForecastUnits: null,
      suggestedQuantity: null,
    });
  });

  it("keeps the average when nothing sold", () => {
    const result = smartForecast({ ...RUN, days: days(() => 0, 120) });
    expect(result).toMatchObject({
      outcome: "KEPT_NO_SALES",
      forecastUnits: "0.00",
      suggestedQuantity: 0,
    });
  });

  it("says when out-of-stock days were left out, and reads returns as no demand", () => {
    const result = smartForecast({
      ...RUN,
      days: days(
        (i) => (i === 100 ? -4 : 3),
        120,
        (i) => (i >= 110 && i < 113 ? false : true),
      ),
    });
    expect(result.explanation.at(-1)).toMatch(/out of stock are left out/);
  });

  it("does not suggest a quantity without knowing the stock", () => {
    const result = smartForecast({ ...RUN, available: null, days: days(() => 3, 120) });
    expect(result.suggestedQuantity).toBeNull();
  });

  it("gives the same answer every time", () => {
    const input = { ...RUN, days: days((i) => (i * 7919) % 13, 200) };
    expect(smartForecast(input)).toEqual(smartForecast(input));
  });

  it("rejects a history with a missing day or a fractional unit", () => {
    const gap = days(() => 1, 60);
    gap.splice(30, 1);
    expect(() => smartForecast({ ...RUN, days: gap })).toThrow(/consecutive days/);
    const fraction = days(() => 1, 60);
    fraction[5] = { ...fraction[5], units: 1.5 };
    expect(() => smartForecast({ ...RUN, days: fraction })).toThrow(/whole number/);
  });
});

describe("separation from Stocky Parity", () => {
  it("is never imported by the parity engine", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const root = new URL("../replenishment/", import.meta.url);
    const sources = readdirSync(root, { recursive: true, encoding: "utf8" }).filter((name) =>
      /\.tsx?$/.test(name),
    );
    expect(sources.length).toBeGreaterThan(0);
    for (const name of sources) {
      expect(readFileSync(new URL(name, root), "utf8"), name).not.toMatch(/smart-forecast/);
    }
  });
});
