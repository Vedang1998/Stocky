/**
 * Exact decimal string preservation for Shopify Money / MoneyV2 / Decimal.
 * Never convert through JavaScript Number or parseFloat.
 */

export function requireDecimalString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `${field} must remain an exact decimal string from Shopify JSON`,
    );
  }
  return value;
}

export function optionalDecimalString(
  value: unknown,
  field: string,
): string | null {
  if (value == null) return null;
  return requireDecimalString(value, field);
}

export function optionalLegacyResourceId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return value.toString();
  throw new Error(
    "legacyResourceId must remain a string (UnsignedInt64 JSON token), not Number",
  );
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  return value;
}

export function requireNonEmptyString(value: unknown, field: string): string {
  const valueAsString = requireString(value, field);
  if (valueAsString === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return valueAsString;
}

export function optionalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  throw new Error("expected string or null");
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }
  return value;
}

export function optionalBoolean(value: unknown, field = "expected boolean or null"): boolean | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  throw new Error(`${field} must be a boolean or null`);
}

export function optionalFiniteNumber(
  value: unknown,
  field: string,
): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number from Shopify JSON`);
  }
  return value;
}

/**
 * Shopify Admin DateTime / RFC 3339 profile. Validate without rewriting a
 * valid source string (no Date.parse round-trip).
 */
const SHOPIFY_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;

function parseDecimalDigits(digits: string): number {
  let value = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const code = digits.charCodeAt(index);
    value = value * 10 + (code - 48);
  }
  return value;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isValidShopifyDateTime(value: string): boolean {
  const match = SHOPIFY_DATETIME.exec(value);
  if (!match) return false;
  const year = parseDecimalDigits(match[1]!);
  const month = parseDecimalDigits(match[2]!);
  const day = parseDecimalDigits(match[3]!);
  const hour = parseDecimalDigits(match[4]!);
  const minute = parseDecimalDigits(match[5]!);
  const second = parseDecimalDigits(match[6]!);
  if (month < 1 || month > 12) return false;
  if (hour > 23 || minute > 59 || second > 60) return false;
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (day < 1 || day > daysInMonth[month - 1]!) return false;
  if (match[8] !== "Z") {
    const offsetHour = parseDecimalDigits(match[9]!);
    const offsetMinute = parseDecimalDigits(match[10]!);
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }
  return true;
}

export function requireIsoTimestamp(value: unknown, field: string): string {
  const asString = requireString(value, field);
  if (!isValidShopifyDateTime(asString)) {
    throw new Error(
      `${field} must be a Shopify DateTime / RFC3339 timestamp`,
    );
  }
  return asString;
}

export function optionalIsoTimestamp(
  value: unknown,
  field = "timestamp",
): string | null {
  if (value == null) return null;
  return requireIsoTimestamp(value, field);
}

export function stringifyUnsignedCount(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return value.toString();
  throw new Error(
    "BulkOperation objectCount/rootObjectCount must remain string tokens, not Number",
  );
}
