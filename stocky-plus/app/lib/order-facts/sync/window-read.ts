import {
  executeAdminReadQuery,
  type OrderAdminReadClient,
} from "../admin-read";
import { ORDER_FACTS_WINDOW_PAGE_SIZE } from "./constants";
import { ORDER_FACTS_WINDOW_LISTING_QUERY, type WindowListingPage } from "./window-listing";
import { OrderFactsSyncError } from "./errors";

export async function readOrderFactsWindowPage(
  admin: OrderAdminReadClient,
  input: {
    query: string;
    first?: number;
    after?: string | null;
  },
): Promise<WindowListingPage> {
  const json = await executeAdminReadQuery<{
    orders?: {
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
      edges?: Array<{
        cursor?: string;
        node?: {
          id?: string;
          updatedAt?: string;
          processedAt?: string | null;
          createdAt?: string | null;
          cancelledAt?: string | null;
        } | null;
      } | null>;
    } | null;
  }>(admin, ORDER_FACTS_WINDOW_LISTING_QUERY, {
    first: input.first ?? ORDER_FACTS_WINDOW_PAGE_SIZE,
    after: input.after ?? null,
    query: input.query,
  });
  const connection = json.data?.orders;
  if (!connection) {
    throw new OrderFactsSyncError(
      "order_facts_window_listing_incomplete",
      "OrderFactsWindowListing returned no orders connection",
    );
  }
  const orders = (connection.edges ?? []).flatMap((edge) => {
    const node = edge?.node;
    if (!node?.id || !node.updatedAt) return [];
    return [
      {
        id: node.id,
        updatedAt: node.updatedAt,
        processedAt: node.processedAt ?? null,
        createdAt: node.createdAt ?? null,
        cancelledAt: node.cancelledAt ?? null,
        cursor: edge?.cursor ?? node.id,
      },
    ];
  });
  return {
    orders,
    hasNextPage: Boolean(connection.pageInfo?.hasNextPage),
    endCursor: connection.pageInfo?.endCursor ?? null,
  };
}
