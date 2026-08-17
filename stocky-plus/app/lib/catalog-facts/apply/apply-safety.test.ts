import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_APPLY_PHYSICAL_DELETE_OPERATIONS,
  denyCanonicalFactPhysicalDelete,
} from "./index";
import { CanonicalApplyPhysicalDeleteError } from "./errors";

const DIR = path.dirname(fileURLToPath(import.meta.url));

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTs(full));
      continue;
    }
    if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("PR5-F2B apply surface safety (R-164)", () => {
  it("ordinary apply APIs provide no physical-delete operation", () => {
    expect(CANONICAL_APPLY_PHYSICAL_DELETE_OPERATIONS).toEqual([]);
    expect(() => denyCanonicalFactPhysicalDelete()).toThrow(
      CanonicalApplyPhysicalDeleteError,
    );
  });

  it("apply module source has no physical delete of canonical facts and no money Number arithmetic", () => {
    const files = walkTs(DIR);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((file) => file.endsWith(`${path.sep}index.ts`))).toBe(true);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\.deleteMany\s*\(/);
      expect(source, file).not.toMatch(/DELETE\s+FROM\s+"Shopify(Product|Variant|InventoryItem|Location|InventoryLevel)Fact"/i);
      expect(source, file).not.toMatch(/parseFloat\s*\(/);
      expect(source, file).not.toMatch(/Number\.parseFloat\s*\(/);
      expect(source, file).not.toMatch(/\bsetval\s*\(/);
      expect(source, file).not.toMatch(/pg_advisory_lock\s*\(/);
      expect(source, file).not.toMatch(/bulkOperationRunQuery/);
      expect(source, file).not.toMatch(/fetch\s*\(/);
      expect(source, file).not.toMatch(/@shopify/);
    }
  });
});
