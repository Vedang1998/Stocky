import { createHash } from "node:crypto";

/**
 * Deterministic SHA-256 checksum over a stable canonical representation.
 * Rows are sorted by id; fields are ordered keys with JSON-stable values.
 */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key] = sortValue(obj[key]);
  }
  return out;
}

export function checksumRows(
  rows: Array<Record<string, unknown>>,
  fields: string[],
): string {
  const normalized = [...rows]
    .map((row) => {
      const picked: Record<string, unknown> = {};
      for (const field of fields) {
        picked[field] = row[field] ?? null;
      }
      return picked;
    })
    .sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")));

  return sha256Hex(canonicalJson(normalized));
}

/**
 * @deprecated ID-only membership checksum — superseded by phase1-tenant-subject-v2
 * streaming subject digests in subject-evidence.ts. Retained only for isolated
 * unit/helper callers; must not be used as run-subject evidence.
 */
export function membershipChecksum(ids: string[]): string {
  const ordered = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sha256Hex(canonicalJson(ordered));
}

export function issueFingerprint(parts: {
  tableName: string;
  rowId: string;
  reasonCode: string;
}): string {
  return sha256Hex(
    canonicalJson({
      tableName: parts.tableName,
      rowId: parts.rowId,
      reasonCode: parts.reasonCode,
    }),
  );
}
