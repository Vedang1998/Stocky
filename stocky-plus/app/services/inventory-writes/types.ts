import type { InventoryWriteCapability } from "../../lib/feature-flags.server";

export const INVENTORY_OPERATION_KINDS = [
  "ADJUSTMENT",
  "STOCKTAKE",
  "RECEIPT",
  "TRANSFER",
  "REVERSAL",
] as const;
export type InventoryOperationKind = (typeof INVENTORY_OPERATION_KINDS)[number];

/** Kinds a caller may record directly; REVERSAL goes through recordInventoryReversal. */
export type ForwardInventoryOperationKind = Exclude<
  InventoryOperationKind,
  "REVERSAL"
>;

/**
 * Kill switch that gates each kind. A reversal is gated by the capability of
 * the operation it reverses.
 */
export const CAPABILITY_BY_KIND: Record<
  ForwardInventoryOperationKind,
  InventoryWriteCapability
> = {
  ADJUSTMENT: "adjustmentWrites",
  STOCKTAKE: "stocktakeInventoryWrites",
  RECEIPT: "receiptWrites",
  TRANSFER: "transferWrites",
};

/**
 * Reason codes accepted by Shopify inventoryAdjustQuantities (Admin 2026-07).
 * https://shopify.dev/docs/apps/build/inventory-management-apps/manage-quantities-states
 */
export const SHOPIFY_INVENTORY_REASONS = [
  "correction",
  "cycle_count_available",
  "damaged",
  "movement_created",
  "movement_updated",
  "movement_received",
  "movement_canceled",
  "other",
  "promotion",
  "quality_control",
  "received",
  "reservation_created",
  "reservation_deleted",
  "reservation_updated",
  "restock",
  "safety_stock",
  "shrinkage",
] as const;
export type ShopifyInventoryReason = (typeof SHOPIFY_INVENTORY_REASONS)[number];

/**
 * Quantity names this app adjusts. Adjusting `available` also moves `on_hand`
 * by the same delta; the other names need a ledger document per change.
 */
export const ADJUSTABLE_QUANTITY_NAMES = [
  "available",
  "damaged",
  "quality_control",
  "safety_stock",
] as const;
export type AdjustableQuantityName = (typeof ADJUSTABLE_QUANTITY_NAMES)[number];

export type InventoryActorChannel = "ADMIN" | "POS" | "SYSTEM";

/** Who asked for a write. Staff identity comes from the verified session token. */
export interface InventoryActor {
  shopifyUserId: string | null;
  displayName: string | null;
  channel: InventoryActorChannel;
}

export interface InventoryOperationLineDraft {
  /** gid://shopify/InventoryItem/… */
  inventoryItemId: string;
  /** gid://shopify/ProductVariant/… when known; reporting only. */
  variantId: string | null;
  /** gid://shopify/Location/… */
  locationId: string;
  /** Signed, non-zero change to `quantityName`. */
  delta: number;
  /**
   * Quantity the caller expects Shopify to hold before the change (compare and
   * swap). null opts out; only pass null when a relative change is intended
   * regardless of concurrent movement.
   */
  changeFromQuantity: number | null;
}

export interface InventoryOperationDraft {
  kind: ForwardInventoryOperationKind;
  /**
   * Stable per business action (e.g. `stocktake:<id>:batch:1`). Replaying the
   * same key with the same payload returns the existing operation.
   */
  idempotencyKey: string;
  source: { type: string; id: string };
  reason: ShopifyInventoryReason;
  quantityName: AdjustableQuantityName;
  referenceDocumentUri: string | null;
  actor: InventoryActor;
  note: string | null;
  lines: InventoryOperationLineDraft[];
}

/** Draft as persisted, including reversal linkage. */
export interface NormalizedInventoryOperationDraft extends Omit<
  InventoryOperationDraft,
  "kind"
> {
  kind: InventoryOperationKind;
  capability: InventoryWriteCapability;
  reversesOperationId: string | null;
}

export type InventoryOperationStatus =
  | "PENDING"
  | "APPLYING"
  | "RETRY_PENDING"
  | "BLOCKED"
  | "APPLIED"
  | "PARTIALLY_APPLIED"
  | "FAILED";

export const TERMINAL_OPERATION_STATUSES: ReadonlySet<InventoryOperationStatus> =
  new Set(["APPLIED", "PARTIALLY_APPLIED", "FAILED"]);

export type InventoryOperationLineStatus =
  "PENDING" | "IN_FLIGHT" | "APPLIED" | "FAILED" | "CONFLICT";

export interface InventoryOperationLineResult {
  lineId: string;
  lineNumber: number;
  inventoryItemId: string;
  variantId: string | null;
  locationId: string;
  delta: number;
  changeFromQuantity: number | null;
  status: InventoryOperationLineStatus;
  quantityAfterChange: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface InventoryOperationResult {
  operationId: string;
  idempotencyKey: string;
  kind: InventoryOperationKind;
  status: InventoryOperationStatus;
  lineCount: number;
  appliedLineCount: number;
  failedLineCount: number;
  conflictLineCount: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  completedAt: Date | null;
  lines: InventoryOperationLineResult[];
}
