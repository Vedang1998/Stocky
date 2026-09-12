/**
 * Required GraphQL LIST fields must not collapse missing/null/object/scalar
 * values into an empty array.
 */

import { OrderFactReadWalkError } from "./errors";
import type { OrderReadIssueExtras } from "./types";

export function requireObjectList<T>(
  value: unknown,
  field: string,
  extras: OrderReadIssueExtras,
): T[] {
  if (!Array.isArray(value)) {
    throw new OrderFactReadWalkError(
      "MALFORMED_ENVELOPE",
      `${field} must be a GraphQL list; missing/null/object/scalar is not an empty array`,
      extras,
    );
  }

  const items: T[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (entry == null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new OrderFactReadWalkError(
        "MALFORMED_ENVELOPE",
        `${field}[${index}] must be a non-null object`,
        extras,
      );
    }
    items.push(entry as T);
  }
  return items;
}

export function assertUniqueNonEmptyGids(
  items: ReadonlyArray<{ id?: unknown }>,
  field: string,
  extras: OrderReadIssueExtras,
): void {
  const seen = new Set<string>();
  for (let index = 0; index < items.length; index += 1) {
    const id = items[index]?.id;
    if (typeof id !== "string" || id === "") {
      throw new OrderFactReadWalkError(
        "IDENTITY_MISMATCH",
        `${field}[${index}] is missing a non-empty id`,
        extras,
      );
    }
    if (seen.has(id)) {
      throw new OrderFactReadWalkError(
        "IDENTITY_MISMATCH",
        `${field} contains duplicate identity ${id}`,
        extras,
      );
    }
    seen.add(id);
  }
}
