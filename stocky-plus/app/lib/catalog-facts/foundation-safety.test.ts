import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { featureFlags } from "../feature-flags.server";
import { listProductionTypeScriptModulesRecursive } from "./admin-read/safety/production-modules";
import {
  assertCatalogFactsReadBoundarySafe,
  assertCatalogFactsWorkerBoundarySafe,
} from "./admin-read/safety/scan";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = path.resolve(DIR, "../../jobs/workers/catalog-facts");

describe("PR5-F1 foundation safety", () => {
  it("does not change inventory-write feature-flag defaults", () => {
    expect(featureFlags.stocktakeInventoryWrites()).toBe(false);
    expect(featureFlags.adjustmentWrites()).toBe(false);
    expect(featureFlags.receiptWrites()).toBe(false);
    expect(featureFlags.costSync()).toBe(false);
    expect(featureFlags.transferWrites()).toBe(false);
    expect(featureFlags.pr5AbsenceTombstone()).toBe(false);
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
        file.includes(
          `${path.sep}admin-read${path.sep}safety${path.sep}scan.ts`,
        ),
      ),
    ).toBe(true);
  });

  it("rejects Shopify mutations in catalog-facts by GraphQL AST (deny-by-default)", () => {
    assertCatalogFactsReadBoundarySafe(DIR);
  });

  it("recursively scans the catalog-facts worker root with its narrow import policy", () => {
    const files = listProductionTypeScriptModulesRecursive(WORKER_DIR);
    expect(files.length).toBeGreaterThan(0);
    assertCatalogFactsWorkerBoundarySafe(WORKER_DIR);
  });

  it("forbids every session-level advisory-lock spelling in both production roots", () => {
    const files = [
      ...listProductionTypeScriptModulesRecursive(DIR),
      ...listProductionTypeScriptModulesRecursive(WORKER_DIR),
    ];
    const forbidden = /\bpg_(?:try_)?advisory_lock(?:_shared)?\s*\(/;
    expect(
      files.flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return forbidden.test(source) ? [file] : [];
      }),
    ).toEqual([]);
    expect(readFileSync(path.join(DIR, "advisory-lock.ts"), "utf8")).toMatch(
      /pg_advisory_xact_lock/,
    );
  });
});
