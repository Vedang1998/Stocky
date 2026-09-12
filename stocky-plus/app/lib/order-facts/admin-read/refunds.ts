import { REFUND_FACT_BY_ID_QUERY } from "./documents";
import { executeBudgetedQuery } from "./budgeted-execute";
import {
  assertAdvancingCursor,
  mapConnectionPage,
  type CursorConnection,
} from "./cursor-pagination";
import { OrderFactReadWalkError, OrderPaginationError } from "./errors";
import { extractSelectedRoot } from "./envelope";
import { resolveReadOptions } from "./read-options";
import {
  assertRefundClockPin,
  pinRefundClock,
  type RefundClockPin,
} from "./snapshot-pin";
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
import {
  createRequestCostAccumulator,
  nullObservedResult,
  walkErrorToResult,
} from "./result";
import { assertTrustedOrderAdminReadContext } from "./tenant";
import type {
  OrderAdjustmentRead,
  OrderAdminReadContext,
  OrderReadIssueExtras,
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
  enclosingOrderGid?: string | null;
};

function asConnection<T>(value: unknown): CursorConnection<T> {
  return value as CursorConnection<T>;
}

function refundExtras(
  refundGid: string,
  phase: OrderReadIssueExtras["phase"],
): OrderReadIssueExtras {
  return { resourceKind: "Refund", requestedGid: refundGid, phase };
}

function applyRefundParentLineage(
  header: ReturnType<typeof mapRefundHeader>,
  enclosingOrderGid: string | null | undefined,
  extras: OrderReadIssueExtras,
): ReturnType<typeof mapRefundHeader> {
  if (!enclosingOrderGid) {
    return header;
  }
  if (header.orderId && header.orderId !== enclosingOrderGid) {
    throw new OrderFactReadWalkError(
      "IDENTITY_MISMATCH",
      "embedded refund order.id contradicts enclosing order GID",
      extras,
    );
  }
  return {
    ...header,
    orderId: header.orderId ?? enclosingOrderGid,
  };
}

function refundChildrenTruncated(
  node: RefundNode,
  extras: OrderReadIssueExtras,
): boolean {
  const pages = [
    mapConnectionPage({
      connection: asConnection<RefundLineNode>(node.refundLineItems),
      connectionName: "refundLineItems",
      mapNode: () => null,
      nodeIdentity: (item) => item.id,
      allowNullNodeId: true,
      extras,
    }),
    mapConnectionPage({
      connection: asConnection<OrderAdjustmentNode>(node.orderAdjustments),
      connectionName: "orderAdjustments",
      mapNode: () => null,
      nodeIdentity: (item) => item.id,
      extras,
    }),
    mapConnectionPage({
      connection: asConnection<RefundShippingLineNode>(node.refundShippingLines),
      connectionName: "refundShippingLines",
      mapNode: () => null,
      nodeIdentity: (item) => item.id,
      allowNullNodeId: true,
      extras,
    }),
    mapConnectionPage({
      connection: asConnection<OrderTransactionNode>(node.transactions),
      connectionName: "refund.transactions",
      mapNode: () => null,
      nodeIdentity: (item) => item.id,
      extras,
    }),
  ];
  return pages.some((page) => page.hasNextPage);
}

export function embeddedRefundIsComplete(
  node: RefundNode,
  extras: OrderReadIssueExtras = {},
): boolean {
  return !refundChildrenTruncated(node, extras);
}

async function fetchRefundNode(
  context: OrderAdminReadContext,
  refundGid: string,
  cost: RequestCostAccumulator,
  pageSize: number,
  maxRequests: number,
  extras: OrderReadIssueExtras,
  cursors: {
    lineAfter: string | null;
    adjAfter: string | null;
    shipAfter: string | null;
    txnAfter: string | null;
  },
): Promise<RefundNode> {
  const json = await executeBudgetedQuery<RefundQueryData>(
    context.admin,
    REFUND_FACT_BY_ID_QUERY,
    {
      id: refundGid,
      refundLineFirst: pageSize,
      refundLineAfter: cursors.lineAfter,
      adjFirst: pageSize,
      adjAfter: cursors.adjAfter,
      shipRefundFirst: pageSize,
      shipRefundAfter: cursors.shipAfter,
      txnFirst: pageSize,
      txnAfter: cursors.txnAfter,
    },
    cost,
    maxRequests,
    extras,
  );
  const extracted = extractSelectedRoot<RefundNode>(json, "refund", extras);
  if (extracted.status === "explicit_null") {
    throw new OrderPaginationError(
      `refund ${refundGid} disappeared after prior presence`,
      extras,
    );
  }
  assertReturnedGidMatches(refundGid, extracted.value.id, "refund", extras);
  return extracted.value;
}

async function recheckRefundClock(
  context: OrderAdminReadContext,
  refundGid: string,
  pin: RefundClockPin,
  cost: RequestCostAccumulator,
  pageSize: number,
  maxRequests: number,
): Promise<void> {
  const extras = refundExtras(refundGid, "version_recheck");
  const node = await fetchRefundNode(
    context,
    refundGid,
    cost,
    pageSize,
    maxRequests,
    extras,
    {
      lineAfter: null,
      adjAfter: null,
      shipAfter: null,
      txnAfter: null,
    },
  );
  assertRefundClockPin(pin, node, extras);
}

async function walkRefundChildren(
  context: OrderAdminReadContext,
  refundGid: string,
  orderCurrencyCode: string,
  cost: RequestCostAccumulator,
  pageSize: number,
  maxRequests: number,
  firstNode: RefundNode,
  enclosingOrderGid: string | null | undefined,
): Promise<RefundRead> {
  const pin = pinRefundClock(firstNode);
  const header = applyRefundParentLineage(
    mapRefundHeader(firstNode, orderCurrencyCode),
    enclosingOrderGid,
    refundExtras(refundGid, "initial"),
  );

  const lines: RefundLineRead[] = [];
  const adjustments: OrderAdjustmentRead[] = [];
  const shipping: RefundShippingLineRead[] = [];
  const transactions: OrderTransactionRead[] = [];
  const seenNonNullLineIds = new Set<string>();
  const seenAdj = new Set<string>();
  const seenShipNonNull = new Set<string>();
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
  let usedContinuation = false;

  while (!linesDone || !adjDone || !shipDone || !txnDone) {
    if (!first) {
      usedContinuation = true;
      node = await fetchRefundNode(
        context,
        refundGid,
        cost,
        pageSize,
        maxRequests,
        refundExtras(refundGid, "refundLineItems"),
        { lineAfter, adjAfter, shipAfter, txnAfter },
      );
      assertRefundClockPin(pin, node, refundExtras(refundGid, "refundLineItems"));
    }
    first = false;

    if (!linesDone) {
      const extras = refundExtras(refundGid, "refundLineItems");
      const page = mapConnectionPage({
        connection: asConnection<RefundLineNode>(node.refundLineItems),
        connectionName: "refundLineItems",
        mapNode: (item) =>
          mapRefundLineNode(item, orderCurrencyCode, lines.length),
        nodeIdentity: (item) => item.id,
        allowNullNodeId: true,
        requireNonEmpty: usedContinuation,
        extras,
      });
      for (const item of page.items) {
        if (item.id) {
          if (seenNonNullLineIds.has(item.id)) {
            throw new OrderPaginationError(
              `duplicate refund line GID across pages: ${item.id}`,
              extras,
            );
          }
          seenNonNullLineIds.add(item.id);
        }
        lines.push({
          ...item,
          refundLineOrdinal: lines.length,
        });
      }
      if (page.hasNextPage) {
        assertAdvancingCursor(
          "refundLineItems",
          page.endCursor!,
          seenLineCursors,
          extras,
        );
        lineAfter = page.endCursor;
      } else {
        linesDone = true;
        lineAfter = null;
      }
    }

    if (!adjDone) {
      const extras = refundExtras(refundGid, "orderAdjustments");
      const page = mapConnectionPage({
        connection: asConnection<OrderAdjustmentNode>(node.orderAdjustments),
        connectionName: "orderAdjustments",
        mapNode: (item) => mapOrderAdjustmentNode(item, orderCurrencyCode),
        nodeIdentity: (item) => item.id,
        requireNonEmpty: usedContinuation,
        extras,
      });
      for (const item of page.items) {
        if (seenAdj.has(item.id)) {
          throw new OrderPaginationError(
            `duplicate orderAdjustment GID across pages: ${item.id}`,
            extras,
          );
        }
        seenAdj.add(item.id);
        adjustments.push(item);
      }
      if (page.hasNextPage) {
        assertAdvancingCursor("orderAdjustments", page.endCursor!, seenAdjCursors, extras);
        adjAfter = page.endCursor;
      } else {
        adjDone = true;
        adjAfter = null;
      }
    }

    if (!shipDone) {
      const extras = refundExtras(refundGid, "refundShippingLines");
      const page = mapConnectionPage({
        connection: asConnection<RefundShippingLineNode>(node.refundShippingLines),
        connectionName: "refundShippingLines",
        mapNode: (item) => mapRefundShippingLineNode(item, orderCurrencyCode),
        nodeIdentity: (item) => item.id,
        allowNullNodeId: true,
        requireNonEmpty: usedContinuation,
        extras,
      });
      for (const item of page.items) {
        if (item.id) {
          if (seenShipNonNull.has(item.id)) {
            throw new OrderPaginationError(
              `duplicate refundShippingLine GID across pages: ${item.id}`,
              extras,
            );
          }
          seenShipNonNull.add(item.id);
        }
        shipping.push(item);
      }
      if (page.hasNextPage) {
        assertAdvancingCursor(
          "refundShippingLines",
          page.endCursor!,
          seenShipCursors,
          extras,
        );
        shipAfter = page.endCursor;
      } else {
        shipDone = true;
        shipAfter = null;
      }
    }

    if (!txnDone) {
      const extras = refundExtras(refundGid, "transactions");
      const page = mapConnectionPage({
        connection: asConnection<OrderTransactionNode>(node.transactions),
        connectionName: "refund.transactions",
        mapNode: (item) => mapOrderTransactionNode(item, orderCurrencyCode),
        nodeIdentity: (item) => item.id,
        requireNonEmpty: usedContinuation,
        extras,
      });
      for (const item of page.items) {
        if (seenTxn.has(item.id)) {
          throw new OrderPaginationError(
            `duplicate refund transaction GID across pages: ${item.id}`,
            extras,
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
          extras,
        );
        txnAfter = page.endCursor;
      } else {
        txnDone = true;
        txnAfter = null;
      }
    }
  }

  if (usedContinuation) {
    await recheckRefundClock(
      context,
      refundGid,
      pin,
      cost,
      pageSize,
      maxRequests,
    );
  }

  return {
    ...header,
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
  continuationAfterPresence = false,
): Promise<RefundRead> {
  const { pageSize, maxRequests } = resolveReadOptions(options, {
    resourceKind: "Refund",
    requestedGid: refundGid,
    phase: "options",
  });
  const cost = options.cost;
  if (!cost) {
    throw new Error("readCompleteRefundSnapshot requires a shared cost accumulator");
  }
  const extras = refundExtras(
    refundGid,
    continuationAfterPresence ? "refunds" : "initial",
  );

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
    extras,
  );
  const extracted = extractSelectedRoot<RefundNode>(json, "refund", extras);
  if (extracted.status === "explicit_null") {
    throw new OrderPaginationError(
      continuationAfterPresence
        ? `refund ${refundGid} disappeared while continuing a truncated embed`
        : `refund ${refundGid} returned explicit null on a continuation rebuild`,
      extras,
    );
  }
  assertReturnedGidMatches(refundGid, extracted.value.id, "refund", extras);
  return walkRefundChildren(
    context,
    refundGid,
    options.orderCurrencyCode,
    cost,
    pageSize,
    maxRequests,
    extracted.value,
    options.enclosingOrderGid,
  );
}

export async function mapEmbeddedOrContinueRefund(
  context: OrderAdminReadContext,
  node: RefundNode,
  orderCurrencyCode: string,
  cost: RequestCostAccumulator,
  pageSize: number,
  maxRequests: number,
  enclosingOrderGid: string,
): Promise<RefundRead> {
  const id = requireNonEmptyRefundId(node, enclosingOrderGid);
  const extras = refundExtras(id, "refunds");
  if (embeddedRefundIsComplete(node, extras)) {
    const linesPage = mapConnectionPage({
      connection: asConnection<RefundLineNode>(node.refundLineItems),
      connectionName: "refundLineItems",
      mapNode: (item) => mapRefundLineNode(item, orderCurrencyCode, 0),
      nodeIdentity: (item) => item.id,
      allowNullNodeId: true,
      extras,
    });
    const lines: RefundLineRead[] = [];
    const seenNonNull = new Set<string>();
    for (const item of linesPage.items) {
      if (item.id) {
        if (seenNonNull.has(item.id)) {
          throw new OrderPaginationError(
            `duplicate refund line GID: ${item.id}`,
            extras,
          );
        }
        seenNonNull.add(item.id);
      }
      lines.push({ ...item, refundLineOrdinal: lines.length });
    }
    const adjustments = mapConnectionPage({
      connection: asConnection<OrderAdjustmentNode>(node.orderAdjustments),
      connectionName: "orderAdjustments",
      mapNode: (item) => mapOrderAdjustmentNode(item, orderCurrencyCode),
      nodeIdentity: (item) => item.id,
      extras,
    });
    const shipping = mapConnectionPage({
      connection: asConnection<RefundShippingLineNode>(node.refundShippingLines),
      connectionName: "refundShippingLines",
      mapNode: (item) => mapRefundShippingLineNode(item, orderCurrencyCode),
      nodeIdentity: (item) => item.id,
      allowNullNodeId: true,
      extras,
    });
    const transactions = mapConnectionPage({
      connection: asConnection<OrderTransactionNode>(node.transactions),
      connectionName: "refund.transactions",
      mapNode: (item) => mapOrderTransactionNode(item, orderCurrencyCode),
      nodeIdentity: (item) => item.id,
      extras,
    });
    const header = applyRefundParentLineage(
      mapRefundHeader(node, orderCurrencyCode),
      enclosingOrderGid,
      extras,
    );
    return {
      ...header,
      refundLineItems: lines,
      orderAdjustments: adjustments.items,
      refundShippingLines: shipping.items,
      transactions: transactions.items,
      childrenComplete: true,
    };
  }

  return readCompleteRefundSnapshot(
    context,
    id,
    {
      orderCurrencyCode,
      pageSize,
      maxRequests,
      cost,
      enclosingOrderGid,
    },
    true,
  );
}

function requireNonEmptyRefundId(
  node: RefundNode,
  enclosingOrderGid: string,
): string {
  if (typeof node.id !== "string" || node.id === "") {
    throw new OrderPaginationError("embedded refund is missing id", {
      resourceKind: "Order",
      requestedGid: enclosingOrderGid,
      phase: "refunds",
    });
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
  const extras: OrderReadIssueExtras = {
    resourceKind: "Refund",
    requestedGid: refundGid,
    phase: "initial",
  };
  try {
    const { pageSize, maxRequests } = resolveReadOptions(options, {
      ...extras,
      phase: "options",
    });
    await assertTrustedOrderAdminReadContext(context);
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
      extras,
    );
    const extracted = extractSelectedRoot<RefundNode>(json, "refund", extras);
    if (extracted.status === "explicit_null") {
      return nullObservedResult("Refund", refundGid, cost);
    }
    assertReturnedGidMatches(refundGid, extracted.value.id, "refund", extras);
    const value = await walkRefundChildren(
      context,
      refundGid,
      options.orderCurrencyCode,
      cost,
      pageSize,
      maxRequests,
      extracted.value,
      undefined,
    );
    return { status: "complete", value, cost };
  } catch (error) {
    return walkErrorToResult(error, cost, extras);
  }
}
