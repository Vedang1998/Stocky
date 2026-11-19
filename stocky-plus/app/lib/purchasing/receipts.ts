/**
 * How a receipt's status reads to a merchant, and what can be done with a
 * receipt in that status. Safe for client and server bundles.
 */

export const RECEIPT_STATUSES = [
  "PENDING",
  "POSTED",
  "PARTIALLY_POSTED",
  "FAILED",
  "REVERSING",
  "REVERSED",
  "PARTIALLY_REVERSED",
  "REVERSAL_FAILED",
] as const;

export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export type BadgeTone = "info" | "success" | "warning" | "critical" | "neutral";

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  PENDING: "Waiting for Shopify",
  POSTED: "Received",
  PARTIALLY_POSTED: "Partly received",
  FAILED: "Not received",
  REVERSING: "Reversal waiting for Shopify",
  REVERSED: "Reversed",
  PARTIALLY_REVERSED: "Partly reversed",
  REVERSAL_FAILED: "Reversal failed",
};

export const RECEIPT_STATUS_TONES: Record<ReceiptStatus, BadgeTone> = {
  PENDING: "warning",
  POSTED: "success",
  PARTIALLY_POSTED: "warning",
  FAILED: "critical",
  REVERSING: "warning",
  REVERSED: "neutral",
  PARTIALLY_REVERSED: "warning",
  REVERSAL_FAILED: "critical",
};

/** Shopify has not answered yet, so the receipt or its reversal can be finished. */
export function canResumeReceipt(status: ReceiptStatus): boolean {
  return status === "PENDING" || status === "REVERSING";
}

/** Stock was received and has not been taken back out. */
export function canReverseReceipt(status: ReceiptStatus): boolean {
  return status === "POSTED" || status === "PARTIALLY_POSTED";
}
