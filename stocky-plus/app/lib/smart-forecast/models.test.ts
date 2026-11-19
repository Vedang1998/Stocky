import { describe, expect, it } from "vitest";
import { forecastWith, minimumHistory, SMART_MODELS } from "./models";

const SETTINGS = { averageDays: 3 };

describe("forecastWith", () => {
  it("averages like the parity method, counting out-of-stock days as the zero they sold", () => {
    expect(forecastWith("PARITY_AVERAGE", [9, 2, null, 4], 2, SETTINGS)).toEqual([2, 2]);
  });

  it("returns nothing until a model has the history it needs", () => {
    for (const model of SMART_MODELS) {
      const needed = minimumHistory(model, SETTINGS);
      expect(forecastWith(model, Array(needed - 1).fill(1), 1, SETTINGS)).toBeNull();
      expect(forecastWith(model, Array(needed).fill(1), 1, SETTINGS)).not.toBeNull();
    }
  });

  it("repeats the weekday pattern of the last four weeks", () => {
    // Index 0 is the same weekday as the first day forecast.
    const history = Array.from({ length: 28 }, (_, i) => (i % 7 >= 5 ? 10 : 2));
    expect(forecastWith("SEASONAL_NAIVE_WEEKLY", history, 9, SETTINGS)).toEqual([
      2, 2, 2, 2, 2, 10, 10, 2, 2,
    ]);
  });

  it("uses the in-stock weekdays only, and the overall average for a weekday never in stock", () => {
    const history: (number | null)[] = Array.from({ length: 28 }, (_, i) =>
      i % 7 === 0 ? null : i % 7 === 1 ? (i === 1 ? 8 : 4) : 3,
    );
    const forecast = forecastWith("SEASONAL_NAIVE_WEEKLY", history, 2, SETTINGS);
    // Weekday 0 was out of stock every week: its forecast is the 80 units sold
    // on the 24 in-stock days. Weekday 1 sold 8, 4, 4 and 4.
    expect(forecast).toEqual([80 / 24, 5]);
  });

  it("blends the recent level with a fitted trend line", () => {
    const history = Array.from({ length: 56 }, (_, i) => i);
    // Level: the last 3 days average 54. The line y = x reaches 56 and 57.
    expect(forecastWith("TREND_BLEND", history, 2, SETTINGS)).toEqual([55, 55.5]);
  });

  it("never forecasts below zero on a falling trend", () => {
    const history = Array.from({ length: 56 }, (_, i) => (i < 50 ? 55 - i : 0));
    const forecast = forecastWith("TREND_BLEND", history, 30, SETTINGS) as number[];
    expect(Math.min(...forecast)).toBe(0);
  });

  it("forecasts occasional sales as size over interval, with the SBA correction", () => {
    const history = Array.from({ length: 56 }, (_, i) => (i % 4 === 3 ? 4 : 0));
    // A sale of 4 every 4 days is 1 a day; SBA scales by 1 − 0.1 / 2.
    expect(forecastWith("CROSTON_SBA", history, 2, SETTINGS)).toEqual([0.95, 0.95]);
    expect(forecastWith("CROSTON_SBA", Array(56).fill(0), 1, SETTINGS)).toEqual([0]);
  });

  it("refuses a horizon that is not a positive whole number", () => {
    expect(() => forecastWith("PARITY_AVERAGE", [1, 1, 1], 0, SETTINGS)).toThrow(RangeError);
    expect(() => forecastWith("PARITY_AVERAGE", [1, 1, 1], 1.5, SETTINGS)).toThrow(RangeError);
  });
});
