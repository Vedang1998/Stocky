/**
 * Decimal values across the loader boundary.
 *
 * React Router's single-fetch encoding (turbo-stream) does not call `toJSON`,
 * so a Prisma.Decimal reaches the browser as its decimal.js internals
 * (`{ d, e, s }`) and renders as `NaN` or `[object Object]` (issue #77).
 * Loaders pass their result through `serializeDecimals`, which turns every
 * Decimal into an exact plain-notation string. Components format those
 * strings with `app/lib/decimal-format.ts`; nothing on the way converts money
 * to a float.
 */
import { Prisma } from "@prisma/client";

/** `T` with every Prisma.Decimal (at any depth) replaced by its string form. */
export type WireDecimals<T> = T extends Prisma.Decimal
  ? string
  : T extends Date
    ? T
    : T extends readonly (infer Item)[]
      ? WireDecimals<Item>[]
      : T extends object
        ? { [Key in keyof T]: WireDecimals<T[Key]> }
        : T;

/**
 * Exact string for one Decimal, in plain notation and without rounding
 * (`toString()` would switch to exponent notation for very small values).
 */
export function decimalToWire(value: Prisma.Decimal): string {
  return value.toFixed();
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function convert(value: unknown): unknown {
  if (Prisma.Decimal.isDecimal(value)) return decimalToWire(value);
  if (Array.isArray(value)) return value.map(convert);
  if (value !== null && typeof value === "object" && isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = convert(entry);
    }
    return result;
  }
  return value;
}

/**
 * Copy of `value` with every Decimal in plain objects and arrays replaced by
 * its exact string. Dates and other class instances are left for the
 * framework's encoder, which handles them natively.
 */
export function serializeDecimals<T>(value: T): WireDecimals<T> {
  return convert(value) as WireDecimals<T>;
}
