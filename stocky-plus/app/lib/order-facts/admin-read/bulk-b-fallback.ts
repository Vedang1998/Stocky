/**
 * Bulk B production disposition and costed per-order refund fallback.
 *
 * Bulk B is schema-valid under specifiedRules but is not a production import
 * path. Refund-bearing orders use per-order `order(id:)` / `RefundFactById`.
 * No bulk-operation submit mutation happens in this module.
 */

import { ORDER_LINE_IMPORT_ENVELOPE } from "./constants";

/** Production Bulk B execution is disabled (LIST refunds / non-Node lines). */
export const BULK_B_PRODUCTION_ENABLED = false;

export type BulkBFallbackCostInput = {
  /** Orders that report non-zero totalRefundedSet or a non-empty refunds LIST. */
  refundBearingOrderCount: number;
  /** Additional RefundFactById walks when embedded refund children are truncated. */
  truncatedRefundContinuationCount?: number;
};

export type BulkBFallbackCost = {
  productionEnabled: false;
  additionalAdminRequests: number;
  lineImportEnvelope: number;
  requestsPerEnvelopeLine: number;
  withinSingleSnapshotBudget: boolean;
  detail: string;
};

/**
 * Cost the Bulk-B fallback against the 1,000,000-line historical envelope.
 * One additional Admin request per refund-bearing order, plus explicit
 * continuation calls. This is not a live-store measurement.
 */
export function costBulkBFallback(
  input: BulkBFallbackCostInput,
): BulkBFallbackCost {
  const continuations = input.truncatedRefundContinuationCount ?? 0;
  const additionalAdminRequests =
    input.refundBearingOrderCount + continuations;
  const requestsPerEnvelopeLine =
    additionalAdminRequests / ORDER_LINE_IMPORT_ENVELOPE;
  return {
    productionEnabled: false,
    additionalAdminRequests,
    lineImportEnvelope: ORDER_LINE_IMPORT_ENVELOPE,
    requestsPerEnvelopeLine,
    withinSingleSnapshotBudget: additionalAdminRequests <= 250,
    detail:
      "Bulk B production disabled. Fallback is per-order order(id:)/RefundFactById " +
      "for refund-bearing orders (non-zero totalRefundedSet or non-empty refunds LIST). " +
      "Live refund-bearing-order ratio is UNVERIFIED (no store submission).",
  };
}

export function orderReportsRefundPresence(input: {
  totalRefundedShopAmount?: string | null;
  refundCount: number;
}): boolean {
  if (input.refundCount > 0) return true;
  const amount = input.totalRefundedShopAmount;
  if (amount == null || amount === "") return false;
  return !/^0(?:\.0+)?$/.test(amount);
}
