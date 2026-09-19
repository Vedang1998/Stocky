/**
 * D-owned untagged window listing QUERY. Not a B admin-read document.
 * QUERY-only; scanned by D safety tests. Poll bulk operations by GID only.
 */
export const ORDER_FACTS_WINDOW_LISTING_QUERY = `
query OrderFactsWindowListing($first: Int!, $after: String, $query: String!) {
  orders(first: $first, after: $after, query: $query, sortKey: UPDATED_AT) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      cursor
      node {
        id
        updatedAt
        processedAt
        createdAt
        cancelledAt
      }
    }
  }
}
`;

export type WindowListedOrder = {
  id: string;
  updatedAt: string;
  processedAt: string | null;
  createdAt: string | null;
  cancelledAt: string | null;
  cursor: string;
};

export type WindowListingPage = {
  orders: WindowListedOrder[];
  hasNextPage: boolean;
  endCursor: string | null;
};

export function historyWindowQuery(input: {
  windowStartIso: string;
  updatedAtGte?: string | null;
}): string {
  const parts = [`processed_at:>='${input.windowStartIso}'`];
  if (input.updatedAtGte) {
    parts.push(`updated_at:>='${input.updatedAtGte}'`);
  }
  return parts.join(" AND ");
}
