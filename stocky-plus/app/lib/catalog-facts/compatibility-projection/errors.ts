import { Prisma } from "@prisma/client";
import type {
  CompatibilityProjectionFailure,
  CompatibilityProjectionIdentity,
} from "./types";

/**
 * Transient Prisma infrastructure failures with an explicit, reviewed reason
 * to retry. Validation, constraint, and unknown errors stay non-retryable.
 */
export const RETRYABLE_PRISMA_ERROR_CODES = new Set([
  "P1001", // Can't reach database server
  "P1002", // Database server timed out
  "P1008", // Operations timed out
  "P1017", // Server closed the connection
  "P2024", // Timed out fetching a connection from the pool
  "P2034", // Write conflict or deadlock
]);

export class CompatibilityProjectionError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly identity?: CompatibilityProjectionIdentity;

  constructor(
    code: string,
    message: string,
    options?: {
      retryable?: boolean;
      identity?: CompatibilityProjectionIdentity;
    },
  ) {
    super(message);
    this.name = "CompatibilityProjectionError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.identity = options?.identity;
  }
}

function errorName(error: unknown): string | undefined {
  if (typeof error === "object" && error != null && "name" in error) {
    const name = (error as { name?: unknown }).name;
    return typeof name === "string" ? name : undefined;
  }
  return undefined;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error != null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/**
 * Default unknown / programming / validation errors to non-retryable.
 * Only an explicit reviewed reason may mark a failure retryable.
 */
export function classifyProjectionFailure(
  error: unknown,
): CompatibilityProjectionFailure {
  if (error instanceof CompatibilityProjectionError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      identity: error.identity,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  const name = errorName(error);

  if (
    error instanceof Prisma.PrismaClientValidationError ||
    name === "PrismaClientValidationError"
  ) {
    return {
      code: "projection_permanent_request_failed",
      message,
      retryable: false,
    };
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    name === "PrismaClientKnownRequestError"
  ) {
    const prismaCode = errorCode(error);
    if (prismaCode && RETRYABLE_PRISMA_ERROR_CODES.has(prismaCode)) {
      return {
        code: "projection_transient_write_failed",
        message,
        retryable: true,
      };
    }
    return {
      code: "projection_permanent_request_failed",
      message,
      retryable: false,
    };
  }

  return {
    code: "projection_unclassified_failure",
    message,
    retryable: false,
  };
}
