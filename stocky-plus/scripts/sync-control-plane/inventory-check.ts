#!/usr/bin/env tsx
/**
 * Fail CI when PR4 sync inventory is stale or required surfaces are unscanned.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SYNC_SURFACES } from "./manifest";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const INVENTORY = path.join(
  APP_ROOT,
  "docs/phases/phase-1/PR4_SYNC_CONTROL_PLANE_INVENTORY.md",
);

function fail(msg: string): never {
  console.error(`sync:inventory:check FAILED: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(INVENTORY)) {
  fail("inventory file missing — run npm run sync:inventory");
}

const generated = execFileSync(
  process.execPath,
  [
    "--import",
    "tsx",
    path.join(APP_ROOT, "scripts/sync-control-plane/inventory.ts"),
    "--stdout",
  ],
  { encoding: "utf8", cwd: APP_ROOT },
);

const committed = fs.readFileSync(INVENTORY, "utf8");
if (generated !== committed) {
  fail("committed inventory drift — regenerate with npm run sync:inventory");
}

// Scanner: webhook routes, queue constants, enqueue* producers, replay export.
const scanTargets: Array<{ pattern: RegExp; requiredPrefix: string; label: string }> = [
  {
    label: "webhook route files",
    pattern: /^app\/routes\/webhooks\.[^/]+\.tsx$/,
    requiredPrefix: "webhook:",
  },
];

const allFiles: string[] = [];
function walk(dir: string, rel = ""): void {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      ent.name === "node_modules" ||
      ent.name === "build" ||
      ent.name === ".git"
    ) {
      continue;
    }
    const childRel = rel ? `${rel}/${ent.name}` : ent.name;
    const childAbs = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(childAbs, childRel);
    else allFiles.push(childRel);
  }
}
walk(path.join(APP_ROOT, "app"));

const surfaceIds = new Set(SYNC_SURFACES.map((s) => s.id));
const surfacePaths = new Set(SYNC_SURFACES.map((s) => s.path));

for (const t of scanTargets) {
  const matches = allFiles.filter((f) => t.pattern.test(f));
  for (const f of matches) {
    if (!surfacePaths.has(f)) {
      fail(`uninventoried ${t.label}: ${f}`);
    }
  }
}

// Required symbols must appear in their declared files.
for (const s of SYNC_SURFACES) {
  const abs = path.join(APP_ROOT, s.path);
  if (!fs.existsSync(abs)) fail(`missing path for ${s.id}: ${s.path}`);
  const body = fs.readFileSync(abs, "utf8");
  if (s.path.endsWith(".prisma")) {
    if (!body.includes(`model ${s.symbol}`)) {
      fail(`schema missing model ${s.symbol}`);
    }
    continue;
  }
  if (!body.includes(s.symbol)) {
    fail(`symbol ${s.symbol} not found in ${s.path} (${s.id})`);
  }
  if (!surfaceIds.has(s.id)) fail(`duplicate/missing id ${s.id}`);
}

// Producer/enqueue helpers that must remain inventoried when present.
const queueFile = fs.readFileSync(
  path.join(APP_ROOT, "app/jobs/queue.server.ts"),
  "utf8",
);
for (const sym of [
  "enqueueWebhook",
  "enqueueCatalogSync",
  "enqueueAfterAuthCatalogSync",
  "enqueueAbcAnalysisForShop",
  "scheduleAbcAnalysisCron",
  "WEBHOOK_QUEUE",
  "CRON_QUEUE",
]) {
  if (!queueFile.includes(sym)) {
    // enqueueWebhook may become a thin wrapper or be removed after intake cutover;
    // require either the symbol or an explicit durable replacement export.
    if (sym === "enqueueWebhook") {
      const intake = fs.readFileSync(
        path.join(APP_ROOT, "app/sync/intake.server.ts"),
        "utf8",
      );
      if (!intake.includes("ingestAuthenticatedWebhook")) {
        fail("webhook producer missing: enqueueWebhook or ingestAuthenticatedWebhook");
      }
      continue;
    }
    fail(`queue.server.ts missing required symbol ${sym}`);
  }
}

const replay = fs.readFileSync(
  path.join(APP_ROOT, "app/sync/replay.server.ts"),
  "utf8",
);
if (!replay.includes("replayDeadLetter")) {
  fail("replay path missing replayDeadLetter");
}

console.log("sync:inventory:check OK");
console.log(`surfaces=${SYNC_SURFACES.length}`);
