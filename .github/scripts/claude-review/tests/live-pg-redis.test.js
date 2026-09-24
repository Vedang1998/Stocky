import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { runProbe as runProbeImpl } from "../lib/sandbox.js";
import { classifyExecutorResult } from "../lib/verdict.js";

function runProbe(probe, options = {}) {
  return runProbeImpl(probe, { isolationMode: "host-unit", ...options });
}

function havePsql() {
  return spawnSync("psql", ["--version"], { encoding: "utf8" }).status === 0;
}
function haveRedis() {
  return spawnSync("redis-cli", ["ping"], { encoding: "utf8" }).stdout.includes("PONG");
}

describe("live Node + PostgreSQL + Redis probes", () => {
  it("runs a permitted SELECT against synthetic PostgreSQL", () => {
    if (!havePsql()) {
      assert.ok(true, "BLOCKED: psql missing — recorded as skip in live suite");
      return;
    }
    const result = runProbe({
      kind: "sql",
      timeout_seconds: 15,
      sql: { text: "SELECT current_user, current_database()" },
    });
    if (result.executor.provisioning_failed) {
      assert.ok(true, "BLOCKED: postgres not accepting connections");
      return;
    }
    assert.equal(result.executor.exit_code, 0, result.executor.stderr);
    assert.match(result.executor.stdout, /stocky_review/);
    assert.equal(classifyExecutorResult(result.probe, result.executor).verdict, "COMPLETED_NO_VERDICT");
  });

  it("fails an actual negative SQL probe", () => {
    if (!havePsql()) return;
    const result = runProbe({
      kind: "sql",
      timeout_seconds: 15,
      sql: { text: "SELECT * FROM definitely_missing_table_stocky_review" },
      expect: { outcome: "fail" },
    });
    if (result.executor.provisioning_failed) return;
    assert.notEqual(result.executor.exit_code, 0);
    const classified = classifyExecutorResult(result.probe, result.executor);
    assert.equal(classified.verdict, "EXPECTED_FAILURE");
  });

  it("PINGs synthetic Redis", () => {
    if (!haveRedis()) {
      assert.ok(true, "BLOCKED: redis-cli ping failed");
      return;
    }
    const result = runProbe({
      kind: "redis",
      timeout_seconds: 10,
      redis: { op: "PING" },
    });
    if (result.executor.provisioning_failed) return;
    assert.equal(result.executor.exit_code, 0, result.executor.stderr);
    assert.match(result.executor.stdout, /PONG/i);
  });

  it("SET/GET with allowlisted key", () => {
    if (!haveRedis()) return;
    const result = runProbe({
      kind: "redis",
      timeout_seconds: 10,
      redis: { op: "SET", key: "stocky-review:live", value: "ok" },
    });
    if (result.executor.provisioning_failed) return;
    assert.equal(result.executor.exit_code, 0);
    const get = runProbe({
      kind: "redis",
      timeout_seconds: 10,
      redis: { op: "GET", key: "stocky-review:live" },
    });
    assert.match(get.executor.stdout, /ok/);
  });

  it("node_script talks to postgres via allowlisted psql spawn", () => {
    if (!havePsql()) return;
    const result = runProbe({
      kind: "node_script",
      timeout_seconds: 15,
      node_script: {
        source: `
          const { spawnSync } = require('child_process');
          const r = spawnSync('psql', ['-v','ON_ERROR_STOP=1','-c','SELECT 1 AS ok'], { encoding: 'utf8' });
          if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
          console.log(r.stdout);
        `,
      },
    });
    if (result.executor.provisioning_failed) return;
    assert.equal(result.executor.exit_code, 0, result.executor.stderr);
    assert.match(result.executor.stdout, /ok/);
  });

  it("zero-test control is an expected failure", () => {
    const result = runProbe({
      kind: "zero_test_control",
      timeout_seconds: 5,
      expect: { outcome: "fail" },
    });
    assert.equal(result.executor.tests_run, 0);
    assert.equal(classifyExecutorResult(result.probe, result.executor).verdict, "EXPECTED_FAILURE");
  });
});
