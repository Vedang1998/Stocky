import {
  runDailyStockSnapshots,
  type SnapshotRunSummary,
} from "../../lib/stock-history/daily-run.server";

export const DEFAULT_STOCK_SNAPSHOT_INTERVAL_MS = 10 * 60_000;

export function resolveStockSnapshotIntervalMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.STOCKY_STOCK_SNAPSHOT_INTERVAL_MS?.trim();
  if (!raw) return DEFAULT_STOCK_SNAPSHOT_INTERVAL_MS;
  const value = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      "STOCKY_STOCK_SNAPSHOT_INTERVAL_MS must be a whole number of milliseconds",
    );
  }
  return value;
}

/**
 * Historical stock on hand is read from one stock snapshot per shop per
 * calendar day. Each shop's day ends at a different instant, so this loop
 * looks at every shop on each pass and captures the ones whose day has just
 * ended. Runs never overlap within one process; across processes the first
 * writer of a day wins and the others write nothing.
 */
export function startDailyStockSnapshotLoop(
  env: NodeJS.ProcessEnv = process.env,
  run: () => Promise<SnapshotRunSummary> = () => runDailyStockSnapshots(),
): NodeJS.Timeout | null {
  const intervalMs = resolveStockSnapshotIntervalMs(env);
  if (intervalMs === 0) {
    console.warn(
      "Daily stock snapshots are off (STOCKY_STOCK_SNAPSHOT_INTERVAL_MS=0): days that end while they are off will be missing from stock history",
    );
    return null;
  }

  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void run()
      .then((summary) => {
        if (summary.captured > 0 || summary.failed > 0) {
          console.log(
            `Daily stock snapshots: ${summary.captured} shop(s) captured (${summary.levels} stock levels), ${summary.waiting} waiting, ${summary.failed} failed`,
          );
        }
      })
      .catch((error) => {
        console.error(
          "Daily stock snapshot run failed:",
          error instanceof Error ? error.message : error,
        );
      })
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  console.log(`Daily stock snapshots checked every ${intervalMs}ms`);
  return timer;
}
