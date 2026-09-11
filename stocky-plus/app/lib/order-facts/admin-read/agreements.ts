import {
  ORDER_ADMIN_READ_MAX_REQUESTS,
  ORDER_ADMIN_READ_PAGE_SIZE,
} from "./constants";
import { ORDER_AGREEMENT_SALES_PAGE_QUERY } from "./documents";
import { executeBudgetedQuery } from "./budgeted-execute";
import {
  assertAdvancingCursor,
  mapConnectionPage,
  type CursorConnection,
} from "./cursor-pagination";
import { OrderFactReadWalkError, OrderPaginationError } from "./errors";
import { assertReturnedGidMatches } from "./identity";
import {
  mapAgreementHeader,
  mapSaleNode,
  type AgreementNode,
  type SaleNode,
} from "./map-nodes";
import type {
  OrderAdminReadContext,
  OrderAgreementRead,
  RequestCostAccumulator,
} from "./types";

type AgreementSalesPageData = {
  order?: {
    id?: unknown;
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
  orderCurrencyCode: string,
  cost: RequestCostAccumulator,
  pageSize: number,
  maxRequests: number,
): Promise<OrderAgreementRead> {
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
    );
    const order = json.data?.order ?? null;
    if (order == null) {
      throw new OrderFactReadWalkError(
        "INACCESSIBLE_HISTORY_WINDOW",
        `order ${orderGid} became inaccessible while paging agreement sales`,
      );
    }
    assertReturnedGidMatches(orderGid, order.id, "order");
    const page = mapConnectionPage({
      connection: order.agreements,
      connectionName: "agreements",
      mapNode: (node) => node,
      nodeIdentity: (node) => node.id,
    });
    if (page.items.length !== 1) {
      throw new OrderPaginationError(
        `OrderAgreementSalesPage expected exactly one agreement, got ${page.items.length}`,
      );
    }
    const node = page.items[0]!;
    if (typeof node.id !== "string" || node.id !== agreement.id) {
      throw new OrderFactReadWalkError(
        "IDENTITY_MISMATCH",
        `OrderAgreementSalesPage returned ${String(node.id)} instead of ${agreement.id}`,
      );
    }
    const salesPage = mapConnectionPage({
      connection: node.sales as CursorConnection<SaleNode>,
      connectionName: "sales",
      mapNode: (item) => mapSaleNode(item, orderCurrencyCode),
      nodeIdentity: (item) => item.id,
    });
    for (const item of salesPage.items) {
      if (seenIds.has(item.id)) {
        throw new OrderPaginationError(
          `duplicate sale GID across pages: ${item.id}`,
        );
      }
      seenIds.add(item.id);
      sales.push(item);
    }
    if (!salesPage.hasNextPage) {
      hasMore = false;
      break;
    }
    assertAdvancingCursor("sales", salesPage.endCursor!, seenCursors);
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

export { ORDER_ADMIN_READ_MAX_REQUESTS, ORDER_ADMIN_READ_PAGE_SIZE };
