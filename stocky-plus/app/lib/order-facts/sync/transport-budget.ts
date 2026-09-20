/**
 * D-owned aggregate Admin transport budget for one import ledger walk.
 * Counts every actual graphql() attempt, including nested readers and retries.
 * Accepted B internals stay frozen; this wrapper is the D hard cap.
 */
import { OrderPaginationError } from "../admin-read/errors";
import type {
  OrderAdminReadClient,
  OrderReadIssueExtras,
} from "../admin-read/types";

export type DTransportClass =
  | "initial"
  | "recheck"
  | "agreement"
  | "sale"
  | "refund"
  | "retry"
  | "fallback";

export type DTransportAccounting = Record<DTransportClass, number> & {
  used: number;
  maxRequests: number;
};

export type DTransportBudget = {
  maxRequests: number;
  used: number;
  phase: DTransportClass;
  lastCallThrottled: boolean;
  classified: Record<DTransportClass, number>;
};

function emptyClassified(): Record<DTransportClass, number> {
  return {
    initial: 0,
    recheck: 0,
    agreement: 0,
    sale: 0,
    refund: 0,
    retry: 0,
    fallback: 0,
  };
}

export function createDTransportBudget(maxRequests: number): DTransportBudget {
  return {
    maxRequests,
    used: 0,
    phase: "initial",
    lastCallThrottled: false,
    classified: emptyClassified(),
  };
}

export function snapshotDTransportBudget(
  budget: DTransportBudget,
): DTransportAccounting {
  return {
    ...budget.classified,
    used: budget.used,
    maxRequests: budget.maxRequests,
  };
}

function isThrottledEnvelope(json: unknown): boolean {
  if (!json || typeof json !== "object" || Array.isArray(json)) return false;
  const errors = (json as { errors?: Array<{ message?: unknown }> }).errors;
  if (!Array.isArray(errors)) return false;
  return errors.some((error) =>
    String(error?.message ?? "")
      .toLowerCase()
      .includes("throttl"),
  );
}

function accountDTransportAttempt(budget: DTransportBudget): void {
  budget.used += 1;
  if (budget.lastCallThrottled) {
    budget.classified.retry += 1;
  } else {
    budget.classified[budget.phase] += 1;
  }
}

export function consumeDTransportAttempt(
  budget: DTransportBudget,
  extras: OrderReadIssueExtras = {},
): void {
  if (budget.used >= budget.maxRequests) {
    throw new OrderPaginationError(
      `Admin request budget exhausted (${budget.maxRequests}); refusing a truncated complete snapshot`,
      extras,
    );
  }
  accountDTransportAttempt(budget);
}

export function setDTransportPhase(
  budget: DTransportBudget,
  phase: DTransportClass,
): void {
  budget.phase = phase;
}

export function wrapAdminWithDTransportBudget(
  admin: OrderAdminReadClient,
  budget: DTransportBudget,
  extras: OrderReadIssueExtras = {},
): OrderAdminReadClient {
  return {
    graphql: async (query, options) => {
      consumeDTransportAttempt(budget, extras);
      const response = await admin.graphql(query, options);
      return {
        json: async () => {
          try {
            const json = await response.json();
            budget.lastCallThrottled = isThrottledEnvelope(json);
            return json;
          } catch (error) {
            budget.lastCallThrottled = true;
            throw error;
          }
        },
      };
    },
  };
}
