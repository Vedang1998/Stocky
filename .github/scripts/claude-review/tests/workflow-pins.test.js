import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CHECKOUT_PIN,
  CLAUDE_ACTION_PIN,
  DOWNLOAD_ARTIFACT_PIN,
  IMAGE_PINS,
  OWNER_ID,
  SETUP_NODE_PIN,
  UPLOAD_ARTIFACT_PIN,
} from "../lib/constants.js";
import { runProbe as runProbeImpl } from "../lib/sandbox.js";
import { classifyExecutorResult } from "../lib/verdict.js";

function runProbe(probe, options = {}) {
  return runProbeImpl(probe, { isolationMode: "host-unit", ...options });
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("workflow pins and comment isolation", () => {
  it("pins full-length action SHAs and does not interpolate comment.body into run scripts", () => {
    const main = fs.readFileSync(path.join(ROOT, "workflows/main.yml"), "utf8");
    const exec = fs.readFileSync(
      path.join(ROOT, "workflows/claude-review-execution.yml"),
      "utf8",
    );
    assert.match(main, new RegExp(CLAUDE_ACTION_PIN.sha));
    assert.match(main, new RegExp(CHECKOUT_PIN.sha));
    assert.match(main, new RegExp(SETUP_NODE_PIN.sha));
    assert.match(main, new RegExp(UPLOAD_ARTIFACT_PIN.sha));
    assert.match(main, new RegExp(DOWNLOAD_ARTIFACT_PIN.sha));
    assert.match(main, new RegExp(String(OWNER_ID)));
    assert.equal(main.includes("allowed_bots:"), false);
    assert.equal(main.includes("allowed_non_write_users:"), false);
    assert.match(main, /show_full_output: false/);
    assert.equal(main.includes("anthropic_api_key"), false);
    assert.match(main, /COMMENT_BODY: \$\{\{ github\.event\.comment\.body \}\}/);
    const runLines = main.split("\n").filter((line) => /^\s+run:/.test(line));
    for (const line of runLines) {
      assert.equal(
        line.includes("github.event.comment.body"),
        false,
        `run: line interpolates comment body: ${line}`,
      );
    }
    assert.match(main, /github_token: \$\{\{ github\.token \}\}/);
    assert.match(main, /^  executable:/m);
    assert.match(main, /^  publish:/m);
    assert.match(main, /^  simple:/m);
    const execJob = main.split(/^  executable:/m)[1].split(/^  publish:/m)[0];
    assert.match(execJob, /contents: read/);
    assert.equal(execJob.includes("contents: write"), false);
    assert.equal(execJob.includes("id-token: write"), false);
    assert.equal(execJob.includes("issues: write"), false);
    assert.match(execJob, /issues: read/);
    assert.equal(execJob.includes("secrets.CLAUDE_CODE_OAUTH_TOKEN"), true);
    const publishJob = main.split(/^  publish:/m)[1].split(/^  publish_reject:/m)[0];
    assert.equal(publishJob.includes("secrets.CLAUDE_CODE_OAUTH_TOKEN"), false);
    assert.match(publishJob, /contents: write/);
    assert.match(publishJob, /publish-from-state/);
    assert.match(exec, /workflow_dispatch/);
    assert.match(exec, /pull_request:/);
    assert.equal(/^\s+pull_request_target:/m.test(exec), false);
    assert.equal(/^\s+workflow_run:/m.test(exec), false);
    assert.equal(exec.includes("secrets.CLAUDE_CODE_OAUTH_TOKEN"), false);
    assert.match(exec, /isolation-proof/);
    assert.match(main, /rewrite-mcp/);
    assert.match(main, /assert-lease/);
    assert.match(main, /submit_result/);
    assert.match(main, /dispatch_key:/);
    assert.match(main, /claude-review-exec-/);
    assert.match(main, /claude-review-pub-/);
    assert.match(main, /needs\.ingress\.result == 'success'/);
    assert.equal(exec.includes("ref: ${{ inputs.subject_head }}"), false);
    const iso = fs.readFileSync(path.join(ROOT, "scripts/claude-review/lib/constants.js"), "utf8");
    assert.match(iso, new RegExp(IMAGE_PINS.postgres.digest.replace("sha256:", "sha256:")));
    assert.doesNotMatch(exec, /stocky_plus_ci/);
  });
});

describe("timeout, quota interruption, malformed output", () => {
  it("marks an oversized node_script as invalid before execution", () => {
    const result = runProbe({
      kind: "node_script",
      timeout_seconds: 5,
      node_script: { source: "x".repeat(40_000) },
    });
    assert.equal(result.ok, false);
    assert.equal(result.validation.code, "node_script_too_large");
    assert.equal(result.executor.malformed_output, true);
  });

  it("treats a timeout as UNKNOWN, not PASS", () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-probe-"));
    const result = runProbe(
      {
        kind: "node_script",
        timeout_seconds: 1,
        node_script: { source: "while (true) {}" },
      },
      { workDir, subjectRoot: workDir },
    );
    assert.equal(result.ok, true);
    assert.equal(result.executor.timed_out, true);
    assert.equal(classifyExecutorResult(result.probe, result.executor).verdict, "UNKNOWN");
  });
});
