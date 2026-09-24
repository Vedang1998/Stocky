import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { resolveContained, isInsideRoot, walkAndRejectEscapes } from "../lib/fs-guard.js";
import { extractSubjectTarball } from "../lib/evidence.js";
import {
  dockerArgsAreIsolated,
  dockerNetworkCreateArgs,
  dockerRunArgs,
  runProbe as runProbeImpl,
  stripSecretEnv,
} from "../lib/sandbox.js";
import { validateProbe } from "../lib/probe.js";
import { classifyExecutorResult } from "../lib/verdict.js";

function runProbe(probe, options = {}) {
  return runProbeImpl(probe, { isolationMode: "host-unit", ...options });
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(HERE, "../fixtures");

describe("typed probe validation", () => {
  it("denies npm_install, shell, http, COPY, and multi-statement SQL", () => {
    assert.equal(validateProbe({ kind: "npm_install" }).code, "probe_kind_denied");
    assert.equal(validateProbe({ kind: "shell" }).code, "probe_kind_denied");
    assert.equal(validateProbe({ kind: "http" }).code, "probe_kind_denied");
    assert.equal(
      validateProbe({ kind: "sql", sql: { text: "SELECT 1" }, isolationMode: "host" }).code,
      "probe_extra_keys",
    );
    assert.equal(
      validateProbe({ kind: "sql", sql: { text: "SELECT 1; DROP TABLE x" } }).code,
      "sql_multi_statement",
    );
    assert.equal(
      validateProbe({ kind: "sql", sql: { text: "COPY x TO PROGRAM 'id'" } }).ok,
      false,
    );
  });

  it("denies redis keys without prefix and arbitrary URLs in redis op", () => {
    assert.equal(
      validateProbe({ kind: "redis", redis: { op: "GET", key: "secrets" } }).code,
      "redis_key_denied",
    );
  });
});

describe("path / archive / symlink attacks", () => {
  it("rejects path traversal", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-root-"));
    fs.writeFileSync(path.join(tmp, "ok.txt"), "ok");
    const r = resolveContained(tmp, "../escape.txt");
    assert.equal(r.ok, false);
    assert.equal(r.code, "path_escape");
  });

  it("rejects a symlink that points outside the root", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-link-"));
    const outside = path.join(os.tmpdir(), `stocky-outside-${Date.now()}`);
    fs.writeFileSync(outside, "secret");
    fs.symlinkSync(outside, path.join(tmp, "link"));
    const r = resolveContained(tmp, "link");
    assert.equal(r.ok, false);
    fs.unlinkSync(outside);
  });

  it("rejects tar entries that escape with ..", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-tar-"));
    const staged = path.join(dir, "staged");
    fs.mkdirSync(staged);
    fs.writeFileSync(path.join(staged, "ok.txt"), "ok");
    const tarball = path.join(dir, "ok.tar.gz");
    spawnSync("tar", ["-C", staged, "-czf", tarball, "ok.txt"], { encoding: "utf8" });
    const dest = path.join(dir, "dest");
    const extracted = extractSubjectTarball(tarball, dest);
    assert.equal(extracted.ok, true, extracted.message || extracted.code);
    const walk = walkAndRejectEscapes(dest);
    assert.equal(walk.ok, true);

    const evil = path.join(dir, "evil.tar.gz");
    const py = spawnSync(
      "python3",
      [
        "-c",
        "import tarfile,io,gzip,sys\n"
        + "buf=io.BytesIO()\n"
        + "tf=tarfile.open(fileobj=buf, mode='w')\n"
        + "info=tarfile.TarInfo('../escape.txt')\n"
        + "data=b'pwn'\n"
        + "info.size=len(data)\n"
        + "tf.addfile(info, io.BytesIO(data))\n"
        + "tf.close()\n"
        + "open(sys.argv[1],'wb').write(gzip.compress(buf.getvalue()))\n",
        evil,
      ],
      { encoding: "utf8" },
    );
    assert.equal(py.status, 0, py.stderr);
    const evilDest = path.join(dir, "evil-dest");
    const blocked = extractSubjectTarball(evil, evilDest);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "tar_path_escape");
  });

  it("isInsideRoot does not treat prefix-siblings as contained", () => {
    assert.equal(isInsideRoot("/tmp/root", "/tmp/root-evil/x"), false);
    assert.equal(isInsideRoot("/tmp/root", "/tmp/root/x"), true);
  });
});

describe("docker argv isolation contract", () => {
  it("uses --internal networks and never mounts the docker socket", () => {
    const net = dockerNetworkCreateArgs("stocky-review-test");
    assert.equal(net.includes("--internal"), true);
    const args = dockerRunArgs({
      network: "stocky-review-test",
      subjectDir: "/tmp/subject",
      probeDir: "/tmp/probe",
      env: { NODE_ENV: "test" },
    });
    assert.equal(args.includes("--privileged"), false);
    assert.equal(args.join(" ").includes("docker.sock"), false);
    assert.equal(args.includes("--network=host"), false);
    assert.equal(args.includes("--cap-drop"), true);
    assert.equal(dockerArgsAreIsolated(args), true);
    assert.equal(dockerArgsAreIsolated(["run", "--privileged"]), false);
  });
});

describe("secret env strip and canaries", () => {
  it("does not copy OAuth or GITHUB_TOKEN into the sandbox env", () => {
    const stripped = stripSecretEnv({
      CLAUDE_CODE_OAUTH_TOKEN: "canary-oauth",
      GITHUB_TOKEN: "canary-gh",
      CANARY_TOKEN: "canary",
      PATH: "/usr/bin",
      PGHOST: "127.0.0.1",
    });
    assert.equal(stripped.CLAUDE_CODE_OAUTH_TOKEN, undefined);
    assert.equal(stripped.GITHUB_TOKEN, undefined);
    assert.equal(stripped.CANARY_TOKEN, undefined);
    assert.equal(stripped.PATH, "/usr/bin");
  });

  it("node_script cannot read a host canary file through the preload jail", () => {
    const canary = path.join(os.tmpdir(), `stocky-canary-${Date.now()}`);
    fs.writeFileSync(canary, "real-looking-but-synthetic");
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-probe-"));
    const result = runProbe(
      {
        kind: "node_script",
        timeout_seconds: 10,
        node_script: {
          source: `require('fs').readFileSync(${JSON.stringify(canary)}, 'utf8');`,
        },
        expect: { outcome: "fail" },
      },
      { workDir, subjectRoot: path.join(FIXTURES, "subject") },
    );
    assert.equal(result.ok, true);
    assert.notEqual(result.executor.exit_code, 0);
    assert.match(result.executor.stderr, /STOCKY_JAIL/);
    fs.unlinkSync(canary);
  });

  it("node_script cannot require the malicious package preinstall path", () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-probe-"));
    const pkg = path.join(FIXTURES, "malicious-package/package.json");
    const result = runProbe(
      {
        kind: "node_script",
        timeout_seconds: 10,
        node_script: {
          source: `require(${JSON.stringify(pkg)}); process.exit(0);`,
        },
        expect: { outcome: "fail" },
      },
      { workDir, subjectRoot: path.join(FIXTURES, "subject") },
    );
    assert.notEqual(result.executor.exit_code, 0);
    assert.equal(fs.existsSync("/tmp/stocky-review-pwned"), false);
  });

  it("node_script fetch to an arbitrary URL is denied by preload", () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-probe-"));
    const result = runProbe(
      {
        kind: "node_script",
        timeout_seconds: 10,
        node_script: {
          source: `fetch('https://example.com').then(()=>process.exit(0)).catch(()=>process.exit(2));`,
        },
        expect: { outcome: "fail" },
      },
      { workDir, subjectRoot: path.join(FIXTURES, "subject") },
    );
    assert.notEqual(result.executor.exit_code, 0);
  });

  it("docker.sock open is denied", () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-probe-"));
    const result = runProbe(
      {
        kind: "node_script",
        timeout_seconds: 10,
        node_script: {
          source: `require('fs').openSync('/var/run/docker.sock');`,
        },
        expect: { outcome: "fail" },
      },
      { workDir, subjectRoot: path.join(FIXTURES, "subject") },
    );
    assert.notEqual(result.executor.exit_code, 0);
  });
});

describe("false claimed success and malformed output", () => {
  it("does not treat executor exit 0 plus tests_run 0 as success", () => {
    const classified = classifyExecutorResult(
      { kind: "sql", expect: { outcome: "pass" } },
      { exit_code: 0, tests_run: 0, stdout: '{"success":true}' },
    );
    assert.equal(classified.verdict, "REJECTED");
    assert.equal(classified.reason, "zero_test_selection");
  });
});
