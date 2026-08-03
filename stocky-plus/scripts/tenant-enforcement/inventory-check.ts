#!/usr/bin/env tsx
/**
 * Fail when the checked-in PR3 enforcement inventory is stale.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const INVENTORY = path.join(
  APP_ROOT,
  "docs/phases/phase-1/PR3_DATABASE_ENFORCEMENT_INVENTORY.md",
);

if (!fs.existsSync(INVENTORY)) {
  console.error(
    "Missing PR3_DATABASE_ENFORCEMENT_INVENTORY.md — run tenant:enforcement:inventory",
  );
  process.exit(1);
}

const checkedIn = fs.readFileSync(INVENTORY, "utf8");

const fresh = execFileSync(
  process.execPath,
  [
    path.join(APP_ROOT, "node_modules/tsx/dist/cli.mjs"),
    path.join(APP_ROOT, "scripts/tenant-enforcement/inventory.ts"),
    "--stdout",
  ],
  { cwd: APP_ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
);

if (checkedIn.trim() !== fresh.trim()) {
  console.error(
    "PR3_DATABASE_ENFORCEMENT_INVENTORY.md is stale. Run: npm run tenant:enforcement:inventory",
  );
  process.exit(1);
}

console.log(
  JSON.stringify({
    event: "tenant_enforcement_inventory_fresh",
    path: "docs/phases/phase-1/PR3_DATABASE_ENFORCEMENT_INVENTORY.md",
  }),
);
