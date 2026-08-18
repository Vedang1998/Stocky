import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR = path.dirname(fileURLToPath(import.meta.url));

function productionModules(): string[] {
  return readdirSync(DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .sort();
}

describe("PR5-F2C compatibility projection safety", () => {
  it("enumerates every production file in this isolated module", () => {
    const files = productionModules();
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain("project.ts");
    expect(files).toContain("mapping.ts");
    expect(files).toContain("legacy-writer.ts");
    expect(files.every((file) => !file.endsWith(".test.ts"))).toBe(true);
  });

  it("does not import Shopify, GraphQL, forecast, ABC, or LowStockAlert", () => {
    for (const file of productionModules()) {
      const source = readFileSync(path.join(DIR, file), "utf8");
      expect(source, file).not.toMatch(/@shopify/);
      expect(source, file).not.toMatch(/graphql-request|admin\.shopify/);
      expect(source, file).not.toMatch(/inventoryAdjustQuantities/);
      expect(source, file).not.toMatch(/inventoryBulkToggleActivation/);
      expect(source, file).not.toMatch(/bulkOperationRunQuery/);
      expect(source, file).not.toMatch(/computeForecast|runAbcAnalysis/);
      expect(source, file).not.toMatch(/lowStockAlert|variantAbcClass|forecastOverride/);
      expect(source, file).not.toMatch(/from ["']\.\.\/\.\.\/services\/forecasting/);
    }
  });

  it("does not write canonical facts or compatibilityProjectionState", () => {
    for (const file of productionModules()) {
      const source = readFileSync(path.join(DIR, file), "utf8");
      expect(source, file).not.toMatch(
        /shopifyProductFact\.(create|update|upsert|delete)/,
      );
      expect(source, file).not.toMatch(
        /shopifyVariantFact\.(create|update|upsert|delete)/,
      );
      expect(source, file).not.toMatch(
        /shopifyInventoryItemFact\.(create|update|upsert|delete)/,
      );
      expect(source, file).not.toMatch(
        /shopifyLocationFact\.(create|update|upsert|delete)/,
      );
      expect(source, file).not.toMatch(
        /shopifyInventoryLevelFact\.(create|update|upsert|delete)/,
      );
      expect(source, file).not.toMatch(/catalogObservationInFlight\.(create|update|upsert|delete)/);
      expect(source, file).not.toMatch(/compatibilityProjectionState\s*:/);
      expect(source, file).not.toMatch(/compatibilityProjectionState\s*=/);
      expect(source, file).not.toMatch(/recommendedCanonicalProjectionState/);
    }
  });

  it("does not invent a canonical writer or advisory-lock helper", () => {
    for (const file of productionModules()) {
      const source = readFileSync(path.join(DIR, file), "utf8");
      expect(source, file).not.toMatch(/advisory-lock|pg_advisory_xact_lock|pg_advisory_lock/);
      expect(source, file).not.toMatch(/observation-generation|allocateCatalogObservationGeneration/);
      expect(source, file).not.toMatch(/acquireCanonicalIdentityAdvisoryLock/);
    }
  });

  it("does not perform Shopify network I/O", () => {
    for (const file of productionModules()) {
      const source = readFileSync(path.join(DIR, file), "utf8");
      expect(source, file).not.toMatch(/\bfetch\s*\(/);
      expect(source, file).not.toMatch(/shopifyGraphQL|unauthenticated|AdminGraphQLClient/);
    }
  });
});
