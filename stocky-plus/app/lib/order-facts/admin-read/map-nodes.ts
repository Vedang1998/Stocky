import {
  optionalBoolean,
  optionalIsoTimestamp,
  optionalLegacyResourceId,
  optionalSignedGraphqlInt,
  optionalString,
  requireBoolean,
  requireIsoTimestamp,
  requireNonEmptyString,
  requireNonnegativeGraphqlInt,
  requireString,
} from "./decimal";
import { OrderFactReadWalkError } from "./errors";
import { optionalMoneyBag, requireMoneyBag } from "./money";
import type {
  CatalogNodeRef,
  OrderAdjustmentRead,
  OrderAgreementRead,
  OrderAgreementSaleRead,
  OrderLineRead,
  OrderTransactionRead,
  RefundLineRead,
  RefundShippingLineRead,
  RefundRead,
} from "./types";

function requireSnapshotTimestamp(value: unknown, field: string): string {
  try {
    return requireIsoTimestamp(value, field);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new OrderFactReadWalkError("MALFORMED_DATETIME", detail);
  }
}

function optionalSnapshotTimestamp(
  value: unknown,
  field: string,
): string | null {
  try {
    return optionalIsoTimestamp(value, field);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new OrderFactReadWalkError("MALFORMED_DATETIME", detail);
  }
}

export type VariantNode = {
  id?: unknown;
  legacyResourceId?: unknown;
  sku?: unknown;
  title?: unknown;
};

export type ProductNode = {
  id?: unknown;
  legacyResourceId?: unknown;
  title?: unknown;
  handle?: unknown;
};

export type LineItemNode = {
  id?: unknown;
  sku?: unknown;
  title?: unknown;
  variantTitle?: unknown;
  vendor?: unknown;
  name?: unknown;
  isGiftCard?: unknown;
  quantity?: unknown;
  currentQuantity?: unknown;
  refundableQuantity?: unknown;
  unfulfilledQuantity?: unknown;
  nonFulfillableQuantity?: unknown;
  originalTotalSet?: unknown;
  originalUnitPriceSet?: unknown;
  discountedTotalSetWithCodeDiscounts?: unknown;
  discountedTotalSetWithoutCodeDiscounts?: unknown;
  totalDiscountSet?: unknown;
  discountedUnitPriceAfterAllDiscountsSet?: unknown;
  variant?: VariantNode | null;
  product?: ProductNode | null;
};

export type SaleNode = {
  __typename?: unknown;
  id?: unknown;
  quantity?: unknown;
  lineType?: unknown;
  actionType?: unknown;
  totalAmount?: unknown;
  lineItem?: { id?: unknown } | null;
};

export type AgreementNode = {
  __typename?: unknown;
  id?: unknown;
  happenedAt?: unknown;
  reason?: unknown;
  refund?: { id?: unknown } | null;
  sales?: unknown;
};

export type RefundLineNode = {
  id?: unknown;
  quantity?: unknown;
  restockType?: unknown;
  restocked?: unknown;
  location?: { id?: unknown } | null;
  lineItem?: { id?: unknown } | null;
  subtotalSet?: unknown;
  totalTaxSet?: unknown;
  priceSet?: unknown;
};

export type OrderAdjustmentNode = {
  id?: unknown;
  reason?: unknown;
  amountSet?: unknown;
  taxAmountSet?: unknown;
};

export type RefundShippingLineNode = {
  id?: unknown;
  shippingLine?: { id?: unknown } | null;
  subtotalAmountSet?: unknown;
  taxAmountSet?: unknown;
};

export type OrderTransactionNode = {
  id?: unknown;
  status?: unknown;
  kind?: unknown;
  createdAt?: unknown;
  processedAt?: unknown;
  amountSet?: unknown;
};

export type RefundNode = {
  id?: unknown;
  legacyResourceId?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  processedAt?: unknown;
  order?: { id?: unknown } | null;
  totalRefundedSet?: unknown;
  refundLineItems?: unknown;
  orderAdjustments?: unknown;
  refundShippingLines?: unknown;
  transactions?: unknown;
};

function mapCatalogRef(
  node: VariantNode | ProductNode | null | undefined,
  noun: string,
): CatalogNodeRef | null {
  if (node == null) return null;
  return {
    id: requireNonEmptyString(node.id, `${noun}.id`),
    legacyResourceId: optionalLegacyResourceId(node.legacyResourceId),
    sku: "sku" in node ? optionalString(node.sku) : undefined,
    title: optionalString(node.title),
    handle: "handle" in node ? optionalString(node.handle) : undefined,
  };
}

export function mapOrderLineNode(
  node: LineItemNode,
  orderCurrencyCode: string,
): OrderLineRead {
  return {
    id: requireNonEmptyString(node.id, "lineItem.id"),
    sku: optionalString(node.sku),
    title: optionalString(node.title),
    variantTitle: optionalString(node.variantTitle),
    vendor: optionalString(node.vendor),
    name: optionalString(node.name),
    isGiftCard: requireBoolean(node.isGiftCard, "lineItem.isGiftCard"),
    quantity: requireNonnegativeGraphqlInt(node.quantity, "lineItem.quantity"),
    currentQuantity: requireNonnegativeGraphqlInt(
      node.currentQuantity,
      "lineItem.currentQuantity",
    ),
    refundableQuantity: requireNonnegativeGraphqlInt(
      node.refundableQuantity,
      "lineItem.refundableQuantity",
    ),
    unfulfilledQuantity: requireNonnegativeGraphqlInt(
      node.unfulfilledQuantity,
      "lineItem.unfulfilledQuantity",
    ),
    nonFulfillableQuantity: requireNonnegativeGraphqlInt(
      node.nonFulfillableQuantity,
      "lineItem.nonFulfillableQuantity",
    ),
    originalTotalSet: requireMoneyBag(
      node.originalTotalSet,
      "lineItem.originalTotalSet",
      orderCurrencyCode,
    ),
    originalUnitPriceSet: requireMoneyBag(
      node.originalUnitPriceSet,
      "lineItem.originalUnitPriceSet",
      orderCurrencyCode,
    ),
    discountedTotalSetWithCodeDiscounts: requireMoneyBag(
      node.discountedTotalSetWithCodeDiscounts,
      "lineItem.discountedTotalSet(withCodeDiscounts: true)",
      orderCurrencyCode,
    ),
    discountedTotalSetWithoutCodeDiscounts: requireMoneyBag(
      node.discountedTotalSetWithoutCodeDiscounts,
      "lineItem.discountedTotalSet(withCodeDiscounts: false)",
      orderCurrencyCode,
    ),
    totalDiscountSet: requireMoneyBag(
      node.totalDiscountSet,
      "lineItem.totalDiscountSet",
      orderCurrencyCode,
    ),
    discountedUnitPriceAfterAllDiscountsSet: optionalMoneyBag(
      node.discountedUnitPriceAfterAllDiscountsSet,
      "lineItem.discountedUnitPriceAfterAllDiscountsSet",
      orderCurrencyCode,
    ),
    variant: mapCatalogRef(node.variant ?? null, "lineItem.variant"),
    product: mapCatalogRef(node.product ?? null, "lineItem.product"),
  };
}

export function mapSaleNode(
  node: SaleNode,
  orderCurrencyCode: string,
): OrderAgreementSaleRead {
  return {
    id: requireNonEmptyString(node.id, "sale.id"),
    typename: requireString(node.__typename, "sale.__typename"),
    quantity: optionalSignedGraphqlInt(node.quantity, "sale.quantity"),
    lineType: requireString(node.lineType, "sale.lineType"),
    actionType: requireString(node.actionType, "sale.actionType"),
    totalAmount: requireMoneyBag(
      node.totalAmount,
      "sale.totalAmount",
      orderCurrencyCode,
    ),
    lineItemId: optionalString(node.lineItem?.id),
  };
}

export function mapAgreementHeader(
  node: AgreementNode,
  edgeCursor: string,
): Omit<OrderAgreementRead, "sales" | "salesComplete"> {
  return {
    id: requireNonEmptyString(node.id, "agreement.id"),
    happenedAt: requireSnapshotTimestamp(node.happenedAt, "agreement.happenedAt"),
    reason: requireString(node.reason, "agreement.reason"),
    typename:
      optionalString(node.__typename) ??
      "SalesAgreement",
    refundId: optionalString(node.refund?.id),
    edgeCursor,
  };
}

export function mapRefundLineNode(
  node: RefundLineNode,
  orderCurrencyCode: string,
  refundLineOrdinal: number,
): RefundLineRead {
  return {
    id: optionalString(node.id),
    quantity: requireNonnegativeGraphqlInt(
      node.quantity,
      "refundLineItem.quantity",
    ),
    restockType: optionalString(node.restockType),
    restocked: optionalBoolean(node.restocked, "refundLineItem.restocked"),
    restockLocationId: optionalString(node.location?.id),
    lineItemId: requireNonEmptyString(
      node.lineItem?.id,
      "refundLineItem.lineItem.id",
    ),
    refundLineOrdinal,
    subtotalSet: requireMoneyBag(
      node.subtotalSet,
      "refundLineItem.subtotalSet",
      orderCurrencyCode,
    ),
    totalTaxSet: requireMoneyBag(
      node.totalTaxSet,
      "refundLineItem.totalTaxSet",
      orderCurrencyCode,
    ),
    priceSet: requireMoneyBag(
      node.priceSet,
      "refundLineItem.priceSet",
      orderCurrencyCode,
    ),
  };
}

export function mapOrderAdjustmentNode(
  node: OrderAdjustmentNode,
  orderCurrencyCode: string,
): OrderAdjustmentRead {
  return {
    id: requireNonEmptyString(node.id, "orderAdjustment.id"),
    reason: optionalString(node.reason),
    amountSet: requireMoneyBag(
      node.amountSet,
      "orderAdjustment.amountSet",
      orderCurrencyCode,
    ),
    taxAmountSet: requireMoneyBag(
      node.taxAmountSet,
      "orderAdjustment.taxAmountSet",
      orderCurrencyCode,
    ),
  };
}

export function mapRefundShippingLineNode(
  node: RefundShippingLineNode,
  orderCurrencyCode: string,
): RefundShippingLineRead {
  return {
    id: optionalString(node.id),
    shippingLineId: optionalString(node.shippingLine?.id),
    subtotalAmountSet: requireMoneyBag(
      node.subtotalAmountSet,
      "refundShippingLine.subtotalAmountSet",
      orderCurrencyCode,
    ),
    taxAmountSet: requireMoneyBag(
      node.taxAmountSet,
      "refundShippingLine.taxAmountSet",
      orderCurrencyCode,
    ),
  };
}

export function mapOrderTransactionNode(
  node: OrderTransactionNode,
  orderCurrencyCode: string,
): OrderTransactionRead {
  return {
    id: requireNonEmptyString(node.id, "orderTransaction.id"),
    status: requireString(node.status, "orderTransaction.status"),
    kind: requireString(node.kind, "orderTransaction.kind"),
    createdAt: requireSnapshotTimestamp(
      node.createdAt,
      "orderTransaction.createdAt",
    ),
    processedAt: optionalSnapshotTimestamp(
      node.processedAt,
      "orderTransaction.processedAt",
    ),
    amountSet: requireMoneyBag(
      node.amountSet,
      "orderTransaction.amountSet",
      orderCurrencyCode,
    ),
  };
}

export function mapRefundHeader(
  node: RefundNode,
  orderCurrencyCode: string,
): Omit<
  RefundRead,
  | "refundLineItems"
  | "orderAdjustments"
  | "refundShippingLines"
  | "transactions"
  | "childrenComplete"
> {
  return {
    id: requireNonEmptyString(node.id, "refund.id"),
    legacyResourceId: optionalLegacyResourceId(node.legacyResourceId),
    createdAt: optionalSnapshotTimestamp(node.createdAt, "refund.createdAt"),
    updatedAt: requireSnapshotTimestamp(node.updatedAt, "refund.updatedAt"),
    processedAt: requireSnapshotTimestamp(
      node.processedAt,
      "refund.processedAt",
    ),
    orderId: optionalString(node.order?.id),
    totalRefundedSet: requireMoneyBag(
      node.totalRefundedSet,
      "refund.totalRefundedSet",
      orderCurrencyCode,
    ),
  };
}

export { requireSnapshotTimestamp, optionalSnapshotTimestamp };
