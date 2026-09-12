import { ORDER_AGREEMENT_SALES_PAGE_QUERY } from "./documents";
import { executeBudgetedQuery } from "./budgeted-execute";
import {
  assertAdvancingCursor,
  mapConnectionPage,
  type CursorConnection,
} from "./cursor-pagination";
import { OrderFactReadWalkError, OrderPaginationError } from "./errors";
import { extractSelectedRoot } from "./envelope";
import { assertOrderClockPin, type OrderClockPin } from "./snapshot-pin";
import {
  mapAgreementHeader,
  mapSaleNode,
  type AgreementNode,
  type SaleNode,
} from "./map-nodes";
import type {
  OrderAdminReadContext,
  OrderAgreementRead,
  OrderReadIssueExtras,
  RequestCostAccumulator,
} from "./types";

type AgreementSalesPageData = {
  order?: {
    id?: unknown;
    updatedAt?: unknown;
    currencyCode?: unknown;
    agreements?: CursorConnection<AgreementNode>;
  } | null;
};

export async function completeAgreementSales(
  context: OrderAdminReadContext,
  orderGid: string,
  agreement: OrderAgreementRead,
  precedingCursor: string | null,
  firstSalesPage: {
    items: OrderAgreementRead["sales"];
    hasNextPage: boolean;
    endCursor: string | null;
  },
  orderPin: OrderClockPin,
  cost: RequestCostAccumulator,
  pageSize: number,
  maxRequests: number,
): Promise<OrderAgreementRead> {
  const extras: OrderReadIssueExtras = {
    resourceKind: "Order",
    requestedGid: orderGid,
    phase: "sales",
  };
  const sales = [...firstSalesPage.items];
  const seenIds = new Set(sales.map((item) => item.id));
  const seenCursors = new Set<string>();
  let after = firstSalesPage.endCursor;
  let hasMore = firstSalesPage.hasNextPage;

  if (hasMore && after) {
    seenCursors.add(after);
  }

  while (hasMore) {
    if (!after) {
      throw new OrderPaginationError(
        "agreement sales hasNextPage is true but endCursor is missing",
        extras,
      );
    }
    const json = await executeBudgetedQuery<AgreementSalesPageData>(
      context.admin,
      ORDER_AGREEMENT_SALES_PAGE_QUERY,
      {
        orderId: orderGid,
        agreementAfter: precedingCursor,
        saleFirst: pageSize,
        saleAfter: after,
      },
      cost,
      maxRequests,
      extras,
    );
    const extracted = extractSelectedRoot<{
      id?: unknown;
      updatedAt?: unknown;
      currencyCode?: unknown;
      agreements?: CursorConnection<AgreementNode>;
    }>(json, "order", extras);
    if (extracted.status === "explicit_null") {
      throw new OrderPaginationError(
        `order ${orderGid} disappeared while paging agreement sales`,
        extras,
      );
    }
    const order = extracted.value;
    assertOrderClockPin(orderPin, order, extras);
    const page = mapConnectionPage({
      connection: order.agreements,
      connectionName: "agreements",
      mapNode: (node) => node,
      nodeIdentity: (node) => node.id,
      requireNonEmpty: true,
      extras,
    });
    if (page.items.length !== 1) {
      throw new OrderPaginationError(
        `OrderAgreementSalesPage expected exactly one agreement, got ${page.items.length}`,
        extras,
      );
    }
    const node = page.items[0]!;
    if (typeof node.id !== "string" || node.id !== agreement.id) {
      throw new OrderFactReadWalkError(
        "IDENTITY_MISMATCH",
        `OrderAgreementSalesPage returned ${String(node.id)} instead of ${agreement.id}`,
        extras,
      );
    }
    const salesPage = mapConnectionPage({
      connection: node.sales as CursorConnection<SaleNode>,
      connectionName: "sales",
      mapNode: (item) => mapSaleNode(item, orderPin.currencyCode),
      nodeIdentity: (item) => item.id,
      requireNonEmpty: true,
      extras,
    });
    for (const item of salesPage.items) {
      if (seenIds.has(item.id)) {
        throw new OrderPaginationError(
          `duplicate sale GID across pages: ${item.id}`,
          extras,
        );
      }
      seenIds.add(item.id);
      sales.push(item);
    }
    if (!salesPage.hasNextPage) {
      hasMore = false;
      break;
    }
    assertAdvancingCursor("sales", salesPage.endCursor!, seenCursors, extras);
    after = salesPage.endCursor;
  }

  return {
    ...agreement,
    sales,
    salesComplete: true,
  };
}

export function mapAgreementFromFirstPage(
  node: AgreementNode,
  edgeCursor: string,
  orderCurrencyCode: string,
  extras: OrderReadIssueExtras = {},
): {
  agreement: OrderAgreementRead;
  salesHasNextPage: boolean;
  salesEndCursor: string | null;
} {
  const header = mapAgreementHeader(node, edgeCursor);
  const salesPage = mapConnectionPage({
    connection: node.sales as CursorConnection<SaleNode>,
    connectionName: "sales",
    mapNode: (item) => mapSaleNode(item, orderCurrencyCode),
    nodeIdentity: (item) => item.id,
    extras,
  });
  return {
    agreement: {
      ...header,
      sales: salesPage.items,
      salesComplete: !salesPage.hasNextPage,
    },
    salesHasNextPage: salesPage.hasNextPage,
    salesEndCursor: salesPage.endCursor,
  };
}
