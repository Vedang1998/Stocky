/**
 * DurableJob legal state transitions (Phase 1 PR 4).
 */
import type { DurableJobState } from "@prisma/client";
import { SyncControlPlaneError } from "./errors";

export type DurableJobTransition = {
  from: DurableJobState;
  to: DurableJobState;
};

/** Legal edges from architecture state machine. */
export const DURABLE_JOB_TRANSITIONS: ReadonlyArray<
  readonly [DurableJobState, DurableJobState]
> = [
  ["PENDING", "DISPATCH_LEASED"],
  ["PENDING", "CANCELLED"],
  ["DISPATCH_LEASED", "ENQUEUED"],
  ["DISPATCH_LEASED", "PENDING"], // lease expiry recovery
  ["ENQUEUED", "RUNNING"],
  ["ENQUEUED", "CANCELLED"],
  ["RUNNING", "SUCCEEDED"],
  ["RUNNING", "RETRY_WAIT"],
  ["RUNNING", "FAILED"],
  ["RETRY_WAIT", "DISPATCH_LEASED"],
  ["RETRY_WAIT", "CANCELLED"],
  ["FAILED", "DEAD_LETTERED"],
] as const;

const TRANSITION_SET = new Set(
  DURABLE_JOB_TRANSITIONS.map(([from, to]) => `${from}->${to}`),
);

export function isLegalTransition(
  from: DurableJobState,
  to: DurableJobState,
): boolean {
  if (from === to) return false;
  return TRANSITION_SET.has(`${from}->${to}`);
}

/** Fail closed on illegal DurableJob transitions. */
export function assertTransition(
  from: DurableJobState,
  to: DurableJobState,
): void {
  if (!isLegalTransition(from, to)) {
    throw new SyncControlPlaneError(
      "illegal_job_transition",
      `Illegal DurableJob transition: ${from} → ${to}`,
    );
  }
}

export const TERMINAL_DURABLE_JOB_STATES: ReadonlySet<DurableJobState> = new Set([
  "SUCCEEDED",
  "DEAD_LETTERED",
  "CANCELLED",
]);

export function isTerminalDurableJobState(state: DurableJobState): boolean {
  return TERMINAL_DURABLE_JOB_STATES.has(state);
}

/** States cancelled on uninstall. */
export const CANCELLABLE_DURABLE_JOB_STATES: readonly DurableJobState[] = [
  "PENDING",
  "DISPATCH_LEASED",
  "ENQUEUED",
  "RETRY_WAIT",
] as const;
