import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listProductionTypeScriptModulesRecursive } from "./safety/production-modules";
import { scanOrderFactsProductionModules } from "./safety/scan";

const ROOT = path.dirname(fileURLToPath(new URL("./documents.ts", import.meta.url)));

function walkAllTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...walkAllTs(full));
      continue;
    }
    if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("PR6-B production-module static safety (T48 reader boundary)", () => {
  it("does not DML canonical facts, observations, or SalesDailyAggregate", () => {
    const files = listProductionTypeScriptModulesRecursive(ROOT);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/OrderFactObservationInFlight/);
      expect(text, file).not.toMatch(/SalesDailyAggregate/);
      expect(text, file).not.toMatch(/\$executeRaw|\$queryRaw/);
      expect(text, file).not.toMatch(/from ["']@prisma\/client["']/);
      expect(text, file).not.toMatch(/\bbulkOperationRunQuery\s*\(/);
      expect(text, file).not.toMatch(/\bparseFloat\s*\(/);
      expect(text, file).not.toMatch(/\bNumber\s*\(\s*(?:amount|shopAmount)/);
      expect(text, file).not.toMatch(/tombstone/i);
      expect(text, file).not.toMatch(/INACCESSIBLE_HISTORY_WINDOW/);
    }
  });

  it("recursively scans nested production modules and finds zero GraphQL findings", () => {
    const result = scanOrderFactsProductionModules(ROOT);
    expect(result.files.length).toBeGreaterThan(5);
    expect(result.relativeFiles.some((file) => file.includes("safety/"))).toBe(
      true,
    );
    expect(result.findings).toEqual([]);
    expect(result.graphqlDocumentCount).toBeGreaterThan(0);
  });

  it("test files may contain planted invalid documents without affecting production scan", () => {
    const tests = walkAllTs(ROOT).filter((file) => file.endsWith(".test.ts"));
    expect(tests.length).toBeGreaterThan(0);
    const planted = tests.some((file) =>
      readFileSync(file, "utf8").includes("InvalidSaleLineItemOnInterface"),
    );
    expect(planted).toBe(true);
    expect(statSync(ROOT).isDirectory()).toBe(true);
  });
});
