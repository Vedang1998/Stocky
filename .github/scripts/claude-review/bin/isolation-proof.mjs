#!/usr/bin/env node
/**
 * Credential-free proof of the production Docker isolation path.
 * Exit 0 only when the isolated executor actually ran and the disable-control
 * revived the prohibited host-file read, then production files hashed equal.
 * Exit 2 = isolation_unavailable (authoring hosts without Docker).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { runProbe } from "../lib/sandbox.js";
import { inspectPinnedImages, dockerAvailable } from "../lib/isolated-executor.js";
import { IMAGE_PINS, pinnedImage } from "../lib/constants.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function hashFile(p) {
  return createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function provenance() {
  const head = process.env.SUBJECT_HEAD || "0".repeat(40);
  const base = process.env.SUBJECT_BASE || "0".repeat(40);
  return {
    task_id: "isolation-proof",
    attempt: "gha-or-local",
    dispatch_key: "propo:isolation-proof",
    authority_comment_id: 0,
    head,
    base,
    pr: 62,
    max_probes: 2,
    max_sandbox_seconds: 120,
  };
}

function writeProof(proof) {
  const text = JSON.stringify(proof, null, 2);
  fs.writeFileSync("/tmp/stocky-isolation-proof.json", text);
  const extra = process.env.STOCKY_ISOLATION_PROOF_OUT;
  if (extra) fs.writeFileSync(extra, text);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\`\`\`json\n${text}\n\`\`\`\n`);
  }
  console.log(text);
}

const proof = {
  docker: dockerAvailable(),
  started_at: new Date().toISOString(),
};

if (!proof.docker) {
  proof.status = "BLOCKED";
  proof.reason = "isolation_unavailable_docker_missing";
  writeProof(proof);
  process.exit(2);
}

const executorFile = path.join(ROOT, "lib/isolated-executor.js");
const sandboxFile = path.join(ROOT, "lib/sandbox.js");
const originalExecutor = hashFile(executorFile);
const originalSandbox = hashFile(sandboxFile);
proof.hashes_before = { executor: originalExecutor, sandbox: originalSandbox };

proof.image_inspect = inspectPinnedImages("docker");
proof.image_inspect_ok = Object.values(proof.image_inspect).every((v) => v.ok);

const canary = path.join(os.tmpdir(), `stocky-host-canary-${Date.now()}`);
fs.writeFileSync(canary, "synthetic-canary-not-a-secret");

const disabled = runProbe(
  {
    kind: "node_script",
    timeout_seconds: 10,
    node_script: {
      source: `require("fs").readFileSync(${JSON.stringify(canary)}, "utf8"); process.exit(0);`,
    },
  },
  {
    isolationMode: "host-enforcement-control",
    disablePreload: true,
    workDir: fs.mkdtempSync(path.join(os.tmpdir(), "stocky-dis-")),
  },
);
proof.disabled_host_read_exit = disabled.executor.exit_code;
proof.disabled_isolation = disabled.executor.isolation;

const leakScript = `
  const fs = require("fs");
  let leaked = false;
  try { fs.readFileSync(${JSON.stringify(canary)}, "utf8"); leaked = true; } catch (e) {}
  try { fs.openSync("/var/run/docker.sock"); leaked = true; } catch (e) {}
  if (process.env.GITHUB_TOKEN || process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY) leaked = true;
  process.exit(leaked ? 0 : 2);
`;

const enabled = runProbe(
  {
    kind: "node_script",
    timeout_seconds: 60,
    node_script: { source: leakScript },
    expect: { outcome: "fail" },
  },
  {
    isolationMode: "docker",
    requireProvenance: true,
    provenance: provenance(),
    probe_index: 1,
    hostCanaryPath: canary,
    subjectRoot: path.join(ROOT, "fixtures/subject"),
  },
);
proof.enabled_backend = enabled.executor.backend;
proof.enabled_isolation = enabled.executor.isolation;
proof.enabled_exit = enabled.executor.exit_code;
proof.enabled_stderr = (enabled.executor.stderr || "").slice(0, 500);
proof.enabled_provisioning_failed = enabled.executor.provisioning_failed;
proof.enabled_image_pins = enabled.executor.image_pins;

const sql = runProbe(
  { kind: "sql", timeout_seconds: 60, sql: { text: "SELECT 1 AS ok" } },
  { isolationMode: "docker", requireProvenance: true, provenance: provenance(), probe_index: 1 },
);
proof.sql_backend = sql.executor.backend;
proof.sql_exit = sql.executor.exit_code;
proof.sql_stdout = (sql.executor.stdout || "").slice(0, 200);
proof.sql_image_pins = sql.executor.image_pins;

const failSql = runProbe(
  {
    kind: "sql",
    timeout_seconds: 60,
    sql: { text: "SELECT * FROM definitely_missing_table_stocky_review" },
    expect: { outcome: "fail" },
  },
  { isolationMode: "docker", requireProvenance: true, provenance: provenance(), probe_index: 1 },
);
proof.fail_sql_exit = failSql.executor.exit_code;

const zero = runProbe(
  { kind: "zero_test_control", timeout_seconds: 5, expect: { outcome: "fail" } },
  { isolationMode: "docker", requireProvenance: false },
);
proof.zero_tests_run = zero.executor.tests_run;

proof.hashes_after = { executor: hashFile(executorFile), sandbox: hashFile(sandboxFile) };
proof.pins = {
  postgres: pinnedImage(IMAGE_PINS.postgres),
  redis: pinnedImage(IMAGE_PINS.redis),
  node: pinnedImage(IMAGE_PINS.node),
};

const hashOk =
  proof.hashes_before.executor === proof.hashes_after.executor &&
  proof.hashes_before.sandbox === proof.hashes_after.sandbox;
const disabledRevived = disabled.executor.exit_code === 0;
const enabledBlocked =
  enabled.executor.backend === "docker" &&
  enabled.executor.exit_code !== 0 &&
  !enabled.executor.provisioning_failed;
const sqlOk = sql.executor.backend === "docker" && sql.executor.exit_code === 0;
const failOk = failSql.executor.exit_code !== 0;
const zeroOk = zero.executor.tests_run === 0;
const pinsUsed = Boolean(sql.executor.image_pins?.postgres?.includes("@sha256:"));

proof.checks = { hashOk, disabledRevived, enabledBlocked, sqlOk, failOk, zeroOk, pinsUsed, image_inspect_ok: proof.image_inspect_ok };
proof.status = Object.values(proof.checks).every(Boolean) ? "PASS_ISOLATION_PROOF" : "FAIL";
writeProof(proof);
try {
  fs.unlinkSync(canary);
} catch {
  /* ignore */
}
process.exit(proof.status === "PASS_ISOLATION_PROOF" ? 0 : 1);
