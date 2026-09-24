#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { dispatchValidate, prepareStateDir, writeGithubOutput } from "../lib/dispatch.js";
import { createGithubClient } from "../lib/github-client.js";
import { buildResultComment } from "../lib/publisher.js";
import { createBroker } from "../lib/mcp-broker.js";

const phase = process.argv.includes("--phase")
  ? process.argv[process.argv.indexOf("--phase") + 1]
  : "validate";

const stateDir =
  process.env.STOCKY_REVIEW_STATE_DIR ||
  path.join(process.env.RUNNER_TEMP || "/tmp", "stocky-review");

async function main() {
  if (phase === "validate") {
    const token = process.env.GITHUB_TOKEN || "";
    const github = process.env.STOCKY_REVIEW_MOCK_GITHUB_URL
      ? createGithubClient({
          baseUrl: process.env.STOCKY_REVIEW_MOCK_GITHUB_URL,
          token,
        })
      : token
        ? createGithubClient({ token })
        : null;
    const decision = await dispatchValidate({ github });
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, "decision.json"), JSON.stringify(decision, null, 2));
    prepareStateDir(stateDir, decision);
    if (process.env.GITHUB_OUTPUT) {
      writeGithubOutput({
        ok: String(Boolean(decision.ok)),
        mode: decision.mode || "rejected",
        invoke_claude: String(Boolean(decision.invoke_claude)),
        admitted: String(Boolean(decision.admitted)),
        prompt: decision.prompt || readPrompt(stateDir),
        allowed_tools: decision.allowed_tools || "",
        disallowed_tools: decision.disallowed_tools || "",
        state_dir: stateDir,
        code: decision.code || "",
        message: decision.message || "",
      });
    } else {
      process.stdout.write(decision.github_output || JSON.stringify(decision, null, 2));
    }
    if (!decision.ok) process.exit(2);
    return;
  }
  if (phase === "broker-self-check") {
    const raw = JSON.parse(fs.readFileSync(path.join(stateDir, "decision.json"), "utf8"));
    const broker = createBroker({
      evidenceDir: path.join(stateDir, "evidence"),
      subjectRoot: path.join(stateDir, "subject"),
      workDir: path.join(stateDir, "work"),
      maxProbes: raw.work_order?.max_probes ?? 2,
      maxSandboxSeconds: raw.work_order?.max_sandbox_seconds ?? 60,
    });
    fs.mkdirSync(path.join(stateDir, "work"), { recursive: true });
    const listed = broker.tools.get_evidence({ name: "README.txt" });
    fs.writeFileSync(path.join(stateDir, "broker-self-check.json"), JSON.stringify(listed, null, 2));
    return;
  }
  if (phase === "publish-reject") {
    const decision = JSON.parse(fs.readFileSync(path.join(stateDir, "decision.json"), "utf8"));
    const body = buildResultComment({
      lease: decision.lease || {
        dispatch_key: "propo:none",
        task_id: "none",
        attempt: "none",
        head: "0".repeat(40),
        status: "rejected",
      },
      status: decision.code || "REJECTED",
      body: `STOCKY_TASK_RESULT_V1\nStatus: REJECTED\nCode: ${decision.code || ""}\nMessage: ${decision.message || ""}\n`,
    });
    fs.writeFileSync(path.join(stateDir, "result-comment.md"), body);
    process.stdout.write(body);
    return;
  }
  throw new Error(`unknown phase ${phase}`);
}

function readPrompt(dir) {
  const p = path.join(dir, "prompt.txt");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
