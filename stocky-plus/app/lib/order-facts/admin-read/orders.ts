import {
  ORDER_ADMIN_READ_MAX_REQUESTS,
  ORDER_ADMIN_READ_PAGE_SIZE,
} from "./constants";
import { ORDER_FACT_BY_ID_QUERY } from "./documents";
import { executeBudgetedQuery } from "./budgeted-execute";
import {
  assertAdvancingCursor,
  mapConnectionPage,
  type CursorConnection,
} from "./cursor-pagination";
import { OrderFactReadWalkError, OrderPaginationError } from "./errors";
import { assertReturnedGidMatches } from "./identity";
import {
  mapOrderLineNode,
  optionalSnapshotTimestamp,
  requireSnapshotTimestamp,
  type AgreementNode,
  type LineItemNode,
  type RefundNode,
} from "./map-nodes";
import { completeAgreementSales, mapAgreementFromFirstPage } from "./agreements";
import { optionalMoneyBag, requireMoneyBag } from "./money";
import { mapEmbeddedOrContinueRefund } from "./refunds";
import { createRequestCostAccumulator, walkErrorToResult } from "./result";
import { assertTrustedOrderAdminReadContext } from "./tenant";
import {
  optionalLegacyResourceId,
  optionalString,
  requireBoolean,
  requireInteger,
  requireNonEmptyString,
  requireString,
} from "./decimal";
import type {
  OrderAdminReadContext,
  OrderAgreementRead,
  OrderFactSnapshot,
  OrderLineRead,
  OrderReadResult,
  RefundRead,
  RequestCostAccumulator,
} from "./types";

export type OrderReadOptions = {
  pageSize?: number;
  maxRequests?: number;
};

type OrderNode = {
  id?: unknown;
  legacyResourceId?: unknown;
  name?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  processedAt?: unknown;
  cancelledAt?: unknown;
  cancelReason?: unknown;
  closed?: unknown;
  closedAt?: unknown;
  edited?: unknown;
  test?: unknown;
  confirmed?: unknown;
  currencyCode?: unknown;
  presentmentCurrencyCode?: unknown;
  taxesIncluded?: unknown;
  displayFinancialStatus?: unknown;
  displayFulfillmentStatus?: unknown;
  sourceName?: unknown;
  currentSubtotalLineItemsQuantity?: unknown;
  subtotalLineItemsQuantity?: unknown;
  retailLocation?: { id?: unknown } | null;
  originalTotalPriceSet?: unknown;
  currentTotalPriceSet?: unknown;
  currentSubtotalPriceSet?: unknown;
  currentTotalDiscountsSet?: unknown;
  currentTotalTaxSet?: unknown;
  totalRefundedSet?: unknown;
  netPaymentSet?: unknown;
  refundDiscrepancySet?: unknown;
  cartDiscountAmountSet?: unknown;
  currentCartDiscountAmountSet?: unknown;
  currentShippingPriceSet?: unknown;
  lineItems?: CursorConnection<LineItemNode>;
  agreements?: CursorConnection<AgreementNode>;
  refunds?: RefundNode[] | null;
};

type OrderFactByIdData = {
  order?: OrderNode | null;
};

function orderFactVariables(input: {
  id: string;
  pageSize: number;
  lineAfter: string | null;
  agrAfter: string | null;
  lineFirst?: number;
  agrFirst?: number;
}): Record<string, unknown> {
  const pageSize = input.pageSize;
  return {
    id: input.id,
    lineFirst: input.lineFirst ?? pageSize,
    lineAfter: input.lineAfter,
    agrFirst: input.agrFirst ?? pageSize,
    agrAfter: input.agrAfter,
    saleFirst: pageSize,
    refundLineFirst: pageSize,
    adjFirst: pageSize,
    shipRefundFirst: pageSize,
    txnFirst: pageSize,
  };
}

function mapOrderHeader(node: OrderNode): Omit<
  OrderFactSnapshot,
  "lineItems" | "agreements" | "refunds"
> {
  const currencyCode = requireNonEmptyString(
    node.currencyCode,
    "order.currencyCode",
  );
  return {
    id: requireNonEmptyString(node.id, "order.id"),
    legacyResourceId: optionalLegacyResourceId(node.legacyResourceId),
    name: requireString(node.name, "order.name"),
    createdAt: requireSnapshotTimestamp(node.createdAt, "order.createdAt"),
    updatedAt: requireSnapshotTimestamp(node.updatedAt, "order.updatedAt"),
    processedAt: optionalSnapshotTimestamp(node.processedAt, "order.processedAt"),
    cancelledAt: optionalSnapshotTimestamp(
      node.cancelledAt,
      "order.cancelledAt",
    ),
    cancelReason: optionalString(node.cancelReason),
    closed: requireBoolean(node.closed, "order.closed"),
    closedAt: optionalSnapshotTimestamp(node.closedAt, "order.closedAt"),
    edited: requireBoolean(node.edited, "order.edited"),
    test: requireBoolean(node.test, "order.test"),
    confirmed: requireBoolean(node.confirmed, "order.confirmed"),
    currencyCode,
    presentmentCurrencyCode: requireNonEmptyString(
      node.presentmentCurrencyCode,
      "order.presentmentCurrencyCode",
    ),
    taxesIncluded: requireBoolean(node.taxesIncluded, "order.taxesIncluded"),
    displayFinancialStatus: optionalString(node.displayFinancialStatus),
    displayFulfillmentStatus: optionalString(node.displayFulfillmentStatus),
    sourceName: optionalString(node.sourceName),
    currentSubtotalLineItemsQuantity: requireInteger(
      node.currentSubtotalLineItemsQuantity,
      "order.currentSubtotalLineItemsQuantity",
    ),
    subtotalLineItemsQuantity: requireInteger(
      node.subtotalLineItemsQuantity,
      "order.subtotalLineItemsQuantity",
    ),
    retailLocationId: optionalString(node.retailLocation?.id),
    originalTotalPriceSet: requireMoneyBag(
      node.originalTotalPriceSet,
      "order.originalTotalPriceSet",
      currencyCode,
    ),
    currentTotalPriceSet: requireMoneyBag(
      node.currentTotalPriceSet,
      "order.currentTotalPriceSet",
      currencyCode,
    ),
    currentSubtotalPriceSet: requireMoneyBag(
      node.currentSubtotalPriceSet,
      "order.currentSubtotalPriceSet",
      currencyCode,
    ),
    currentTotalDiscountsSet: requireMoneyBag(
      node.currentTotalDiscountsSet,
      "order.currentTotalDiscountsSet",
      currencyCode,
    ),
    currentTotalTaxSet: requireMoneyBag(
      node.currentTotalTaxSet,
      "order.currentTotalTaxSet",
      currencyCode,
    ),
    totalRefundedSet: requireMoneyBag(
      node.totalRefundedSet,
      "order.totalRefundedSet",
      currencyCode,
    ),
    netPaymentSet: requireMoneyBag(
      node.netPaymentSet,
      "order.netPaymentSet",
      currencyCode,
    ),
    refundDiscrepancySet: optionalMoneyBag(
      node.refundDiscrepancySet,
      "order.refundDiscrepancySet",
      currencyCode,
    ),
    cartDiscountAmountSet: optionalMoneyBag(
      node.cartDiscountAmountSet,
      "order.cartDiscountAmountSet",
      currencyCode,
    ),
    currentCartDiscountAmountSet: optionalMoneyBag(
      node.currentCartDiscountAmountSet,
      "order.currentCartDiscountAmountSet",
      currencyCode,
    ),
    currentShippingPriceSet: optionalMoneyBag(
      node.currentShippingPriceSet,
      "order.currentShippingPriceSet",
      currencyCode,
    ),
  };
}

async function fetchOrderPage(
  context: OrderAdminReadContext,
  variables: Record<string, unknown>,
  cost: RequestCostAccumulator,
  maxRequests: number,
): Promise<OrderNode | null> {
  const json = await executeBudgetedQuery<OrderFactByIdData>(
    context.admin,
    ORDER_FACT_BY_ID_QUERY,
    variables,
    cost,
    maxRequests,
  );
  return json.data?.order ?? null;
}

export async function readOrderFact(
  context: OrderAdminReadContext,
  orderGid: string,
  options?: OrderReadOptions,
): Promise<OrderReadResult<OrderFactSnapshot>> {
  const cost = createRequestCostAccumulator();
  const pageSize = options?.pageSize ?? ORDER_ADMIN_READ_PAGE_SIZE;
  const maxRequests = options?.maxRequests ?? ORDER_ADMIN_READ_MAX_REQUESTS;

  try {
    await assertTrustedOrderAdminReadContext(context);

    const first = await fetchOrderPage(
      context,
      orderFactVariables({
        id: orderGid,
        pageSize,
        lineAfter: null,
        agrAfter: null,
      }),
      cost,
      maxRequests,
    );
    if (first == null) {
      throw new OrderFactReadWalkError(
        "INACCESSIBLE_HISTORY_WINDOW",
        `order(id: ${orderGid}) returned null; existenceKind INACCESSIBLE_HISTORY_WINDOW`,
      );
    }
    assertReturnedGidMatches(orderGid, first.id, "order");
    const header = mapOrderHeader(first);
    const currencyCode = header.currencyCode;

    const lineItems: OrderLineRead[] = [];
    const seenLineIds = new Set<string>();
    const seenLineCursors = new Set<string>();
    let linePage = mapConnectionPage({
      connection: first.lineItems,
      connectionName: "lineItems",
      mapNode: (node) => mapOrderLineNode(node, currencyCode),
      nodeIdentity: (node) => node.id,
    });
    for (const item of linePage.items) {
      if (seenLineIds.has(item.id)) {
        throw new OrderPaginationError(
          `duplicate lineItem GID across pages: ${item.id}`,
        );
      }
      seenLineIds.add(item.id);
      lineItems.push(item);
    }
    while (linePage.hasNextPage) {
      assertAdvancingCursor("lineItems", linePage.endCursor!, seenLineCursors);
      const extra = await fetchOrderPage(
        context,
        orderFactVariables({
          id: orderGid,
          pageSize,
          lineAfter: linePage.endCursor,
          agrAfter: null,
          agrFirst: 1,
        }),
        cost,
        maxRequests,
      );
      if (extra == null) {
        throw new OrderFactReadWalkError(
          "INACCESSIBLE_HISTORY_WINDOW",
          `order ${orderGid} became inaccessible while paging lineItems`,
        );
      }
      assertReturnedGidMatches(orderGid, extra.id, "order");
      linePage = mapConnectionPage({
        connection: extra.lineItems,
        connectionName: "lineItems",
        mapNode: (node) => mapOrderLineNode(node, currencyCode),
        nodeIdentity: (node) => node.id,
      });
      for (const item of linePage.items) {
        if (seenLineIds.has(item.id)) {
          throw new OrderPaginationError(
            `duplicate lineItem GID across pages: ${item.id}`,
          );
        }
        seenLineIds.add(item.id);
        lineItems.push(item);
      }
    }

    const pendingAgreements: Array<{
      agreement: OrderAgreementRead;
      precedingCursor: string | null;
      salesHasNextPage: boolean;
      salesEndCursor: string | null;
    }> = [];
    const seenAgreementIds = new Set<string>();
    const seenAgreementCursors = new Set<string>();
    let precedingCursor: string | null = null;
    let agrPage = mapConnectionPage({
      connection: first.agreements,
      connectionName: "agreements",
      mapNode: (node, cursor) =>
        mapAgreementFromFirstPage(node, cursor, currencyCode),
      nodeIdentity: (node) => node.id,
    });
    for (let index = 0; index < agrPage.items.length; index += 1) {
      const mapped = agrPage.items[index]!;
      const edgeCursor = agrPage.edgeCursors[index]!;
      if (seenAgreementIds.has(mapped.agreement.id)) {
        throw new OrderPaginationError(
          `duplicate agreement GID across pages: ${mapped.agreement.id}`,
        );
      }
      seenAgreementIds.add(mapped.agreement.id);
      pendingAgreements.push({
        ...mapped,
        precedingCursor,
      });
      precedingCursor = edgeCursor;
    }
    while (agrPage.hasNextPage) {
      assertAdvancingCursor("agreements", agrPage.endCursor!, seenAgreementCursors);
      const extra = await fetchOrderPage(
        context,
        orderFactVariables({
          id: orderGid,
          pageSize,
          lineAfter: null,
          agrAfter: agrPage.endCursor,
          lineFirst: 1,
        }),
        cost,
        maxRequests,
      );
      if (extra == null) {
        throw new OrderFactReadWalkError(
          "INACCESSIBLE_HISTORY_WINDOW",
          `order ${orderGid} became inaccessible while paging agreements`,
        );
      }
      assertReturnedGidMatches(orderGid, extra.id, "order");
      agrPage = mapConnectionPage({
        connection: extra.agreements,
        connectionName: "agreements",
        mapNode: (node, cursor) =>
          mapAgreementFromFirstPage(node, cursor, currencyCode),
        nodeIdentity: (node) => node.id,
      });
      for (let index = 0; index < agrPage.items.length; index += 1) {
        const mapped = agrPage.items[index]!;
        const edgeCursor = agrPage.edgeCursors[index]!;
        if (seenAgreementIds.has(mapped.agreement.id)) {
          throw new OrderPaginationError(
            `duplicate agreement GID across pages: ${mapped.agreement.id}`,
          );
        }
        seenAgreementIds.add(mapped.agreement.id);
        pendingAgreements.push({
          ...mapped,
          precedingCursor,
        });
        precedingCursor = edgeCursor;
      }
    }

    const agreements: OrderAgreementRead[] = [];
    for (const pending of pendingAgreements) {
      if (!pending.salesHasNextPage) {
        agreements.push({ ...pending.agreement, salesComplete: true });
        continue;
      }
      agreements.push(
        await completeAgreementSales(
          context,
          orderGid,
          pending.agreement,
          pending.precedingCursor,
          {
            items: pending.agreement.sales,
            hasNextPage: pending.salesHasNextPage,
            endCursor: pending.salesEndCursor,
          },
          currencyCode,
          cost,
          pageSize,
          maxRequests,
        ),
      );
    }

    const refundNodes = Array.isArray(first.refunds) ? first.refunds : [];
    const refunds: RefundRead[] = [];
    for (const refundNode of refundNodes) {
      refunds.push(
        await mapEmbeddedOrContinueRefund(
          context,
          refundNode,
          currencyCode,
          cost,
          pageSize,
          maxRequests,
        ),
      );
    }

    return {
      status: "complete",
      value: {
        ...header,
        lineItems,
        agreements,
        refunds,
      },
      cost,
    };
  } catch (error) {
    return walkErrorToResult(error, cost);
  }
}
