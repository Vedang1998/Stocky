/**
 * Deterministic SHA-256 digest over canonical JSON (sorted keys, stable nulls).
 */
import { createHash } from "node:crypto";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Recursively sort object keys for stable serialization. */
export function canonicalizeJson(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = canonicalizeJson(value[key]);
  }
  return sorted;
}

export function canonicalJsonString(value: unknown): string {
  return JSON.stringify(canonicalizeJson(value));
}

/** SHA-256 hex digest of the canonical JSON serialization. */
export function digestCanonicalJson(value: unknown): string {
  return createHash("sha256").update(canonicalJsonString(value)).digest("hex");
}
