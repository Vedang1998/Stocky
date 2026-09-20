import {
  ORDER_EDIT_GID_PREFIX,
  ORDER_GID_PREFIX,
  ORDER_TRANSACTION_GID_PREFIX,
  REFUND_GID_PREFIX,
} from "./constants";
import { OrderFactsIdentityError } from "./errors";

export function scalarId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

export function asShopifyGid(
  resource: "Order" | "Refund" | "OrderTransaction" | "OrderEdit",
  restOrGid: string,
): string {
  if (restOrGid.startsWith("gid://shopify/")) return restOrGid;
  return `gid://shopify/${resource}/${restOrGid}`;
}

function requireOrderGid(raw: string, field: string): string {
  const gid = asShopifyGid("Order", raw);
  if (!gid.startsWith(ORDER_GID_PREFIX) || gid === ORDER_GID_PREFIX) {
    throw new OrderFactsIdentityError(`${field} is not an Order GID`);
  }
  return gid;
}

export function extractOrderGidFromLegacyProjection(
  projection: Record<string, unknown>,
): string {
  const gql = scalarId(projection.admin_graphql_api_id);
  if (gql) return requireOrderGid(gql, "admin_graphql_api_id");
  const rest = scalarId(projection.id);
  if (!rest) {
    throw new OrderFactsIdentityError("orders identity missing id");
  }
  return requireOrderGid(rest, "id");
}

export function extractOrderGidFromDeleteProjection(
  projection: Record<string, unknown>,
): string {
  // Official 2026-07 REST sample is `{ "id": <number> }` only.
  // Do not require admin_graphql_api_id. If present and valid, use it.
  const gql = scalarId(projection.admin_graphql_api_id);
  if (gql) return requireOrderGid(gql, "admin_graphql_api_id");
  const rest = scalarId(projection.id);
  if (!rest) {
    throw new OrderFactsIdentityError("orders/delete identity missing id");
  }
  return requireOrderGid(rest, "id");
}

export function extractEditedOrderIdentity(
  projection: Record<string, unknown>,
): { orderGid: string; orderEditGid: string | null; committedAt: string | null } {
  const edit = projection.order_edit;
  const body =
    edit && typeof edit === "object" && !Array.isArray(edit)
      ? (edit as Record<string, unknown>)
      : projection;
  const orderId = scalarId(body.order_id);
  if (!orderId) {
    throw new OrderFactsIdentityError("orders/edited missing order_id");
  }
  const editId = scalarId(body.id);
  return {
    orderGid: requireOrderGid(orderId, "order_edit.order_id"),
    orderEditGid: editId
      ? asShopifyGid("OrderEdit", editId).startsWith(ORDER_EDIT_GID_PREFIX)
        ? asShopifyGid("OrderEdit", editId)
        : asShopifyGid("OrderEdit", editId)
      : null,
    committedAt:
      scalarId(body.committed_at) ??
      scalarId(body.updated_at) ??
      scalarId(body.created_at),
  };
}

export function extractRefundIdentity(
  projection: Record<string, unknown>,
): { refundGid: string; enclosingOrderGid: string | null } {
  const gql = scalarId(projection.admin_graphql_api_id);
  const rest = scalarId(projection.id);
  const raw = gql ?? rest;
  if (!raw) {
    throw new OrderFactsIdentityError("refunds/create identity missing id");
  }
  const refundGid = asShopifyGid("Refund", raw);
  if (!refundGid.startsWith(REFUND_GID_PREFIX) || refundGid === REFUND_GID_PREFIX) {
    throw new OrderFactsIdentityError("refund identity is not a Refund GID");
  }
  const orderRaw = scalarId(projection.order_id);
  return {
    refundGid,
    enclosingOrderGid: orderRaw ? requireOrderGid(orderRaw, "order_id") : null,
  };
}

export function extractTransactionIdentity(
  projection: Record<string, unknown>,
): {
  transactionGid: string;
  orderGid: string;
  status: string;
} {
  const statusRaw = scalarId(projection.status);
  if (!statusRaw) {
    throw new OrderFactsIdentityError("order_transactions/create missing status");
  }
  const orderRaw = scalarId(projection.order_id);
  if (!orderRaw) {
    throw new OrderFactsIdentityError("order_transactions/create missing order_id");
  }
  const idRaw = scalarId(projection.id) ?? scalarId(projection.admin_graphql_api_id);
  if (!idRaw) {
    throw new OrderFactsIdentityError("order_transactions/create missing id");
  }
  const transactionGid = asShopifyGid("OrderTransaction", idRaw);
  if (
    !transactionGid.startsWith(ORDER_TRANSACTION_GID_PREFIX) ||
    transactionGid === ORDER_TRANSACTION_GID_PREFIX
  ) {
    throw new OrderFactsIdentityError("transaction identity is not an OrderTransaction GID");
  }
  return {
    transactionGid,
    orderGid: requireOrderGid(orderRaw, "order_id"),
    status: statusRaw.toLowerCase(),
  };
}

export function assertNotWebhookDeliveryId(
  candidate: string,
  webhookDeliveryId: string | null | undefined,
): void {
  if (webhookDeliveryId && candidate === webhookDeliveryId) {
    throw new OrderFactsIdentityError(
      "webhook delivery id is not an order identity",
    );
  }
}
