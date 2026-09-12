import type {
  OrderReadFailureKind,
  OrderReadIssueExtras,
  OrderReadPhase,
  OrderReadResourceKind,
  OrderReadResult,
  RequestCostAccumulator,
} from "./types";
import { boundReadDetail, OrderFactReadWalkError } from "./errors";
import { createRequestCostAccumulator } from "./execute";

function issueFields(
  kind: OrderReadFailureKind,
  detail: string,
  cost: RequestCostAccumulator,
  extras: OrderReadIssueExtras = {},
): {
  resourceKind: OrderReadResourceKind | null;
  requestedGid: string | null;
  phase: OrderReadPhase;
  reason: OrderReadFailureKind;
  detail: string;
  cost: RequestCostAccumulator;
} {
  return {
    resourceKind: extras.resourceKind ?? null,
    requestedGid: extras.requestedGid ?? null,
    phase: extras.phase ?? "initial",
    reason: kind,
    detail: boundReadDetail(detail),
    cost,
  };
}

export function failureResult<T>(
  kind: OrderReadFailureKind,
  detail: string,
  cost: RequestCostAccumulator,
  extras: OrderReadIssueExtras = {},
): OrderReadResult<T> {
  return {
    status: "failure",
    kind,
    ...issueFields(kind, detail, cost, extras),
  };
}

export function incompleteResult<T>(
  detail: string,
  cost: RequestCostAccumulator,
  extras: OrderReadIssueExtras = {},
): OrderReadResult<T> {
  return {
    status: "incomplete",
    outcome: "SNAPSHOT_PAGINATION_INCOMPLETE",
    ...issueFields("SNAPSHOT_PAGINATION_INCOMPLETE", detail, cost, extras),
  };
}

export function nullObservedResult<T>(
  resourceKind: "Order" | "Refund",
  requestedGid: string,
  cost: RequestCostAccumulator,
): OrderReadResult<T> {
  return {
    status: "null_observed",
    resourceKind,
    requestedGid,
    queryCompleted: true,
    nodeReturned: null,
    phase: "initial",
    cost,
  };
}

export function walkErrorToResult<T>(
  error: unknown,
  cost: RequestCostAccumulator,
  extras: OrderReadIssueExtras = {},
): OrderReadResult<T> {
  if (error instanceof OrderFactReadWalkError) {
    const merged: OrderReadIssueExtras = {
      resourceKind: error.resourceKind ?? extras.resourceKind,
      requestedGid: error.requestedGid ?? extras.requestedGid,
      phase: error.phase ?? extras.phase,
    };
    if (error.kind === "SNAPSHOT_PAGINATION_INCOMPLETE") {
      return incompleteResult(error.message, cost, merged);
    }
    return failureResult(error.kind, error.message, cost, merged);
  }
  const detail = error instanceof Error ? error.message : String(error);
  if (/DateTime|RFC3339/.test(detail)) {
    return failureResult("MALFORMED_DATETIME", detail, cost, extras);
  }
  if (/decimal string|MoneyBag|MALFORMED_MONEY/.test(detail)) {
    return failureResult("MALFORMED_MONEY", detail, cost, extras);
  }
  return failureResult("ADMIN_READ_ERROR", detail, cost, extras);
}

export { createRequestCostAccumulator };
