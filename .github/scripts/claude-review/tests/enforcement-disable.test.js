import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isInsideRoot } from "../lib/fs-guard.js";
import { runProbe } from "../lib/sandbox.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function hashFile(p) {
  return createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

describe("disable production enforcement then restore", () => {
  it("revives a path escape when isInsideRoot is disabled, then hash-checks the original", async () => {
    const original = path.join(ROOT, "lib/fs-guard.js");
    const originalHash = hashFile(original);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-enf-"));
    const mutated = path.join(tmp, "fs-guard.js");
    const src = fs.readFileSync(original, "utf8");
    assert.match(src, /export function isInsideRoot/);
    const disabled = src.replace(
      "export function isInsideRoot(root, candidate) {",
      "export function isInsideRoot(root, candidate) { if (process.env.STOCKY_REVIEW_DISABLE_ENFORCEMENT === '1') return true;",
    );
    assert.notEqual(disabled, src);
    fs.writeFileSync(mutated, disabled);
    const mod = await import(`${pathToFileURL(mutated).href}?t=${Date.now()}`);
    process.env.STOCKY_REVIEW_DISABLE_ENFORCEMENT = "1";
    assert.equal(mod.isInsideRoot("/tmp/root", "/etc/passwd"), true);
    delete process.env.STOCKY_REVIEW_DISABLE_ENFORCEMENT;
    assert.equal(mod.isInsideRoot("/tmp/root", "/etc/passwd"), false);
    assert.equal(isInsideRoot("/tmp/root", "/etc/passwd"), false);
    assert.equal(hashFile(original), originalHash);
  });

  it("revives a host-file read when preload is disabled, then restores enforcement", () => {
    const preload = path.join(ROOT, "sandbox/preload-jail.cjs");
    const originalHash = hashFile(preload);
    const canary = path.join(os.tmpdir(), `stocky-canary-enf-${Date.now()}`);
    fs.writeFileSync(canary, "synthetic-canary");
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-probe-"));
    const disabled = runProbe(
      {
        kind: "node_script",
        timeout_seconds: 10,
        node_script: {
          source: `const fs=require('fs'); fs.readFileSync(${JSON.stringify(canary)},'utf8'); process.exit(0);`,
        },
      },
      { workDir, disablePreload: true, subjectRoot: workDir, isolationMode: "host-enforcement-control" },
    );
    assert.equal(disabled.executor.exit_code, 0, "disabled jail should allow the canary read");
    const workDir2 = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-probe-"));
    const enabled = runProbe(
      {
        kind: "node_script",
        timeout_seconds: 10,
        node_script: {
          source: `const fs=require('fs'); fs.readFileSync(${JSON.stringify(canary)},'utf8'); process.exit(0);`,
        },
        expect: { outcome: "fail" },
      },
      { workDir: workDir2, subjectRoot: workDir2, isolationMode: "host-unit" },
    );
    assert.notEqual(enabled.executor.exit_code, 0);
    assert.equal(hashFile(preload), originalHash);
    fs.unlinkSync(canary);
  });
});
