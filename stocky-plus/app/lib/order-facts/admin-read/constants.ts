/**
 * PR6-B admin-read named constants. Do not redefine A's types/constants.
 */

export const ORDER_HISTORY_WINDOW_DAYS = 60;

export const ORDER_ADMIN_READ_PAGE_SIZE = 100;

export const ORDER_ADMIN_READ_MAX_PAGES = 10_000;

/** Hard bound on Admin GraphQL requests for one snapshot walk. */
export const ORDER_ADMIN_READ_MAX_REQUESTS = 250;

/**
 * Million-line historical envelope used to cost the Bulk-B fallback.
 * Direct `orders` pagination is forbidden as the primary line import.
 */
export const ORDER_LINE_IMPORT_ENVELOPE = 1_000_000;

export const FORBIDDEN_LIST_PAGINATION_FIELDS = [
  "refunds",
  "transactions",
  "taxLines",
  "discountAllocations",
  "duties",
] as const;

/** Refund.transactions is a Connection and must paginate. */
export const REQUIRED_CONNECTION_PAGINATION_FIELDS = [
  "lineItems",
  "agreements",
  "sales",
  "refundLineItems",
  "orderAdjustments",
  "refundShippingLines",
] as const;
