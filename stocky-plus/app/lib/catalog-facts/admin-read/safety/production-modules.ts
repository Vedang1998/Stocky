/**
 * Recursive production TypeScript module discovery for catalog-facts (R-163).
 *
 * Nested directories under the canonical fact/read boundary must be inspected.
 * Test files are not production modules.
 */

import { readdirSync } from "node:fs";
import path from "node:path";

const SKIP_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "build",
  "__tests__",
]);

export function listProductionTypeScriptModulesRecursive(
  rootDir: string,
): string[] {
  const out: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name.endsWith(".d.ts")) continue;
      if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) {
        continue;
      }
      if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        out.push(full);
      }
    }
  }

  walk(rootDir);
  return out.sort();
}

export function toPosixRelative(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}
