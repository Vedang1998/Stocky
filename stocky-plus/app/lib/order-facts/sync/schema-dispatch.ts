import {
  FROZEN_V1_SCHEMA_VERSIONS,
  NEW_TOPIC_SCHEMA_VERSIONS,
  QUARANTINE_PROJECTION_SCHEMA_VERSION,
  type OrderFactsWebhookTopic,
} from "./constants";
import { OrderFactsSchemaDispatchError } from "./errors";

export type OrderFactsSchemaLane =
  | "legacy_v1"
  | "edited_v1"
  | "delete_v1"
  | "transaction_v1"
  | "quarantine";

/**
 * Dispatch on the persisted payloadSchemaVersion. Frozen v1 order/refund
 * deliveries remain executable after new-topic schema versions land (T51).
 * Unknown versions fail closed. No catalog-style global version fence.
 */
export function dispatchOrderFactsSchema(input: {
  topic: OrderFactsWebhookTopic;
  payloadSchemaVersion: string;
}): OrderFactsSchemaLane {
  if (input.payloadSchemaVersion === QUARANTINE_PROJECTION_SCHEMA_VERSION) {
    return "quarantine";
  }

  if (
    input.topic === "orders/create" ||
    input.topic === "orders/cancelled" ||
    input.topic === "refunds/create"
  ) {
    if (input.payloadSchemaVersion === FROZEN_V1_SCHEMA_VERSIONS[input.topic]) {
      return "legacy_v1";
    }
    throw new OrderFactsSchemaDispatchError(
      `Unrecognized schema ${input.payloadSchemaVersion} for frozen topic ${input.topic}`,
    );
  }

  if (input.topic === "orders/edited") {
    if (input.payloadSchemaVersion === NEW_TOPIC_SCHEMA_VERSIONS["orders/edited"]) {
      return "edited_v1";
    }
    throw new OrderFactsSchemaDispatchError(
      `Unrecognized schema ${input.payloadSchemaVersion} for orders/edited`,
    );
  }

  if (input.topic === "orders/delete") {
    if (input.payloadSchemaVersion === NEW_TOPIC_SCHEMA_VERSIONS["orders/delete"]) {
      return "delete_v1";
    }
    throw new OrderFactsSchemaDispatchError(
      `Unrecognized schema ${input.payloadSchemaVersion} for orders/delete`,
    );
  }

  if (input.topic === "order_transactions/create") {
    if (
      input.payloadSchemaVersion ===
      NEW_TOPIC_SCHEMA_VERSIONS["order_transactions/create"]
    ) {
      return "transaction_v1";
    }
    throw new OrderFactsSchemaDispatchError(
      `Unrecognized schema ${input.payloadSchemaVersion} for order_transactions/create`,
    );
  }

  throw new OrderFactsSchemaDispatchError(
    `Unrecognized order-facts topic ${input.topic}`,
  );
}
