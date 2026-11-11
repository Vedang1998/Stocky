/**
 * Purchase-order lifecycle rules.
 *
 * Draft → Sent → Ordered → Partially received → Received → Closed, with
 * Cancelled as a terminal branch and archiving as a separate flag. Receipt
 * postings are the only path to PARTIAL / RECEIVED; this module never moves a
 * PO into those states.
 */

export const PURCHASE_ORDER_STATUSES = [
  "DRAFT",
  "SENT",
  "ORDERED",
  "PARTIAL",
  "RECEIVED",
  "CLOSED",
  "CANCELLED",
] as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

/** Statuses whose remaining quantities count as incoming stock. */
export const INCOMING_STATUSES = ["SENT", "ORDERED", "PARTIAL"] as const;

export const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ORDERED: "Ordered",
  PARTIAL: "Partially received",
  RECEIVED: "Received",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export type PurchaseOrderAction =
  | "markSent"
  | "markOrdered"
  | "cancel"
  | "close"
  | "archive"
  | "unarchive"
  | "delete";

export type LifecycleState = {
  status: PurchaseOrderStatus;
  archived: boolean;
  /** True once any unit has been received against the PO. */
  hasReceipts: boolean;
};

export class PurchaseOrderStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseOrderStateError";
  }
}

function denial(
  state: LifecycleState,
  action: PurchaseOrderAction,
): string | null {
  const label = STATUS_LABELS[state.status].toLowerCase();
  if (state.archived && action !== "unarchive") {
    return "Archived purchase orders are read-only. Unarchive it first.";
  }
  switch (action) {
    case "markSent":
      return ["DRAFT", "SENT", "ORDERED", "PARTIAL"].includes(state.status)
        ? null
        : `A ${label} purchase order cannot be sent.`;
    case "markOrdered":
      return state.status === "DRAFT" || state.status === "SENT"
        ? null
        : `A ${label} purchase order cannot be marked as ordered.`;
    case "cancel":
      if (state.hasReceipts) {
        return "Stock has already been received on this purchase order. Close it instead of cancelling.";
      }
      return ["DRAFT", "SENT", "ORDERED"].includes(state.status)
        ? null
        : `A ${label} purchase order cannot be cancelled.`;
    case "close":
      return state.status === "PARTIAL" || state.status === "RECEIVED"
        ? null
        : "Only partially or fully received purchase orders can be closed.";
    case "archive":
      return ["RECEIVED", "CLOSED", "CANCELLED"].includes(state.status)
        ? null
        : "Only received, closed or cancelled purchase orders can be archived.";
    case "unarchive":
      return state.archived ? null : "This purchase order is not archived.";
    case "delete":
      return state.status === "DRAFT"
        ? null
        : "Only draft purchase orders can be deleted. Cancel it instead.";
  }
}

export function canPerform(
  state: LifecycleState,
  action: PurchaseOrderAction,
): boolean {
  return denial(state, action) === null;
}

export function assertCanPerform(
  state: LifecycleState,
  action: PurchaseOrderAction,
): void {
  const reason = denial(state, action);
  if (reason) throw new PurchaseOrderStateError(reason);
}

export function nextStatusFor(
  status: PurchaseOrderStatus,
  action: PurchaseOrderAction,
): PurchaseOrderStatus {
  switch (action) {
    case "markSent":
      return status === "DRAFT" ? "SENT" : status;
    case "markOrdered":
      return "ORDERED";
    case "cancel":
      return "CANCELLED";
    case "close":
      return "CLOSED";
    default:
      return status;
  }
}

/** Header fields printed on supplier documents, dates and terms. */
export function canEditHeader(state: LifecycleState): boolean {
  return !state.archived && state.status !== "CANCELLED";
}

/** Destination, currency and charges are fixed once receiving starts. */
export function canEditCommercialTerms(state: LifecycleState): boolean {
  return (
    !state.archived &&
    ["DRAFT", "SENT", "ORDERED"].includes(state.status) &&
    !state.hasReceipts
  );
}

/** Lines can be added or re-quantified until the PO is received in full. */
export function canEditLines(state: LifecycleState): boolean {
  return (
    !state.archived &&
    ["DRAFT", "SENT", "ORDERED", "PARTIAL"].includes(state.status)
  );
}

export function isIncoming(status: PurchaseOrderStatus): boolean {
  return (INCOMING_STATUSES as readonly string[]).includes(status);
}

export function isPurchaseOrderStatus(
  value: string,
): value is PurchaseOrderStatus {
  return (PURCHASE_ORDER_STATUSES as readonly string[]).includes(value);
}
