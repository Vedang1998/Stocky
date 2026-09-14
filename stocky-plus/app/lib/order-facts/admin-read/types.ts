/**
 * PR6-B Admin READ types. Maps Shopify JSON into typed read models.
 * Does not persist canonical facts or issue Shopify mutations.
 *
 * B reports what a QUERY returned. It does not assign domain existence kinds
 * (those remain A's stored vocabulary and C's adjudication).
 */

import type { MoneyBagSides } from "../types";

export interface OrderAdminReadClient {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<{ json: () => Promise<unknown> }>;
}

export type AdminGraphQLError = {
  message: string;
  path?: ReadonlyArray<string | number>;
  extensions?: {
    code?: string;
    [key: string]: unknown;
  };
};

export type AdminGraphQLCost = {
  requestedQueryCost?: number;
  throttleStatus?: {
    maximumAvailable?: number;
    currentlyAvailable?: number;
    restoreRate?: number;
  };
};

export type AdminGraphQLResponse<T> = {
  data?: T;
  errors?: AdminGraphQLError[];
  extensions?: {
    cost?: AdminGraphQLCost;
  };
};

export type TrustedShopIdentity = {
  readonly id: string;
  readonly myshopifyDomain: string;
};

export type OrderAdminReadContext = {
  admin: OrderAdminReadClient;
  shop: TrustedShopIdentity;
  request?: Request;
};

export type RequestCostAccumulator = {
  requests: number;
  requestedQueryCost: number;
};

export type CatalogNodeRef = {
  id: string;
  legacyResourceId: string | null;
  sku?: string | null;
  title?: string | null;
  handle?: string | null;
};

export type OrderReadResourceKind = "Order" | "Refund" | "Shop" | "AccessScopes";

export type OrderReadPhase =
  | "initial"
  | "lineItems"
  | "agreements"
  | "sales"
  | "refunds"
  | "refundLineItems"
  | "orderAdjustments"
  | "refundShippingLines"
  | "transactions"
  | "version_recheck"
  | "options"
  | "tenant";

export type OrderReadIssueExtras = {
  resourceKind?: OrderReadResourceKind;
  requestedGid?: string | null;
  phase?: OrderReadPhase;
};

export type OrderLineRead = {
  id: string;
  sku: string | null;
  title: string | null;
  variantTitle: string | null;
  vendor: string | null;
  name: string | null;
  isGiftCard: boolean;
  quantity: number;
  currentQuantity: number;
  refundableQuantity: number;
  unfulfilledQuantity: number;
  nonFulfillableQuantity: number;
  originalTotalSet: MoneyBagSides;
  originalUnitPriceSet: MoneyBagSides;
  discountedTotalSetWithCodeDiscounts: MoneyBagSides;
  discountedTotalSetWithoutCodeDiscounts: MoneyBagSides;
  totalDiscountSet: MoneyBagSides;
  discountedUnitPriceAfterAllDiscountsSet: MoneyBagSides | null;
  variant: CatalogNodeRef | null;
  product: CatalogNodeRef | null;
};

export type OrderAgreementSaleRead = {
  id: string;
  typename: string;
  quantity: number | null;
  lineType: string;
  actionType: string;
  totalAmount: MoneyBagSides;
  lineItemId: string | null;
};

export type OrderAgreementRead = {
  id: string;
  happenedAt: string;
  reason: string;
  typename: string;
  refundId: string | null;
  edgeCursor: string;
  sales: OrderAgreementSaleRead[];
  salesComplete: boolean;
};

export type RefundLineRead = {
  id: string | null;
  quantity: number;
  restockType: string | null;
  restocked: boolean | null;
  restockLocationId: string | null;
  lineItemId: string;
  refundLineOrdinal: number;
  subtotalSet: MoneyBagSides;
  totalTaxSet: MoneyBagSides;
  priceSet: MoneyBagSides;
};

export type OrderAdjustmentRead = {
  id: string;
  reason: string | null;
  amountSet: MoneyBagSides;
  taxAmountSet: MoneyBagSides;
};

export type RefundShippingLineRead = {
  id: string | null;
  shippingLineId: string | null;
  subtotalAmountSet: MoneyBagSides;
  taxAmountSet: MoneyBagSides;
};

export type OrderTransactionRead = {
  id: string;
  status: string;
  kind: string;
  createdAt: string;
  processedAt: string | null;
  amountSet: MoneyBagSides;
};

export type RefundRead = {
  id: string;
  legacyResourceId: string | null;
  createdAt: string | null;
  updatedAt: string;
  processedAt: string;
  orderId: string | null;
  totalRefundedSet: MoneyBagSides;
  refundLineItems: RefundLineRead[];
  orderAdjustments: OrderAdjustmentRead[];
  refundShippingLines: RefundShippingLineRead[];
  transactions: OrderTransactionRead[];
  childrenComplete: boolean;
};

export type OrderFactSnapshot = {
  id: string;
  legacyResourceId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  closed: boolean;
  closedAt: string | null;
  edited: boolean;
  test: boolean;
  confirmed: boolean;
  currencyCode: string;
  presentmentCurrencyCode: string;
  taxesIncluded: boolean;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  sourceName: string | null;
  currentSubtotalLineItemsQuantity: number;
  subtotalLineItemsQuantity: number;
  retailLocationId: string | null;
  originalTotalPriceSet: MoneyBagSides;
  currentTotalPriceSet: MoneyBagSides;
  currentSubtotalPriceSet: MoneyBagSides;
  currentTotalDiscountsSet: MoneyBagSides;
  currentTotalTaxSet: MoneyBagSides;
  totalRefundedSet: MoneyBagSides;
  netPaymentSet: MoneyBagSides;
  refundDiscrepancySet: MoneyBagSides | null;
  cartDiscountAmountSet: MoneyBagSides | null;
  currentCartDiscountAmountSet: MoneyBagSides | null;
  currentShippingPriceSet: MoneyBagSides | null;
  lineItems: OrderLineRead[];
  agreements: OrderAgreementRead[];
  refunds: RefundRead[];
};

export type ShopTimezoneCurrencyRead = {
  shopGid: string;
  ianaTimezone: string;
  currencyCode: string;
};

export type AccessScopeSnapshot = {
  handles: string[];
};

export type OrderReadFailureKind =
  | "SNAPSHOT_PAGINATION_INCOMPLETE"
  | "IDENTITY_MISMATCH"
  | "MALFORMED_MONEY"
  | "MONEY_CURRENCY_MISMATCH"
  | "MALFORMED_DATETIME"
  | "MALFORMED_ENVELOPE"
  | "INVALID_READ_OPTIONS"
  | "TENANT_DENIED"
  | "ADMIN_READ_ERROR";

export type OrderReadStructuredIssue = {
  resourceKind: OrderReadResourceKind | null;
  requestedGid: string | null;
  phase: OrderReadPhase;
  reason: OrderReadFailureKind;
  detail: string;
  cost: RequestCostAccumulator;
};

export type OrderReadResult<T> =
  | { status: "complete"; value: T; cost: RequestCostAccumulator }
  | ({
      status: "incomplete";
      outcome: "SNAPSHOT_PAGINATION_INCOMPLETE";
    } & OrderReadStructuredIssue)
  | ({
      status: "failure";
      kind: OrderReadFailureKind;
    } & OrderReadStructuredIssue)
  | {
      status: "null_observed";
      resourceKind: "Order" | "Refund";
      requestedGid: string;
      queryCompleted: true;
      nodeReturned: null;
      phase: "initial";
      cost: RequestCostAccumulator;
    };
