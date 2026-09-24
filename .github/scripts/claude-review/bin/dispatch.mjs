#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { dispatchValidate, prepareStateDir, rewriteMcpConfig, writeGithubOutput } from "../lib/dispatch.js";
import { createGithubClient } from "../lib/github-client.js";
import { buildResultComment, publishFromState } from "../lib/publisher.js";
import { snapshotSubjectTarball } from "../lib/evidence.js";
import { OWNER_LOGIN, REPOSITORY } from "../lib/constants.js";

const phase = process.argv.includes("--phase")
  ? process.argv[process.argv.indexOf("--phase") + 1]
  : "validate";

const stateDir =
  process.env.STOCKY_REVIEW_STATE_DIR ||
  path.join(process.env.RUNNER_TEMP || "/tmp", "stocky-review");

function githubFromEnv() {
  const token = process.env.GITHUB_TOKEN || "";
  if (process.env.STOCKY_REVIEW_MOCK_GITHUB_URL) {
    return createGithubClient({
      baseUrl: process.env.STOCKY_REVIEW_MOCK_GITHUB_URL,
      token,
    });
  }
  return token ? createGithubClient({ token }) : null;
}

async function main() {
  if (phase === "validate") {
    const github = githubFromEnv();
    const decision = await dispatchValidate({ github });
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, "decision.json"), JSON.stringify(decision, null, 2));
    prepareStateDir(stateDir, decision);
    if (decision.ok && decision.mode === "executable_review" && decision.invoke_claude && github) {
      const [owner, repo] = REPOSITORY.split("/");
      const snap = await snapshotSubjectTarball(github, {
        owner,
        repo,
        sha: decision.work_order.subject.head,
        dest: path.join(stateDir, "subject-extract"),
      });
      fs.writeFileSync(path.join(stateDir, "subject-root.json"), JSON.stringify(snap, null, 2));
      if (snap.ok) {
        fs.cpSync(snap.dest, path.join(stateDir, "subject"), { recursive: true });
      }
    }
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
    if (!decision.ok && !process.env.GITHUB_OUTPUT) process.exit(2);
    return;
  }
  if (phase === "rewrite-mcp") {
    const cfg = rewriteMcpConfig(stateDir);
    process.stdout.write(JSON.stringify({ ok: true, mcp: cfg }, null, 2) + "\n");
    return;
  }
  if (phase === "collect-executor") {
    const probesPath = path.join(stateDir, "probes.json");
    const probes = fs.existsSync(probesPath)
      ? JSON.parse(fs.readFileSync(probesPath, "utf8"))
      : [];
    const summary = {
      collected_at: new Date().toISOString(),
      probe_count: probes.length,
      isolations: probes.map((p) => p.executor?.isolation || p.executor?.backend),
      backends: probes.map((p) => p.executor?.backend),
    };
    fs.writeFileSync(path.join(stateDir, "executor-summary.json"), JSON.stringify(summary, null, 2));
    const modelCandidate = path.join(stateDir, "work", "model-result.md");
    if (fs.existsSync(modelCandidate) && !fs.existsSync(path.join(stateDir, "model-result.md"))) {
      fs.copyFileSync(modelCandidate, path.join(stateDir, "model-result.md"));
    }
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
    return;
  }
  if (phase === "publish-from-state") {
    const github = githubFromEnv();
    const result = await publishFromState({
      stateDir,
      github,
      issueNumber: process.env.ISSUE_NUMBER,
      repoDir: process.env.STOCKY_PUBLISH_REPO_DIR || "",
      publishBranch: process.env.STOCKY_PUBLISH_BRANCH === "1",
    });
    process.stdout.write(JSON.stringify({ ok: result.ok, code: result.code, status: result.combined?.status, reason: result.combined?.reason }, null, 2) + "\n");
    if (!result.ok) process.exit(2);
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
    const github = githubFromEnv();
    if (github && process.env.ISSUE_NUMBER) {
      const [owner, repoName] = REPOSITORY.split("/");
      await github.mutate("POST", `/repos/${owner}/${repoName}/issues/${process.env.ISSUE_NUMBER}/comments`, {
        body,
      });
    }
    process.stdout.write(body);
    return;
  }
  throw new Error(`unknown phase ${phase}`);
}

function readPrompt(dir) {
  const p = path.join(dir, "prompt.txt");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

void OWNER_LOGIN;

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
