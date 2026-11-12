#!/usr/bin/env tsx
/**
 * Mechanically generate PR2_TENANT_ACCESS_INVENTORY.md from the scanner.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inventoryRows, renderTenantAccessInventory } from "./inventory-render";
import { scanRepository } from "./scan";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const STDOUT_ONLY = process.argv.includes("--stdout");
const OUT = STDOUT_ONLY
  ? null
  : path.join(
      APP_ROOT,
      "docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md",
    );

const result = scanRepository();
const md = renderTenantAccessInventory(result);

if (OUT) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, md);
  console.log(
    JSON.stringify({
      event: "tenant_access_inventory_written",
      path: path.relative(APP_ROOT, OUT),
      rows: inventoryRows(result.findings).length,
      findings: result.findings.length,
      violations: result.violations.length,
    }),
  );
  if (result.violations.length > 0) {
    console.error(
      `Refusing to treat inventory as clean: ${result.violations.length} violation(s)`,
    );
    process.exit(1);
  }
} else {
  process.stdout.write(md);
}
