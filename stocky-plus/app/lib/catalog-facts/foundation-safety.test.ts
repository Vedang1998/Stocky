import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { featureFlags } from "../feature-flags.server";

const DIR = path.dirname(fileURLToPath(import.meta.url));

describe("PR5-F1 foundation safety", () => {
  it("does not change inventory-write feature-flag defaults", () => {
    expect(featureFlags.stocktakeInventoryWrites()).toBe(false);
    expect(featureFlags.adjustmentWrites()).toBe(false);
    expect(featureFlags.receiptWrites()).toBe(false);
    expect(featureFlags.costSync()).toBe(false);
    expect(featureFlags.transferWrites()).toBe(false);
  });

  it("catalog-facts modules do not import Shopify or GraphQL clients", () => {
    const files = [
      "advisory-lock.ts",
      "constants.ts",
      "index.ts",
      "lock-capacity.ts",
      "lock-key.ts",
      "observation-generation.ts",
    ];
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
