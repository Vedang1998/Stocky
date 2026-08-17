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

export function optionalBoolean(value: unknown): boolean | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  throw new Error("expected boolean or null");
}

export function requireIsoTimestamp(value: unknown, field: string): string {
  return requireString(value, field);
}

export function optionalIsoTimestamp(value: unknown): string | null {
  return optionalString(value);
}

export function stringifyUnsignedCount(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return value.toString();
  throw new Error(
    "BulkOperation objectCount/rootObjectCount must remain string tokens, not Number",
  );
}
