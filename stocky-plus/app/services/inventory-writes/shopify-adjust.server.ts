import type { AdminGraphQLClient } from "../shopify-gql.server";
import type { AdjustableQuantityName } from "./types";

/**
 * inventoryAdjustQuantities with the @idempotent key that Admin 2026-04+
 * requires. Shopify applies the changes of one request atomically: either the
 * adjustment group is returned or userErrors are, never a partial group.
 */
export const INVENTORY_ADJUST_MUTATION = `#graphql
  mutation ProPoInventoryAdjust(
    $input: InventoryAdjustQuantitiesInput!
    $idempotencyKey: String!
    $quantityNames: [String!]
  ) {
    inventoryAdjustQuantities(input: $input) @idempotent(key: $idempotencyKey) {
      inventoryAdjustmentGroup {
        id
        changes(quantityNames: $quantityNames) {
          name
          delta
          quantityAfterChange
          item {
            id
          }
          location {
            id
          }
        }
      }
      userErrors {
        code
        field
        message
      }
    }
  }`;

export interface AdjustBatchChange {
  inventoryItemId: string;
  locationId: string;
  delta: number;
  changeFromQuantity: number | null;
}

export interface AdjustBatchRequest {
  idempotencyKey: string;
  reason: string;
  quantityName: AdjustableQuantityName;
  referenceDocumentUri: string | null;
  /** Required by Shopify for every quantity name except `available`. */
  ledgerDocumentUri: string | null;
  changes: AdjustBatchChange[];
}

export interface AppliedChange {
  inventoryItemId: string;
  locationId: string;
  delta: number;
  quantityAfterChange: number | null;
}

export interface AdjustBatchError {
  code: string;
  message: string;
  /** Index into request.changes when Shopify attributes the error to one change. */
  changeIndex: number | null;
}

export type AdjustBatchOutcome =
  /** Shopify confirmed the whole batch. */
  | { kind: "applied"; adjustmentGroupId: string; changes: AppliedChange[] }
  /** Shopify definitively applied nothing from this batch. */
  | { kind: "rejected"; errors: AdjustBatchError[] }
  /**
   * Outcome unknown or temporarily refused. Resend the identical request with
   * the same idempotency key; never treat these lines as failed.
   */
  | { kind: "retry"; code: string; message: string };

/**
 * userError codes that mean "try the same key again later". After
 * ADJUST_QUANTITIES_FAILED the resend either succeeds or Shopify answers
 * IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED, which the executor re-keys.
 */
const RETRY_USER_ERROR_CODES = new Set([
  "IDEMPOTENCY_CONCURRENT_REQUEST",
  "SERVICE_UNAVAILABLE",
  "ADJUST_QUANTITIES_FAILED",
]);

/** Top-level GraphQL error codes that are transient. */
const RETRY_GRAPHQL_CODES = new Set([
  "THROTTLED",
  "INTERNAL_SERVER_ERROR",
  "SERVICE_UNAVAILABLE",
  "TIMEOUT",
]);

const MAX_MESSAGE_LENGTH = 1000;

function truncate(message: string): string {
  return message.length > MAX_MESSAGE_LENGTH
    ? `${message.slice(0, MAX_MESSAGE_LENGTH - 1)}…`
    : message;
}

/** ["input", "changes", "3", "delta"] → 3 */
export function changeIndexFromField(
  field: readonly string[] | null | undefined,
  changeCount: number,
): number | null {
  if (!field) return null;
  const at = field.indexOf("changes");
  if (at === -1 || at + 1 >= field.length) return null;
  const raw = field[at + 1];
  if (!/^\d+$/.test(raw)) return null;
  const index = Number(raw);
  return index < changeCount ? index : null;
}

interface GraphQLErrorShape {
  message?: string;
  extensions?: { code?: string };
}

interface AdjustPayloadShape {
  data?: {
    inventoryAdjustQuantities?: {
      inventoryAdjustmentGroup?: {
        id?: string;
        changes?: Array<{
          name?: string;
          delta?: number;
          quantityAfterChange?: number | null;
          item?: { id?: string } | null;
          location?: { id?: string } | null;
        }>;
      } | null;
      userErrors?: Array<{
        code?: string | null;
        field?: string[] | null;
        message?: string;
      }>;
    } | null;
  } | null;
  errors?: GraphQLErrorShape[] | { message?: string };
}

/**
 * Interpret one inventoryAdjustQuantities response. Pure so every branch is
 * unit-testable without a Shopify client.
 */
export function classifyAdjustResponse(
  request: AdjustBatchRequest,
  body: unknown,
): AdjustBatchOutcome {
  const payload = (body ?? {}) as AdjustPayloadShape;

  const topLevel = Array.isArray(payload.errors)
    ? payload.errors
    : payload.errors
      ? [payload.errors as GraphQLErrorShape]
      : [];
  if (topLevel.length > 0) {
    const codes = topLevel.map((e) => e.extensions?.code ?? "");
    const message = truncate(
      topLevel.map((e) => e.message ?? "GraphQL error").join("; "),
    );
    const throttled =
      codes.some((code) => RETRY_GRAPHQL_CODES.has(code)) ||
      /throttled/i.test(message);
    if (throttled) {
      return {
        kind: "retry",
        code: codes.find((c) => RETRY_GRAPHQL_CODES.has(c)) || "THROTTLED",
        message,
      };
    }
    // Parse, validation and access errors are raised before execution.
    return {
      kind: "rejected",
      errors: [
        {
          code: codes.find((c) => c !== "") || "GRAPHQL_ERROR",
          message,
          changeIndex: null,
        },
      ],
    };
  }

  const result = payload.data?.inventoryAdjustQuantities;
  if (!result) {
    return {
      kind: "retry",
      code: "EMPTY_RESPONSE",
      message: "Shopify returned no inventoryAdjustQuantities payload",
    };
  }

  const userErrors = result.userErrors ?? [];
  if (userErrors.length > 0) {
    const retryable = userErrors.find(
      (e) => e.code && RETRY_USER_ERROR_CODES.has(e.code),
    );
    if (retryable) {
      return {
        kind: "retry",
        code: retryable.code ?? "RETRY",
        message: truncate(retryable.message ?? retryable.code ?? "Retry later"),
      };
    }
    return {
      kind: "rejected",
      errors: userErrors.map((e) => ({
        code: e.code ?? "USER_ERROR",
        message: truncate(e.message ?? "Shopify rejected the change"),
        changeIndex: changeIndexFromField(e.field, request.changes.length),
      })),
    };
  }

  const group = result.inventoryAdjustmentGroup;
  if (!group?.id) {
    return {
      kind: "retry",
      code: "EMPTY_RESPONSE",
      message: "Shopify returned neither an adjustment group nor errors",
    };
  }

  const changes: AppliedChange[] = (group.changes ?? [])
    .filter((c) => c.name === request.quantityName)
    .map((c) => ({
      inventoryItemId: c.item?.id ?? "",
      locationId: c.location?.id ?? "",
      delta: c.delta ?? 0,
      quantityAfterChange:
        typeof c.quantityAfterChange === "number"
          ? c.quantityAfterChange
          : null,
    }));
  return { kind: "applied", adjustmentGroupId: group.id, changes };
}

export function buildAdjustVariables(request: AdjustBatchRequest) {
  return {
    idempotencyKey: request.idempotencyKey,
    quantityNames: [request.quantityName],
    input: {
      name: request.quantityName,
      reason: request.reason,
      ...(request.referenceDocumentUri
        ? { referenceDocumentUri: request.referenceDocumentUri }
        : {}),
      changes: request.changes.map((change) => ({
        inventoryItemId: change.inventoryItemId,
        locationId: change.locationId,
        delta: change.delta,
        // Mandatory on 2026-04+: an explicit null opts out of compare-and-swap.
        changeFromQuantity: change.changeFromQuantity,
        ...(request.ledgerDocumentUri
          ? { ledgerDocumentUri: request.ledgerDocumentUri }
          : {}),
      })),
    },
  };
}

export type SendAdjustBatch = (
  request: AdjustBatchRequest,
) => Promise<AdjustBatchOutcome>;

/**
 * HTTP statuses at which Shopify refused the request before executing it and
 * a resend cannot succeed. 401/402/423 (expired token, frozen or locked shop)
 * are left as "retry" so the operation resumes once the shop recovers.
 */
const NOT_EXECUTED_HTTP_STATUSES = new Set([400, 403, 404]);

/**
 * The Shopify API client throws instead of returning GraphQL and HTTP errors.
 * Recover what the error tells us; anything unrecognized stays "retry".
 */
export function classifyThrownAdjustError(
  request: AdjustBatchRequest,
  err: unknown,
): AdjustBatchOutcome {
  const thrownMessage =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const message = truncate(thrownMessage || "Request to Shopify failed");
  const shaped = (err ?? {}) as {
    body?: {
      data?: unknown;
      errors?: { graphQLErrors?: GraphQLErrorShape[] };
    };
    response?: { code?: number };
  };

  const graphQLErrors = shaped.body?.errors?.graphQLErrors;
  if (Array.isArray(graphQLErrors) && graphQLErrors.length > 0) {
    return classifyAdjustResponse(request, {
      data: shaped.body?.data,
      errors: graphQLErrors,
    });
  }

  const status = shaped.response?.code;
  if (typeof status === "number" && NOT_EXECUTED_HTTP_STATUSES.has(status)) {
    return {
      kind: "rejected",
      errors: [{ code: `HTTP_${status}`, message, changeIndex: null }],
    };
  }

  return {
    kind: "retry",
    code: typeof status === "number" ? `HTTP_${status}` : "TRANSPORT_ERROR",
    message,
  };
}

/**
 * Send one batch. Transport failures and unreadable responses are "retry":
 * Shopify may have applied the batch, and only a resend with the same key can
 * tell us without risking a double application.
 */
export function createShopifyAdjustSender(
  admin: AdminGraphQLClient,
): SendAdjustBatch {
  return async (request) => {
    let body: unknown;
    try {
      const response = await admin.graphql(INVENTORY_ADJUST_MUTATION, {
        variables: buildAdjustVariables(request),
      });
      body = await response.json();
    } catch (err) {
      return classifyThrownAdjustError(request, err);
    }
    return classifyAdjustResponse(request, body);
  };
}
