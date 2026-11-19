/**
 * Decimal helpers for purchasing money and quantities.
 *
 * All purchasing arithmetic uses Prisma.Decimal (decimal.js). Values are only
 * converted to strings at the presentation boundary.
 */
import { Prisma } from "@prisma/client";

export type Decimal = Prisma.Decimal;
export type DecimalInput = Prisma.Decimal | string | number;

export const ZERO = new Prisma.Decimal(0);
export const ONE = new Prisma.Decimal(1);
export const HUNDRED = new Prisma.Decimal(100);

/** Currency amounts on purchase orders carry two decimal places. */
export const MONEY_SCALE = 2;
/** Unit costs carry four decimal places (POLineItem.unitCost is DECIMAL(10,4)). */
export const UNIT_COST_SCALE = 4;

export function dec(value: DecimalInput | null | undefined): Prisma.Decimal {
  if (value === null || value === undefined) return ZERO;
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new RangeError(`Non-finite number cannot become a decimal: ${value}`);
  }
  return new Prisma.Decimal(value);
}

export function decOrNull(
  value: DecimalInput | null | undefined,
): Prisma.Decimal | null {
  return value === null || value === undefined ? null : dec(value);
}

/** Round half away from zero, the convention used on commercial invoices. */
export function roundTo(value: Prisma.Decimal, scale: number): Prisma.Decimal {
  return value.toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP);
}

export function roundMoney(value: Prisma.Decimal): Prisma.Decimal {
  return roundTo(value, MONEY_SCALE);
}

export function sum(values: Iterable<Prisma.Decimal>): Prisma.Decimal {
  let total = ZERO;
  for (const value of values) total = total.plus(value);
  return total;
}

/** Fixed-scale string for loader payloads, CSV and documents. */
export function toFixed(
  value: DecimalInput | null | undefined,
  scale: number = MONEY_SCALE,
): string {
  return roundTo(dec(value), scale).toFixed(scale);
}

export function toFixedOrNull(
  value: DecimalInput | null | undefined,
  scale: number = MONEY_SCALE,
): string | null {
  return value === null || value === undefined ? null : toFixed(value, scale);
}

/**
 * Plain string without trailing zeros, for prefilling form inputs
 * (e.g. 12.5000 → "12.5").
 */
export function toInputString(
  value: DecimalInput | null | undefined,
): string {
  if (value === null || value === undefined) return "";
  return dec(value).toString();
}
