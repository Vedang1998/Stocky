/**
 * Production B → C mapper. Imports merged B typed reads and C snapshots.
 * Not the test-local copied-type mapper in pr6-c-b-compat-mapper.ts.
 */
import type {
  OrderFactSnapshot,
  OrderLineRead,
  OrderReadResult,
  RefundRead,
} from "../admin-read";
import type {
  DirectOrderObservation,
  OrderSnapshot,
  RefundSnapshot,
} from "../apply/types";
import type { MoneyBagSides } from "../types";
import type { MapContext, MapOutcome } from "./types";

const SHOPIFY_DATETIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

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
  const discountedTotalSet: MoneyBagSides = withCode;
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
    discountedTotalSet,
    totalDiscountSet: line.totalDiscountSet,
    discountedUnitPriceAfterAllDiscountsSet:
      line.discountedUnitPriceAfterAllDiscountsSet,
  };
}

function mapAgreement(agreement: OrderFactSnapshot["agreements"][number]) {
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

export function mapRefundRead(
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

export function resolveRefundParentGid(
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
      "RefundSnapshot.shopifyOrderGid is required but B returned orderId=null without an enclosing Order GID",
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
  ctx: MapContext,
  identity: DirectOrderObservation["identity"],
  extras: Partial<DirectOrderObservation>,
): DirectOrderObservation {
  return {
    observationKind: "direct",
    observationToken: ctx.observationToken,
    observationRequestGen: ctx.observationRequestGen,
    observationResponseGen: ctx.observationResponseGen,
    identity,
    existenceKind: ctx.existenceKind ?? "LIVE_REFETCH",
    existenceObservedAt: ctx.existenceObservedAt,
    sourceKind: ctx.sourceKind,
    accessScopeSnapshot: ctx.accessScopeSnapshot,
    lastConfirmedAccessScopes: ctx.lastConfirmedAccessScopes,
    snapshotComplete: true,
    queryCompleted: true,
    queryReturnedNull: false,
    ...extras,
  };
}

/** Pagination incompleteness and transport errors retry. Malformed money/identity fail closed. */
export function isRetryableMappedReadIssue(
  mapped: Extract<MapOutcome, { status: "incomplete" | "failure" }>,
): boolean {
  if (mapped.status === "incomplete") return true;
  return mapped.reason === "ADMIN_READ_ERROR";
}

function catchDatetime(fn: () => MapOutcome): MapOutcome {
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
  ctx: MapContext,
): MapOutcome {
  if (result.status === "incomplete") {
    return {
      status: "incomplete",
      reason: result.reason,
      phase: result.phase,
      requestedGid: result.requestedGid,
      resourceKind: result.resourceKind === "Refund" ? "Refund" : "Order",
    };
  }
  if (result.status === "failure") {
    return {
      status: "failure",
      reason: result.reason,
      phase: result.phase,
      requestedGid: result.requestedGid,
      resourceKind: result.resourceKind,
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
  ctx: MapContext,
): MapOutcome {
  if (result.status === "incomplete") {
    return {
      status: "incomplete",
      reason: result.reason,
      phase: result.phase,
      requestedGid: result.requestedGid,
      resourceKind: "Refund",
    };
  }
  if (result.status === "failure") {
    return {
      status: "failure",
      reason: result.reason,
      phase: result.phase,
      requestedGid: result.requestedGid,
      resourceKind: result.resourceKind,
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
