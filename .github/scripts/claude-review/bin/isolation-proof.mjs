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
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { runProbe } from "../lib/sandbox.js";
import {
  cleanupPrefix,
  dockerAvailable,
  inspectPinnedImages,
  leftoverResources,
} from "../lib/isolated-executor.js";
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
function parseGateway(text) {
  for (const line of String(text).split("\\n").slice(1)) {
    const p = line.split("\\t");
    if (p[1] === "00000000") {
      const g = p[2];
      return [g.slice(6, 8), g.slice(4, 6), g.slice(2, 4), g.slice(0, 2)]
        .map((h) => parseInt(h, 16))
        .join(".");
    }
  }
  return "";
}
function probe(ip) {
  const port = Number(process.env.STOCKY_HOST_LISTENER_PORT);
  const sock = new net.Socket();
  sock.setTimeout(2000);
  sock.connect(port, ip, () => {
    process.stdout.write("CONNECTED " + ip);
    process.exit(0);
  });
  sock.on("timeout", () => {
    process.stdout.write("TIMEOUT " + ip);
    process.exit(2);
  });
  sock.on("error", (e) => {
    process.stdout.write(String(e.code || e.message) + " " + ip);
    process.exit(2);
  });
}
fs.promises.readFile("/proc/net/route", "utf8").then((text) => {
  probe(parseGateway(text));
}).catch((e) => {
  process.stdout.write("ROUTE " + String(e.code || e.message));
  process.exit(2);
});
`;

const JAIL_BYPASS = `
const fs = require("fs");
const net = require("net");
const { execFileSync } = require("child_process");
const out = { uid: process.getuid(), canary: "ENOENT", sock: "ENOENT", secrets: false, egress: "untried" };
try { fs.promises.readFile(process.env.STOCKY_CANARY_PATH).then(() => {}).catch(() => {}); } catch (e) {}
try { fs.readFileSync(process.env.STOCKY_CANARY_PATH, "utf8"); out.canary = "READ"; } catch (e) { out.canary = e.code || "ERR"; }
try { fs.openSync("/var/run/docker.sock"); out.sock = "OPEN"; } catch (e) { out.sock = e.code || "ERR"; }
try { fs.openSync("/run/docker.sock"); out.sock2 = "OPEN"; } catch (e) { out.sock2 = e.code || "ERR"; }
out.secrets = Boolean(process.env.GITHUB_TOKEN || process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY);
function tryConn(host, port, key) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(1500);
    s.connect(port, host, () => { s.destroy(); resolve("CONNECTED"); });
    s.on("timeout", () => { s.destroy(); resolve("TIMEOUT"); });
    s.on("error", (e) => resolve(e.code || e.message));
  }).then((v) => { out[key] = v; });
}
Promise.all([
  tryConn("1.1.1.1", 443, "egress_443"),
  tryConn("169.254.169.254", 80, "imds"),
]).then(() => {
  try { execFileSync("id", { encoding: "utf8" }); out.exec = "RAN"; } catch (e) { out.exec = e.code || "ERR"; }
  process.stdout.write(JSON.stringify(out));
  process.exit(2);
});
`;

function listenHost() {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      socket.write("host-canary");
      socket.end();
    });
    server.listen(0, "0.0.0.0", () => {
      resolve({ server, port: server.address().port });
    });
    server.on("error", reject);
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

process.env.STOCKY_ISOLATION_PROOF = "1";
process.env.CLAUDE_CODE_OAUTH_TOKEN = "synthetic-oauth-canary";
process.env.GITHUB_TOKEN = "synthetic-github-canary";
process.env.ANTHROPIC_API_KEY = "synthetic-anthropic-canary";
process.env.SOME_OTHER_SECRET = "synthetic-other-canary";

const executorFile = path.join(ROOT, "lib/isolated-executor.js");
const sandboxFile = path.join(ROOT, "lib/sandbox.js");
const originalExecutor = hashFile(executorFile);
const originalSandbox = hashFile(sandboxFile);
proof.hashes_before = { executor: originalExecutor, sandbox: originalSandbox };

proof.image_inspect = inspectPinnedImages("docker");
proof.image_inspect_ok = Object.values(proof.image_inspect).every((v) => v.ok && v.matches_pin);

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

const jail = runProbe(
  {
    kind: "node_script",
    timeout_seconds: 30,
    node_script: { source: JAIL_BYPASS },
    expect: { outcome: "fail" },
  },
  dockerOpts({ hostCanaryPath: canary }),
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

const listener = await listenHost();
proof.host_listener_port = listener.port;

delete process.env.STOCKY_ISOLATION_PROOF_MUTATION;
const gwProd = runProbe(
  {
    kind: "node_script",
    timeout_seconds: 20,
    node_script: { source: GATEWAY_SCRIPT },
    expect: { outcome: "fail" },
  },
  dockerOpts({ hostListenerPort: listener.port }),
);
proof.gateway_production = {
  backend: gwProd.executor.backend,
  exit: gwProd.executor.exit_code,
  stdout: (gwProd.executor.stdout || "").slice(0, 200),
  provisioning_failed: gwProd.executor.provisioning_failed,
};

process.env.STOCKY_ISOLATION_PROOF_MUTATION = "omit-gateway-isolated";
const gwMut = runProbe(
  {
    kind: "node_script",
    timeout_seconds: 20,
    node_script: { source: GATEWAY_SCRIPT },
    expect: { outcome: "fail" },
  },
  dockerOpts({ hostListenerPort: listener.port }),
);
proof.gateway_mutation = {
  backend: gwMut.executor.backend,
  exit: gwMut.executor.exit_code,
  stdout: (gwMut.executor.stdout || "").slice(0, 200),
};
delete process.env.STOCKY_ISOLATION_PROOF_MUTATION;
listener.server.close();

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

process.env.STOCKY_ISOLATION_PROOF_MUTATION = "skip-cleanup";
const orphan = runProbe(
  {
    kind: "node_script",
    timeout_seconds: 5,
    node_script: { source: "while (true) {}" },
    expect: { outcome: "timeout" },
  },
  dockerOpts(),
);
proof.orphan_mutation = {
  timed_out: orphan.executor.timed_out,
  leftovers_before_restore: leftoverResources("docker", orphan.prefix || "srnone"),
};
if (orphan.prefix) {
  proof.orphan_mutation.after_restore = cleanupPrefix("docker", orphan.prefix);
}
delete process.env.STOCKY_ISOLATION_PROOF_MUTATION;

const sql = runProbe(
  { kind: "sql", timeout_seconds: 60, sql: { text: "SELECT 1 AS ok" } },
  dockerOpts(),
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
  dockerOpts(),
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

const checks = {
  hashOk:
    proof.hashes_before.executor === proof.hashes_after.executor &&
    proof.hashes_before.sandbox === proof.hashes_after.sandbox,
  disabledRevived: disabled.executor.exit_code === 0,
  image_inspect_ok: proof.image_inspect_ok,
  jail_backend_docker: jail.executor.backend === "docker" && !jail.executor.provisioning_failed,
  canary_denied: jailParsed.canary !== "READ",
  sock_denied: jailParsed.sock === "ENOENT" || jailParsed.sock === "EACCES" || jailParsed.sock === "ERR",
  secrets_denied: jailParsed.secrets === false && proof.env_denied.oauth && proof.env_denied.github,
  egress_denied: jailParsed.egress_443 !== "CONNECTED",
  imds_denied: jailParsed.imds !== "CONNECTED",
  gateway_production_not_connected:
    gwProd.executor.backend === "docker" &&
    !gwProd.executor.provisioning_failed &&
    !/CONNECTED/.test(gwProd.executor.stdout || ""),
  gateway_mutation_revived: /CONNECTED/.test(gwMut.executor.stdout || ""),
  timeout_enforced:
    timed.executor.timed_out === true &&
    timed.executor.backend === "docker" &&
    proof.timeout.duration_ms < 90_000,
  timeout_no_orphans:
    (proof.timeout.leftovers.containers || []).length === 0 &&
    (proof.timeout.leftovers.networks || []).length === 0,
  orphan_mutation_revived: (proof.orphan_mutation.leftovers_before_restore.containers || []).length > 0,
  orphan_restored: (proof.orphan_mutation.after_restore?.containers || []).length === 0,
  sqlOk: sql.executor.backend === "docker" && sql.executor.exit_code === 0,
  failOk: failSql.executor.exit_code !== 0,
  zeroOk: zero.executor.tests_run === 0,
  pinsUsed: Boolean(sql.executor.image_pins?.postgres?.includes("@sha256:")),
};
proof.checks = checks;
proof.status = Object.values(checks).every(Boolean) ? "PASS_ISOLATION_PROOF" : "FAIL";
writeProof(proof);
try {
  fs.unlinkSync(canary);
} catch {
  /* ignore */
}
process.exit(proof.status === "PASS_ISOLATION_PROOF" ? 0 : 1);
