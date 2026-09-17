/**
 * PR6-D orchestration constants. Do not widen catalog resource kinds.
 * Do not add read_all_orders. Do not enable inventory-write flags.
 */

export const ORDER_FACTS_SYNC_JOB_TYPE = "order-facts-sync" as const;
export const ORDER_FACTS_RECONCILE_JOB_TYPE = "order-facts-reconcile" as const;

export const ORDER_FACTS_SYNC_SOURCE = "order_facts_sync" as const;
export const ORDER_FACTS_RECONCILE_SOURCE = "order_facts_reconcile" as const;

export const ORDER_FACTS_SYNC_SCHEMA_VERSION = "order-facts-sync-v1" as const;
export const ORDER_FACTS_RECONCILE_SCHEMA_VERSION =
  "order-facts-reconcile-v1" as const;

export const ORDER_FACTS_CURSOR_INCREMENTAL = "order_facts_incremental" as const;
export const ORDER_FACTS_CURSOR_SWEEP = "order_facts_window_sweep" as const;
export const ORDER_FACTS_HEALTH_DOMAIN = "order_facts" as const;

export const ORDER_FACTS_WEBHOOK_TOPICS = [
  "orders/create",
  "orders/cancelled",
  "refunds/create",
  "orders/edited",
  "orders/delete",
  "order_transactions/create",
] as const;

export type OrderFactsWebhookTopic = (typeof ORDER_FACTS_WEBHOOK_TOPICS)[number];

export const LEGACY_ORDER_WEBHOOK_TOPICS = [
  "orders/create",
  "orders/cancelled",
  "refunds/create",
] as const;

export type LegacyOrderWebhookTopic =
  (typeof LEGACY_ORDER_WEBHOOK_TOPICS)[number];

export const FROZEN_V1_SCHEMA_VERSIONS = {
  "orders/create": "webhook-projection-orders-create-v1",
  "orders/cancelled": "webhook-projection-orders-cancelled-v1",
  "refunds/create": "webhook-projection-refunds-create-v1",
} as const;

export const NEW_TOPIC_SCHEMA_VERSIONS = {
  "orders/edited": "webhook-projection-orders-edited-v1",
  "orders/delete": "webhook-projection-orders-delete-v1",
  "order_transactions/create":
    "webhook-projection-order-transactions-create-v1",
} as const;

export const QUARANTINE_PROJECTION_SCHEMA_VERSION =
  "quarantine-projection-bounds-v1" as const;

export const ORDER_GID_PREFIX = "gid://shopify/Order/";
export const REFUND_GID_PREFIX = "gid://shopify/Refund/";
export const ORDER_TRANSACTION_GID_PREFIX = "gid://shopify/OrderTransaction/";
export const ORDER_EDIT_GID_PREFIX = "gid://shopify/OrderEdit/";
export const BULK_OPERATION_GID_PREFIX = "gid://shopify/BulkOperation/";

export const TERMINAL_TRANSACTION_STATUSES = [
  "success",
  "failure",
  "error",
] as const;

export const ORDER_FACTS_DIRECT_LEASE_MS = 60_000;
export const ORDER_FACTS_JSONL_MAX_OPEN_PARENTS = 32;
export const ORDER_FACTS_JSONL_MAX_LINE_BYTES = 4 * 1024 * 1024;
export const ORDER_FACTS_JSONL_MAX_LIVE_BYTES = 8 * 1024 * 1024;
export const ORDER_FACTS_JSONL_MAX_SCRATCH_BYTES = 2 * 1024 * 1024 * 1024;
export const ORDER_FACTS_JSONL_ID_SORT_CHUNK = 65_536;
export const ORDER_FACTS_JSONL_MAX_ACK_BITSET_BYTES = 32 * 1024 * 1024;
export const ORDER_FACTS_JSONL_MAX_GROUP_MERGE_FILES = 512;
export const ORDER_FACTS_SCRATCH_PREFIX = "stocky-pr6-d" as const;
export const ORDER_FACTS_SCRATCH_MARKER = ".stocky-pr6-d-owned" as const;
export const ORDER_FACTS_SCRATCH_ATTEMPT_PREFIX = "att-" as const;
export const ORDER_FACTS_JSONL_MAX_SCRATCH_ATTEMPTS = 32;
export const ORDER_FACTS_D_API_VERSION = "2026-07" as const;
export const ORDER_FACTS_SOURCE_MANIFEST_VERSION =
  "order-facts-d-source-manifest-v1" as const;
export const ORDER_FACTS_IMPORT_RECEIPT_BINDING_VERSION =
  "order-facts-d-import-src-v1" as const;
export const ORDER_FACTS_IMPORT_RECEIPT_DIGEST_VERSION =
  "order-facts-d-import-src-v2" as const;
export const ORDER_FACTS_SCRATCH_QUOTA_LOCK = "quota.lock" as const;
export const ORDER_FACTS_SCRATCH_RESERVATION = "quota.reservation" as const;
export const ORDER_FACTS_SCRATCH_METADATA_ALLOWANCE_BYTES = 65_536;
export const ORDER_FACTS_SCRATCH_RESOURCE_REASON =
  "order_facts_scratch_resource" as const;
/** One large staging attempt may reserve remaining namespace capacity. */
export const ORDER_FACTS_SCRATCH_SINGLE_LARGE_IMPORT_DEFAULT = true as const;
export const ORDER_FACTS_FIRST_CONFIRMATION_RETRY_MS = 5_000;
export const ORDER_FACTS_BULK_POLL_WALL_CLOCK_MAX_MS = 600_000;
export const ORDER_FACTS_WINDOW_PAGE_SIZE = 50;
export const ORDER_FACTS_MAX_WINDOW_PAGES = 200;
export const ORDER_FACTS_RECONCILE_COALESCE_MS = 15 * 60 * 1000;
export const ORDER_LINE_IMPORT_ENVELOPE = 1_000_000;
export const ORDER_FACTS_BULK_POLL_INTERVAL_MS = 5_000;
export const ORDER_FACTS_BULK_POLL_MAX_ATTEMPTS = 120;
export const ORDER_FACTS_CRON_QUEUE = "stocky-cron" as const;
export const ORDER_FACTS_SYNC_DOMAIN = "order_facts" as const;

export const ORDER_FACTS_BULK_SUBMITTER_MODULE =
  "app/lib/catalog-facts/ingest/bulk-operation-submitter.ts" as const;

export function isOrderFactsWebhookTopic(
  topic: string,
): topic is OrderFactsWebhookTopic {
  return (ORDER_FACTS_WEBHOOK_TOPICS as readonly string[]).includes(topic);
}

export function isLegacyOrderWebhookTopic(
  topic: string,
): topic is LegacyOrderWebhookTopic {
  return (LEGACY_ORDER_WEBHOOK_TOPICS as readonly string[]).includes(topic);
}
