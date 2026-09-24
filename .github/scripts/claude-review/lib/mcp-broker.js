import fs from "node:fs";
import path from "node:path";
import { readEvidence, readSubjectFile } from "./evidence.js";
import { runProbe } from "./sandbox.js";
import { checkpoint } from "./session.js";
import { classifyExecutorResult } from "./verdict.js";
import { MAX_PROBES } from "./constants.js";

/**
 * Minimal MCP stdio broker. Tools only. No GitHub token. No OAuth.
 */
export function createBroker(state) {
  const probes = [];
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
    if (probes.length >= (state.maxProbes ?? MAX_PROBES)) {
      return { ok: false, code: "probe_quota", message: "max_probes exhausted" };
    }
    const result = runProbe(args, {
      subjectRoot: state.subjectRoot,
      workDir: path.join(state.workDir, `probe-${probes.length + 1}`),
      limits: { max_sandbox_seconds: state.maxSandboxSeconds },
      pg: state.pg,
      redis: state.redis,
    });
    if (result.ok) {
      const classified = classifyExecutorResult(result.probe, result.executor);
      probes.push({ ...result, classified });
      return { ok: true, probe: result.probe, executor: result.executor, classified };
    }
    probes.push(result);
    return result;
  }
  function saveCheckpoint(args) {
    const cp = checkpoint(
      { note: String(args?.note ?? "").slice(0, 1000), probes: probes.length },
      args?.reason || "manual",
    );
    const dest = path.join(state.workDir, "checkpoint.json");
    fs.writeFileSync(dest, JSON.stringify(cp, null, 2));
    return { ok: true, checkpoint: cp };
  }
  return {
    tools: {
      get_evidence: getEvidence,
      read_subject: readSubject,
      run_probe: run,
      checkpoint: saveCheckpoint,
    },
    probes,
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
            description: "Run one typed sandbox probe",
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
