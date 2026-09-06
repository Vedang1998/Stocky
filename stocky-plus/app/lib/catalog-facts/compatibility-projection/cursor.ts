import { CompatibilityProjectionError } from "./errors";
import type { ShopRebuildCursor } from "./types";

function invalidRebuildCursor(detail: string): never {
  throw new CompatibilityProjectionError(
    "invalid_rebuild_cursor",
    `Compatibility projection rebuild cursor is malformed: ${detail}`,
    { retryable: false },
  );
}

function assertPlainCursorObject(
  cursor: unknown,
): asserts cursor is Record<string, unknown> {
  if (cursor == null || typeof cursor !== "object" || Array.isArray(cursor)) {
    invalidRebuildCursor("cursor must be an object");
  }
}

function assertAllowedKeys(
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      invalidRebuildCursor(`unexpected field ${key}`);
    }
  }
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    invalidRebuildCursor(`${field} must be a non-empty string when present`);
  }
  return value;
}

/**
 * Validate every rebuild-cursor field. Numbers, objects, arrays, empty
 * strings, and partial inventory-level composites are non-retryable.
 */
export function normalizeRebuildCursor(
  cursor: ShopRebuildCursor | null | unknown,
): ShopRebuildCursor {
  if (cursor == null) return { phase: "variants" };

  assertPlainCursorObject(cursor);
  const record = cursor;

  if (record.phase === "variants") {
    assertAllowedKeys(record, new Set(["phase", "afterGid"]));
    if (!("afterGid" in record) || record.afterGid === undefined) {
      return { phase: "variants" };
    }
    return {
      phase: "variants",
      afterGid: requireNonEmptyString(record.afterGid, "afterGid"),
    };
  }

  if (record.phase === "inventory_levels") {
    assertAllowedKeys(
      record,
      new Set(["phase", "afterItemGid", "afterLocationGid"]),
    );
    const hasItem =
      "afterItemGid" in record && record.afterItemGid !== undefined;
    const hasLocation =
      "afterLocationGid" in record && record.afterLocationGid !== undefined;
    if (hasItem !== hasLocation) {
      invalidRebuildCursor(
        "inventory_levels afterItemGid and afterLocationGid must both be absent or both be non-empty strings",
      );
    }
    if (!hasItem) {
      return { phase: "inventory_levels" };
    }
    return {
      phase: "inventory_levels",
      afterItemGid: requireNonEmptyString(record.afterItemGid, "afterItemGid"),
      afterLocationGid: requireNonEmptyString(
        record.afterLocationGid,
        "afterLocationGid",
      ),
    };
  }

  invalidRebuildCursor("phase must be exactly variants or inventory_levels");
}
