#!/usr/bin/env tsx
/**
 * Mechanical sync control-plane inventory check (F-PR4-07).
 * Uses TypeScript compiler API to discover unauthorized surfaces.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  SYNC_INVENTORY_VERSION,
  SYNC_SURFACES,
  assertSyncSurfacesResolvable,
} from "./manifest";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/** Exact-file exceptions — no wildcards (F-PR4-07). */
export const SYNC_SCAN_EXCEPTIONS: readonly {
  id: string;
  path: string;
  category: string;
  owner: string;
  productionRuntime: boolean;
  justification: string;
  removalCondition: string;
}[] = [
  {
    id: "EX-SYNC-001",
    path: "app/sync/control-plane-db.server.ts",
    category: "control_plane_client_factory",
    owner: "sync-control-plane",
    productionRuntime: true,
    justification: "Sole approved factory for getControlPlanePrisma",
    removalCondition: "Never — required factory",
  },
  {
    id: "EX-SYNC-002",
    path: "scripts/sync-control-plane/tests/sync-integration.test.ts",
    category: "test_harness",
    owner: "sync-control-plane",
    productionRuntime: false,
    justification: "Integration tests may construct Queue for obliterate",
    removalCondition: "When harness moves off direct Queue",
  },
  {
    id: "EX-SYNC-003",
    path: "app/sync/__tests__/sync-control-plane.integration.test.ts",
    category: "test_harness",
    owner: "sync-control-plane",
    productionRuntime: false,
    justification: "Integration tests may construct Queue for obliterate",
    removalCondition: "When harness moves off direct Queue",
  },
  {
    id: "EX-SYNC-004",
    path: "app/sync/__tests__/sync-dispatch-recovery.test.ts",
    category: "test_harness",
    owner: "sync-control-plane",
    productionRuntime: false,
    justification: "Dispatch recovery tests inspect BullMQ jobs directly",
    removalCondition: "When harness moves off direct Queue",
  },
  {
    id: "EX-SYNC-005",
    path: "app/sync/__tests__/sync-performance.test.ts",
    category: "test_harness",
    owner: "sync-control-plane",
    productionRuntime: false,
    justification: "Performance tests obliterate queues between runs",
    removalCondition: "When harness moves off direct Queue",
  },
  {
    id: "EX-SYNC-007",
    path: "app/sync/__tests__/sync-final-correction.test.ts",
    category: "test_harness",
    owner: "sync-control-plane",
    productionRuntime: false,
    justification: "D-045 final-correction tests inspect BullMQ jobs and obliterate queues",
    removalCondition: "When harness moves off direct Queue",
  },
  {
    id: "EX-SYNC-006",
    path: "app/tenant/__tests__/queue-redis.test.ts",
    category: "test_harness",
    owner: "tenant-access",
    productionRuntime: false,
    justification: "PR2 queue/Redis envelope tests construct Queue",
    removalCondition: "N/A — PR2 harness",
  },
];

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "build" || ent.name === ".git") {
        continue;
      }
      walkTsFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(ent.name) && !ent.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

type Finding = {
  file: string;
  line: number;
  kind: string;
  detail: string;
};

function exceptionFor(rel: string): (typeof SYNC_SCAN_EXCEPTIONS)[number] | undefined {
  return SYNC_SCAN_EXCEPTIONS.find((e) => e.path === rel);
}

function scanFile(abs: string): Finding[] {
  const rel = toPosix(path.relative(APP_ROOT, abs));
  const text = fs.readFileSync(abs, "utf8");
  const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true);
  const findings: Finding[] = [];
  const ex = exceptionFor(rel);

  const approvedControlPlaneImporters = new Set(
    SYNC_SURFACES.filter(
      (s) =>
        s.kind === "producer" ||
        s.kind === "dispatcher" ||
        s.kind === "worker" ||
        s.kind === "replay_path" ||
        s.kind === "webhook_route",
    ).map((s) => s.path),
  );
  approvedControlPlaneImporters.add("app/sync/control-plane-db.server.ts");
  approvedControlPlaneImporters.add("app/sync/lifecycle.server.ts");
  approvedControlPlaneImporters.add("app/sync/uninstall.server.ts");
  approvedControlPlaneImporters.add("app/sync/reinstall.server.ts");
  approvedControlPlaneImporters.add("app/sync/health.server.ts");
  approvedControlPlaneImporters.add("app/sync/intake.server.ts");
  approvedControlPlaneImporters.add("app/sync/dispatcher.server.ts");
  approvedControlPlaneImporters.add("app/sync/replay.server.ts");
  approvedControlPlaneImporters.add("app/jobs/workers/webhook-processor.ts");
  approvedControlPlaneImporters.add("app/jobs/queue.server.ts");

  function add(node: ts.Node, kind: string, detail: string) {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    findings.push({ file: rel, line: line + 1, kind, detail });
  }

  function visit(node: ts.Node) {
    // new Queue( / new Worker(
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      if (name === "Queue" || name === "Worker") {
        const allowed =
          rel === "app/jobs/queue.server.ts" ||
          (ex != null &&
            (ex.category === "test_harness" ||
              ex.category === "control_plane_client_factory"));
        if (!allowed) {
          add(node, `direct_${name.toLowerCase()}`, `Unauthorized new ${name}()`);
        }
      }
    }

    // getControlPlanePrisma import / call
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (
        spec.includes("control-plane-db") &&
        !approvedControlPlaneImporters.has(rel) &&
        !rel.includes("/__tests__/") &&
        !rel.includes(".test.") &&
        !rel.startsWith("scripts/sync-control-plane/")
      ) {
        add(node, "control_plane_import", `Unauthorized control-plane import from ${spec}`);
      }
    }

    // replayDeadLetter outside replay.server.ts
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "replayDeadLetter" &&
      rel !== "app/sync/replay.server.ts" &&
      !rel.includes("/__tests__/") &&
      !rel.includes(".test.")
    ) {
      add(node, "replay_outside_module", "replayDeadLetter called outside replay.server.ts");
    }

    // Raw SQL mentioning control-plane tables outside allowlisted modules
    if (
      ts.isTaggedTemplateExpression(node) &&
      /\$queryRaw|\$executeRaw/.test(node.tag.getText(sf))
    ) {
      const raw = node.template.getText(sf);
      const tables = [
        "DurableJob",
        "WebhookDelivery",
        "JobAttempt",
        "JobDispatch",
        "DeadLetter",
        "JobReplay",
      ];
      for (const t of tables) {
        if (raw.includes(`"${t}"`) || raw.includes(`'${t}'`)) {
          const allowed =
            rel.startsWith("app/sync/") ||
            rel.startsWith("scripts/sync-control-plane/") ||
            rel.includes("/__tests__/");
          if (!allowed) {
            add(node, "raw_sql_control_plane", `Raw SQL touches ${t}`);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);
  return findings;
}

// --- main ---
const missing = assertSyncSurfacesResolvable((rel) =>
  fs.existsSync(path.join(APP_ROOT, rel)),
);
if (missing.length > 0) {
  console.error("sync inventory surfaces missing on disk:");
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}

const inventoryPath = path.join(
  APP_ROOT,
  "docs/phases/phase-1/PR4_SYNC_CONTROL_PLANE_INVENTORY.md",
);
if (!fs.existsSync(inventoryPath)) {
  console.error("Committed inventory missing — run npm run sync:inventory");
  process.exit(1);
}

const digest = createHash("sha256")
  .update(JSON.stringify({ version: SYNC_INVENTORY_VERSION, surfaces: SYNC_SURFACES }))
  .digest("hex");
const committed = fs.readFileSync(inventoryPath, "utf8");
if (!committed.includes(digest)) {
  console.error("sync inventory digest drift — regenerate with npm run sync:inventory");
  console.error(`expected digest fragment: ${digest}`);
  process.exit(1);
}

const files = [
  ...walkTsFiles(path.join(APP_ROOT, "app")),
  ...walkTsFiles(path.join(APP_ROOT, "scripts/sync-control-plane")),
];

const allFindings: Finding[] = [];
for (const f of files) {
  allFindings.push(...scanFile(f));
}

if (allFindings.length > 0) {
  console.error(`sync inventory scanner found ${allFindings.length} violation(s):`);
  for (const f of allFindings) {
    console.error(`  ${f.file}:${f.line} [${f.kind}] ${f.detail}`);
  }
  process.exit(1);
}

// Ensure JobDispatch is inventoried.
if (!SYNC_SURFACES.some((s) => s.id === "table:JobDispatch")) {
  console.error("JobDispatch missing from SYNC_SURFACES");
  process.exit(1);
}

console.log(`sync:inventory:check ok surfaces=${SYNC_SURFACES.length} digest=${digest.slice(0, 12)}…`);
