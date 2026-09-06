import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_APPLY_PHYSICAL_DELETE_OPERATIONS,
  applyCanonicalFacts,
  denyCanonicalFactPhysicalDelete,
} from "./index";
import {
  CanonicalApplyLeaseInvalidError,
  CanonicalApplyPhysicalDeleteError,
  CanonicalApplyRequestGenerationMismatchError,
} from "./errors";

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

  it("request-generation mismatch is a distinct fail-closed error", () => {
    const error = new CanonicalApplyRequestGenerationMismatchError();
    expect(error).not.toBeInstanceOf(CanonicalApplyLeaseInvalidError);
    expect(error.code).toBe("canonical_apply_request_generation_mismatch");
  });

  it("binds durable observationRequestGen and does not retry unique conflicts in-process", () => {
    const fencing = readFileSync(path.join(DIR, "fencing.ts"), "utf8");
    expect(fencing).toMatch(/CanonicalApplyRequestGenerationMismatchError/);
    expect(fencing).toMatch(/mapped\.observationRequestGen !== expectedRequestGen/);
    expect(fencing).toMatch(
      /AND "observationRequestGen" = \$\{expectedRequestGen\.toString\(\)\}::bigint/,
    );
    const index = readFileSync(path.join(DIR, "index.ts"), "utf8");
    expect(index).not.toMatch(/CanonicalApplyUniqueConflictError/);
    expect(index).toMatch(/MUST start a fresh[\s*]+PostgreSQL transaction/);
    const writers = readFileSync(path.join(DIR, "writers.ts"), "utf8");
    expect(writers).not.toMatch(/ON CONFLICT/);
  });

  it("apply module source has no physical delete of canonical facts and no money Number arithmetic", () => {
    const files = walkTs(DIR);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((file) => file.endsWith(`${path.sep}index.ts`))).toBe(true);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/MAX_UNIQUE_RETRIES/);
      expect(source, file).not.toMatch(/\.deleteMany\s*\(/);
      expect(source, file).not.toMatch(/\$queryRaw\s*\(/);
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

  it("does not masquerade a full-sync fence as a direct existence interval", () => {
    const files = walkTs(DIR);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/function observationInterval\s*\(/);
      expect(source, file).not.toMatch(/requestGen:\s*observation\.fenceGeneration/);
      expect(source, file).not.toMatch(/responseGen:\s*observation\.fenceGeneration/);
    }
    const index = readFileSync(path.join(DIR, "index.ts"), "utf8");
    expect(index).toMatch(/directObservationInterval/);
    expect(index).toMatch(/fullSyncFenceGeneration/);
    expect(index).toMatch(/fullSyncAttributeMarker/);
    expect(index).toMatch(/nullableFallbackIntervalFromFullSyncMarker/);
    expect(index).toMatch(/loadCompletedDirectsNotSafelyEarlierThanFence/);
    expect(index).toMatch(/loadActiveUnexpiredBlockersForFullSync/);
    const evidence = readFileSync(path.join(DIR, "observation-evidence.ts"), "utf8");
    expect(evidence).toMatch(/kind: "full_sync_fence"/);
    expect(evidence).toMatch(/kind: "full_sync_attribute_marker"/);
  });

  it("locks the canonical fact before observation rows inside applyOneObservation", () => {
    const index = readFileSync(path.join(DIR, "index.ts"), "utf8");
    const start = index.indexOf("async function applyOneObservation");
    const end = index.indexOf("export async function applyCanonicalFacts");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = index.slice(start, end);
    const factLock = body.indexOf("lockAndReadFact");
    const observationLock = body.indexOf("lockObservationRows");
    expect(factLock).toBeGreaterThan(-1);
    expect(observationLock).toBeGreaterThan(-1);
    expect(factLock).toBeLessThan(observationLock);
    expect(body).toMatch(/reliesOnExpiry/);
    expect(body).not.toMatch(/abandonExpiredFullSyncBlockers/);
  });

  it("returns an empty batch after tenant validation without capacity evaluation or locks", async () => {
    const queries: string[] = [];
    const db = {
      $queryRaw: async (strings: TemplateStringsArray) => {
        const sql = strings.join("?");
        queries.push(sql);
        if (sql.includes("stocky.current_shop_id")) {
          return [{ shop_id: "shop-empty" }];
        }
        throw new Error(`empty batch must not issue ${sql}`);
      },
    };
    const result = await applyCanonicalFacts(db, {
      shopId: "shop-empty",
      observations: [],
    });
    expect(result).toEqual({
      results: [],
      identitiesLocked: 0,
      abandonedBlockerTokens: [],
    });
    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(/stocky\.current_shop_id/);
  });
});
