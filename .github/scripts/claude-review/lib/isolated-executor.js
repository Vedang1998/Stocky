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

export function proofMutation() {
  if (process.env.STOCKY_ISOLATION_PROOF !== "1") return "";
  return String(process.env.STOCKY_ISOLATION_PROOF_MUTATION || "");
}

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
    leftovers: partial.leftovers,
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
    timeout: options.timeout ?? 30_000,
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

function sleepMs(ms) {
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}

function waitForExec(dockerBin, args, timeoutMs, ok = (r) => r.status === 0) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const r = docker(dockerBin, args, { timeout: 15_000 });
    if (ok(r)) return true;
    sleepMs(250);
  }
  return false;
}

export function dockerNetworkCreateArgs(name) {
  const args = [
    "network",
    "create",
    "--driver",
    "bridge",
    "--internal",
    "--label",
    `stocky.review=${name}`,
  ];
  if (proofMutation() !== "omit-gateway-isolated") {
    args.push(
      "--opt",
      "com.docker.network.bridge.enable_ip_masquerade=false",
      "--opt",
      "com.docker.network.bridge.gateway_mode_ipv4=isolated",
    );
  }
  args.push(name);
  return args;
}

export function leftoverResources(dockerBin, prefix) {
  const ps = docker(
    dockerBin,
    ["ps", "-a", "--filter", `name=${prefix}`, "--format", "{{.Names}}"],
    { timeout: 10_000 },
  );
  const nets = docker(
    dockerBin,
    ["network", "ls", "--filter", `name=${prefix}`, "--format", "{{.Name}}"],
    { timeout: 10_000 },
  );
  const labeled = docker(
    dockerBin,
    ["ps", "-a", "--filter", `label=stocky.review=${prefix}`, "--format", "{{.Names}}"],
    { timeout: 10_000 },
  );
  const containers = new Set(
    `${ps.stdout || ""}\n${labeled.stdout || ""}`
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const networks = (nets.stdout || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return { containers: [...containers], networks };
}

export function cleanupPrefix(dockerBin, prefix) {
  docker(dockerBin, ["rm", "-f", `${prefix}pg`, `${prefix}rd`, `${prefix}pr`], { timeout: 20_000 });
  const left = leftoverResources(dockerBin, prefix);
  if (left.containers.length) {
    docker(dockerBin, ["rm", "-f", ...left.containers], { timeout: 20_000 });
  }
  docker(dockerBin, ["network", "rm", prefix], { timeout: 20_000 });
  return leftoverResources(dockerBin, prefix);
}

function waitNamedContainer(dockerBin, name, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const r = docker(
      dockerBin,
      ["inspect", "-f", "{{.State.Running}} {{.State.ExitCode}}", name],
      { timeout: 5_000 },
    );
    if (r.status === 0) {
      const [running, exitCode] = (r.stdout || "").trim().split(/\s+/);
      if (running === "false") {
        return { timed_out: false, exit_code: Number(exitCode) || 0 };
      }
    }
    sleepMs(200);
  }
  return { timed_out: true, exit_code: 124 };
}

/**
 * Detached named run + inspect poll + SIGKILL. Do not use attached spawnSync
 * timeout against `docker run` of untrusted PID 1 (sig-proxy hang).
 */
export function runDetachedThenWait(dockerBin, args, { name, timeoutMs }) {
  const started = docker(dockerBin, args, { timeout: 30_000 });
  if (started.status !== 0) {
    return {
      status: started.status ?? 1,
      stdout: "",
      stderr: started.stderr || started.error?.message || "docker run -d failed",
      timed_out: false,
      provisioning_failed: true,
    };
  }
  const wait = waitNamedContainer(dockerBin, name, timeoutMs);
  const mutation = proofMutation();
  if (wait.timed_out && mutation !== "skip-kill") {
    docker(dockerBin, ["kill", "-s", "KILL", name], { timeout: 10_000 });
  }
  const logs = docker(dockerBin, ["logs", name], { timeout: 15_000 });
  if (mutation !== "skip-cleanup") {
    docker(dockerBin, ["rm", "-f", name], { timeout: 15_000 });
  }
  return {
    status: wait.timed_out ? 124 : wait.exit_code,
    stdout: logs.stdout,
    stderr: logs.stderr,
    timed_out: wait.timed_out,
    provisioning_failed: false,
  };
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
    "--label",
    `stocky.review=${network}`,
  ];
  for (const [k, v] of envPairs) {
    args.push("-e", `${k}=${v}`);
  }
  args.push(image);
  return args;
}

function commonProbeArgs({ name, network }) {
  return [
    "run",
    "-d",
    "--name",
    name,
    "--init",
    "--stop-timeout",
    "1",
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
    "--label",
    `stocky.review=${network}`,
  ];
}

function probeNodeArgs({ name, network, subjectDir, probeDir, envPairs, image }) {
  const args = [
    ...commonProbeArgs({ name, network }),
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

function imagePins() {
  return {
    postgres: pinnedImage(IMAGE_PINS.postgres),
    redis: pinnedImage(IMAGE_PINS.redis),
    node: pinnedImage(IMAGE_PINS.node),
  };
}

/**
 * Production executor. Untrusted probe code runs only inside digest-pinned
 * containers on an --internal isolated-gateway network. Host spawnSync is used
 * solely for the trusted `docker` CLI and never as the probe timeout mechanism.
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
  const probeName = `${id}pr`;
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

  const started = Date.now();
  const mutation = proofMutation();
  try {
    const net = docker(dockerBin, dockerNetworkCreateArgs(network));
    if (net.status !== 0) {
      return {
        ok: true,
        probe,
        executor: isolationUnavailable(`network create failed: ${net.stderr}`),
      };
    }

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

    const rdArgs = sidecarArgs(network, redisName, "redis", [], pinnedImage(IMAGE_PINS.redis));
    const rd = docker(dockerBin, rdArgs, { timeout: 60_000 });
    if (rd.status !== 0) {
      return {
        ok: true,
        probe,
        executor: isolationUnavailable(`redis sidecar failed: ${rd.stderr}`),
      };
    }

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

    const timeoutMs = probe.timeout_seconds * 1000;
    let r;
    if (probe.kind === "sql") {
      r = runDetachedThenWait(
        dockerBin,
        [
          ...commonProbeArgs({ name: probeName, network }),
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
        { name: probeName, timeoutMs },
      );
    } else if (probe.kind === "redis") {
      const redisArgs =
        probe.redis.op === "PING"
          ? ["PING"]
          : probe.redis.op === "GET"
            ? ["GET", probe.redis.key]
            : ["SET", probe.redis.key, probe.redis.value];
      r = runDetachedThenWait(
        dockerBin,
        [
          ...commonProbeArgs({ name: probeName, network }),
          pinnedImage(IMAGE_PINS.redis),
          "redis-cli",
          "-h",
          "redis",
          ...redisArgs,
        ],
        { name: probeName, timeoutMs },
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
      if (options.hostListenerPort) {
        envPairs.push(["STOCKY_HOST_LISTENER_PORT", String(options.hostListenerPort)]);
      }
      const nodeArgs = probeNodeArgs({
        name: probeName,
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
      r = runDetachedThenWait(dockerBin, nodeArgs, { name: probeName, timeoutMs });
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

    const leftovers =
      mutation === "skip-cleanup" ? leftoverResources(dockerBin, id) : { containers: [], networks: [] };
    return {
      ok: true,
      probe,
      executor: executorResult({
        backend: "docker",
        isolation: "docker",
        exit_code: r.status ?? 1,
        timed_out: r.timed_out,
        provisioning_failed: Boolean(r.provisioning_failed),
        stdout: r.stdout,
        stderr: r.stderr,
        tests_run: 1,
        duration_ms: Date.now() - started,
        image_pins: imagePins(),
        leftovers,
      }),
      workDir,
      prefix: id,
    };
  } finally {
    if (mutation !== "skip-cleanup") {
      cleanupPrefix(dockerBin, id);
    }
  }
}

export { PRELOAD_SRC, REDIS_KEY_PREFIX, SYNTHETIC_REDIS };
