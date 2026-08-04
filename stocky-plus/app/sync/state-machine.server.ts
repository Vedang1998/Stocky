/**
 * DurableJob legal state transitions (Phase 1 PR 4 + D-043 corrections).
 * Must stay in sync with stocky_durable_job_transition_guard() in SQL.
 */
import type { DurableJobState } from "@prisma/client";
import { SyncControlPlaneError } from "./errors";

/** Legal edges — includes uninstall cancel from DISPATCH_LEASED and RUNNING. */
export const DURABLE_JOB_TRANSITIONS: ReadonlyArray<
  readonly [DurableJobState, DurableJobState]
> = [
  ["PENDING", "DISPATCH_LEASED"],
  ["PENDING", "CANCELLED"],
  ["DISPATCH_LEASED", "ENQUEUED"],
  ["DISPATCH_LEASED", "PENDING"], // lease expiry recovery
  ["DISPATCH_LEASED", "CANCELLED"], // F-PR4-03
  ["ENQUEUED", "RUNNING"],
  ["ENQUEUED", "CANCELLED"],
  ["RUNNING", "SUCCEEDED"],
  ["RUNNING", "RETRY_WAIT"],
  ["RUNNING", "FAILED"],
  ["RUNNING", "CANCELLED"], // F-PR4-03
  ["RETRY_WAIT", "DISPATCH_LEASED"],
  ["RETRY_WAIT", "CANCELLED"],
  ["FAILED", "DEAD_LETTERED"],
] as const;

const TRANSITION_SET = new Set(
  DURABLE_JOB_TRANSITIONS.map(([from, to]) => `${from}->${to}`),
);

/** SQL-compatible list for drift verification. */
export const DURABLE_JOB_TRANSITION_PAIRS: ReadonlyArray<{
  from: DurableJobState;
  to: DurableJobState;
}> = DURABLE_JOB_TRANSITIONS.map(([from, to]) => ({ from, to }));

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

/** States cancelled on uninstall — every non-terminal cancellable state. */
export const CANCELLABLE_DURABLE_JOB_STATES: readonly DurableJobState[] = [
  "PENDING",
  "DISPATCH_LEASED",
  "ENQUEUED",
  "RUNNING",
  "RETRY_WAIT",
] as const;

/** Assert every cancellable state has a legal → CANCELLED edge. */
export function assertCancellableTransitionCoverage(): void {
  for (const state of CANCELLABLE_DURABLE_JOB_STATES) {
    if (!isLegalTransition(state, "CANCELLED")) {
      throw new Error(
        `Cancellable state ${state} lacks legal → CANCELLED transition`,
      );
    }
  }
}
