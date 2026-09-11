import {
  ORDER_ADMIN_READ_MAX_REQUESTS,
  ORDER_ADMIN_READ_PAGE_SIZE,
} from "./constants";
import { REFUND_FACT_BY_ID_QUERY } from "./documents";
import { executeBudgetedQuery } from "./budgeted-execute";
import {
  assertAdvancingCursor,
  mapConnectionPage,
  type CursorConnection,
} from "./cursor-pagination";
import { OrderPaginationError } from "./errors";
import { assertReturnedGidMatches } from "./identity";
import {
  mapOrderAdjustmentNode,
  mapOrderTransactionNode,
  mapRefundHeader,
  mapRefundLineNode,
  mapRefundShippingLineNode,
  type OrderAdjustmentNode,
  type OrderTransactionNode,
  type RefundLineNode,
  type RefundNode,
  type RefundShippingLineNode,
} from "./map-nodes";
import { createRequestCostAccumulator, walkErrorToResult } from "./result";
import { assertTrustedOrderAdminReadContext } from "./tenant";
import type {
  OrderAdjustmentRead,
  OrderAdminReadContext,
  OrderReadResult,
  OrderTransactionRead,
  RefundLineRead,
  RefundRead,
  RefundShippingLineRead,
  RequestCostAccumulator,
} from "./types";

type RefundQueryData = {
  refund?: RefundNode | null;
};

export type RefundWalkOptions = {
  pageSize?: number;
  maxRequests?: number;
  orderCurrencyCode: string;
  cost?: RequestCostAccumulator;
};

function asConnection<T>(value: unknown): CursorConnection<T> {
  return (value ?? null) as CursorConnection<T>;
}

function refundChildrenTruncated(node: RefundNode): boolean {
  const pages = [
    mapConnectionPage({
      connection: asConnection<RefundLineNode>(node.refundLineItems),
      connectionName: "refundLineItems",
      mapNode: () => null,
      nodeIdentity: (item) => item.id ?? "null",
      allowNullNodeId: true,
    }),
    mapConnectionPage({
      connection: asConnection<OrderAdjustmentNode>(node.orderAdjustments),
      connectionName: "orderAdjustments",
      mapNode: () => null,
      nodeIdentity: (item) => item.id,
    }),
    mapConnectionPage({
      connection: asConnection<RefundShippingLineNode>(node.refundShippingLines),
      connectionName: "refundShippingLines",
      mapNode: () => null,
      nodeIdentity: (item) => item.id ?? "null",
      allowNullNodeId: true,
    }),
    mapConnectionPage({
      connection: asConnection<OrderTransactionNode>(node.transactions),
      connectionName: "refund.transactions",
      mapNode: () => null,
      nodeIdentity: (item) => item.id,
    }),
  ];
  return pages.some((page) => page.hasNextPage);
}

export function embeddedRefundIsComplete(node: RefundNode): boolean {
  return !refundChildrenTruncated(node);
}

async function walkRefundChildren(
  context: OrderAdminReadContext,
  refundGid: string,
  orderCurrencyCode: string,
  cost: RequestCostAccumulator,
  pageSize: number,
  maxRequests: number,
  firstNode: RefundNode,
): Promise<RefundRead> {
  const lines: RefundLineRead[] = [];
  const adjustments: OrderAdjustmentRead[] = [];
  const shipping: RefundShippingLineRead[] = [];
  const transactions: OrderTransactionRead[] = [];
  const seenLineKeys = new Set<string>();
  const seenAdj = new Set<string>();
  const seenShip = new Set<string>();
  const seenTxn = new Set<string>();
  const seenLineCursors = new Set<string>();
  const seenAdjCursors = new Set<string>();
  const seenShipCursors = new Set<string>();
  const seenTxnCursors = new Set<string>();

  let lineAfter: string | null = null;
  let adjAfter: string | null = null;
  let shipAfter: string | null = null;
  let txnAfter: string | null = null;
  let linesDone = false;
  let adjDone = false;
  let shipDone = false;
  let txnDone = false;
  let node = firstNode;
  let first = true;

  while (!linesDone || !adjDone || !shipDone || !txnDone) {
    if (!first) {
      const json = await executeBudgetedQuery<RefundQueryData>(
        context.admin,
        REFUND_FACT_BY_ID_QUERY,
        {
          id: refundGid,
          refundLineFirst: pageSize,
          refundLineAfter: lineAfter,
          adjFirst: pageSize,
          adjAfter,
          shipRefundFirst: pageSize,
          shipRefundAfter: shipAfter,
          txnFirst: pageSize,
          txnAfter,
        },
        cost,
        maxRequests,
      );
      const next = json.data?.refund ?? null;
      if (next == null) {
        throw new OrderPaginationError(
          `refund ${refundGid} became inaccessible during child pagination`,
        );
      }
      assertReturnedGidMatches(refundGid, next.id, "refund");
      node = next;
    }
    first = false;

    if (!linesDone) {
      const page = mapConnectionPage({
        connection: asConnection<RefundLineNode>(node.refundLineItems),
        connectionName: "refundLineItems",
        mapNode: (item) => mapRefundLineNode(item, orderCurrencyCode),
        nodeIdentity: (item) => item.id ?? "null",
        allowNullNodeId: true,
      });
      for (const [index, item] of page.items.entries()) {
        const key = `${item.lineItemId}:${item.id ?? "null"}:${page.edgeCursors[index]}`;
        if (seenLineKeys.has(key)) {
          throw new OrderPaginationError(
            `duplicate refund line across pages: ${key}`,
          );
        }
        seenLineKeys.add(key);
        lines.push(item);
      }
      if (page.hasNextPage) {
        assertAdvancingCursor(
          "refundLineItems",
          page.endCursor!,
          seenLineCursors,
        );
        lineAfter = page.endCursor;
      } else {
        linesDone = true;
      }
    }

    if (!adjDone) {
      const page = mapConnectionPage({
        connection: asConnection<OrderAdjustmentNode>(node.orderAdjustments),
        connectionName: "orderAdjustments",
        mapNode: (item) => mapOrderAdjustmentNode(item, orderCurrencyCode),
        nodeIdentity: (item) => item.id,
      });
      for (const item of page.items) {
        if (seenAdj.has(item.id)) {
          throw new OrderPaginationError(
            `duplicate orderAdjustment GID across pages: ${item.id}`,
          );
        }
        seenAdj.add(item.id);
        adjustments.push(item);
      }
      if (page.hasNextPage) {
        assertAdvancingCursor("orderAdjustments", page.endCursor!, seenAdjCursors);
        adjAfter = page.endCursor;
      } else {
        adjDone = true;
      }
    }

    if (!shipDone) {
      const page = mapConnectionPage({
        connection: asConnection<RefundShippingLineNode>(node.refundShippingLines),
        connectionName: "refundShippingLines",
        mapNode: (item) => mapRefundShippingLineNode(item, orderCurrencyCode),
        nodeIdentity: (item) => item.id ?? "null",
        allowNullNodeId: true,
      });
      for (const [index, item] of page.items.entries()) {
        const key = `${item.id ?? "null"}:${page.edgeCursors[index]}`;
        if (seenShip.has(key)) {
          throw new OrderPaginationError(
            `duplicate refundShippingLine across pages: ${key}`,
          );
        }
        seenShip.add(key);
        shipping.push(item);
      }
      if (page.hasNextPage) {
        assertAdvancingCursor(
          "refundShippingLines",
          page.endCursor!,
          seenShipCursors,
        );
        shipAfter = page.endCursor;
      } else {
        shipDone = true;
      }
    }

    if (!txnDone) {
      const page = mapConnectionPage({
        connection: asConnection<OrderTransactionNode>(node.transactions),
        connectionName: "refund.transactions",
        mapNode: (item) => mapOrderTransactionNode(item, orderCurrencyCode),
        nodeIdentity: (item) => item.id,
      });
      for (const item of page.items) {
        if (seenTxn.has(item.id)) {
          throw new OrderPaginationError(
            `duplicate refund transaction GID across pages: ${item.id}`,
          );
        }
        seenTxn.add(item.id);
        transactions.push(item);
      }
      if (page.hasNextPage) {
        assertAdvancingCursor(
          "refund.transactions",
          page.endCursor!,
          seenTxnCursors,
        );
        txnAfter = page.endCursor;
      } else {
        txnDone = true;
      }
    }
  }

  return {
    ...mapRefundHeader(node, orderCurrencyCode),
    refundLineItems: lines,
    orderAdjustments: adjustments,
    refundShippingLines: shipping,
    transactions,
    childrenComplete: true,
  };
}

export async function readCompleteRefundSnapshot(
  context: OrderAdminReadContext,
  refundGid: string,
  options: RefundWalkOptions,
): Promise<RefundRead> {
  const pageSize = options.pageSize ?? ORDER_ADMIN_READ_PAGE_SIZE;
  const maxRequests = options.maxRequests ?? ORDER_ADMIN_READ_MAX_REQUESTS;
  const cost = options.cost;
  if (!cost) {
    throw new Error("readCompleteRefundSnapshot requires a shared cost accumulator");
  }

  const json = await executeBudgetedQuery<RefundQueryData>(
    context.admin,
    REFUND_FACT_BY_ID_QUERY,
    {
      id: refundGid,
      refundLineFirst: pageSize,
      refundLineAfter: null,
      adjFirst: pageSize,
      adjAfter: null,
      shipRefundFirst: pageSize,
      shipRefundAfter: null,
      txnFirst: pageSize,
      txnAfter: null,
    },
    cost,
    maxRequests,
  );
  const node = json.data?.refund ?? null;
  if (node == null) {
    throw new OrderPaginationError(
      `refund ${refundGid} is inaccessible; not a complete refund snapshot`,
    );
  }
  assertReturnedGidMatches(refundGid, node.id, "refund");
  return walkRefundChildren(
    context,
    refundGid,
    options.orderCurrencyCode,
    cost,
    pageSize,
    maxRequests,
    node,
  );
}

export async function mapEmbeddedOrContinueRefund(
  context: OrderAdminReadContext,
  node: RefundNode,
  orderCurrencyCode: string,
  cost: RequestCostAccumulator,
  pageSize: number,
  maxRequests: number,
): Promise<RefundRead> {
  const id = requireNonEmptyRefundId(node);
  if (embeddedRefundIsComplete(node)) {
    const lines = mapConnectionPage({
      connection: asConnection<RefundLineNode>(node.refundLineItems),
      connectionName: "refundLineItems",
      mapNode: (item) => mapRefundLineNode(item, orderCurrencyCode),
      nodeIdentity: (item) => item.id ?? "null",
      allowNullNodeId: true,
    });
    const adjustments = mapConnectionPage({
      connection: asConnection<OrderAdjustmentNode>(node.orderAdjustments),
      connectionName: "orderAdjustments",
      mapNode: (item) => mapOrderAdjustmentNode(item, orderCurrencyCode),
      nodeIdentity: (item) => item.id,
    });
    const shipping = mapConnectionPage({
      connection: asConnection<RefundShippingLineNode>(node.refundShippingLines),
      connectionName: "refundShippingLines",
      mapNode: (item) => mapRefundShippingLineNode(item, orderCurrencyCode),
      nodeIdentity: (item) => item.id ?? "null",
      allowNullNodeId: true,
    });
    const transactions = mapConnectionPage({
      connection: asConnection<OrderTransactionNode>(node.transactions),
      connectionName: "refund.transactions",
      mapNode: (item) => mapOrderTransactionNode(item, orderCurrencyCode),
      nodeIdentity: (item) => item.id,
    });
    return {
      ...mapRefundHeader(node, orderCurrencyCode),
      refundLineItems: lines.items,
      orderAdjustments: adjustments.items,
      refundShippingLines: shipping.items,
      transactions: transactions.items,
      childrenComplete: true,
    };
  }

  return readCompleteRefundSnapshot(context, id, {
    orderCurrencyCode,
    pageSize,
    maxRequests,
    cost,
  });
}

function requireNonEmptyRefundId(node: RefundNode): string {
  if (typeof node.id !== "string" || node.id === "") {
    throw new OrderPaginationError("embedded refund is missing id");
  }
  return node.id;
}

export async function readRefundFact(
  context: OrderAdminReadContext,
  refundGid: string,
  options: {
    pageSize?: number;
    maxRequests?: number;
    orderCurrencyCode: string;
  },
): Promise<OrderReadResult<RefundRead>> {
  const cost = createRequestCostAccumulator();
  try {
    await assertTrustedOrderAdminReadContext(context);
    const value = await readCompleteRefundSnapshot(context, refundGid, {
      ...options,
      cost,
    });
    return { status: "complete", value, cost };
  } catch (error) {
    return walkErrorToResult(error, cost);
  }
}
