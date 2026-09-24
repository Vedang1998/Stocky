import fs from "node:fs";
import path from "node:path";
import { readEvidence, readSubjectFile } from "./evidence.js";
import { runProbe } from "./sandbox.js";
import { checkpoint } from "./session.js";
import { classifyExecutorResult } from "./verdict.js";
import { looksLikeGateOverride, sanitizePublicText } from "./sanitize.js";
import { MAX_MODEL_RESULT_BYTES, MAX_PROBES, SECRET_ENV_DENY } from "./constants.js";

/**
 * Minimal MCP stdio broker. Tools only. No GitHub token. No OAuth.
 * run_probe always uses the digest-pinned Docker executor.
 * submit_result writes a bounded file for the trusted publisher; it does not
 * call the GitHub API.
 */
export function scrubBrokerEnv(env = process.env) {
  for (const key of SECRET_ENV_DENY) {
    if (key in env) delete env[key];
  }
}

function persistDirOf(state) {
  if (state.stateDir) return state.stateDir;
  if (state.workDir) return path.dirname(state.workDir);
  return null;
}

export function createBroker(state) {
  const probes = [];
  const persistDir = persistDirOf(state);
  function persist() {
    if (!persistDir) return;
    fs.mkdirSync(persistDir, { recursive: true });
    fs.writeFileSync(path.join(persistDir, "probes.json"), JSON.stringify(probes, null, 2));
  }
  function getEvidence(args) {
    const name = String(args?.name ?? "");
    if (!name) return { ok: false, code: "missing_evidence_name" };
    return readEvidence(state.evidenceDir, name);
  }
  function readSubject(args) {
    const rel = String(args?.path ?? "");
    return readSubjectFile(state.subjectRoot, rel);
  }
  function run(args) {
    if (
      args &&
      typeof args === "object" &&
      ("isolationMode" in args || "dockerBin" in args || "disablePreload" in args)
    ) {
      return { ok: false, code: "probe_extra_keys", message: "model cannot select isolation mode" };
    }
    if (probes.length >= (state.maxProbes ?? MAX_PROBES)) {
      return { ok: false, code: "probe_quota", message: "max_probes exhausted" };
    }
    const result = runProbe(args, {
      isolationMode: "docker",
      requireProvenance: true,
      provenance: state.provenance,
      probe_index: probes.length + 1,
      maxProbes: state.maxProbes ?? MAX_PROBES,
      subjectRoot: state.subjectRoot,
      workDir: path.join(state.workDir || persistDir || "/tmp", `probe-${probes.length + 1}`),
      limits: { max_sandbox_seconds: state.maxSandboxSeconds },
      dockerBin: state.dockerBin,
    });
    if (result.ok) {
      const classified = classifyExecutorResult(result.probe, result.executor);
      probes.push({ ...result, classified });
      persist();
      return { ok: true, probe: result.probe, executor: result.executor, classified };
    }
    probes.push(result);
    persist();
    return result;
  }
  function saveCheckpoint(args) {
    const cp = checkpoint(
      { note: String(args?.note ?? "").slice(0, 1000), probes: probes.length },
      args?.reason || "manual",
    );
    if (persistDir) {
      fs.mkdirSync(persistDir, { recursive: true });
      fs.writeFileSync(path.join(persistDir, "checkpoint.json"), JSON.stringify(cp, null, 2));
    }
    return { ok: true, checkpoint: cp };
  }
  function submitResult(args) {
    if (!args || typeof args !== "object" || Array.isArray(args)) {
      return { ok: false, code: "invalid_submit_result", message: "submit_result requires an object" };
    }
    const extra = Object.keys(args).filter((k) => k !== "markdown");
    if (extra.length) {
      return { ok: false, code: "submit_result_extra_keys", extra };
    }
    const markdown = String(args.markdown ?? "");
    const bytes = Buffer.byteLength(markdown, "utf8");
    if (bytes > MAX_MODEL_RESULT_BYTES) {
      return { ok: false, code: "model_result_too_large", bytes };
    }
    if (looksLikeGateOverride(markdown)) {
      return { ok: false, code: "artifact_gate_override", message: "model result tries to alter gates" };
    }
    if (!persistDir) {
      return { ok: false, code: "missing_state_dir", message: "submit_result needs a state directory" };
    }
    fs.mkdirSync(persistDir, { recursive: true });
    const dest = path.join(persistDir, "model-result.md");
    fs.writeFileSync(dest, sanitizePublicText(markdown, MAX_MODEL_RESULT_BYTES));
    persist();
    return { ok: true, bytes, path: "model-result.md" };
  }
  return {
    tools: {
      get_evidence: getEvidence,
      read_subject: readSubject,
      run_probe: run,
      checkpoint: saveCheckpoint,
      submit_result: submitResult,
    },
    probes,
    persistDir,
  };
}

export function handleJsonRpc(broker, message) {
  const id = message.id ?? null;
  if (message.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "stocky_review", version: "1.0.0" },
      },
    };
  }
  if (message.method === "notifications/initialized") {
    return null;
  }
  if (message.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "get_evidence",
            description: "Read a file from the trusted evidence pack",
            inputSchema: {
              type: "object",
              properties: { name: { type: "string" } },
              required: ["name"],
            },
          },
          {
            name: "read_subject",
            description: "Read a file from the exact-SHA subject snapshot",
            inputSchema: {
              type: "object",
              properties: { path: { type: "string" } },
              required: ["path"],
            },
          },
          {
            name: "run_probe",
            description: "Run one typed sandbox probe in the isolated executor",
            inputSchema: { type: "object" },
          },
          {
            name: "checkpoint",
            description: "Persist a bounded checkpoint",
            inputSchema: {
              type: "object",
              properties: { note: { type: "string" }, reason: { type: "string" } },
            },
          },
          {
            name: "submit_result",
            description:
              "Submit bounded markdown findings for trusted publication. Does not write to GitHub.",
            inputSchema: {
              type: "object",
              properties: { markdown: { type: "string" } },
              required: ["markdown"],
              additionalProperties: false,
            },
          },
        ],
      },
    };
  }
  if (message.method === "tools/call") {
    const name = message.params?.name;
    const args = message.params?.arguments ?? {};
    const fn = broker.tools[name];
    if (!fn) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `unknown tool ${name}` },
      };
    }
    const result = fn(args);
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: result?.ok === false,
      },
    };
  }
  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `unknown method ${message.method}` },
  };
}

export function mcpConfig({ brokerPath, stateDir }) {
  return {
    mcpServers: {
      stocky_review: {
        command: process.execPath,
        args: [brokerPath, "--state-dir", stateDir],
        env: {
          STOCKY_REVIEW_STATE_DIR: stateDir,
        },
      },
    },
  };
}
