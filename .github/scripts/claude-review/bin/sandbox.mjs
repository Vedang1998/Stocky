#!/usr/bin/env node
import { runProbe } from "../lib/sandbox.js";
import { classifyExecutorResult } from "../lib/verdict.js";
import { bindProbeRequest } from "../lib/provenance.js";
import { isFullSha } from "../lib/util.js";

function probeFromEnv() {
  if (process.argv[2] && process.argv[2] !== "--require-provenance") return JSON.parse(process.argv[2]);
  if (process.env.STOCKY_PROBE_JSON) return JSON.parse(process.env.STOCKY_PROBE_JSON);
  if (process.env.PROBE_KIND) {
    const timeout = Number(process.env.PROBE_TIMEOUT || 60);
    const kind = process.env.PROBE_KIND;
    if (kind === "sql") {
      return { kind: "sql", timeout_seconds: timeout, sql: { text: process.env.PROBE_SQL || "SELECT 1 AS ok" } };
    }
    if (kind === "redis") {
      return { kind: "redis", timeout_seconds: timeout, redis: { op: "PING" } };
    }
    if (kind === "zero_test_control") {
      return { kind: "zero_test_control", timeout_seconds: timeout };
    }
    return { kind };
  }
  return {};
}

const requireProvenance = process.argv.includes("--require-provenance") || process.env.STOCKY_REQUIRE_PROVENANCE === "1";
const probe = probeFromEnv();
let provenance;
if (requireProvenance) {
  provenance = {
    task_id: process.env.TASK_ID,
    attempt: process.env.ATTEMPT,
    dispatch_key: process.env.DISPATCH_KEY,
    authority_comment_id: process.env.AUTHORITY_COMMENT_ID,
    head: process.env.SUBJECT_HEAD,
    base: process.env.SUBJECT_BASE,
    pr: Number(process.env.SUBJECT_PR || 0),
    max_probes: 2,
    max_sandbox_seconds: Number(process.env.PROBE_TIMEOUT || 60),
  };
  if (!isFullSha(String(provenance.head)) || !isFullSha(String(provenance.base))) {
    process.stdout.write(JSON.stringify({ ok: false, code: "invalid_provenance_sha" }, null, 2) + "\n");
    process.exit(2);
  }
  const bound = bindProbeRequest({
    provenance,
    probe,
    probe_index: 1,
    max_probes: 2,
  });
  if (!bound.ok) {
    process.stdout.write(JSON.stringify(bound, null, 2) + "\n");
    process.exit(2);
  }
}

const result = runProbe(probe, {
  isolationMode: "docker",
  requireProvenance,
  provenance,
  probe_index: 1,
  subjectRoot: process.env.SUBJECT_ROOT,
});
const classified = result.ok
  ? classifyExecutorResult(result.probe, result.executor)
  : { verdict: "BLOCKED", reason: result.validation?.code };
process.stdout.write(JSON.stringify({ ...result, classified }, null, 2) + "\n");
process.exit(result.executor?.provisioning_failed || result.ok === false ? 2 : 0);
