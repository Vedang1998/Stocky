/**
 * Distinguish a completed explicit-null selected root from a malformed envelope.
 * B never classifies existence from these outcomes.
 */

import { OrderFactReadWalkError } from "./errors";
import type { OrderReadIssueExtras } from "./types";

export type SelectedRootExtraction<T> =
  | { status: "value"; value: T }
  | { status: "explicit_null" };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractSelectedRoot<T>(
  json: unknown,
  rootField: string,
  extras: OrderReadIssueExtras,
): SelectedRootExtraction<T> {
  if (!isPlainObject(json)) {
    throw new OrderFactReadWalkError(
      "MALFORMED_ENVELOPE",
      "Admin JSON envelope is not an object",
      extras,
    );
  }

  if ("errors" in json && json.errors != null) {
    if (!Array.isArray(json.errors)) {
      throw new OrderFactReadWalkError(
        "MALFORMED_ENVELOPE",
        "Admin JSON errors is not an array",
        extras,
      );
    }
    if (json.errors.length > 0) {
      throw new OrderFactReadWalkError(
        "ADMIN_READ_ERROR",
        "Admin JSON includes GraphQL errors",
        extras,
      );
    }
  }

  if (!Object.prototype.hasOwnProperty.call(json, "data")) {
    throw new OrderFactReadWalkError(
      "MALFORMED_ENVELOPE",
      "Admin JSON is missing data",
      extras,
    );
  }

  if (json.data == null) {
    throw new OrderFactReadWalkError(
      "MALFORMED_ENVELOPE",
      "Admin JSON data is null",
      extras,
    );
  }

  if (!isPlainObject(json.data)) {
    throw new OrderFactReadWalkError(
      "MALFORMED_ENVELOPE",
      "Admin JSON data is not an object",
      extras,
    );
  }

  const data = json.data;
  if (!Object.prototype.hasOwnProperty.call(data, rootField)) {
    throw new OrderFactReadWalkError(
      "MALFORMED_ENVELOPE",
      `Admin JSON data is missing selected root ${rootField}`,
      extras,
    );
  }

  const root = data[rootField];
  if (root === null) {
    return { status: "explicit_null" };
  }
  if (!isPlainObject(root)) {
    throw new OrderFactReadWalkError(
      "MALFORMED_ENVELOPE",
      `selected root ${rootField} is not an object`,
      extras,
    );
  }

  return { status: "value", value: root as T };
}
