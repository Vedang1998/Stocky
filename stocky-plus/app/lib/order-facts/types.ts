/**
 * PR6-A frozen order/refund fact contracts for later PR6-B and PR6-C.
 *
 * Types and interfaces only. No Prisma import, no GraphQL-generated import,
 * no network I/O, no database I/O, no applicator behavior.
 *
 * Money values are exact decimal strings. Never JavaScript Number conversion.
 */

import type { OrderResourceKind } from "./constants";

export type { OrderResourceKind } from "./constants";

/** Exact Shopify MoneyV2.amount text. Never Number. */
export type ExactMoneyText = string;

export type MoneyBagSides = {
  shopAmount: ExactMoneyText;
  shopCurrencyCode: string;
  presentmentAmount: ExactMoneyText;
  presentmentCurrencyCode: string;
};

export type OptionalMoneyBagSides = {
  shopAmount: ExactMoneyText | null;
  shopCurrencyCode: string | null;
  presentmentAmount: ExactMoneyText | null;
  presentmentCurrencyCode: string | null;
};

export const ORDER_EXISTENCE_STATES = ["LIVE", "ABSENT"] as const;
export type OrderExistenceState = (typeof ORDER_EXISTENCE_STATES)[number];

export const ORDER_EXISTENCE_KINDS = [
  "LIVE_REFETCH",
  "LIVE_FULL_SYNC_PRESENT",
  "ABSENT_CONFIRMED_QUERY",
  "INACCESSIBLE_HISTORY_WINDOW",
  "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
] as const;
export type OrderExistenceKind = (typeof ORDER_EXISTENCE_KINDS)[number];

export const ORDER_ATTRIBUTE_FRESHNESS_STATES = ["ORDERED", "DEGRADED"] as const;
export type OrderAttributeFreshnessState =
  (typeof ORDER_ATTRIBUTE_FRESHNESS_STATES)[number];

export const ORDER_ABSENCE_NOMINATION_STATES = [
  "NONE",
  "CANDIDATE",
  "CIRCUIT_BREAKER_HELD",
] as const;
export type OrderAbsenceNominationState =
  (typeof ORDER_ABSENCE_NOMINATION_STATES)[number];

export const ORDER_SOURCE_KINDS = [
  "FULL_SYNC",
  "INCREMENTAL_REFETCH",
  "DELETE_WEBHOOK",
  "RECONCILE",
  "TRANSACTION_WEBHOOK",
] as const;
export type OrderSourceKind = (typeof ORDER_SOURCE_KINDS)[number];

export const ORDER_DELETION_SOURCES = ["WEBHOOK", "CONFIRMED_QUERY"] as const;
export type OrderDeletionSource = (typeof ORDER_DELETION_SOURCES)[number];

export const ORDER_OBSERVATION_LIFECYCLE_STATES = [
  "ACTIVE",
  "COMPLETED",
  "ABANDONED",
] as const;
export type OrderObservationLifecycleState =
  (typeof ORDER_OBSERVATION_LIFECYCLE_STATES)[number];

/**
 * ACTIVE ⇒ responseGen IS NULL.
 * COMPLETED ⇒ responseGen IS NOT NULL.
 */
export type OrderObservationLifecycleContract = {
  lifecycleState: OrderObservationLifecycleState;
  observationRequestGen: bigint;
  observationResponseGen: bigint | null;
};

export const ORDER_OBSERVATION_FAILURE_OUTCOMES = [
  "SNAPSHOT_PAGINATION_INCOMPLETE",
] as const;
export type OrderObservationFailureOutcome =
  (typeof ORDER_OBSERVATION_FAILURE_OUTCOMES)[number];

/** Effective Admin token scopes used for an observation (absence authority). */
export type AccessScopeSnapshot = readonly string[];

export type ShopifyGidIdentity = {
  shopId: string;
  shopifyGid: string;
};

/** DIRECT GID facts: Order, OrderLine, Refund, Adjustment, Agreement, Sale, Transaction. */
export type DirectShopifyGidFactIdentity = ShopifyGidIdentity;

/**
 * Refund-line identity is the approved ordinal composite.
 * shopifyGid (RefundLineItem.id) is nullable lineage, not the unique key.
 */
export type RefundLineFactIdentity = {
  shopId: string;
  shopifyRefundGid: string;
  shopifyLineItemGid: string;
  refundLineOrdinal: number;
  shopifyGid: string | null;
};

/**
 * Agreement-sale unique identity is (shopId, Sale.id) only.
 * shopifyAgreementGid is required lineage/FK, not a second unique identity.
 */
export type AgreementSaleFactIdentity = {
  shopId: string;
  shopifyGid: string;
  shopifyAgreementGid: string;
};

export type OrderGidLockIdentityContract = {
  shopId: string;
  resourceKind: Exclude<OrderResourceKind, "RefundLine">;
  shopifyGid: string;
};

export type RefundLineLockIdentityContract = {
  shopId: string;
  resourceKind: "RefundLine";
  shopifyRefundGid: string;
  shopifyLineItemGid: string;
  refundLineOrdinal: number;
};

export type OrderLockIdentityContract =
  | OrderGidLockIdentityContract
  | RefundLineLockIdentityContract;

/**
 * Lock-before-first-insert contract for PR6-C.
 * Refund jobs lock Order + Refund. Order-only jobs lock Order unless the same
 * apply also writes refund snapshots. Acquire after dedupe, ascending (key1,key2).
 */
export const ORDER_LOCK_BEFORE_FIRST_INSERT = true as const;

export const ORDER_CLOCK_A_FACT_TYPES = ["Order", "Refund"] as const;
export type OrderClockAFactType = (typeof ORDER_CLOCK_A_FACT_TYPES)[number];

export type OrderClockFields = {
  shopifyUpdatedAt: string | null;
  existenceObservedAt: string;
  existenceRequestGen: bigint | null;
  existenceResponseGen: bigint | null;
  signalReceivedAt: string | null;
  lastSignalTopic: string | null;
  lastSignalDeliveryId: string | null;
  lastSignalTriggeredAt: string | null;
  attributeRequestGen: bigint | null;
  attributeResponseGen: bigint | null;
};

export const ORDER_MONEY_DIAGNOSTIC_STATES = [
  "REFUND_MONEY_UNBALANCED",
  "MONEY_CURRENCY_MISMATCH",
] as const;
export type OrderMoneyDiagnosticState =
  (typeof ORDER_MONEY_DIAGNOSTIC_STATES)[number];

export const ORDER_UNIT_DIAGNOSTIC_STATES = [
  "LINE_UNIT_IDENTITY_INCONSISTENT",
] as const;
export type OrderUnitDiagnosticState =
  (typeof ORDER_UNIT_DIAGNOSTIC_STATES)[number];

export const ORDER_HISTORY_WINDOW_STATES = [
  "ORDER_HISTORY_WINDOW_TRUNCATED",
  "INACCESSIBLE_HISTORY_WINDOW",
] as const;
export type OrderHistoryWindowState =
  (typeof ORDER_HISTORY_WINDOW_STATES)[number];

export type OrderFactDiagnostics = {
  moneyDiagnosticState: string | null;
  unitDiagnosticState: string | null;
  historyWindowState: string | null;
  existenceDiagnosticState: string | null;
};

/**
 * Refund shipping lines are Monday-critical money for the refund identity.
 * Persist as summed columns on ShopifyOrderRefundFact — not a merchant table.
 * Full order shipping-line fact identity is post-Monday parity (not PR6-A).
 */
export type RefundShippingLineSnapshot = {
  shopifyGid: string | null;
  subtotal: OptionalMoneyBagSides;
  tax: OptionalMoneyBagSides;
};

export const ORDER_REQUIRED_MONEY_BAGS = {
  order: [
    "originalTotalPriceSet",
    "currentTotalPriceSet",
    "currentSubtotalPriceSet",
    "currentTotalDiscountsSet",
    "currentTotalTaxSet",
    "totalRefundedSet",
    "netPaymentSet",
  ],
  line: [
    "originalTotalSet",
    "originalUnitPriceSet",
    "discountedTotalSet",
    "totalDiscountSet",
  ],
  refundLine: ["subtotalSet", "totalTaxSet", "priceSet"],
} as const;

export const ORDER_OPTIONAL_MONEY_BAGS = {
  order: [
    "refundDiscrepancySet",
    "cartDiscountAmountSet",
    "currentCartDiscountAmountSet",
    "currentShippingPriceSet",
  ],
  line: ["discountedUnitPriceAfterAllDiscountsSet"],
} as const;

export type ShopTimezoneCurrencyStorage = {
  ianaTimezone: string | null;
  currencyCode: string | null;
};

export type OrderProcessedAtPersistence = {
  processedAtShopify: string | null;
  processedAt: string | null;
};

export type OrderLineDenormalizedParentColumns = {
  orderProcessedAt: string | null;
  orderCancelledAt: string | null;
  orderTest: boolean;
  orderShopCurrencyCode: string;
};

export type AgreementSaleDenormalizedColumns = {
  happenedAt: string;
};

export const FROZEN_ORDER_NUMERIC_PRECISION = 20;
export const FROZEN_ORDER_NUMERIC_SCALE = 6;
