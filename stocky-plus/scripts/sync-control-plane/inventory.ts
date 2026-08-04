#!/usr/bin/env tsx
/**
 * Mechanically generate PR4_SYNC_CONTROL_PLANE_INVENTORY.md
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  SYNC_INVENTORY_VERSION,
  SYNC_SURFACES,
  assertSyncSurfacesResolvable,
} from "./manifest";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const STDOUT_ONLY = process.argv.includes("--stdout");
const OUT = STDOUT_ONLY
  ? null
  : path.join(
      APP_ROOT,
      "docs/phases/phase-1/PR4_SYNC_CONTROL_PLANE_INVENTORY.md",
    );

const missing = assertSyncSurfacesResolvable((rel) =>
  fs.existsSync(path.join(APP_ROOT, rel)),
);
if (missing.length > 0) {
  console.error("sync inventory surfaces missing on disk:");
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}

const digest = createHash("sha256")
  .update(JSON.stringify({ version: SYNC_INVENTORY_VERSION, surfaces: SYNC_SURFACES }))
  .digest("hex");

const byKind: Record<string, number> = {};
for (const s of SYNC_SURFACES) {
  byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
}

const md = `# PR 4 — Synchronization Control Plane Inventory

**Phase:** 1
**Work unit:** PR 4 — Synchronization control plane
**Branch:** \`phase-1/sync-control-plane\`
**Generator:** \`scripts/sync-control-plane/inventory.ts\` (deterministic)
**Inventory version:** \`${SYNC_INVENTORY_VERSION}\`
**Content digest:** \`${digest}\`
**Surfaces:** ${SYNC_SURFACES.length}

> This file is mechanically generated. Do not edit by hand.
> Regenerate with \`npm run sync:inventory\`.
> CI verifies freshness via \`npm run sync:inventory:check\`.

## Counts by kind

| Kind | Count |
|---|---|
${Object.entries(byKind)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}

## Surface inventory

| Kind | ID | Path | Symbol | Notes |
|---|---|---|---|---|
${SYNC_SURFACES.map(
  (s) =>
    `| ${s.kind} | \`${s.id}\` | \`${s.path}\` | \`${s.symbol}\` | ${s.notes.replace(/\|/g, "\\|")} |`,
).join("\n")}

## Completeness rules

CI must fail when:

1. A listed surface path is missing on disk.
2. Generated inventory digest drifts from committed file.
3. A new producer, queue, worker, webhook route, or replay path is introduced without a manifest entry (scanner coverage in \`inventory-check.ts\`).

## Classification reminder

Control-plane tables listed above are \`platform_control_plane\` (tenant-owned via non-null \`shopId\`, not merchant-domain FORCE RLS). See \`PR4_SYNC_CONTROL_PLANE_ARCHITECTURE.md\`.
`;

if (OUT) {
  fs.writeFileSync(OUT, md);
  console.log(`Wrote ${path.relative(APP_ROOT, OUT)}`);
  console.log(`digest=${digest}`);
} else {
  process.stdout.write(md);
}
