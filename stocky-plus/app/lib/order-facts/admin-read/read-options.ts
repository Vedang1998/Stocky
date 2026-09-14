/**
 * Validate Admin pagination budget options before any transport.
 */

import {
  ORDER_ADMIN_READ_MAX_REQUESTS,
  ORDER_ADMIN_READ_PAGE_SIZE,
} from "./constants";
import { OrderFactReadWalkError } from "./errors";
import type { OrderReadIssueExtras } from "./types";

/** Shopify Admin GraphQL connection `first` maximum. */
export const ORDER_ADMIN_READ_MAX_PAGE_SIZE = 250;

export type ResolvedReadOptions = {
  pageSize: number;
  maxRequests: number;
};

function assertPositiveSafeInteger(
  value: unknown,
  field: string,
  extras: OrderReadIssueExtras,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new OrderFactReadWalkError(
      "INVALID_READ_OPTIONS",
      `${field} must be a finite positive safe integer`,
      extras,
    );
  }
  return value;
}

export function resolveReadOptions(
  options: { pageSize?: number; maxRequests?: number } | undefined,
  extras: OrderReadIssueExtras,
): ResolvedReadOptions {
  const pageSize =
    options && Object.prototype.hasOwnProperty.call(options, "pageSize")
      ? assertPositiveSafeInteger(options.pageSize, "pageSize", extras)
      : ORDER_ADMIN_READ_PAGE_SIZE;
  const maxRequests =
    options && Object.prototype.hasOwnProperty.call(options, "maxRequests")
      ? assertPositiveSafeInteger(options.maxRequests, "maxRequests", extras)
      : ORDER_ADMIN_READ_MAX_REQUESTS;

  if (pageSize > ORDER_ADMIN_READ_MAX_PAGE_SIZE) {
    throw new OrderFactReadWalkError(
      "INVALID_READ_OPTIONS",
      `pageSize exceeds API-supported maximum ${ORDER_ADMIN_READ_MAX_PAGE_SIZE}`,
      extras,
    );
  }
  if (maxRequests > ORDER_ADMIN_READ_MAX_REQUESTS) {
    throw new OrderFactReadWalkError(
      "INVALID_READ_OPTIONS",
      `maxRequests exceeds configured maximum ${ORDER_ADMIN_READ_MAX_REQUESTS}`,
      extras,
    );
  }

  return { pageSize, maxRequests };
}
