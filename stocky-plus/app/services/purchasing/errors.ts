/**
 * Errors the purchasing services raise for conditions a merchant can fix.
 *
 * Routes turn these into form or banner messages. Anything else that escapes a
 * service is a defect and is left to the route error boundary.
 */
import type { FieldErrors } from "../../lib/purchasing/form-input";

export type PurchasingErrorCode =
  | "not_found"
  | "invalid_input"
  | "invalid_state"
  | "conflict";

export class PurchasingError extends Error {
  readonly code: PurchasingErrorCode;
  readonly fieldErrors: FieldErrors;

  constructor(
    code: PurchasingErrorCode,
    message: string,
    fieldErrors: FieldErrors = {},
  ) {
    super(message);
    this.name = "PurchasingError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function notFound(what: string): PurchasingError {
  return new PurchasingError("not_found", `${what} was not found.`);
}

export function invalidInput(
  message: string,
  fieldErrors: FieldErrors = {},
): PurchasingError {
  return new PurchasingError("invalid_input", message, fieldErrors);
}

/** Prisma unique-constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}
