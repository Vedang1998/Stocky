import type { OrderReadFailureKind, OrderReadResult, RequestCostAccumulator } from "./types";
import { OrderFactReadWalkError } from "./errors";
import { createRequestCostAccumulator } from "./execute";

export function failureResult<T>(
  kind: OrderReadFailureKind,
  detail: string,
  cost: RequestCostAccumulator,
): OrderReadResult<T> {
  return { status: "failure", kind, detail, cost };
}

export function incompleteResult<T>(
  detail: string,
  cost: RequestCostAccumulator,
): OrderReadResult<T> {
  return {
    status: "incomplete",
    outcome: "SNAPSHOT_PAGINATION_INCOMPLETE",
    cost,
    detail,
  };
}

export function walkErrorToResult<T>(
  error: unknown,
  cost: RequestCostAccumulator,
): OrderReadResult<T> {
  if (error instanceof OrderFactReadWalkError) {
    if (error.kind === "SNAPSHOT_PAGINATION_INCOMPLETE") {
      return incompleteResult(error.message, cost);
    }
    return failureResult(error.kind, error.message, cost);
  }
  const detail = error instanceof Error ? error.message : String(error);
  if (/DateTime|RFC3339/.test(detail)) {
    return failureResult("MALFORMED_DATETIME", detail, cost);
  }
  if (/decimal string|MoneyBag|MALFORMED_MONEY/.test(detail)) {
    return failureResult("MALFORMED_MONEY", detail, cost);
  }
  return failureResult("ADMIN_READ_ERROR", detail, cost);
}

export { createRequestCostAccumulator };
