import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { featureFlags } from "../feature-flags.server";
import { listProductionTypeScriptModulesRecursive } from "./admin-read/safety/production-modules";
import { assertCatalogFactsReadBoundarySafe } from "./admin-read/safety/scan";

const DIR = path.dirname(fileURLToPath(import.meta.url));

describe("PR5-F1 foundation safety", () => {
  it("does not change inventory-write feature-flag defaults", () => {
    expect(featureFlags.stocktakeInventoryWrites()).toBe(false);
    expect(featureFlags.adjustmentWrites()).toBe(false);
    expect(featureFlags.receiptWrites()).toBe(false);
    expect(featureFlags.costSync()).toBe(false);
    expect(featureFlags.transferWrites()).toBe(false);
  });

  it("recursively enumerates nested production modules including admin-read/safety", () => {
    const files = listProductionTypeScriptModulesRecursive(DIR);
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((file) => !file.endsWith(".test.ts"))).toBe(true);
    expect(
      files.some((file) => file.includes(`${path.sep}admin-read${path.sep}`)),
    ).toBe(true);
    expect(
      files.some((file) =>
        file.includes(`${path.sep}admin-read${path.sep}safety${path.sep}scan.ts`),
      ),
    ).toBe(true);
  });

  it("rejects Shopify mutations in catalog-facts by GraphQL AST (deny-by-default)", () => {
    assertCatalogFactsReadBoundarySafe(DIR);
  });

  it("advisory lock module forbids session-level pg_advisory_lock", () => {
    const source = readFileSync(path.join(DIR, "advisory-lock.ts"), "utf8");
    expect(source).toMatch(/pg_advisory_xact_lock/);
    expect(source).not.toMatch(/pg_advisory_lock\s*\(/);
    expect(source).not.toMatch(/pg_try_advisory_lock\s*\(/);
  });
});
