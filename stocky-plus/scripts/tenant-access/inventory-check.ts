#!/usr/bin/env tsx
/**
 * Fail when the checked-in inventory markdown is stale vs a fresh scan.
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
  "docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md",
);

if (!fs.existsSync(INVENTORY)) {
  console.error("Missing PR2_TENANT_ACCESS_INVENTORY.md — run tenant:access:inventory");
  process.exit(1);
}

const checkedIn = fs.readFileSync(INVENTORY, "utf8");

// Regenerate to a temp buffer by running inventory --stdout
const fresh = execFileSync(
  process.execPath,
  [
    path.join(APP_ROOT, "node_modules/tsx/dist/cli.mjs"),
    path.join(APP_ROOT, "scripts/tenant-access/inventory.ts"),
    "--stdout",
  ],
  { cwd: APP_ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
);

function normalize(md: string): string {
  // Ignore generatedAt timestamp line for freshness comparison
  return md
    .split("\n")
    .filter((line) => !line.startsWith("**Generated at:**"))
    .join("\n")
    .trim();
}

if (normalize(checkedIn) !== normalize(fresh)) {
  console.error(
    "PR2_TENANT_ACCESS_INVENTORY.md is stale. Run: npm run tenant:access:inventory",
  );
  process.exit(1);
}

console.log(
  JSON.stringify({ event: "tenant_access_inventory_fresh", path: "docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md" }),
);
