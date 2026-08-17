import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { featureFlags } from "../feature-flags.server";

const DIR = path.dirname(fileURLToPath(import.meta.url));

function productionCatalogFactModules(): string[] {
  return readdirSync(DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .sort();
}

describe("PR5-F1 foundation safety", () => {
  it("does not change inventory-write feature-flag defaults", () => {
    expect(featureFlags.stocktakeInventoryWrites()).toBe(false);
    expect(featureFlags.adjustmentWrites()).toBe(false);
    expect(featureFlags.receiptWrites()).toBe(false);
    expect(featureFlags.costSync()).toBe(false);
    expect(featureFlags.transferWrites()).toBe(false);
  });

  it("enumerates every production catalog-facts module for prohibited Shopify imports", () => {
    const files = productionCatalogFactModules();
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((file) => !file.endsWith(".test.ts"))).toBe(true);
    for (const file of files) {
      const source = readFileSync(path.join(DIR, file), "utf8");
      expect(source, file).not.toMatch(/@shopify/);
      expect(source, file).not.toMatch(/graphql-request|admin\.shopify/);
      expect(source, file).not.toMatch(/inventoryAdjustQuantities/);
      expect(source, file).not.toMatch(/bulkOperationRunQuery/);
    }
  });

  it("advisory lock module forbids session-level pg_advisory_lock", () => {
    const source = readFileSync(path.join(DIR, "advisory-lock.ts"), "utf8");
    expect(source).toMatch(/pg_advisory_xact_lock/);
    expect(source).not.toMatch(/pg_advisory_lock\s*\(/);
    expect(source).not.toMatch(/pg_try_advisory_lock\s*\(/);
  });
});
