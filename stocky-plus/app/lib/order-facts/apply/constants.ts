/**
 * PR6-C applicator constants. A did not export the named window length.
 * Do not invent a second sequence. Do not widen catalog kinds.
 */

export const ORDER_HISTORY_WINDOW_DAYS = 60 as const;

export const READ_ORDERS_SCOPE = "read_orders" as const;
export const READ_ALL_ORDERS_SCOPE = "read_all_orders" as const;

export const ORDER_APPLY_PHYSICAL_DELETE_OPERATIONS = [] as const;

export const ORDER_RECEIPT_SCHEMA_VERSION =
  "sync-application-receipt-v1" as const;

export const ORDER_TERMINAL_REVIVAL_PREFIX =
  "TERMINAL_IDENTITY_REVIVAL_CONFLICT" as const;
