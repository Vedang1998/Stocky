/**
 * Topic-specific webhook payload sanitizers.
 * Persist only approved projection keys; strip PII; keep money as strings.
 */
import { SyncControlPlaneError } from "./errors";

export const WEBHOOK_PROJECTION_SCHEMA_VERSIONS = {
  "orders/create": "webhook-projection-orders-create-v1",
  "orders/cancelled": "webhook-projection-orders-cancelled-v1",
  "refunds/create": "webhook-projection-refunds-create-v1",
  "inventory_levels/update": "webhook-projection-inventory-levels-update-v1",
  "app/uninstalled": "webhook-projection-app-uninstalled-v1",
} as const;

export type SanitizedWebhookTopic = keyof typeof WEBHOOK_PROJECTION_SCHEMA_VERSIONS;

export type SanitizedWebhookProjection = {
  schemaVersion: string;
  topic: SanitizedWebhookTopic;
  projection: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Keep money fields as exact strings — never Number/parseFloat. */
function moneyString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    // Coerce numeric wire values to string without float arithmetic on money.
    return String(value);
  }
  return null;
}

function pickLineItem(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  return {
    id: raw.id ?? null,
    variant_id: raw.variant_id ?? null,
    product_id: raw.product_id ?? null,
    sku: typeof raw.sku === "string" ? raw.sku : null,
    quantity: typeof raw.quantity === "number" ? raw.quantity : null,
    price: moneyString(raw.price),
    total_discount: moneyString(raw.total_discount),
    location_id: raw.location_id ?? null,
    fulfillment_status:
      typeof raw.fulfillment_status === "string" ? raw.fulfillment_status : null,
  };
}

function sanitizeOrderProjection(
  payload: Record<string, unknown>,
  topic: "orders/create" | "orders/cancelled",
): Record<string, unknown> {
  const lineItems = Array.isArray(payload.line_items)
    ? payload.line_items.map(pickLineItem).filter(Boolean)
    : [];

  return {
    id: payload.id ?? null,
    admin_graphql_api_id: payload.admin_graphql_api_id ?? null,
    name: typeof payload.name === "string" ? payload.name : null,
    created_at: typeof payload.created_at === "string" ? payload.created_at : null,
    updated_at: typeof payload.updated_at === "string" ? payload.updated_at : null,
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
    // Explicitly omit: customer, email, phone, billing_address, shipping_address,
    // note, note_attributes, browser_ip, client_details, payment tokens, etc.
    _topic: topic,
  };
}

function sanitizeRefundProjection(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const refundLineItems = Array.isArray(payload.refund_line_items)
    ? payload.refund_line_items
        .map((item) => {
          if (!isRecord(item)) return null;
          const lineItem = isRecord(item.line_item)
            ? pickLineItem(item.line_item)
            : null;
          return {
            id: item.id ?? null,
            quantity: typeof item.quantity === "number" ? item.quantity : null,
            restock_type:
              typeof item.restock_type === "string" ? item.restock_type : null,
            line_item: lineItem,
          };
        })
        .filter(Boolean)
    : [];

  return {
    id: payload.id ?? null,
    order_id: payload.order_id ?? null,
    created_at: typeof payload.created_at === "string" ? payload.created_at : null,
    note: null, // strip free-text notes (may contain PII)
    refund_line_items: refundLineItems,
  };
}

function sanitizeInventoryProjection(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    inventory_item_id: payload.inventory_item_id ?? null,
    location_id: payload.location_id ?? null,
    available: typeof payload.available === "number" ? payload.available : null,
    updated_at: typeof payload.updated_at === "string" ? payload.updated_at : null,
  };
}

function sanitizeUninstallProjection(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    id: payload.id ?? null,
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
    case "inventory_levels/update":
      projection = sanitizeInventoryProjection(payload);
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

  return { schemaVersion, topic, projection };
}
