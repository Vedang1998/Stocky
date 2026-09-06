/**
 * Topic-specific webhook payload sanitizers with validated bounds (F-PR4-12).
 * Persist only approved projection keys; strip PII; keep money as strings.
 * On overflow: fail closed — no silent truncation of operational data.
 */
import { SyncControlPlaneError } from "./errors";

export const WEBHOOK_PROJECTION_SCHEMA_VERSIONS = {
  "orders/create": "webhook-projection-orders-create-v1",
  "orders/cancelled": "webhook-projection-orders-cancelled-v1",
  "refunds/create": "webhook-projection-refunds-create-v1",
  "products/create": "webhook-projection-products-create-v1",
  "products/update": "webhook-projection-products-update-v1",
  "products/delete": "webhook-projection-products-delete-v1",
  "inventory_items/create": "webhook-projection-inventory-items-create-v1",
  "inventory_items/update": "webhook-projection-inventory-items-update-v1",
  "inventory_items/delete": "webhook-projection-inventory-items-delete-v1",
  "inventory_levels/connect": "webhook-projection-inventory-levels-connect-v1",
  "inventory_levels/update": "webhook-projection-inventory-levels-update-v1",
  "inventory_levels/disconnect":
    "webhook-projection-inventory-levels-disconnect-v1",
  "locations/create": "webhook-projection-locations-create-v1",
  "locations/update": "webhook-projection-locations-update-v1",
  "locations/delete": "webhook-projection-locations-delete-v1",
  "locations/activate": "webhook-projection-locations-activate-v1",
  "locations/deactivate": "webhook-projection-locations-deactivate-v1",
  "bulk_operations/finish": "webhook-projection-bulk-operations-finish-v1",
  "app/uninstalled": "webhook-projection-app-uninstalled-v1",
} as const;

export type SanitizedWebhookTopic =
  keyof typeof WEBHOOK_PROJECTION_SCHEMA_VERSIONS;

export type SanitizedWebhookProjection = {
  schemaVersion: string;
  topic: SanitizedWebhookTopic;
  projection: Record<string, unknown>;
};

/**
 * Engineering limits for persisted webhook projections (F-PR4-12).
 * Chosen to bound memory/storage amplification while admitting legitimate
 * large orders. Overflow fails closed with a stable error code.
 */
export const PROJECTION_BOUNDS = {
  maxUtf8Bytes: 256 * 1024,
  maxDepth: 8,
  maxNodes: 2_000,
  maxArrayElements: 500,
  maxLineItems: 250,
  maxStringLength: 4_096,
  maxObjectKeys: 64,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function assertScalarId(value: unknown, field: string): string | number | null {
  if (value == null) return null;
  if (typeof value === "string") {
    if (utf8ByteLength(value) > PROJECTION_BOUNDS.maxStringLength) {
      throw new SyncControlPlaneError(
        "projection_bounds_exceeded",
        `Field ${field} exceeds max string length`,
      );
    }
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new SyncControlPlaneError(
    "projection_scalar_type_invalid",
    `Field ${field} must be string, number, or null — objects/arrays are rejected`,
  );
}

/** Keep money fields as exact strings — never Number/parseFloat. */
function moneyString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    if (utf8ByteLength(value) > PROJECTION_BOUNDS.maxStringLength) {
      throw new SyncControlPlaneError(
        "projection_bounds_exceeded",
        "Money string exceeds max length",
      );
    }
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  throw new SyncControlPlaneError(
    "projection_scalar_type_invalid",
    "Money field must be string, finite number, or null",
  );
}

function countNodes(value: unknown, depth: number): number {
  if (depth > PROJECTION_BOUNDS.maxDepth) {
    throw new SyncControlPlaneError(
      "projection_bounds_exceeded",
      `Projection exceeds max depth ${PROJECTION_BOUNDS.maxDepth}`,
    );
  }
  if (value == null || typeof value !== "object") return 1;
  if (Array.isArray(value)) {
    if (value.length > PROJECTION_BOUNDS.maxArrayElements) {
      throw new SyncControlPlaneError(
        "projection_bounds_exceeded",
        `Array exceeds max elements ${PROJECTION_BOUNDS.maxArrayElements}`,
      );
    }
    let n = 1;
    for (const item of value) n += countNodes(item, depth + 1);
    return n;
  }
  const keys = Object.keys(value as object);
  if (keys.length > PROJECTION_BOUNDS.maxObjectKeys) {
    throw new SyncControlPlaneError(
      "projection_bounds_exceeded",
      `Object exceeds max keys ${PROJECTION_BOUNDS.maxObjectKeys}`,
    );
  }
  let n = 1;
  for (const k of keys) {
    n += countNodes((value as Record<string, unknown>)[k], depth + 1);
  }
  return n;
}

function assertProjectionBounds(projection: Record<string, unknown>): void {
  const nodes = countNodes(projection, 0);
  if (nodes > PROJECTION_BOUNDS.maxNodes) {
    throw new SyncControlPlaneError(
      "projection_bounds_exceeded",
      `Projection exceeds max nodes ${PROJECTION_BOUNDS.maxNodes}`,
    );
  }
  const json = JSON.stringify(projection);
  if (utf8ByteLength(json) > PROJECTION_BOUNDS.maxUtf8Bytes) {
    throw new SyncControlPlaneError(
      "projection_bounds_exceeded",
      `Projection exceeds max UTF-8 bytes ${PROJECTION_BOUNDS.maxUtf8Bytes}`,
    );
  }
}

function pickLineItem(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  return {
    id: assertScalarId(raw.id, "line_item.id"),
    variant_id: assertScalarId(raw.variant_id, "line_item.variant_id"),
    product_id: assertScalarId(raw.product_id, "line_item.product_id"),
    sku:
      typeof raw.sku === "string"
        ? raw.sku.slice(0, PROJECTION_BOUNDS.maxStringLength)
        : null,
    quantity: typeof raw.quantity === "number" ? raw.quantity : null,
    price: moneyString(raw.price),
    total_discount: moneyString(raw.total_discount),
    location_id: assertScalarId(raw.location_id, "line_item.location_id"),
    fulfillment_status:
      typeof raw.fulfillment_status === "string"
        ? raw.fulfillment_status
        : null,
  };
}

function sanitizeOrderProjection(
  payload: Record<string, unknown>,
  topic: "orders/create" | "orders/cancelled",
): Record<string, unknown> {
  const rawLines = Array.isArray(payload.line_items) ? payload.line_items : [];
  if (rawLines.length > PROJECTION_BOUNDS.maxLineItems) {
    throw new SyncControlPlaneError(
      "projection_bounds_exceeded",
      `line_items exceeds max ${PROJECTION_BOUNDS.maxLineItems}`,
    );
  }
  const lineItems = rawLines.map(pickLineItem).filter(Boolean);

  return {
    id: assertScalarId(payload.id, "id"),
    admin_graphql_api_id: assertScalarId(
      payload.admin_graphql_api_id,
      "admin_graphql_api_id",
    ),
    name: typeof payload.name === "string" ? payload.name : null,
    created_at:
      typeof payload.created_at === "string" ? payload.created_at : null,
    updated_at:
      typeof payload.updated_at === "string" ? payload.updated_at : null,
    cancelled_at:
      typeof payload.cancelled_at === "string" ? payload.cancelled_at : null,
    cancel_reason:
      typeof payload.cancel_reason === "string" ? payload.cancel_reason : null,
    financial_status:
      typeof payload.financial_status === "string"
        ? payload.financial_status
        : null,
    fulfillment_status:
      typeof payload.fulfillment_status === "string"
        ? payload.fulfillment_status
        : null,
    currency: typeof payload.currency === "string" ? payload.currency : null,
    total_price: moneyString(payload.total_price),
    subtotal_price: moneyString(payload.subtotal_price),
    total_tax: moneyString(payload.total_tax),
    total_discounts: moneyString(payload.total_discounts),
    line_items: lineItems,
    _topic: topic,
  };
}

function sanitizeRefundProjection(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const rawRefundLines = Array.isArray(payload.refund_line_items)
    ? payload.refund_line_items
    : [];
  if (rawRefundLines.length > PROJECTION_BOUNDS.maxLineItems) {
    throw new SyncControlPlaneError(
      "projection_bounds_exceeded",
      `refund_line_items exceeds max ${PROJECTION_BOUNDS.maxLineItems}`,
    );
  }
  const refundLineItems = rawRefundLines
    .map((item) => {
      if (!isRecord(item)) return null;
      const lineItem = isRecord(item.line_item)
        ? pickLineItem(item.line_item)
        : null;
      return {
        id: assertScalarId(item.id, "refund_line_item.id"),
        quantity: typeof item.quantity === "number" ? item.quantity : null,
        restock_type:
          typeof item.restock_type === "string" ? item.restock_type : null,
        line_item: lineItem,
      };
    })
    .filter(Boolean);

  return {
    id: assertScalarId(payload.id, "id"),
    order_id: assertScalarId(payload.order_id, "order_id"),
    created_at:
      typeof payload.created_at === "string" ? payload.created_at : null,
    note: null,
    refund_line_items: refundLineItems,
  };
}

function sanitizeInventoryProjection(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    inventory_item_id: assertScalarId(
      payload.inventory_item_id,
      "inventory_item_id",
    ),
    location_id: assertScalarId(payload.location_id, "location_id"),
    available: typeof payload.available === "number" ? payload.available : null,
    updated_at:
      typeof payload.updated_at === "string" ? payload.updated_at : null,
  };
}

function sanitizeCatalogIdentityProjection(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const rawVariantGids = Array.isArray(payload.variant_gids)
    ? payload.variant_gids
    : [];
  if (rawVariantGids.length > PROJECTION_BOUNDS.maxArrayElements) {
    throw new SyncControlPlaneError(
      "projection_bounds_exceeded",
      "variant_gids exceeds the persisted signal bound",
    );
  }
  return {
    id: assertScalarId(payload.id, "id"),
    admin_graphql_api_id: assertScalarId(
      payload.admin_graphql_api_id,
      "admin_graphql_api_id",
    ),
    inventory_item_id: assertScalarId(
      payload.inventory_item_id,
      "inventory_item_id",
    ),
    location_id: assertScalarId(payload.location_id, "location_id"),
    updated_at:
      typeof payload.updated_at === "string" ? payload.updated_at : null,
    variant_gids: rawVariantGids.map((item) =>
      isRecord(item)
        ? {
            admin_graphql_api_id: assertScalarId(
              item.admin_graphql_api_id ?? item.id,
              "variant_gids[].admin_graphql_api_id",
            ),
          }
        : {
            admin_graphql_api_id: assertScalarId(
              item,
              "variant_gids[].admin_graphql_api_id",
            ),
          },
    ),
  };
}

function sanitizeBulkFinishProjection(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    id: assertScalarId(
      payload.admin_graphql_api_id ?? payload.id,
      "bulk_operation.id",
    ),
    status: typeof payload.status === "string" ? payload.status : null,
    completed_at:
      typeof payload.completed_at === "string" ? payload.completed_at : null,
  };
}

function sanitizeUninstallProjection(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    id: assertScalarId(payload.id, "id"),
    domain: typeof payload.domain === "string" ? payload.domain : null,
    myshopify_domain:
      typeof payload.myshopify_domain === "string"
        ? payload.myshopify_domain
        : null,
  };
}

export function isSanitizedWebhookTopic(
  topic: string,
): topic is SanitizedWebhookTopic {
  return Object.hasOwn(WEBHOOK_PROJECTION_SCHEMA_VERSIONS, topic);
}

/**
 * Sanitize a verified webhook payload into a versioned control-plane projection.
 * Fail closed on bound overflow or invalid scalar types.
 */
export function sanitizeWebhookPayload(
  topic: string,
  payload: unknown,
): SanitizedWebhookProjection {
  if (!isSanitizedWebhookTopic(topic)) {
    throw new SyncControlPlaneError(
      "topic_unsupported",
      `No sanitizer for webhook topic: ${topic}`,
    );
  }
  if (!isRecord(payload)) {
    throw new SyncControlPlaneError(
      "sanitize_failed",
      "Webhook payload must be a JSON object",
    );
  }

  const schemaVersion = WEBHOOK_PROJECTION_SCHEMA_VERSIONS[topic];
  let projection: Record<string, unknown>;

  switch (topic) {
    case "orders/create":
      projection = sanitizeOrderProjection(payload, "orders/create");
      break;
    case "orders/cancelled":
      projection = sanitizeOrderProjection(payload, "orders/cancelled");
      break;
    case "refunds/create":
      projection = sanitizeRefundProjection(payload);
      break;
    case "products/create":
    case "products/update":
    case "products/delete":
    case "inventory_items/create":
    case "inventory_items/update":
    case "inventory_items/delete":
    case "inventory_levels/connect":
    case "inventory_levels/disconnect":
    case "locations/create":
    case "locations/update":
    case "locations/delete":
    case "locations/activate":
    case "locations/deactivate":
      projection = sanitizeCatalogIdentityProjection(payload);
      break;
    case "inventory_levels/update":
      projection = sanitizeInventoryProjection(payload);
      break;
    case "bulk_operations/finish":
      projection = sanitizeBulkFinishProjection(payload);
      break;
    case "app/uninstalled":
      projection = sanitizeUninstallProjection(payload);
      break;
    default: {
      const _exhaustive: never = topic;
      throw new SyncControlPlaneError(
        "topic_unsupported",
        `Unhandled sanitizer topic: ${_exhaustive}`,
      );
    }
  }

  assertProjectionBounds(projection);
  return { schemaVersion, topic, projection };
}
