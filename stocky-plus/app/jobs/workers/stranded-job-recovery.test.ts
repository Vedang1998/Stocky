import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecoverStrandedEnqueuedResult } from "../../sync/dispatcher.server";
import {
  DEFAULT_STRANDED_RECOVERY_INTERVAL_MS,
  resolveStrandedRecoveryIntervalMs,
  startStrandedJobRecoveryLoop,
} from "./stranded-job-recovery";

const NOTHING: RecoverStrandedEnqueuedResult = {
  recovered: 0,
  deadLettered: 0,
  stillRunnable: 0,
  indeterminate: 0,
  isolatedFailures: 0,
};

describe("stranded job recovery loop (#122)", () => {
  let timer: NodeJS.Timeout | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    if (timer) clearInterval(timer);
    timer = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs recovery every minute by default", async () => {
    const recover = vi.fn(async () => NOTHING);
    timer = startStrandedJobRecoveryLoop({}, recover);

    await vi.advanceTimersByTimeAsync(DEFAULT_STRANDED_RECOVERY_INTERVAL_MS - 1);
    expect(recover).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(recover).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(DEFAULT_STRANDED_RECOVERY_INTERVAL_MS);
    expect(recover).toHaveBeenCalledTimes(2);
  });

  it("does not start a run while the last one is still going", async () => {
    let finish: (result: RecoverStrandedEnqueuedResult) => void = () => {};
    const recover = vi.fn(
      () =>
        new Promise<RecoverStrandedEnqueuedResult>((resolve) => {
          finish = resolve;
        }),
    );
    timer = startStrandedJobRecoveryLoop(
      { STOCKY_STRANDED_RECOVERY_INTERVAL_MS: "1000" },
      recover,
    );

    await vi.advanceTimersByTimeAsync(3_000);
    expect(recover).toHaveBeenCalledTimes(1);
    finish(NOTHING);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(recover).toHaveBeenCalledTimes(2);
  });

  it("reports what it changed and keeps going after a failed run", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const recover = vi
      .fn<() => Promise<RecoverStrandedEnqueuedResult>>()
      .mockResolvedValueOnce({ ...NOTHING, recovered: 2, deadLettered: 1 })
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValue(NOTHING);
    timer = startStrandedJobRecoveryLoop(
      { STOCKY_STRANDED_RECOVERY_INTERVAL_MS: "1000" },
      recover,
    );

    await vi.advanceTimersByTimeAsync(3_000);

    expect(recover).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("2 retried, 1 dead-lettered");
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][1])).toContain("database unavailable");
  });

  it("can be turned off, and says so", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const recover = vi.fn(async () => NOTHING);

    timer = startStrandedJobRecoveryLoop(
      { STOCKY_STRANDED_RECOVERY_INTERVAL_MS: "0" },
      recover,
    );

    expect(timer).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each(["-1", "1.5", "soon"])("refuses an interval of %s", (value) => {
    expect(() =>
      resolveStrandedRecoveryIntervalMs({
        STOCKY_STRANDED_RECOVERY_INTERVAL_MS: value,
      }),
    ).toThrow(/whole number/);
  });
});
