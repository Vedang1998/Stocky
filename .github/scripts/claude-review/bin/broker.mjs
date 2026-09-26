#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createBroker, handleJsonRpc, scrubBrokerEnv } from "../lib/mcp-broker.js";

const stateDir = process.env.STOCKY_REVIEW_STATE_DIR || argValue("--state-dir") || "/tmp/stocky-review";
const decisionPath = path.join(stateDir, "decision.json");
const decision = fs.existsSync(decisionPath)
  ? JSON.parse(fs.readFileSync(decisionPath, "utf8"))
  : {};
const provenancePath = path.join(stateDir, "provenance.json");
const provenanceFile = fs.existsSync(provenancePath)
  ? JSON.parse(fs.readFileSync(provenancePath, "utf8"))
  : {};

scrubBrokerEnv(process.env);

const broker = createBroker({
  evidenceDir: path.join(stateDir, "evidence"),
  subjectRoot: path.join(stateDir, "subject"),
  stateDir,
  workDir: path.join(stateDir, "work"),
  maxProbes: decision.work_order?.max_probes ?? provenanceFile.max_probes ?? 2,
  maxSandboxSeconds: decision.work_order?.max_sandbox_seconds ?? provenanceFile.max_sandbox_seconds ?? 1200,
  provenance: {
    task_id: provenanceFile.task_id || decision.work_order?.task_id,
    attempt: provenanceFile.attempt || decision.lease?.attempt,
    dispatch_key: provenanceFile.dispatch_key || decision.work_order?.dispatch_key,
    authority_comment_id:
      provenanceFile.authority_comment_id || decision.work_order?.authority_comment_id,
    head: provenanceFile.head || decision.work_order?.subject?.head,
    base: provenanceFile.base || decision.work_order?.subject?.base,
    pr: provenanceFile.pr || decision.work_order?.subject?.pr,
    max_probes: provenanceFile.max_probes || decision.work_order?.max_probes || 2,
    max_sandbox_seconds:
      provenanceFile.max_sandbox_seconds || decision.work_order?.max_sandbox_seconds || 1200,
  },
});

if (process.argv.includes("--call")) {
  const name = argValue("--call");
  const args = JSON.parse(argValue("--args") || "{}");
  const fn = broker.tools[name];
  if (!fn) {
    console.error(`unknown tool ${name}`);
    process.exit(2);
  }
  process.stdout.write(JSON.stringify(fn(args), null, 2) + "\n");
  process.exit(0);
}

process.stdin.setEncoding("utf8");
let buf = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  buf = Buffer.concat([buf, Buffer.from(chunk)]);
  while (true) {
    const headerEnd = buf.indexOf("\r\n\r\n");
    if (headerEnd < 0) break;
    const header = buf.subarray(0, headerEnd).toString("utf8");
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buf = buf.subarray(headerEnd + 4);
      continue;
    }
    const len = Number(match[1]);
    const bodyStart = headerEnd + 4;
    if (buf.length < bodyStart + len) break;
    const json = buf.subarray(bodyStart, bodyStart + len).toString("utf8");
    buf = buf.subarray(bodyStart + len);
    let message;
    try {
      message = JSON.parse(json);
    } catch {
      continue;
    }
    const response = handleJsonRpc(broker, message);
    if (response) writeMessage(response);
  }
});

function writeMessage(obj) {
  const json = JSON.stringify(obj);
  const payload = Buffer.from(json, "utf8");
  process.stdout.write(`Content-Length: ${payload.length}\r\n\r\n`);
  process.stdout.write(payload);
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : "";
}

void readline;
