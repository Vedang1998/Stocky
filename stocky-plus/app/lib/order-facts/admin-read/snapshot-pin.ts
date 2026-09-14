/**
 * Per-resource Clock A pin. Compare exact validated timestamp strings,
 * never a Date conversion.
 */

import { requireSnapshotTimestamp } from "./map-nodes";
import { OrderPaginationError } from "./errors";
import { requireNonEmptyString } from "./decimal";
import { assertReturnedGidMatches } from "./identity";
import type { OrderReadIssueExtras } from "./types";

export type OrderClockPin = {
  gid: string;
  updatedAt: string;
  currencyCode: string;
};

export type RefundClockPin = {
  gid: string;
  updatedAt: string;
};

export function pinOrderClock(node: {
  id?: unknown;
  updatedAt?: unknown;
  currencyCode?: unknown;
}): OrderClockPin {
  return {
    gid: requireNonEmptyString(node.id, "order.id"),
    updatedAt: requireSnapshotTimestamp(node.updatedAt, "order.updatedAt"),
    currencyCode: requireNonEmptyString(node.currencyCode, "order.currencyCode"),
  };
}

export function pinRefundClock(node: {
  id?: unknown;
  updatedAt?: unknown;
}): RefundClockPin {
  return {
    gid: requireNonEmptyString(node.id, "refund.id"),
    updatedAt: requireSnapshotTimestamp(node.updatedAt, "refund.updatedAt"),
  };
}

export function assertOrderClockPin(
  pin: OrderClockPin,
  node: { id?: unknown; updatedAt?: unknown; currencyCode?: unknown },
  extras: OrderReadIssueExtras,
): void {
  assertReturnedGidMatches(pin.gid, node.id, "order", extras);
  const updatedAt = requireSnapshotTimestamp(node.updatedAt, "order.updatedAt");
  if (updatedAt !== pin.updatedAt) {
    throw new OrderPaginationError(
      "order updatedAt drifted during pagination",
      extras,
    );
  }
  const currencyCode = requireNonEmptyString(
    node.currencyCode,
    "order.currencyCode",
  );
  if (currencyCode !== pin.currencyCode) {
    throw new OrderPaginationError(
      "order currencyCode drifted during pagination",
      extras,
    );
  }
}

export function assertRefundClockPin(
  pin: RefundClockPin,
  node: { id?: unknown; updatedAt?: unknown },
  extras: OrderReadIssueExtras,
): void {
  assertReturnedGidMatches(pin.gid, node.id, "refund", extras);
  const updatedAt = requireSnapshotTimestamp(node.updatedAt, "refund.updatedAt");
  if (updatedAt !== pin.updatedAt) {
    throw new OrderPaginationError(
      "refund updatedAt drifted during pagination",
      extras,
    );
  }
}
