#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { dispatchValidate, prepareStateDir, rewriteMcpConfig, writeGithubOutput } from "../lib/dispatch.js";
import { createGithubClient } from "../lib/github-client.js";
import { buildResultComment, publishFromState } from "../lib/publisher.js";
import { snapshotSubjectTarball } from "../lib/evidence.js";
import {
  bindAuthorityComment,
  fetchIssueComment,
  fetchIssueComments,
} from "../lib/authority.js";
import { leaseFromComments, renderLockMarker, stopFromComments } from "../lib/session.js";
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

function repoParts() {
  const [owner, repo] = REPOSITORY.split("/");
  return { owner, repo };
}

async function postLock(github, issueNumber, lease, extra = "") {
  if (!github || !issueNumber || !lease) return { ok: false, code: "lock_post_skipped" };
  const { owner, repo } = repoParts();
  const body = `${renderLockMarker(lease)}\n${extra}`.trim();
  const comment = await github.mutate("POST", `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    body,
  });
  return { ok: true, comment };
}

function writeDecision(decision) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, "decision.json"), JSON.stringify(decision, null, 2));
}

async function main() {
  if (phase === "validate") {
    const github = githubFromEnv();
    const decision = await dispatchValidate({ github });
    writeDecision(decision);
    prepareStateDir(stateDir, decision);
    if (decision.post_lock && decision.lease && github && process.env.ISSUE_NUMBER) {
      try {
        await postLock(github, process.env.ISSUE_NUMBER, decision.lease, "lease recorded by trusted dispatcher");
      } catch (err) {
        decision.invoke_claude = false;
        decision.code = "lease_lock_unacked";
        decision.message = err?.message || "failed to persist lease lock";
        decision.rejected = true;
        writeDecision(decision);
      }
    }
    if (decision.ok && decision.mode === "executable_review" && decision.invoke_claude && github) {
      const { owner, repo } = repoParts();
      const snap = await snapshotSubjectTarball(github, {
        owner,
        repo,
        sha: decision.work_order.subject.head,
        dest: path.join(stateDir, "subject-extract"),
      });
      fs.writeFileSync(path.join(stateDir, "subject-root.json"), JSON.stringify(snap, null, 2));
      if (snap.ok) {
        fs.cpSync(snap.dest, path.join(stateDir, "subject"), { recursive: true });
      } else {
        decision.invoke_claude = false;
        decision.rejected = true;
        decision.code = snap.code || "snapshot_failed";
        decision.message = snap.message || "exact-SHA subject snapshot failed";
        writeDecision(decision);
      }
    }
    const outputs = {
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
      dispatch_key: decision.work_order?.dispatch_key || decision.lease?.dispatch_key || "",
    };
    if (process.env.GITHUB_OUTPUT) {
      writeGithubOutput(outputs);
    } else {
      process.stdout.write(decision.github_output || JSON.stringify(decision, null, 2));
    }
    if (!decision.ok && !process.env.GITHUB_OUTPUT) process.exit(2);
    return;
  }
  if (phase === "assert-lease") {
    const github = githubFromEnv();
    const decision = JSON.parse(fs.readFileSync(path.join(stateDir, "decision.json"), "utf8"));
    const proceed = await assertLeaseStillValid(decision, github);
    if (process.env.GITHUB_OUTPUT) {
      writeGithubOutput({
        proceed: String(proceed.ok),
        code: proceed.code || "",
        message: proceed.message || "",
      });
    } else {
      process.stdout.write(JSON.stringify(proceed, null, 2) + "\n");
    }
    if (!proceed.ok) process.exit(2);
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
    const checkpointPath = path.join(stateDir, "checkpoint.json");
    const modelPath = path.join(stateDir, "model-result.md");
    const modelCandidate = path.join(stateDir, "work", "model-result.md");
    if (fs.existsSync(modelCandidate) && !fs.existsSync(modelPath)) {
      fs.copyFileSync(modelCandidate, modelPath);
    }
    const workCheckpoint = path.join(stateDir, "work", "checkpoint.json");
    if (fs.existsSync(workCheckpoint) && !fs.existsSync(checkpointPath)) {
      fs.copyFileSync(workCheckpoint, checkpointPath);
    }
    const summary = {
      collected_at: new Date().toISOString(),
      probe_count: probes.length,
      isolations: probes.map((p) => p.executor?.isolation || p.executor?.backend),
      backends: probes.map((p) => p.executor?.backend),
      timed_out: probes.filter((p) => p.executor?.timed_out).length,
      has_model_result: fs.existsSync(modelPath),
      has_checkpoint: fs.existsSync(checkpointPath),
    };
    fs.writeFileSync(path.join(stateDir, "executor-summary.json"), JSON.stringify(summary, null, 2));
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
      const { owner, repo } = repoParts();
      await github.mutate("POST", `/repos/${owner}/${repo}/issues/${process.env.ISSUE_NUMBER}/comments`, {
        body,
      });
    }
    process.stdout.write(body);
    return;
  }
  throw new Error(`unknown phase ${phase}`);
}

async function assertLeaseStillValid(decision, github) {
  if (!decision?.lease || !decision.work_order) {
    return { ok: false, code: "missing_lease", message: "assert-lease requires decision lease" };
  }
  if (!github) {
    return { ok: false, code: "permission_unverified", message: "assert-lease requires GitHub" };
  }
  const { owner, repo } = repoParts();
  const issueNumber = process.env.ISSUE_NUMBER || decision.event?.issue_number;
  const comments = await fetchIssueComments(github, { owner, repo, issueNumber });
  const stopped = stopFromComments(comments, {
    dispatchKey: decision.work_order.dispatch_key,
    taskId: decision.work_order.task_id,
  });
  if (stopped) {
    return { ok: false, code: "stopped", message: "STOP observed before model invocation" };
  }
  const existing = leaseFromComments(comments, {
    dispatchKey: decision.work_order.dispatch_key,
    taskId: decision.work_order.task_id,
  });
  if (existing?.status === "stopped") {
    return { ok: false, code: "stopped", message: "lease is stopped" };
  }
  if (
    existing &&
    existing.attempt &&
    existing.attempt !== decision.lease.attempt &&
    (existing.status === "running" || existing.status === "leased" || existing.status === "completed")
  ) {
    return { ok: false, code: "duplicate_dispatch", message: "another attempt owns the task key" };
  }
  const comment = await fetchIssueComment(github, {
    owner,
    repo,
    commentId: decision.work_order.authority_comment_id,
  });
  const bound = bindAuthorityComment(decision.work_order, comment);
  if (!bound.ok) return bound;
  const capturePath = path.join(stateDir, "authority-capture.json");
  if (fs.existsSync(capturePath)) {
    const captured = JSON.parse(fs.readFileSync(capturePath, "utf8"));
    if (captured.body_sha256 && captured.body_sha256 !== bound.captured.body_sha256) {
      return { ok: false, code: "authority_edited", message: "authority hash drifted after capture" };
    }
  }
  return { ok: true, code: "", message: "lease valid" };
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
