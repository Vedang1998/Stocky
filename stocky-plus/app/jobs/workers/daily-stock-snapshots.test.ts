import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SnapshotRunSummary } from "../../lib/stock-history/daily-run.server";
import {
  DEFAULT_STOCK_SNAPSHOT_INTERVAL_MS,
  resolveStockSnapshotIntervalMs,
  startDailyStockSnapshotLoop,
} from "./daily-stock-snapshots";

const QUIET: SnapshotRunSummary = {
  shops: 3,
  captured: 0,
  levels: 0,
  waiting: 0,
  failed: 0,
};

describe("daily stock snapshot loop", () => {
  let timer: NodeJS.Timeout | null = null;
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    log = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    if (timer) clearInterval(timer);
    timer = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("looks for due shops every ten minutes by default", async () => {
    const run = vi.fn(async () => QUIET);
    timer = startDailyStockSnapshotLoop({}, run);

    await vi.advanceTimersByTimeAsync(DEFAULT_STOCK_SNAPSHOT_INTERVAL_MS - 1);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(DEFAULT_STOCK_SNAPSHOT_INTERVAL_MS);
    expect(run).toHaveBeenCalledTimes(2);
    expect(DEFAULT_STOCK_SNAPSHOT_INTERVAL_MS).toBe(600_000);
  });

  it("does not start a run while the last one is still going", async () => {
    let finish: (summary: SnapshotRunSummary) => void = () => {};
    const run = vi.fn(
      () =>
        new Promise<SnapshotRunSummary>((resolve) => {
          finish = resolve;
        }),
    );
    timer = startDailyStockSnapshotLoop(
      { STOCKY_STOCK_SNAPSHOT_INTERVAL_MS: "1000" },
      run,
    );

    await vi.advanceTimersByTimeAsync(3_000);
    expect(run).toHaveBeenCalledTimes(1);
    finish(QUIET);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("keeps going after a run throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi
      .fn<() => Promise<SnapshotRunSummary>>()
      .mockRejectedValueOnce(new Error("database is down"))
      .mockResolvedValue(QUIET);
    timer = startDailyStockSnapshotLoop(
      { STOCKY_STOCK_SNAPSHOT_INTERVAL_MS: "1000" },
      run,
    );

    await vi.advanceTimersByTimeAsync(2_000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith(
      "Daily stock snapshot run failed:",
      "database is down",
    );
  });

  it("reports a run only when a shop was captured or failed", async () => {
    const run = vi
      .fn<() => Promise<SnapshotRunSummary>>()
      .mockResolvedValueOnce(QUIET)
      .mockResolvedValueOnce({ ...QUIET, captured: 2, levels: 140, failed: 1 });
    timer = startDailyStockSnapshotLoop(
      { STOCKY_STOCK_SNAPSHOT_INTERVAL_MS: "1000" },
      run,
    );
    log.mockClear();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(log).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(log).toHaveBeenCalledWith(
      "Daily stock snapshots: 2 shop(s) captured (140 stock levels), 0 waiting, 1 failed",
    );
  });

  it("stays off when the interval is 0 and says what that costs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const run = vi.fn(async () => QUIET);
    timer = startDailyStockSnapshotLoop(
      { STOCKY_STOCK_SNAPSHOT_INTERVAL_MS: "0" },
      run,
    );

    expect(timer).toBeNull();
    vi.advanceTimersByTime(DEFAULT_STOCK_SNAPSHOT_INTERVAL_MS * 3);
    expect(run).not.toHaveBeenCalled();
    expect(warn.mock.calls[0][0]).toContain("missing from stock history");
  });

  it("refuses an interval that is not a whole number of milliseconds", () => {
    for (const bad of ["-1", "1.5", "ten", "1e3", "99999999999999999999"]) {
      expect(() =>
        resolveStockSnapshotIntervalMs({
          STOCKY_STOCK_SNAPSHOT_INTERVAL_MS: bad,
        }),
      ).toThrow("STOCKY_STOCK_SNAPSHOT_INTERVAL_MS");
    }
    expect(
      resolveStockSnapshotIntervalMs({
        STOCKY_STOCK_SNAPSHOT_INTERVAL_MS: " 30000 ",
      }),
    ).toBe(30_000);
    expect(resolveStockSnapshotIntervalMs({})).toBe(
      DEFAULT_STOCK_SNAPSHOT_INTERVAL_MS,
    );
  });
});
