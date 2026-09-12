/**
 * Test-local B→C mapper for PR6-C.
 *
 * Not a production PR6-D adapter. Maps pinned B typed-read results into C
 * observations. B `admin-read/**` is not committed on this branch.
 */
import type {
  DirectOrderObservation,
  OrderSnapshot,
  RefundSnapshot,
} from "../../../app/lib/order-facts/apply/types";
import type { MoneyBagSides } from "../../../app/lib/order-facts/types";

export const B_TYPED_READ_CONTRACT_PIN =
  "610ed0503a3aa2998aca7228f4fca9617bed23a3";

const SHOPIFY_DATETIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export type RequestCostAccumulator = {
  requests: number;
  requestedQueryCost: number;
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

export type CatalogNodeRef = {
  id: string;
  legacyResourceId: string | null;
  sku?: string | null;
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

export type CompatMapContext = {
  shopId: string;
  observationToken: string;
  observationRequestGen: bigint;
  observationResponseGen: bigint;
  existenceObservedAt: Date;
  accessScopeSnapshot: readonly string[];
  enclosingOrderGid?: string | null;
};

export type CompatMapOutcome =
  | { status: "mapped"; observation: DirectOrderObservation }
  | { status: "null_observed"; observation: DirectOrderObservation }
  | { status: "incomplete"; reason: OrderReadFailureKind; phase: OrderReadPhase }
  | { status: "failure"; reason: OrderReadFailureKind; phase: OrderReadPhase }
  | {
      status: "blocked";
      code:
        | "unknown_parent_order_gid"
        | "contradictory_parent_order_gid"
        | "malformed_datetime"
        | "missing_with_code_discount_authority";
      reason: string;
    };

function parseIsoToDate(value: string, field: string): Date {
  if (!SHOPIFY_DATETIME.test(value)) {
    throw Object.assign(new Error(`malformed_datetime:${field}`), {
      code: "malformed_datetime",
    });
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw Object.assign(new Error(`malformed_datetime:${field}`), {
      code: "malformed_datetime",
    });
  }
  return parsed;
}

function parseOptionalIso(value: string | null, field: string): Date | null {
  if (value == null) return null;
  return parseIsoToDate(value, field);
}

function mapLine(line: OrderLineRead) {
  const withCode = line.discountedTotalSetWithCodeDiscounts;
  if (withCode == null) {
    throw Object.assign(new Error("missing_with_code_discount_authority"), {
      code: "missing_with_code_discount_authority",
    });
  }
  return {
    shopifyGid: line.id,
    quantity: line.quantity,
    currentQuantity: line.currentQuantity,
    refundableQuantity: line.refundableQuantity,
    unfulfilledQuantity: line.unfulfilledQuantity,
    isGiftCard: line.isGiftCard,
    title: line.title ?? "",
    variantTitle: line.variantTitle,
    vendor: line.vendor,
    sku: line.sku,
    name: line.name,
    variantGidAtSale: line.variant?.id ?? null,
    productGidAtSale: line.product?.id ?? null,
    currentVariantGid: line.variant?.id ?? null,
    currentProductGid: line.product?.id ?? null,
    shopifyLegacyResourceId: null,
    originalTotalSet: line.originalTotalSet,
    originalUnitPriceSet: line.originalUnitPriceSet,
    discountedTotalSet: withCode,
    totalDiscountSet: line.totalDiscountSet,
    discountedUnitPriceAfterAllDiscountsSet:
      line.discountedUnitPriceAfterAllDiscountsSet,
  };
}

function mapAgreement(agreement: OrderAgreementRead) {
  return {
    shopifyGid: agreement.id,
    happenedAt: parseIsoToDate(agreement.happenedAt, "agreement.happenedAt"),
    agreementTypename: agreement.typename,
    reason: agreement.reason,
    refundGid: agreement.refundId,
    salesComplete: agreement.salesComplete,
    sales: agreement.sales.map((sale) => ({
      shopifyGid: sale.id,
      quantity: sale.quantity,
      lineType: sale.lineType,
      actionType: sale.actionType,
      saleTypename: sale.typename,
      shopifyLineItemGid: sale.lineItemId,
      totalAmount: sale.totalAmount,
    })),
  };
}

function mapRefundRead(
  refund: RefundRead,
  shopifyOrderGid: string,
): RefundSnapshot {
  return {
    shopifyGid: refund.id,
    shopifyOrderGid,
    shopifyCreatedAt: parseOptionalIso(refund.createdAt, "refund.createdAt"),
    shopifyUpdatedAt: parseIsoToDate(refund.updatedAt, "refund.updatedAt"),
    processedAt: parseIsoToDate(refund.processedAt, "refund.processedAt"),
    processedAtShopify: refund.processedAt,
    shopifyLegacyResourceId: refund.legacyResourceId,
    totalRefundedSet: refund.totalRefundedSet,
    shippingLines: refund.refundShippingLines.map((line) => ({
      shopifyGid: line.id,
      subtotal: line.subtotalAmountSet,
      tax: line.taxAmountSet,
    })),
    lines: refund.refundLineItems.map((item) => ({
      shopifyGid: item.id,
      shopifyLineItemGid: item.lineItemId,
      refundLineOrdinal: item.refundLineOrdinal,
      quantity: item.quantity,
      restockType: item.restockType,
      restocked: item.restocked,
      restockLocationGid: item.restockLocationId,
      subtotalSet: item.subtotalSet,
      totalTaxSet: item.totalTaxSet,
      priceSet: item.priceSet,
    })),
    linesComplete: refund.childrenComplete,
    adjustments: refund.orderAdjustments.map((adjustment) => ({
      shopifyGid: adjustment.id,
      reason: adjustment.reason,
      amountSet: adjustment.amountSet,
      taxAmountSet: adjustment.taxAmountSet,
    })),
    adjustmentsComplete: refund.childrenComplete,
    transactions: refund.transactions.map((txn) => ({
      shopifyGid: txn.id,
      status: txn.status,
      kind: txn.kind,
      shopifyCreatedAt: parseIsoToDate(txn.createdAt, "transaction.createdAt"),
      processedAt: parseOptionalIso(txn.processedAt, "transaction.processedAt"),
      amountSet: txn.amountSet,
    })),
    transactionsComplete: refund.childrenComplete,
  };
}

function resolveRefundParentGid(
  refund: RefundRead,
  enclosingOrderGid: string | null | undefined,
):
  | { ok: true; shopifyOrderGid: string }
  | {
      ok: false;
      code: "unknown_parent_order_gid" | "contradictory_parent_order_gid";
      reason: string;
    } {
  if (refund.orderId != null && enclosingOrderGid != null) {
    if (refund.orderId !== enclosingOrderGid) {
      return {
        ok: false,
        code: "contradictory_parent_order_gid",
        reason:
          "Refund orderId contradicts the enclosing Order GID; C will not invent a parent",
      };
    }
    return { ok: true, shopifyOrderGid: refund.orderId };
  }
  if (refund.orderId != null) {
    return { ok: true, shopifyOrderGid: refund.orderId };
  }
  if (enclosingOrderGid != null && enclosingOrderGid !== "") {
    return { ok: true, shopifyOrderGid: enclosingOrderGid };
  }
  return {
    ok: false,
    code: "unknown_parent_order_gid",
    reason:
      "C RefundSnapshot.shopifyOrderGid is required but B returned orderId=null without an enclosing Order GID",
  };
}

function mapOrderFactSnapshot(value: OrderFactSnapshot): OrderSnapshot {
  return {
    shopifyGid: value.id,
    name: value.name,
    shopifyCreatedAt: parseIsoToDate(value.createdAt, "order.createdAt"),
    shopifyUpdatedAt: parseIsoToDate(value.updatedAt, "order.updatedAt"),
    processedAt: parseOptionalIso(value.processedAt, "order.processedAt"),
    processedAtShopify: value.processedAt,
    cancelledAt: parseOptionalIso(value.cancelledAt, "order.cancelledAt"),
    cancelReason: value.cancelReason,
    closed: value.closed,
    closedAt: parseOptionalIso(value.closedAt, "order.closedAt"),
    edited: value.edited,
    test: value.test,
    confirmed: value.confirmed,
    shopCurrencyCode: value.currencyCode,
    presentmentCurrencyCode: value.presentmentCurrencyCode,
    taxesIncluded: value.taxesIncluded,
    displayFinancialStatus: value.displayFinancialStatus,
    displayFulfillmentStatus: value.displayFulfillmentStatus,
    sourceName: value.sourceName,
    retailLocationGid: value.retailLocationId,
    currentSubtotalLineItemsQuantity: value.currentSubtotalLineItemsQuantity,
    subtotalLineItemsQuantity: value.subtotalLineItemsQuantity,
    shopifyLegacyResourceId: value.legacyResourceId,
    originalTotalPriceSet: value.originalTotalPriceSet,
    currentTotalPriceSet: value.currentTotalPriceSet,
    currentSubtotalPriceSet: value.currentSubtotalPriceSet,
    currentTotalDiscountsSet: value.currentTotalDiscountsSet,
    currentTotalTaxSet: value.currentTotalTaxSet,
    totalRefundedSet: value.totalRefundedSet,
    netPaymentSet: value.netPaymentSet,
    refundDiscrepancySet: value.refundDiscrepancySet,
    cartDiscountAmountSet: value.cartDiscountAmountSet,
    currentCartDiscountAmountSet: value.currentCartDiscountAmountSet,
    currentShippingPriceSet: value.currentShippingPriceSet,
    lines: value.lineItems.map(mapLine),
    linesComplete: true,
    agreements: value.agreements.map(mapAgreement),
    agreementsComplete: true,
  };
}

function directShell(
  ctx: CompatMapContext,
  identity: DirectOrderObservation["identity"],
  extras: Partial<DirectOrderObservation>,
): DirectOrderObservation {
  return {
    observationKind: "direct",
    observationToken: ctx.observationToken,
    observationRequestGen: ctx.observationRequestGen,
    observationResponseGen: ctx.observationResponseGen,
    identity,
    existenceKind: "LIVE_REFETCH",
    existenceObservedAt: ctx.existenceObservedAt,
    sourceKind: "INCREMENTAL_REFETCH",
    accessScopeSnapshot: ctx.accessScopeSnapshot,
    snapshotComplete: true,
    queryCompleted: true,
    queryReturnedNull: false,
    ...extras,
  };
}

function catchDatetime(fn: () => CompatMapOutcome): CompatMapOutcome {
  try {
    return fn();
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "malformed_datetime") {
      return {
        status: "blocked",
        code: "malformed_datetime",
        reason: error instanceof Error ? error.message : String(error),
      };
    }
    if (code === "missing_with_code_discount_authority") {
      return {
        status: "blocked",
        code: "missing_with_code_discount_authority",
        reason: "discountedTotalSetWithCodeDiscounts is the canonical authority",
      };
    }
    throw error;
  }
}

export function mapBOrderReadResult(
  result: OrderReadResult<OrderFactSnapshot>,
  ctx: CompatMapContext,
): CompatMapOutcome {
  if (result.status === "incomplete") {
    return {
      status: "incomplete",
      reason: result.reason,
      phase: result.phase,
    };
  }
  if (result.status === "failure") {
    return {
      status: "failure",
      reason: result.reason,
      phase: result.phase,
    };
  }
  if (result.status === "null_observed") {
    return {
      status: "null_observed",
      observation: directShell(
        ctx,
        {
          shopId: ctx.shopId,
          resourceKind: result.resourceKind,
          shopifyGid: result.requestedGid,
        },
        {
          existenceKind: "ABSENT_CONFIRMED_QUERY",
          snapshotComplete: true,
          queryCompleted: true,
          queryReturnedNull: true,
          order: null,
          refund: null,
          nestedRefunds: [],
        },
      ),
    };
  }
  return catchDatetime(() => {
    const nestedRefunds: RefundSnapshot[] = [];
    for (const refund of result.value.refunds) {
      const parent = resolveRefundParentGid(refund, result.value.id);
      if (!parent.ok) {
        return {
          status: "blocked",
          code: parent.code,
          reason: parent.reason,
        };
      }
      nestedRefunds.push(mapRefundRead(refund, parent.shopifyOrderGid));
    }
    const order = mapOrderFactSnapshot(result.value);
    return {
      status: "mapped",
      observation: directShell(
        ctx,
        {
          shopId: ctx.shopId,
          resourceKind: "Order",
          shopifyGid: order.shopifyGid,
        },
        {
          order,
          nestedRefunds,
          shopifyCreatedAt: order.shopifyCreatedAt,
          processedAt: order.processedAt,
        },
      ),
    };
  });
}

export function mapBRefundReadResult(
  result: OrderReadResult<RefundRead>,
  ctx: CompatMapContext,
): CompatMapOutcome {
  if (result.status === "incomplete") {
    return {
      status: "incomplete",
      reason: result.reason,
      phase: result.phase,
    };
  }
  if (result.status === "failure") {
    return {
      status: "failure",
      reason: result.reason,
      phase: result.phase,
    };
  }
  if (result.status === "null_observed") {
    return {
      status: "null_observed",
      observation: directShell(
        ctx,
        {
          shopId: ctx.shopId,
          resourceKind: "Refund",
          shopifyGid: result.requestedGid,
        },
        {
          existenceKind: "ABSENT_CONFIRMED_QUERY",
          snapshotComplete: true,
          queryCompleted: true,
          queryReturnedNull: true,
          refund: null,
        },
      ),
    };
  }
  return catchDatetime(() => {
    const parent = resolveRefundParentGid(result.value, ctx.enclosingOrderGid);
    if (!parent.ok) {
      return {
        status: "blocked",
        code: parent.code,
        reason: parent.reason,
      };
    }
    const refund = mapRefundRead(result.value, parent.shopifyOrderGid);
    return {
      status: "mapped",
      observation: directShell(
        ctx,
        {
          shopId: ctx.shopId,
          resourceKind: "Refund",
          shopifyGid: refund.shopifyGid,
        },
        {
          refund,
          shopifyCreatedAt: refund.shopifyCreatedAt,
          processedAt: refund.processedAt,
        },
      ),
    };
  });
}

export function incompleteObservationFromB(
  result: Extract<OrderReadResult<unknown>, { status: "incomplete" }>,
  ctx: CompatMapContext,
): DirectOrderObservation {
  const resourceKind =
    result.resourceKind === "Refund" ? "Refund" : "Order";
  const gid = result.requestedGid ?? "gid://shopify/Order/unknown";
  return directShell(
    ctx,
    { shopId: ctx.shopId, resourceKind, shopifyGid: gid },
    {
      snapshotComplete: false,
      queryCompleted: false,
      queryReturnedNull: false,
      order: null,
      refund: null,
    },
  );
}
