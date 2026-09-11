/**
 * Budgeted Admin QUERY execution for one snapshot walk.
 */

import {
  accumulateAdminReadCost,
  executeAdminReadQuery,
  OrderAdminReadError,
} from "./execute";
import { OrderFactReadWalkError, OrderPaginationError } from "./errors";
import type {
  AdminGraphQLResponse,
  OrderAdminReadClient,
  RequestCostAccumulator,
} from "./types";

export async function executeBudgetedQuery<T>(
  admin: OrderAdminReadClient,
  document: string,
  variables: Record<string, unknown> | undefined,
  cost: RequestCostAccumulator,
  maxRequests: number,
): Promise<AdminGraphQLResponse<T>> {
  if (cost.requests >= maxRequests) {
    throw new OrderPaginationError(
      `Admin request budget exhausted (${maxRequests}); refusing a truncated complete snapshot`,
    );
  }
  try {
    const json = await executeAdminReadQuery<T>(admin, document, variables);
    accumulateAdminReadCost(cost, json);
    return json;
  } catch (error) {
    if (error instanceof OrderFactReadWalkError) throw error;
    if (error instanceof OrderAdminReadError) {
      throw new OrderFactReadWalkError("ADMIN_READ_ERROR", error.message);
    }
    throw error;
  }
}
