/**
 * PR6-C applicator input/output types. Observations are already-authoritative.
 * This lane performs no Shopify I/O and does not import GraphQL-generated types.
 */
import type {
  OrderExistenceKind,
  OrderSourceKind,
} from "../types";
import type { OrderLockIdentity } from "../lock-key";
import type { RequiredMoneyBagInput } from "./money";

export type OrderApplyResourceKind = "Order" | "Refund";

export type OrderApplyIdentity = {
  shopId: string;
  resourceKind: OrderApplyResourceKind;
  shopifyGid: string;
};

export type MoneyBagInput = RequiredMoneyBagInput;

export type OrderLineSnapshot = {
  shopifyGid: string;
  quantity: number;
  currentQuantity: number;
  refundableQuantity: number;
  unfulfilledQuantity: number | null;
  isGiftCard: boolean;
  title: string;
  variantTitle: string | null;
  vendor: string | null;
  sku: string | null;
  name: string | null;
  variantGidAtSale: string | null;
  productGidAtSale: string | null;
  currentVariantGid: string | null;
  currentProductGid: string | null;
  shopifyLegacyResourceId: string | null;
  originalTotalSet: MoneyBagInput;
  originalUnitPriceSet: MoneyBagInput;
  discountedTotalSet: MoneyBagInput;
  totalDiscountSet: MoneyBagInput;
  discountedUnitPriceAfterAllDiscountsSet?: MoneyBagInput | null;
};

export type SaleSnapshot = {
  shopifyGid: string;
  quantity: number | null;
  lineType: string | null;
  actionType: string | null;
  saleTypename: string;
  shopifyLineItemGid: string | null;
  totalAmount: MoneyBagInput;
};

export type AgreementSnapshot = {
  shopifyGid: string;
  happenedAt: Date;
  agreementTypename: string;
  reason: string | null;
  refundGid: string | null;
  sales: SaleSnapshot[];
  salesComplete: boolean;
};

export type OrderSnapshot = {
  shopifyGid: string;
  name: string;
  shopifyCreatedAt: Date | null;
  shopifyUpdatedAt: Date;
  processedAt: Date | null;
  processedAtShopify: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  closed: boolean;
  closedAt: Date | null;
  edited: boolean;
  test: boolean;
  confirmed: boolean;
  shopCurrencyCode: string;
  presentmentCurrencyCode: string | null;
  taxesIncluded: boolean;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  sourceName: string | null;
  retailLocationGid: string | null;
  currentSubtotalLineItemsQuantity: number | null;
  subtotalLineItemsQuantity: number | null;
  shopifyLegacyResourceId: string | null;
  originalTotalPriceSet: MoneyBagInput;
  currentTotalPriceSet: MoneyBagInput;
  currentSubtotalPriceSet: MoneyBagInput;
  currentTotalDiscountsSet: MoneyBagInput;
  currentTotalTaxSet: MoneyBagInput;
  totalRefundedSet: MoneyBagInput;
  netPaymentSet: MoneyBagInput;
  refundDiscrepancySet?: MoneyBagInput | null;
  cartDiscountAmountSet?: MoneyBagInput | null;
  currentCartDiscountAmountSet?: MoneyBagInput | null;
  currentShippingPriceSet?: MoneyBagInput | null;
  lines: OrderLineSnapshot[];
  linesComplete: boolean;
  agreements: AgreementSnapshot[];
  agreementsComplete: boolean;
};

export type RefundLineSnapshot = {
  shopifyGid: string | null;
  shopifyLineItemGid: string;
  refundLineOrdinal: number;
  quantity: number;
  restockType: string | null;
  restocked: boolean | null;
  restockLocationGid: string | null;
  subtotalSet: MoneyBagInput;
  totalTaxSet: MoneyBagInput;
  priceSet: MoneyBagInput;
};

export type RefundShippingLineInput = {
  shopifyGid: string | null;
  subtotal: MoneyBagInput;
  tax: MoneyBagInput;
};

export type AdjustmentSnapshot = {
  shopifyGid: string;
  reason: string | null;
  amountSet: MoneyBagInput;
  taxAmountSet: MoneyBagInput;
};

export type TransactionSnapshot = {
  shopifyGid: string;
  status: string;
  kind: string | null;
  shopifyCreatedAt: Date;
  processedAt: Date | null;
  amountSet: MoneyBagInput;
};

export type RefundSnapshot = {
  shopifyGid: string;
  shopifyOrderGid: string;
  shopifyCreatedAt: Date | null;
  shopifyUpdatedAt: Date;
  processedAt: Date | null;
  processedAtShopify: string | null;
  shopifyLegacyResourceId: string | null;
  totalRefundedSet: MoneyBagInput;
  shippingLines: RefundShippingLineInput[];
  lines: RefundLineSnapshot[];
  linesComplete: boolean;
  adjustments: AdjustmentSnapshot[];
  adjustmentsComplete: boolean;
  transactions: TransactionSnapshot[];
  transactionsComplete: boolean;
};

export type OrderApplySignal = {
  topic: string;
  deliveryId: string;
  triggeredAt: Date | null;
  receivedAt: Date;
};

export type OrderApplyReceiptInput = {
  applicationKey: string;
  sourceJobType: string;
  rootDurableJobId: string;
  applyingDurableJobId: string;
  payloadDigest: string;
  applicationSchemaVersion?: string;
};

export type DirectOrderObservation = {
  observationKind: "direct";
  observationToken: string;
  observationRequestGen: bigint;
  observationResponseGen: bigint;
  identity: OrderApplyIdentity;
  existenceKind: OrderExistenceKind;
  existenceObservedAt: Date;
  sourceKind: OrderSourceKind;
  accessScopeSnapshot: readonly string[];
  lastConfirmedAccessScopes?: readonly string[] | null;
  shopifyCreatedAt?: Date | null;
  processedAt?: Date | null;
  queryCompleted?: boolean;
  queryReturnedNull?: boolean;
  snapshotComplete: boolean;
  order?: OrderSnapshot | null;
  refund?: RefundSnapshot | null;
  nestedRefunds?: RefundSnapshot[];
  signal?: OrderApplySignal | null;
};

export type FullSyncOrderObservation = {
  observationKind: "full_sync";
  fenceGeneration: bigint;
  epochId: string;
  identity: OrderApplyIdentity;
  existenceKind: Extract<
    OrderExistenceKind,
    "LIVE_FULL_SYNC_PRESENT" | "INACCESSIBLE_HISTORY_WINDOW"
  >;
  existenceObservedAt: Date;
  sourceKind: "FULL_SYNC";
  accessScopeSnapshot: readonly string[];
  snapshotComplete: boolean;
  order?: OrderSnapshot | null;
  refund?: RefundSnapshot | null;
  nestedRefunds?: RefundSnapshot[];
  nominateAbsence?: boolean;
};

export type OrderObservation = DirectOrderObservation | FullSyncOrderObservation;

export type OrderApplyBatchInput = {
  shopId: string;
  observations: OrderObservation[];
  receipt?: OrderApplyReceiptInput;
  claimedClientShopId?: string | null;
  requestedCanonicalIdentitiesPerTransaction?: number;
  configuredWorstCaseConcurrentCanonicalTransactions?: number;
};

export type OrderApplyObservationResult = {
  identity: OrderApplyIdentity;
  outcome:
    | "applied"
    | "noop"
    | "rejected"
    | "blocked"
    | "conflict"
    | "incomplete"
    | "already_applied"
    | "lease_invalid";
  reason: string;
  existenceMutated: boolean;
  attributesApplied: boolean;
  childrenApplied: boolean;
  diagnosticState: string | null;
  factId: string | null;
};

export type OrderApplyBatchResult = {
  results: OrderApplyObservationResult[];
  identitiesLocked: number;
  abandonedBlockerTokens: string[];
  receiptStatus: "applied" | "already_applied" | "none";
};

export function identityKey(identity: OrderApplyIdentity): string {
  return `${identity.shopId}|${identity.resourceKind}|${identity.shopifyGid}`;
}

export function observationLockIdentity(
  observation: OrderObservation,
): OrderLockIdentity {
  return {
    shopId: observation.identity.shopId,
    resourceKind: observation.identity.resourceKind,
    shopifyGid: observation.identity.shopifyGid,
  };
}

export const DIAGNOSTIC = {
  CONCURRENT_EXISTENCE: "CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT",
  TERMINAL_REVIVAL: "TERMINAL_IDENTITY_REVIVAL_CONFLICT",
  SNAPSHOT_INCOMPLETE: "SNAPSHOT_PAGINATION_INCOMPLETE",
  MONEY_CURRENCY: "MONEY_CURRENCY_MISMATCH",
  REFUND_UNBALANCED: "REFUND_MONEY_UNBALANCED",
  LINE_UNIT: "LINE_UNIT_IDENTITY_INCONSISTENT",
  SALE_SIGN: "UNIT_SALE_SIGN_INCONSISTENT",
  WINDOW_TRUNCATED: "ORDER_HISTORY_WINDOW_TRUNCATED",
  EXISTENCE_UNVERIFIABLE: "ORDER_EXISTENCE_UNVERIFIABLE_WINDOW",
  REFUND_OUTSIDE_WINDOW: "REFUND_OUTSIDE_ACCESSIBLE_WINDOW",
  SCOPE_DOWNGRADE: "ORDER_SCOPE_DOWNGRADE_VOIDS_ABSENCE",
  STALE_DELETE: "STALE_DELETE_SIGNAL",
} as const;
