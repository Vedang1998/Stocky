/**
 * BullMQ queue-dispatch presence classification (NEW-PR4-C01 / D-044 / D-045).
 *
 * `getJob()` returning an object is NOT equivalent to a runnable dispatch.
 * Only the committed runnable-state allowlist may lead to ENQUEUED.
 *
 * Pinned BullMQ 5.81.2: `Job.getState()` does not emit `paused`. Upgrading
 * BullMQ requires revalidating this allowlist against reachable states.
 */
import type { Job, Queue } from "bullmq";

/**
 * Committed allowlist — fail closed for any other/unknown state.
 * Subset of states reachable from BullMQ 5.81.2 `Job.getState()`.
 */
export const RUNNABLE_BULLMQ_STATES = [
  "waiting",
  "delayed",
  "active",
  "prioritized",
  "waiting-children",
] as const;

export type RunnableBullmqState = (typeof RUNNABLE_BULLMQ_STATES)[number];

export const TERMINAL_BULLMQ_STATES = ["completed", "failed"] as const;

export type TerminalBullmqState = (typeof TERMINAL_BULLMQ_STATES)[number];

/** Documented max for the test-only Redis lookup timeout (ms). */
export const MAX_TEST_REDIS_FAST_FAIL_MS = 5_000;

const RUNNABLE_SET = new Set<string>(RUNNABLE_BULLMQ_STATES);
const TERMINAL_SET = new Set<string>(TERMINAL_BULLMQ_STATES);

export type QueueDispatchPresence =
  | { status: "RUNNABLE_EXISTING"; queueState: string }
  | { status: "RUNNABLE_CREATED"; queueState: string }
  | { status: "TERMINAL_EXISTING"; queueState: string }
  | { status: "MISSING" }
  | { status: "SHOP_DISABLED" }
  | { status: "QUEUE_UNAVAILABLE"; reason: string }
  | { status: "UNKNOWN_STATE"; queueState: string };

/**
 * Narrow test-only seam for unsupported future BullMQ states that the pinned
 * BullMQ version cannot naturally produce. Production never sets this.
 * Must not replace terminal / missing / retained / outage integration tests.
 */
let testStateClassificationSeam:
  | ((queueState: string) => QueueDispatchPresence | null)
  | null = null;

export function __setQueueStateClassificationSeamForTests(
  seam: ((queueState: string) => QueueDispatchPresence | null) | null,
): void {
  testStateClassificationSeam = seam;
}

export function isRunnableBullmqState(state: string): boolean {
  return RUNNABLE_SET.has(state);
}

export function isTerminalBullmqState(state: string): boolean {
  return TERMINAL_SET.has(state);
}

/**
 * Resolve the test-only Redis lookup timeout.
 * Honored only when NODE_ENV === "test". Ignored in production and development.
 * Must be a positive integer ≤ MAX_TEST_REDIS_FAST_FAIL_MS.
 */
export function resolveTestRedisFastFailMs(
  env: NodeJS.ProcessEnv = process.env,
): number | null {
  if (env.NODE_ENV !== "test") {
    return null;
  }
  const raw = env.STOCKY_TEST_REDIS_FAST_FAIL_MS;
  if (raw == null || raw.trim() === "") {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_TEST_REDIS_FAST_FAIL_MS) {
    return null;
  }
  return parsed;
}

/**
 * Classify an existing BullMQ job object by its live state.
 * Never treats mere object existence as runnable.
 */
export async function classifyExistingQueueJob(
  job: Job,
): Promise<QueueDispatchPresence> {
  let queueState: string;
  try {
    queueState = await job.getState();
  } catch (err) {
    return {
      status: "QUEUE_UNAVAILABLE",
      reason: err instanceof Error ? err.message : "getState_failed",
    };
  }

  if (testStateClassificationSeam) {
    const overridden = testStateClassificationSeam(queueState);
    if (overridden) return overridden;
  }

  if (isRunnableBullmqState(queueState)) {
    return { status: "RUNNABLE_EXISTING", queueState };
  }
  if (isTerminalBullmqState(queueState)) {
    return { status: "TERMINAL_EXISTING", queueState };
  }
  return { status: "UNKNOWN_STATE", queueState };
}

/**
 * Look up the deterministic queue job ID and classify presence.
 */
export async function inspectQueueDispatchPresence(
  queue: Queue,
  queueJobId: string,
): Promise<QueueDispatchPresence> {
  let existing: Job | undefined;
  try {
    const getJobPromise = queue.getJob(queueJobId);
    const fastFailMs = resolveTestRedisFastFailMs();
    if (fastFailMs == null) {
      existing = await getJobPromise;
    } else {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        existing = await Promise.race([
          getJobPromise.finally(() => {
            if (timer !== undefined) clearTimeout(timer);
          }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("queue_lookup_timeout")),
              fastFailMs,
            );
          }),
        ]);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
      // Absorb late rejection from the losing timeout/getJob promise.
      void getJobPromise.catch(() => undefined);
    }
  } catch (err) {
    return {
      status: "QUEUE_UNAVAILABLE",
      reason: err instanceof Error ? err.message : "getJob_failed",
    };
  }

  if (!existing) {
    return { status: "MISSING" };
  }
  return classifyExistingQueueJob(existing);
}

/**
 * After queue.add(), re-inspect the job — add() may return a retained terminal
 * job when the deterministic ID already exists.
 */
export async function classifyAfterQueueAdd(
  queue: Queue,
  queueJobId: string,
  added: Job | undefined,
): Promise<QueueDispatchPresence> {
  if (!added) {
    return inspectQueueDispatchPresence(queue, queueJobId);
  }
  const classified = await classifyExistingQueueJob(added);
  if (classified.status === "RUNNABLE_EXISTING") {
    return { status: "RUNNABLE_CREATED", queueState: classified.queueState };
  }
  return classified;
}
