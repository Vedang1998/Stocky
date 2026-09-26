#!/usr/bin/env node
/**
 * Credential-free proof of the production Docker isolation path.
 * Exit 0 only when every specific oracle passes (not a generic non-zero).
 * Exit 2 = isolation_unavailable (authoring hosts without Docker).
 */
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { runProbe } from "../lib/sandbox.js";
import {
  cleanupPrefix,
  deriveHostGatewayCandidates,
  dockerAvailable,
  inspectPinnedImages,
  leftoverResources,
} from "../lib/isolated-executor.js";
import { IMAGE_PINS, MAX_COLLECTOR_BUFFER_BYTES, MAX_PROBE_OUTPUT_BYTES, pinnedImage } from "../lib/constants.js";
import { assertNoProductionTestHooks } from "../lib/production-hooks.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LISTENER_BIN = path.join(ROOT, "bin/host-listener.mjs");

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

function dockerOpts(over = {}) {
  return {
    isolationMode: "docker",
    requireProvenance: true,
    provenance: provenance(),
    probe_index: 1,
    subjectRoot: path.join(ROOT, "fixtures/subject"),
    ...over,
  };
}

const GATEWAY_SCRIPT = `
const fs = require("fs");
const net = require("net");
function ipv4(s) {
  return /^(?:\\d{1,3}\\.){3}\\d{1,3}$/.test(String(s || ""));
}
function candidates() {
  const out = [];
  const seen = new Set();
  function add(ip) {
    if (ipv4(ip) && !seen.has(ip)) { seen.add(ip); out.push(ip); }
  }
  for (const ip of String(process.env.STOCKY_GATEWAY_CANDIDATES || "").split(",")) add(ip.trim());
  add(process.env.STOCKY_BRIDGE_GATEWAY);
  add("172.17.0.1");
  add("127.0.0.1");
  try {
    const text = fs.readFileSync("/proc/net/route", "utf8");
    for (const line of text.split("\\n").slice(1)) {
      const p = line.split("\\t");
      if (p[1] === "00000000") {
        const g = p[2];
        add([g.slice(6, 8), g.slice(4, 6), g.slice(2, 4), g.slice(0, 2)].map((h) => parseInt(h, 16)).join("."));
      }
    }
  } catch (e) {}
  return out;
}
function probeOne(ip, port) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(1500);
    sock.connect(port, ip, () => {
      sock.destroy();
      resolve({ ip: ip, result: "CONNECTED" });
    });
    sock.on("timeout", () => { sock.destroy(); resolve({ ip: ip, result: "TIMEOUT" }); });
    sock.on("error", (e) => { sock.destroy(); resolve({ ip: ip, result: String(e.code || e.message) }); });
  });
}
(async () => {
  const port = Number(process.env.STOCKY_HOST_LISTENER_PORT);
  const ips = candidates();
  const results = [];
  for (const ip of ips) results.push(await probeOne(ip, port));
  process.stdout.write(JSON.stringify({ attempts: results.length, results: results }));
  process.exit(results.some((r) => r.result === "CONNECTED") ? 0 : 2);
})();
`;

const JAIL_BYPASS = `
const fs = require("fs");
const net = require("net");
const { execFileSync } = require("child_process");
function classify(e) {
  if (!e) return "ERR";
  if (e.code) return String(e.code);
  const msg = String(e.message || "");
  if (msg.indexOf("STOCKY_JAIL") >= 0) return "STOCKY_JAIL";
  const m = msg.match(/\\b(ENOENT|EACCES|EPERM)\\b/);
  return m ? m[1] : "ERR";
}
const out = {
  uid: process.getuid(),
  canary: "untried",
  canary_attempted: false,
  canary_bypass: "untried",
  canary_bypass_attempted: false,
  sock: "untried",
  sock_attempted: false,
  sock_bypass: "untried",
  sock_bypass_attempted: false,
  fake_sock: "untried",
  fake_sock_attempted: false,
  fake_sock_bypass: "untried",
  fake_sock_bypass_attempted: false,
  secrets: false,
  egress: "untried",
  exec: "untried"
};
try {
  fs.readFileSync(process.env.STOCKY_CANARY_PATH, "utf8");
  out.canary = "READ";
  out.canary_attempted = true;
} catch (e) {
  out.canary_attempted = true;
  out.canary = classify(e);
}
try {
  fs.openSync("/var/run/docker.sock");
  out.sock = "OPEN";
  out.sock_attempted = true;
} catch (e) {
  out.sock_attempted = true;
  out.sock = classify(e);
}
try {
  fs.openSync("/run/docker.sock");
  out.sock2 = "OPEN";
} catch (e) {
  out.sock2 = classify(e);
}
try {
  fs.openSync(process.env.STOCKY_FAKE_DOCKER_SOCK || "/tmp/stocky-fake-docker.sock");
  out.fake_sock = "OPEN";
  out.fake_sock_attempted = true;
} catch (e) {
  out.fake_sock_attempted = true;
  out.fake_sock = classify(e);
}
out.secrets = Boolean(process.env.GITHUB_TOKEN || process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY);
function tryConn(host, port, key) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(1500);
    s.connect(port, host, () => { s.destroy(); resolve("CONNECTED"); });
    s.on("timeout", () => { s.destroy(); resolve("TIMEOUT"); });
    s.on("error", (e) => { s.destroy(); resolve(e.code || e.message); });
  }).then((v) => { out[key] = v; });
}
function bypassRead(p, field, attemptedField) {
  return fs.promises.readFile(p).then(function () {
    out[attemptedField] = true;
    out[field] = "READ";
  }, function (e) {
    out[attemptedField] = true;
    out[field] = classify(e);
  });
}
function bypassStat(p, field, attemptedField) {
  return fs.promises.stat(p).then(function () {
    out[attemptedField] = true;
    out[field] = "OPEN";
  }, function (e) {
    out[attemptedField] = true;
    out[field] = classify(e);
  });
}
Promise.all([
  tryConn("1.1.1.1", 443, "egress_443"),
  tryConn("169.254.169.254", 80, "imds"),
  bypassRead(process.env.STOCKY_CANARY_PATH, "canary_bypass", "canary_bypass_attempted"),
  bypassStat("/var/run/docker.sock", "sock_bypass", "sock_bypass_attempted"),
  bypassStat(process.env.STOCKY_FAKE_DOCKER_SOCK || "/tmp/stocky-fake-docker.sock", "fake_sock_bypass", "fake_sock_bypass_attempted"),
]).then(() => {
  try { execFileSync("id", { encoding: "utf8" }); out.exec = "RAN"; } catch (e) { out.exec = classify(e); }
  process.stdout.write(JSON.stringify(out));
});
`;

const DNS_SCRIPT = `
const dns = require("dns");
const out = { attempts: 0, results: [] };
function lookup(name) {
  return new Promise((resolve) => {
    out.attempts += 1;
    dns.lookup(name, { family: 4 }, (err, address) => {
      out.results.push({ name: name, address: address || "", code: err ? (err.code || err.message) : "OK" });
      resolve();
    });
  });
}
Promise.all([lookup("example.invalid"), lookup("one.one.one.one")]).then(() => {
  process.stdout.write(JSON.stringify(out));
  process.exit(2);
});
`;

const DRAIN_WRITE_HELPER = `
function writeFully(buf) {
  return new Promise((resolve, reject) => {
    process.stdout.write(buf, (err) => (err ? reject(err) : resolve()));
  });
}
`;

const FLOOD_SCRIPT = `
${DRAIN_WRITE_HELPER}
const chunk = Buffer.alloc(64 * 1024, 0x41);
(async () => {
  for (let i = 0; i < 40; i++) await writeFully(chunk);
})().catch(() => { process.exitCode = 1; });
`;

const ROTATION_TAIL_SCRIPT = `
${DRAIN_WRITE_HELPER}
(async () => {
  await writeFully("START-MARKER\\n");
  const chunk = Buffer.alloc(64 * 1024, 0x41);
  for (let i = 0; i < 32; i++) await writeFully(chunk);
  await writeFully("TAIL-MARKER\\n");
})().catch(() => { process.exitCode = 1; });
`;

const OMIT_LIMIT_SCRIPT = `
${DRAIN_WRITE_HELPER}
const chunk = Buffer.alloc(64 * 1024, 0x42);
(async () => {
  for (let i = 0; i < 8; i++) await writeFully(chunk);
})().catch(() => { process.exitCode = 1; });
`;

function startHostListener() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-listener-"));
  const portFile = path.join(dir, "port");
  const acceptFile = path.join(dir, "accepts");
  const child = spawn(process.execPath, [LISTENER_BIN, portFile, acceptFile], {
    stdio: "ignore",
    env: { PATH: process.env.PATH },
  });
  const started = Date.now();
  while (Date.now() - started < 5000) {
    if (fs.existsSync(portFile)) {
      const port = Number(fs.readFileSync(portFile, "utf8").trim());
      if (port > 0) return { child, port, acceptFile, dir };
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }
  child.kill("SIGTERM");
  throw new Error("host listener did not publish a port");
}

function hostConnect(port) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host: "127.0.0.1", port }, () => {
      let data = "";
      sock.on("data", (c) => {
        data += c;
      });
      sock.on("end", () => resolve(data));
    });
    sock.setTimeout(2000);
    sock.on("timeout", () => {
      sock.destroy();
      reject(new Error("liveness timeout"));
    });
    sock.on("error", reject);
  });
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

process.env.CLAUDE_CODE_OAUTH_TOKEN = "synthetic-oauth-canary";
process.env.GITHUB_TOKEN = "synthetic-github-canary";
process.env.ANTHROPIC_API_KEY = "synthetic-anthropic-canary";
process.env.SOME_OTHER_SECRET = "synthetic-other-canary";
delete process.env.STOCKY_ISOLATION_PROOF;
delete process.env.STOCKY_ISOLATION_PROOF_MUTATION;
delete process.env.STOCKY_REVIEW_MOCK_GITHUB_URL;

const executorFile = path.join(ROOT, "lib/isolated-executor.js");
const sandboxFile = path.join(ROOT, "lib/sandbox.js");
const originalExecutor = hashFile(executorFile);
const originalSandbox = hashFile(sandboxFile);
proof.hashes_before = { executor: originalExecutor, sandbox: originalSandbox };

proof.image_inspect = inspectPinnedImages("docker");
proof.image_inspect_ok = Object.values(proof.image_inspect).every((v) => v.ok && v.matches_pin);

const canary = path.join(os.tmpdir(), `stocky-host-canary-${Date.now()}`);
fs.writeFileSync(canary, "synthetic-canary-not-a-secret");
const fakeSock = path.join(os.tmpdir(), `stocky-fake-docker-${Date.now()}.sock`);
fs.writeFileSync(fakeSock, "not-a-real-docker-socket");

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

const jail = runProbe(
  {
    kind: "node_script",
    timeout_seconds: 30,
    node_script: { source: JAIL_BYPASS },
    expect: { outcome: "fail" },
  },
  dockerOpts({ hostCanaryPath: canary, fakeDockerSockPath: fakeSock }),
);
proof.jail_stdout = (jail.executor.stdout || "").slice(0, 800);
proof.jail_backend = jail.executor.backend;
let jailParsed = {};
try {
  jailParsed = JSON.parse((jail.executor.stdout || "").trim().split("\n").pop());
} catch {
  jailParsed = { parse: "failed", raw: proof.jail_stdout };
}
proof.jail = jailParsed;

const envDump = runProbe(
  {
    kind: "node_script",
    timeout_seconds: 20,
    node_script: {
      source: `process.stdout.write(JSON.stringify(process.env)); process.exit(0);`,
    },
  },
  dockerOpts(),
);
proof.env_dump_backend = envDump.executor.backend;
const envText = envDump.executor.stdout || "";
proof.env_denied = {
  oauth: !envText.includes("synthetic-oauth-canary"),
  github: !envText.includes("synthetic-github-canary"),
  anthropic: !envText.includes("synthetic-anthropic-canary"),
  other: !envText.includes("synthetic-other-canary"),
};

const listener = startHostListener();
proof.host_listener_port = listener.port;
const liveness = await hostConnect(listener.port);
proof.host_listener_liveness = liveness.includes("host-canary");
const acceptsAfterLiveness = fs.readFileSync(listener.acceptFile, "utf8");
const candidates = deriveHostGatewayCandidates();
proof.gateway_candidates = candidates;
proof.ambient_hooks_denied = assertNoProductionTestHooks({
  STOCKY_ISOLATION_PROOF: "1",
  STOCKY_ISOLATION_PROOF_MUTATION: "omit-gateway-isolated",
}).ok === false;

const gwProd = runProbe(
  {
    kind: "node_script",
    timeout_seconds: 30,
    node_script: { source: GATEWAY_SCRIPT },
    expect: { outcome: "fail" },
  },
  dockerOpts({ hostListenerPort: listener.port, gatewayCandidates: candidates }),
);
let gwProdParsed = { attempts: 0, results: [] };
try {
  gwProdParsed = JSON.parse((gwProd.executor.stdout || "").trim().split("\n").pop());
} catch {
  gwProdParsed = { parse: "failed", raw: (gwProd.executor.stdout || "").slice(0, 300) };
}
proof.gateway_production = {
  backend: gwProd.executor.backend,
  exit: gwProd.executor.exit_code,
  stdout: (gwProd.executor.stdout || "").slice(0, 500),
  provisioning_failed: gwProd.executor.provisioning_failed,
  attempts: gwProdParsed.attempts || 0,
  results: gwProdParsed.results || [],
};
const acceptsAfterProd = fs.readFileSync(listener.acceptFile, "utf8");
proof.gateway_production_new_accepts = acceptsAfterProd !== acceptsAfterLiveness;

const gwMut = runProbe(
  {
    kind: "node_script",
    timeout_seconds: 30,
    node_script: { source: GATEWAY_SCRIPT },
    expect: { outcome: "fail" },
  },
  dockerOpts({
    hostListenerPort: listener.port,
    gatewayCandidates: candidates,
    allowProofHooks: true,
    proofMutation: "omit-gateway-isolated",
  }),
);
proof.gateway_mutation = {
  backend: gwMut.executor.backend,
  exit: gwMut.executor.exit_code,
  stdout: (gwMut.executor.stdout || "").slice(0, 500),
  attempts: 0,
  results: [],
};
try {
  const parsedMut = JSON.parse((gwMut.executor.stdout || "").trim().split("\n").pop());
  proof.gateway_mutation.attempts = parsedMut.attempts || 0;
  proof.gateway_mutation.results = parsedMut.results || [];
} catch {
  proof.gateway_mutation.parse = "failed";
}

const dns = runProbe(
  {
    kind: "node_script",
    timeout_seconds: 20,
    node_script: { source: DNS_SCRIPT },
    expect: { outcome: "fail" },
  },
  dockerOpts(),
);
proof.dns = { backend: dns.executor.backend, stdout: (dns.executor.stdout || "").slice(0, 400) };
try {
  proof.dns.parsed = JSON.parse((dns.executor.stdout || "").trim().split("\n").pop());
} catch {
  proof.dns.parsed = { parse: "failed" };
}

const timeoutStarted = Date.now();
const timed = runProbe(
  {
    kind: "node_script",
    timeout_seconds: 5,
    node_script: { source: "while (true) {}" },
    expect: { outcome: "timeout" },
  },
  dockerOpts(),
);
proof.timeout = {
  timed_out: timed.executor.timed_out,
  exit: timed.executor.exit_code,
  backend: timed.executor.backend,
  duration_ms: Date.now() - timeoutStarted,
  leftovers: leftoverResources("docker", timed.prefix || "srnone"),
};
if (timed.prefix) cleanupPrefix("docker", timed.prefix);

const orphan = runProbe(
  {
    kind: "node_script",
    timeout_seconds: 5,
    node_script: { source: "while (true) {}" },
    expect: { outcome: "timeout" },
  },
  dockerOpts({ allowProofHooks: true, proofMutation: "skip-cleanup" }),
);
proof.orphan_mutation = {
  timed_out: orphan.executor.timed_out,
  leftovers_before_restore: leftoverResources("docker", orphan.prefix || "srnone"),
};
if (orphan.prefix) {
  proof.orphan_mutation.after_restore = cleanupPrefix("docker", orphan.prefix);
}

const flood = runProbe(
  {
    kind: "node_script",
    timeout_seconds: 20,
    node_script: { source: FLOOD_SCRIPT },
  },
  dockerOpts(),
);
proof.flood = {
  backend: flood.executor.backend,
  exit: flood.executor.exit_code,
  output_incomplete: flood.executor.output_incomplete,
  output_truncated: flood.executor.output_truncated,
  output_bytes: flood.executor.output_bytes,
  log_bytes: flood.executor.log_bytes,
  log_driver: flood.executor.log_driver,
  leftovers: leftoverResources("docker", flood.prefix || "srnone"),
};
if (flood.prefix) cleanupPrefix("docker", flood.prefix);

const rotation = runProbe(
  {
    kind: "node_script",
    timeout_seconds: 20,
    node_script: { source: ROTATION_TAIL_SCRIPT },
  },
  dockerOpts(),
);
proof.rotation_tail = {
  backend: rotation.executor.backend,
  exit: rotation.executor.exit_code,
  output_incomplete: rotation.executor.output_incomplete,
  stdout_has_start: (rotation.executor.stdout || "").includes("START-MARKER"),
  stdout_has_tail: (rotation.executor.stdout || "").includes("TAIL-MARKER"),
  returned_bytes: Buffer.byteLength(rotation.executor.stdout || "", "utf8"),
  log_bytes: rotation.executor.log_bytes,
};
if (rotation.prefix) cleanupPrefix("docker", rotation.prefix);

const omitLimits = runProbe(
  {
    kind: "node_script",
    timeout_seconds: 20,
    node_script: { source: OMIT_LIMIT_SCRIPT },
  },
  dockerOpts({ allowProofHooks: true, proofMutation: "omit-log-limits" }),
);
proof.omit_log_limits = {
  backend: omitLimits.executor.backend,
  output_incomplete: omitLimits.executor.output_incomplete,
  returned_bytes: Buffer.byteLength(omitLimits.executor.stdout || "", "utf8"),
  log_driver: omitLimits.executor.log_driver,
  note: "omit-log-limits writes 512KiB only; rotation threshold is not an exact host-disk bound",
};
if (omitLimits.prefix) cleanupPrefix("docker", omitLimits.prefix);

const sql = runProbe(
  { kind: "sql", timeout_seconds: 60, sql: { text: "SELECT 1 AS ok" } },
  dockerOpts(),
);
proof.sql_backend = sql.executor.backend;
proof.sql_exit = sql.executor.exit_code;
proof.sql_stdout = (sql.executor.stdout || "").slice(0, 200);
proof.sql_stderr = (sql.executor.stderr || "").slice(0, 400);
proof.sql_provisioning_failed = sql.executor.provisioning_failed;
proof.sql_image_pins = sql.executor.image_pins;

const failSql = runProbe(
  {
    kind: "sql",
    timeout_seconds: 60,
    sql: { text: "SELECT * FROM definitely_missing_table_stocky_review" },
    expect: { outcome: "fail" },
  },
  dockerOpts(),
);
proof.fail_sql_exit = failSql.executor.exit_code;
proof.fail_sql_stderr = (failSql.executor.stderr || "").slice(0, 200);

const zero = runProbe(
  { kind: "zero_test_control", timeout_seconds: 5, expect: { outcome: "fail" } },
  { isolationMode: "docker", requireProvenance: false },
);
proof.zero_tests_run = zero.executor.tests_run;
listener.child.kill("SIGTERM");

proof.hashes_after = { executor: hashFile(executorFile), sandbox: hashFile(sandboxFile) };
proof.pins = {
  postgres: pinnedImage(IMAGE_PINS.postgres),
  redis: pinnedImage(IMAGE_PINS.redis),
  node: pinnedImage(IMAGE_PINS.node),
};

const prodConnected = (proof.gateway_production.results || []).some((r) => r.result === "CONNECTED");
const mutConnected = (proof.gateway_mutation.results || []).some((r) => r.result === "CONNECTED");
const dnsAttempts = proof.dns.parsed?.attempts || 0;
const dnsResults = proof.dns.parsed?.results || [];
const SPECIFIC_FS_DENY = new Set(["ENOENT", "EACCES", "EPERM", "STOCKY_JAIL"]);
function specificFsDenied(attempted, outcome, successTokens) {
  if (attempted !== true) return false;
  if (successTokens.includes(outcome) || outcome === "untried" || outcome === "ERR") return false;
  return SPECIFIC_FS_DENY.has(outcome);
}
const NET_DENY = new Set([
  "ENETUNREACH",
  "EHOSTUNREACH",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "TIMEOUT",
  "EPERM",
  "EACCES",
]);
const DNS_DENY = new Set(["EAI_AGAIN", "ESERVFAIL", "ENOTFOUND", "EAI_NONAME", "EAI_FAIL", "ENETUNREACH"]);
const floodReturned = Buffer.byteLength(flood.executor.stdout || "", "utf8");
const rotationReturned = Buffer.byteLength(rotation.executor.stdout || "", "utf8");
const omitReturned = Buffer.byteLength(omitLimits.executor.stdout || "", "utf8");
proof.resource_bound_note =
  "json-file max-size=1m max-file=1 is a rotation threshold, not an exact whole-host disk bound. Collector/follow buffers cap at 256KiB and mark incomplete.";

const checks = {
  hashOk:
    proof.hashes_before.executor === proof.hashes_after.executor &&
    proof.hashes_before.sandbox === proof.hashes_after.sandbox,
  disabledRevived: disabled.executor.exit_code === 0,
  image_inspect_ok: proof.image_inspect_ok,
  jail_backend_docker: jail.executor.backend === "docker" && !jail.executor.provisioning_failed,
  canary_denied:
    specificFsDenied(jailParsed.canary_attempted, jailParsed.canary, ["READ"]) &&
    specificFsDenied(jailParsed.canary_bypass_attempted, jailParsed.canary_bypass, ["READ"]),
  sock_denied:
    specificFsDenied(jailParsed.sock_attempted, jailParsed.sock, ["OPEN"]) &&
    specificFsDenied(jailParsed.sock_bypass_attempted, jailParsed.sock_bypass, ["OPEN"]),
  fake_sock_denied:
    specificFsDenied(jailParsed.fake_sock_attempted, jailParsed.fake_sock, ["OPEN"]) &&
    specificFsDenied(jailParsed.fake_sock_bypass_attempted, jailParsed.fake_sock_bypass, ["OPEN"]),
  secrets_denied: jailParsed.secrets === false && proof.env_denied.oauth && proof.env_denied.github,
  egress_denied: NET_DENY.has(jailParsed.egress_443),
  imds_denied: NET_DENY.has(jailParsed.imds),
  host_listener_live: proof.host_listener_liveness === true,
  gateway_candidates_present: (proof.gateway_candidates || []).length > 0,
  gateway_production_attempts: proof.gateway_production.attempts > 0,
  gateway_production_not_connected:
    gwProd.executor.backend === "docker" &&
    !gwProd.executor.provisioning_failed &&
    proof.gateway_production.attempts > 0 &&
    !prodConnected &&
    proof.gateway_production_new_accepts === false,
  gateway_mutation_revived: mutConnected === true && proof.gateway_mutation.attempts > 0,
  dns_attempts: dnsAttempts > 0,
  dns_not_ok:
    dnsAttempts > 0 &&
    dnsResults.length > 0 &&
    dnsResults.every((r) => DNS_DENY.has(r.code)),
  timeout_enforced:
    timed.executor.timed_out === true &&
    timed.executor.backend === "docker" &&
    proof.timeout.duration_ms < 90_000,
  timeout_no_orphans:
    (proof.timeout.leftovers.containers || []).length === 0 &&
    (proof.timeout.leftovers.networks || []).length === 0,
  orphan_mutation_revived: (proof.orphan_mutation.leftovers_before_restore.containers || []).length > 0,
  orphan_restored: (proof.orphan_mutation.after_restore?.containers || []).length === 0,
  flood_incomplete: flood.executor.output_incomplete === true || flood.executor.output_truncated === true,
  flood_bounded: floodReturned <= MAX_PROBE_OUTPUT_BYTES && floodReturned <= MAX_COLLECTOR_BUFFER_BYTES,
  flood_no_orphans:
    (proof.flood.leftovers.containers || []).length === 0 &&
    (proof.flood.leftovers.networks || []).length === 0,
  rotation_incomplete: rotation.executor.output_incomplete === true,
  rotation_bounded: rotationReturned <= MAX_COLLECTOR_BUFFER_BYTES,
  rotation_not_tail_only_complete:
    rotation.executor.output_incomplete === true ||
    !(proof.rotation_tail.stdout_has_tail && !proof.rotation_tail.stdout_has_start),
  omit_limits_incomplete: omitLimits.executor.output_incomplete === true,
  omit_limits_bounded: omitReturned <= MAX_COLLECTOR_BUFFER_BYTES,
  sqlOk: sql.executor.backend === "docker" && sql.executor.exit_code === 0 && !sql.executor.provisioning_failed,
  sqlComplete: sql.executor.output_incomplete !== true,
  failOk: failSql.executor.exit_code !== 0,
  zeroOk: zero.executor.tests_run === 0,
  pinsUsed: Boolean(sql.executor.image_pins?.postgres?.includes("@sha256:")),
  ambient_hooks_not_authority: proof.ambient_hooks_denied === true,
};
proof.checks = checks;
proof.status = Object.values(checks).every(Boolean) ? "PASS_ISOLATION_PROOF" : "FAIL";
writeProof(proof);
try {
  fs.unlinkSync(canary);
  fs.unlinkSync(fakeSock);
} catch {
  /* ignore */
}
process.exit(proof.status === "PASS_ISOLATION_PROOF" ? 0 : 1);
