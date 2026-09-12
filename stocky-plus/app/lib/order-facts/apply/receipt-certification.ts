/**
 * Receipt success certifies a terminal accepted operation, not an attempt.
 * Generic `noop` / zero-writes is not success; reasons are allowlisted.
 */
import type { OrderApplyObservationResult } from "./types";

export const RECEIPT_TERMINAL_ACCEPTED_NOOP_REASONS = [
  "already_live",
  "already_absent",
  "overlap_agree",
  "presence_keep_live",
  "absent_not_later",
  "preserve_established_tombstone",
  "already_unverified_delete",
  "first_insert_absent_preserve_no_row",
  "clock_a_stale",
  "terminal_first_confirmation",
] as const;

const TERMINAL_NOOP = new Set<string>(RECEIPT_TERMINAL_ACCEPTED_NOOP_REASONS);

export function observationCertifiesReceiptSuccess(
  result: Pick<OrderApplyObservationResult, "outcome"> & {
    reason?: string | null;
  },
): boolean {
  if (result.outcome === "applied" || result.outcome === "already_applied") {
    return true;
  }
  if (result.outcome === "noop") {
    return Boolean(result.reason && TERMINAL_NOOP.has(result.reason));
  }
  return false;
}

export function batchCertifiesReceiptSuccess(
  results: readonly Pick<OrderApplyObservationResult, "outcome" | "reason">[],
): boolean {
  return (
    results.length > 0 &&
    results.every((result) => observationCertifiesReceiptSuccess(result))
  );
}
