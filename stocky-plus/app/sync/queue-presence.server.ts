/**
 * BullMQ queue-dispatch presence classification (NEW-PR4-C01 / D-044).
 *
 * `getJob()` returning an object is NOT equivalent to a runnable dispatch.
 * Only the committed runnable-state allowlist may lead to ENQUEUED.
 */
import type { Job, Queue } from "bullmq";

/** Committed allowlist — fail closed for any other/unknown state. */
export const RUNNABLE_BULLMQ_STATES = [
  "waiting",
  "delayed",
  "active",
  "prioritized",
  "waiting-children",
  "paused",
] as const;

export type RunnableBullmqState = (typeof RUNNABLE_BULLMQ_STATES)[number];

export const TERMINAL_BULLMQ_STATES = ["completed", "failed"] as const;

export type TerminalBullmqState = (typeof TERMINAL_BULLMQ_STATES)[number];

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

export function isRunnableBullmqState(state: string): boolean {
  return RUNNABLE_SET.has(state);
}

export function isTerminalBullmqState(state: string): boolean {
  return TERMINAL_SET.has(state);
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
    existing = await queue.getJob(queueJobId);
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
