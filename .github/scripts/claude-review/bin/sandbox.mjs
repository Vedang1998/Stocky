#!/usr/bin/env node
import { runProbe } from "../lib/sandbox.js";
import { classifyExecutorResult } from "../lib/verdict.js";

function probeFromEnv() {
  if (process.argv[2]) return JSON.parse(process.argv[2]);
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
const probe = probeFromEnv();
const result = runProbe(probe, {
  subjectRoot: process.env.SUBJECT_ROOT,
  disablePreload: process.env.STOCKY_DISABLE_PRELOAD === "1",
});
const classified = result.ok
  ? classifyExecutorResult(result.probe, result.executor)
  : { verdict: "BLOCKED", reason: result.validation?.code };
process.stdout.write(JSON.stringify({ ...result, classified }, null, 2) + "\n");
process.exit(result.executor?.exit_code && result.probe?.expect?.outcome !== "fail" ? result.executor.exit_code : 0);
