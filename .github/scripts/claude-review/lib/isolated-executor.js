import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  IMAGE_PINS,
  MAX_PROBE_OUTPUT_BYTES,
  REDIS_KEY_PREFIX,
  SECRET_ENV_DENY,
  SYNTHETIC_PG,
  SYNTHETIC_REDIS,
  pinnedImage,
} from "./constants.js";
import { bindProbeRequest } from "./provenance.js";
import { outputHash } from "./verdict.js";
import { resultErr, sha256Hex } from "./util.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PRELOAD_SRC = path.resolve(HERE, "../sandbox/preload-jail.cjs");

export function dockerAvailable(dockerBin = "docker") {
  const r = spawnSync(dockerBin, ["info"], {
    encoding: "utf8",
    timeout: 8000,
    env: dockerCliEnv(),
  });
  return r.status === 0;
}

export function assertIsolatedDockerArgs(args) {
  const joined = args.join(" ");
  if (joined.includes("docker.sock")) {
    return resultErr("docker_socket_denied", "docker.sock must not be mounted");
  }
  if (args.includes("--privileged")) {
    return resultErr("privileged_denied", "privileged containers are denied");
  }
  if (args.includes("--pid=host") || args.includes("--network=host") || args.includes("--net=host")) {
    return resultErr("host_namespace_denied", "host pid/network namespaces are denied");
  }
  if (joined.includes("/var/run/docker.sock")) {
    return resultErr("docker_socket_denied", "docker.sock path denied");
  }
  return { ok: true };
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

export function executorResult(partial) {
  const stdout = truncateOutput(partial.stdout);
  const stderr = truncateOutput(partial.stderr);
  return {
    backend: partial.backend,
    isolation: partial.isolation || partial.backend,
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
    image_pins: partial.image_pins,
  };
}

export function dockerCliEnv(base = process.env) {
  const out = {
    PATH: base.PATH || "/usr/bin:/bin",
    LANG: base.LANG || "C",
    HOME: base.HOME || "/tmp",
  };
  if (base.LC_ALL) out.LC_ALL = base.LC_ALL;
  for (const key of ["DOCKER_HOST", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH", "DOCKER_CONTEXT"]) {
    if (base[key]) out[key] = base[key];
  }
  return out;
}

function docker(dockerBin, args, options = {}) {
  const isolated = assertIsolatedDockerArgs(args);
  if (!isolated.ok) {
    return {
      status: 2,
      stdout: "",
      stderr: isolated.message,
      error: new Error(isolated.code),
    };
  }
  return spawnSync(dockerBin, args, {
    encoding: "utf8",
    timeout: options.timeout ?? 120_000,
    env: options.env || dockerCliEnv(),
  });
}

function isolationUnavailable(reason) {
  return executorResult({
    backend: "none",
    isolation: "unavailable",
    exit_code: 2,
    provisioning_failed: true,
    tests_run: 0,
    stdout: "",
    stderr: `isolation_unavailable: ${reason}`,
  });
}

export function inspectPinnedImages(dockerBin = "docker") {
  const observed = {};
  for (const [name, pin] of Object.entries(IMAGE_PINS)) {
    const ref = pinnedImage(pin);
    const pull = docker(dockerBin, ["pull", ref], { timeout: 180_000 });
    if (pull.status !== 0) {
      observed[name] = { ok: false, ref, error: pull.stderr || pull.error?.message };
      continue;
    }
    const inspect = docker(
      dockerBin,
      ["image", "inspect", "--format", "{{json .RepoDigests}} {{.Id}}", ref],
      { timeout: 15_000 },
    );
    observed[name] = {
      ok: inspect.status === 0,
      ref,
      pin_digest: pin.digest,
      inspect: (inspect.stdout || "").trim(),
      matches_pin: (inspect.stdout || "").includes(pin.digest.replace("sha256:", "")),
    };
  }
  return observed;
}

function waitForExec(dockerBin, args, timeoutMs, ok = (r) => r.status === 0) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const r = docker(dockerBin, args, { timeout: 15_000 });
    if (ok(r)) return true;
    spawnSync("sleep", ["1"]);
  }
  return false;
}

function sidecarArgs(network, name, alias, envPairs, image) {
  const args = [
    "run",
    "-d",
    "--rm",
    "--name",
    name,
    "--network",
    network,
    "--network-alias",
    alias,
    "--security-opt",
    "no-new-privileges",
  ];
  for (const [k, v] of envPairs) {
    args.push("-e", `${k}=${v}`);
  }
  args.push(image);
  return args;
}

function probeNodeArgs({ network, subjectDir, probeDir, envPairs, image }) {
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
    `${probeDir}:/probe:ro`,
    "--workdir",
    "/probe",
  ];
  for (const [k, v] of envPairs) {
    args.push("-e", `${k}=${v}`);
  }
  args.push(image, "node", "--require", "/probe/preload-jail.cjs", "/probe/script.js");
  return args;
}

/**
 * Production executor. Untrusted probe code runs only inside digest-pinned
 * containers on an --internal network. Host spawnSync is used solely for the
 * trusted `docker` CLI.
 */
export function runIsolatedProbe(probe, options = {}) {
  const dockerBin = options.dockerBin || "docker";
  const provenance = options.provenance;
  if (options.requireProvenance !== false) {
    const bound = bindProbeRequest({
      provenance: provenance || options.defaultProvenance,
      probe,
      probe_index: options.probe_index || 1,
      max_probes: options.maxProbes,
    });
    if (!bound.ok) {
      return {
        ok: false,
        validation: bound,
        executor: executorResult({
          backend: "none",
          isolation: "unbound",
          exit_code: 2,
          malformed_output: true,
          tests_run: 0,
          stdout: "",
          stderr: bound.message,
        }),
      };
    }
  }
  if (probe.kind === "zero_test_control") {
    return {
      ok: true,
      probe,
      executor: executorResult({
        backend: "control",
        isolation: "docker",
        exit_code: 1,
        tests_run: 0,
        stdout: "",
        stderr: "zero tests selected",
      }),
    };
  }
  if (!dockerAvailable(dockerBin)) {
    return {
      ok: true,
      probe,
      executor: isolationUnavailable("docker CLI/daemon not available"),
    };
  }

  const id = `sr${sha256Hex(`${Date.now()}-${Math.random()}`).slice(0, 10)}`;
  const network = id;
  const pgName = `${id}pg`;
  const redisName = `${id}rd`;
  const workDir = options.workDir || fs.mkdtempSync(path.join(os.tmpdir(), "stocky-iso-"));
  fs.mkdirSync(workDir, { recursive: true });
  const subjectDir = options.subjectRoot || path.join(workDir, "subject");
  fs.mkdirSync(subjectDir, { recursive: true });
  const probeDir = path.join(workDir, "probe");
  fs.mkdirSync(probeDir, { recursive: true });
  fs.copyFileSync(PRELOAD_SRC, path.join(probeDir, "preload-jail.cjs"));
  if (probe.kind === "node_script") {
    fs.writeFileSync(path.join(probeDir, "script.js"), probe.node_script.source);
  } else {
    fs.writeFileSync(path.join(probeDir, "script.js"), "process.exit(0);\n");
  }

  const created = [];
  const started = Date.now();
  try {
    const net = docker(dockerBin, ["network", "create", "--internal", "--driver", "bridge", network]);
    if (net.status !== 0) {
      return {
        ok: true,
        probe,
        executor: isolationUnavailable(`network create failed: ${net.stderr}`),
      };
    }
    created.push(["network", network]);

    const pgArgs = sidecarArgs(
      network,
      pgName,
      "pg",
      [
        ["POSTGRES_USER", SYNTHETIC_PG.user],
        ["POSTGRES_PASSWORD", SYNTHETIC_PG.password],
        ["POSTGRES_DB", SYNTHETIC_PG.database],
      ],
      pinnedImage(IMAGE_PINS.postgres),
    );
    const pg = docker(dockerBin, pgArgs, { timeout: 60_000 });
    if (pg.status !== 0) {
      return {
        ok: true,
        probe,
        executor: isolationUnavailable(`postgres sidecar failed: ${pg.stderr}`),
      };
    }
    created.push(["container", pgName]);

    const rdArgs = sidecarArgs(network, redisName, "redis", [], pinnedImage(IMAGE_PINS.redis));
    const rd = docker(dockerBin, rdArgs, { timeout: 60_000 });
    if (rd.status !== 0) {
      return {
        ok: true,
        probe,
        executor: isolationUnavailable(`redis sidecar failed: ${rd.stderr}`),
      };
    }
    created.push(["container", redisName]);

    if (
      !waitForExec(dockerBin, ["exec", pgName, "pg_isready", "-U", SYNTHETIC_PG.user, "-d", SYNTHETIC_PG.database], 45_000)
    ) {
      return {
        ok: true,
        probe,
        executor: isolationUnavailable("postgres did not become ready"),
      };
    }
    if (
      !waitForExec(
        dockerBin,
        ["exec", redisName, "redis-cli", "PING"],
        20_000,
        (r) => r.status === 0 && /PONG/i.test(`${r.stdout || ""}${r.stderr || ""}`),
      )
    ) {
      return {
        ok: true,
        probe,
        executor: isolationUnavailable("redis did not become ready"),
      };
    }

    let r;
    if (probe.kind === "sql") {
      r = docker(
        dockerBin,
        [
          "run",
          "--rm",
          "--network",
          network,
          "--user",
          "65534:65534",
          "--cap-drop",
          "ALL",
          "--security-opt",
          "no-new-privileges",
          "-e",
          `PGPASSWORD=${SYNTHETIC_PG.password}`,
          pinnedImage(IMAGE_PINS.postgres),
          "psql",
          "-h",
          "pg",
          "-U",
          SYNTHETIC_PG.user,
          "-d",
          SYNTHETIC_PG.database,
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          probe.sql.text,
        ],
        { timeout: probe.timeout_seconds * 1000 + 5000 },
      );
    } else if (probe.kind === "redis") {
      const redisArgs =
        probe.redis.op === "PING"
          ? ["PING"]
          : probe.redis.op === "GET"
            ? ["GET", probe.redis.key]
            : ["SET", probe.redis.key, probe.redis.value];
      r = docker(
        dockerBin,
        [
          "run",
          "--rm",
          "--network",
          network,
          "--user",
          "65534:65534",
          "--cap-drop",
          "ALL",
          "--security-opt",
          "no-new-privileges",
          pinnedImage(IMAGE_PINS.redis),
          "redis-cli",
          "-h",
          "redis",
          ...redisArgs,
        ],
        { timeout: probe.timeout_seconds * 1000 + 5000 },
      );
    } else if (probe.kind === "node_script") {
      const envPairs = [
        ["NODE_ENV", "test"],
        ["TZ", "UTC"],
        ["HOME", "/probe"],
        ["SUBJECT_ROOT", "/subject"],
        ["PROBE_ROOT", "/probe"],
        ["STOCKY_JAIL_ROOTS", "/subject:/probe"],
        ["STOCKY_JAIL_NET_HOSTS", "pg,redis"],
        ["STOCKY_JAIL_NET_PORTS", "5432,6379"],
        ["PGHOST", "pg"],
        ["PGPORT", "5432"],
        ["PGUSER", SYNTHETIC_PG.user],
        ["PGPASSWORD", SYNTHETIC_PG.password],
        ["PGDATABASE", SYNTHETIC_PG.database],
      ];
      if (options.hostCanaryPath) {
        envPairs.push(["STOCKY_CANARY_PATH", options.hostCanaryPath]);
      }
      const nodeArgs = probeNodeArgs({
        network,
        subjectDir,
        probeDir,
        envPairs,
        image: pinnedImage(IMAGE_PINS.node),
      });
      for (const key of SECRET_ENV_DENY) {
        if (nodeArgs.some((a) => String(a).includes(key))) {
          return {
            ok: true,
            probe,
            executor: isolationUnavailable("refusing to pass denied secret env into probe"),
          };
        }
      }
      r = docker(dockerBin, nodeArgs, { timeout: probe.timeout_seconds * 1000 + 5000 });
    } else {
      return {
        ok: true,
        probe,
        executor: executorResult({
          backend: "control",
          isolation: "docker",
          exit_code: 1,
          tests_run: 0,
          stdout: "",
          stderr: "zero tests selected",
        }),
      };
    }

    const timed_out = r.error?.code === "ETIMEDOUT" || r.signal === "SIGTERM" || r.signal === "SIGKILL";
    return {
      ok: true,
      probe,
      executor: executorResult({
        backend: "docker",
        isolation: "docker",
        exit_code: r.status ?? 1,
        timed_out,
        stdout: r.stdout,
        stderr: r.stderr,
        tests_run: 1,
        duration_ms: Date.now() - started,
        image_pins: {
          postgres: pinnedImage(IMAGE_PINS.postgres),
          redis: pinnedImage(IMAGE_PINS.redis),
          node: pinnedImage(IMAGE_PINS.node),
        },
      }),
      workDir,
    };
  } finally {
    docker(dockerBin, ["rm", "-f", pgName, redisName], { timeout: 20_000 });
    docker(dockerBin, ["network", "rm", network], { timeout: 20_000 });
  }
}

export { PRELOAD_SRC, REDIS_KEY_PREFIX };
