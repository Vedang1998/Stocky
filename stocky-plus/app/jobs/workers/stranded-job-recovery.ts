import {
  recoverStrandedEnqueuedJobs,
  type RecoverStrandedEnqueuedResult,
} from "../../sync/dispatcher.server";

export const DEFAULT_STRANDED_RECOVERY_INTERVAL_MS = 60_000;

export function resolveStrandedRecoveryIntervalMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.STOCKY_STRANDED_RECOVERY_INTERVAL_MS?.trim();
  if (!raw) return DEFAULT_STRANDED_RECOVERY_INTERVAL_MS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      "STOCKY_STRANDED_RECOVERY_INTERVAL_MS must be a whole number of milliseconds",
    );
  }
  return value;
}

/**
 * A job recorded as enqueued whose queue delivery is gone (failed, removed or
 * never runnable) would otherwise wait forever without anyone seeing it
 * (#122). This loop hands each such job, once it has waited past the
 * dispatcher's stranded threshold, back for a retry or dead-letters it with a
 * data issue, according to its execution strategy.
 */
export function startStrandedJobRecoveryLoop(
  env: NodeJS.ProcessEnv = process.env,
  recover: () => Promise<RecoverStrandedEnqueuedResult> = () =>
    recoverStrandedEnqueuedJobs(),
): NodeJS.Timeout | null {
  const intervalMs = resolveStrandedRecoveryIntervalMs(env);
  if (intervalMs === 0) {
    console.warn(
      "Stranded job recovery is off (STOCKY_STRANDED_RECOVERY_INTERVAL_MS=0): jobs whose queue delivery was lost stay enqueued",
    );
    return null;
  }

  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void recover()
      .then((result) => {
        if (
          result.recovered > 0 ||
          result.deadLettered > 0 ||
          result.indeterminate > 0 ||
          result.isolatedFailures > 0
        ) {
          console.warn(
            `Stranded job recovery: ${result.recovered} retried, ${result.deadLettered} dead-lettered, ${result.indeterminate} undecided, ${result.isolatedFailures} failed`,
          );
        }
      })
      .catch((error) => {
        console.error(
          "Stranded job recovery run failed:",
          error instanceof Error ? error.message : error,
        );
      })
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  console.log(`Stranded job recovery every ${intervalMs}ms`);
  return timer;
}
