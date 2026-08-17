/**
 * Query helpers for the canonical applicator. No Shopify I/O.
 *
 * Callers must use the tagged-template form so values stay bound parameters:
 * `await queryRows(db)`SELECT ... ${shopId}``
 */
import type { CanonicalLockQueryRaw } from "../advisory-lock";
import { CanonicalApplyUniqueConflictError } from "./errors";

export type CanonicalApplyDb = CanonicalLockQueryRaw;

export function queryRows<T = Record<string, unknown>>(
  db: CanonicalApplyDb,
): (strings: TemplateStringsArray, ...values: unknown[]) => Promise<T[]> {
  return async (strings, ...values) => {
    const result = await db.$queryRaw(strings, ...values);
    if (!Array.isArray(result)) {
      throw new Error("canonical apply query must return an array of rows");
    }
    return result as T[];
  };
}

export function asBigInt(value: unknown, field: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "string" && value !== "") return BigInt(value);
  if (typeof value === "number") {
    throw new Error(`${field} must not be a JavaScript Number`);
  }
  throw new Error(`${field} is missing`);
}

export function asBigIntOrNull(value: unknown, field: string): bigint | null {
  if (value == null) return null;
  return asBigInt(value, field);
}

export function asDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function asString(value: unknown): string | null {
  if (value == null) return null;
  return String(value);
}

export function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value == null) return fallback;
  return value === true || value === "t" || value === "true";
}

export function asInt(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (typeof value === "bigint") {
    const n = Number(value);
    if (!Number.isSafeInteger(n)) {
      throw new Error("integer column exceeded safe integer range");
    }
    return n;
  }
  return null;
}

export function isUniqueViolation(error: unknown): boolean {
  const err = error as {
    code?: string;
    message?: string;
    meta?: { code?: string; message?: string };
  };
  const code = `${err.code ?? ""} ${err.meta?.code ?? ""}`;
  const message = `${err.message ?? ""} ${err.meta?.message ?? ""}`;
  return (
    code.includes("23505") ||
    code.includes("P2002") ||
    /23505/.test(message) ||
    /unique constraint/i.test(message)
  );
}

export function throwIfUniqueViolation(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new CanonicalApplyUniqueConflictError();
  }
  throw error;
}

export function newFactId(): string {
  return `cfa_${crypto.randomUUID()}`;
}
