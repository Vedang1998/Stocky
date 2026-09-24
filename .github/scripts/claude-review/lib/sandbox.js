import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  HOST_ISOLATION_MODES,
  MAX_PROBE_OUTPUT_BYTES,
  NODE_VERSION,
  SECRET_ENV_DENY,
  SYNTHETIC_PG,
  SYNTHETIC_REDIS,
} from "./constants.js";
import { validateProbe } from "./probe.js";
import { outputHash } from "./verdict.js";
import { resultErr } from "./util.js";
import { runIsolatedProbe } from "./isolated-executor.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PRELOAD_SRC = path.resolve(HERE, "../sandbox/preload-jail.cjs");

export function dockerNetworkCreateArgs(name) {
  return ["network", "create", "--internal", name];
}

export function dockerRunArgs({
  image = `node:${NODE_VERSION}-bookworm-slim`,
  network,
  subjectDir,
  probeDir,
  env = {},
}) {
  const args = [
    "run",
    "--rm",
    "--network",
    network,
    "--user",
    "65534:65534",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,nosuid,size=64m",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--memory",
    "1g",
    "--cpus",
    "1",
    "--pids-limit",
    "128",
    "-v",
    `${subjectDir}:/subject:ro`,
    "-v",
    `${probeDir}:/probe:rw`,
    "--workdir",
    "/probe",
  ];
  for (const [k, v] of Object.entries(env)) {
    args.push("-e", `${k}=${v}`);
  }
  args.push(image, "node", "--require", "/probe/preload-jail.cjs", "/probe/script.js");
  return args;
}

export function dockerArgsAreIsolated(args) {
  const joined = args.join(" ");
  if (joined.includes("docker.sock")) return false;
  if (joined.includes("--privileged")) return false;
  if (joined.includes("--pid=host") || joined.includes("--network=host")) return false;
  if (!args.includes("--internal") && !args.includes("--cap-drop")) {
    /* run args use cap-drop; network create uses --internal */
  }
  if (!args.includes("--cap-drop") && !args.includes("create")) return false;
  return !args.includes("--privileged");
}

export function dockerAvailable() {
  const r = spawnSync("docker", ["info"], { encoding: "utf8", timeout: 8000 });
  return r.status === 0;
}

export function stripSecretEnv(baseEnv = process.env) {
  const out = {};
  const allow = new Set([
    "PATH",
    "LANG",
    "LC_ALL",
    "TZ",
    "HOME",
    "NODE_ENV",
    "TERM",
    "DATABASE_URL",
    "PGHOST",
    "PGPORT",
    "PGUSER",
    "PGPASSWORD",
    "PGDATABASE",
    "REDIS_URL",
    "SUBJECT_ROOT",
    "PROBE_ROOT",
    "STOCKY_JAIL_ROOTS",
    "STOCKY_JAIL_NET_HOSTS",
    "STOCKY_JAIL_NET_PORTS",
  ]);
  for (const [k, v] of Object.entries(baseEnv)) {
    if (SECRET_ENV_DENY.includes(k)) continue;
    if (k.startsWith("STOCKY_JAIL_")) out[k] = v;
    else if (allow.has(k)) out[k] = v;
  }
  out.TZ = out.TZ || "UTC";
  out.NODE_ENV = "test";
  return out;
}

function truncateOutput(text) {
  const buf = Buffer.from(String(text ?? ""), "utf8");
  if (buf.length <= MAX_PROBE_OUTPUT_BYTES) {
    return { text: buf.toString("utf8"), truncated: false, bytes: buf.length };
  }
  return {
    text: buf.subarray(0, MAX_PROBE_OUTPUT_BYTES).toString("utf8"),
    truncated: true,
    bytes: buf.length,
  };
}

function executorResult(partial) {
  const stdout = truncateOutput(partial.stdout);
  const stderr = truncateOutput(partial.stderr);
  return {
    backend: partial.backend,
    exit_code: partial.exit_code,
    timed_out: Boolean(partial.timed_out),
    provisioning_failed: Boolean(partial.provisioning_failed),
    malformed_output: Boolean(partial.malformed_output),
    tests_run: partial.tests_run ?? 1,
    stdout: stdout.text,
    stderr: stderr.text,
    output_truncated: stdout.truncated || stderr.truncated,
    output_bytes: stdout.bytes + stderr.bytes,
    stdout_sha256: outputHash(stdout.text, stderr.text),
    duration_ms: partial.duration_ms ?? 0,
  };
}

function spawnTimed(command, args, options) {
  const started = Date.now();
  const r = spawnSync(command, args, options);
  const timed_out =
    r.error?.code === "ETIMEDOUT" || r.signal === "SIGTERM" || r.signal === "SIGKILL";
  return { r, duration_ms: Date.now() - started, timed_out };
}

export function runSqlProbe(probe, env) {
  const psql = process.env.STOCKY_PSQL_BIN || "psql";
  const { r, duration_ms, timed_out } = spawnTimed(
    psql,
    [
      "-v",
      "ON_ERROR_STOP=1",
      "-d",
      env.PGDATABASE || SYNTHETIC_PG.database,
      "-c",
      probe.sql.text,
    ],
    {
      encoding: "utf8",
      timeout: probe.timeout_seconds * 1000,
      env,
    },
  );
  if (r.error && r.error.code === "ENOENT") {
    return executorResult({
      backend: "process",
      exit_code: 127,
      provisioning_failed: true,
      stdout: "",
      stderr: "psql not found",
      tests_run: 0,
      duration_ms,
    });
  }
  return executorResult({
    backend: "process",
    exit_code: r.status ?? 1,
    timed_out,
    stdout: r.stdout,
    stderr: r.stderr,
    tests_run: 1,
    duration_ms,
  });
}

export function runRedisProbe(probe, env) {
  const bin = process.env.STOCKY_REDIS_CLI_BIN || "redis-cli";
  const args =
    probe.redis.op === "PING"
      ? ["PING"]
      : probe.redis.op === "GET"
        ? ["GET", probe.redis.key]
        : ["SET", probe.redis.key, probe.redis.value];
  const { r, duration_ms, timed_out } = spawnTimed(bin, args, {
    encoding: "utf8",
    timeout: probe.timeout_seconds * 1000,
    env,
  });
  if (r.error && r.error.code === "ENOENT") {
    return executorResult({
      backend: "process",
      exit_code: 127,
      provisioning_failed: true,
      stdout: "",
      stderr: "redis-cli not found",
      tests_run: 0,
      duration_ms,
    });
  }
  const text = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const failed =
    r.status !== 0 || /NOAUTH|denied|error|could not connect/i.test(text);
  return executorResult({
    backend: "process",
    exit_code: failed ? r.status || 1 : 0,
    timed_out,
    stdout: r.stdout,
    stderr: r.stderr,
    tests_run: 1,
    duration_ms,
  });
}

export function runNodeScriptProbe(probe, { env, workDir, disablePreload = false }) {
  const scriptPath = path.join(workDir, "script.js");
  const preloadDest = path.join(workDir, "preload-jail.cjs");
  fs.writeFileSync(scriptPath, probe.node_script.source);
  if (!disablePreload) {
    fs.copyFileSync(PRELOAD_SRC, preloadDest);
  }
  const args = disablePreload
    ? [scriptPath]
    : ["--require", preloadDest, scriptPath];
  const { r, duration_ms, timed_out } = spawnTimed(process.execPath, args, {
    encoding: "utf8",
    timeout: probe.timeout_seconds * 1000,
    env,
    cwd: workDir,
  });
  return executorResult({
    backend: "process",
    exit_code: r.status ?? 1,
    timed_out,
    stdout: r.stdout,
    stderr: r.stderr,
    tests_run: 1,
    duration_ms,
  });
}

export function runZeroTestControl() {
  return executorResult({
    backend: "control",
    exit_code: 1,
    stdout: "",
    stderr: "zero tests selected",
    tests_run: 0,
    duration_ms: 0,
  });
}

export function buildSandboxEnv({
  subjectRoot,
  probeRoot,
  pg = SYNTHETIC_PG,
  redis = SYNTHETIC_REDIS,
  extra = {},
}) {
  const env = stripSecretEnv({
    ...process.env,
    ...extra,
    PATH: process.env.PATH,
    HOME: probeRoot,
    SUBJECT_ROOT: subjectRoot,
    PROBE_ROOT: probeRoot,
    STOCKY_JAIL_ROOTS: [subjectRoot, probeRoot].join(path.delimiter),
    STOCKY_JAIL_NET_HOSTS: "127.0.0.1,localhost",
    STOCKY_JAIL_NET_PORTS: `${pg.port},${redis.port}`,
    PGHOST: pg.host,
    PGPORT: String(pg.port),
    PGUSER: pg.user,
    PGPASSWORD: pg.password,
    PGDATABASE: pg.database,
    DATABASE_URL: `postgresql://${pg.user}:${pg.password}@${pg.host}:${pg.port}/${pg.database}`,
    REDIS_URL: `redis://${redis.host}:${redis.port}`,
  });
  return env;
}

export function runHostProbe(probe, options = {}) {
  const workDir = options.workDir || fs.mkdtempSync(path.join(os.tmpdir(), "stocky-probe-"));
  fs.mkdirSync(workDir, { recursive: true });
  const env = buildSandboxEnv({
    subjectRoot: options.subjectRoot || workDir,
    probeRoot: workDir,
    pg: options.pg,
    redis: options.redis,
    extra: options.extraEnv,
  });
  let executor;
  if (probe.kind === "sql") executor = runSqlProbe(probe, env);
  else if (probe.kind === "redis") executor = runRedisProbe(probe, env);
  else if (probe.kind === "node_script") {
    executor = runNodeScriptProbe(probe, {
      env,
      workDir,
      disablePreload: options.disablePreload === true,
    });
  } else if (probe.kind === "zero_test_control") executor = runZeroTestControl();
  else {
    return { ok: false, validation: resultErr("unknown_probe_kind", probe.kind) };
  }
  executor.isolation = isolationLabel(options.isolationMode);
  executor.backend = executor.backend || "process";
  return { ok: true, probe, executor, workDir };
}

function isolationLabel(mode) {
  return mode === "host-enforcement-control" ? "host-enforcement-control" : "host-unit";
}

export function runProbe(rawProbe, options = {}) {
  const validated = validateProbe(rawProbe, options.limits);
  if (!validated.ok) {
    return {
      ok: false,
      validation: validated,
      executor: executorResult({
        backend: "none",
        exit_code: 2,
        malformed_output: true,
        stdout: "",
        stderr: validated.message,
        tests_run: 0,
      }),
    };
  }
  const probe = validated.probe;
  const isolationMode = options.isolationMode || "docker";
  if (HOST_ISOLATION_MODES.includes(isolationMode)) {
    return runHostProbe(probe, options);
  }
  return runIsolatedProbe(probe, {
    ...options,
    requireProvenance: options.requireProvenance === true,
  });
}
