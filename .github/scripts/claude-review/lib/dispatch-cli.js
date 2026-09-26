import fs from "node:fs";
import path from "node:path";
import { dispatchValidate, prepareStateDir, rewriteMcpConfig } from "./dispatch.js";
import { buildTrustedResultComment, publishFromState } from "./publisher.js";
import { snapshotSubjectTarball as snapshotSubjectTarballDefault } from "./evidence.js";
import { bindAuthorityComment, fetchIssueComment, fetchCommentHistory } from "./authority.js";
import { reduceControlState, renderLockMarker } from "./session.js";
import { REPOSITORY } from "./constants.js";
import { githubOutput } from "./util.js";

export function repoParts() {
  const [owner, repo] = REPOSITORY.split("/");
  return { owner, repo };
}

export async function postLock(github, issueNumber, lease, extra = "") {
  if (!github || !issueNumber || !lease) return { ok: false, code: "lock_post_skipped" };
  const { owner, repo } = repoParts();
  const body = `${renderLockMarker(lease)}\n${extra}`.trim();
  const comment = await github.mutate("POST", `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    body,
  });
  return { ok: true, comment };
}

export function writeDecision(stateDir, decision) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, "decision.json"), JSON.stringify(decision, null, 2));
}

function emitGithubOutput(env, outputs) {
  const body = Object.entries(outputs)
    .map(([k, v]) => githubOutput(k, v))
    .join("");
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, body);
  return body;
}

function readPrompt(dir) {
  const p = path.join(dir, "prompt.txt");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

export async function assertLeaseStillValid(decision, github, { env = process.env, stateDir } = {}) {
  if (!decision?.lease || !decision.work_order) {
    return { ok: false, code: "missing_lease", message: "assert-lease requires decision lease" };
  }
  if (!github) {
    return { ok: false, code: "permission_unverified", message: "assert-lease requires GitHub" };
  }
  const { owner, repo } = repoParts();
  const issueNumber = env.ISSUE_NUMBER || decision.event?.issue_number;
  const history = await fetchCommentHistory(github, { owner, repo, issueNumber });
  if (!history.ok) return history;
  const control = reduceControlState(history.comments, {
    dispatchKey: decision.work_order.dispatch_key,
    taskId: decision.work_order.task_id,
    thread: issueNumber,
  });
  if (!control.ok) return control;
  if (control.stopped) {
    return { ok: false, code: "stopped", message: "STOP observed before model invocation" };
  }
  const existing = control.lease;
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

/**
 * Phase runner used by production CLI and credential-free tests.
 * Tests inject `github` via DI. Production bin refuses mock/proof env first.
 */
export async function runDispatchPhase({
  phase,
  env = process.env,
  github = null,
  stateDir,
  snapshotSubjectTarball = snapshotSubjectTarballDefault,
} = {}) {
  if (phase === "validate") {
    const decision = await dispatchValidate({ github, env });
    writeDecision(stateDir, decision);
    prepareStateDir(stateDir, decision);

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
        if (decision.lease) decision.lease.status = "blocked";
        writeDecision(stateDir, decision);
      }
    }

    if (decision.post_lock && decision.lease && github && env.ISSUE_NUMBER) {
      try {
        const posted = await postLock(
          github,
          env.ISSUE_NUMBER,
          decision.lease,
          "lease recorded by trusted dispatcher",
        );
        if (!posted.ok) {
          throw new Error(posted.code || "lock_post_skipped");
        }
      } catch (err) {
        decision.invoke_claude = false;
        decision.code = "lease_lock_unacked";
        decision.message = err?.message || "failed to persist lease lock";
        decision.rejected = true;
        if (decision.lease && decision.lease.status !== "blocked" && decision.lease.status !== "stopped") {
          decision.lease.status = "unknown";
        }
        writeDecision(stateDir, decision);
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
    if (env.GITHUB_OUTPUT) {
      emitGithubOutput(env, outputs);
    } else {
      process.stdout.write(decision.github_output || JSON.stringify(decision, null, 2));
    }
    return decision;
  }

  if (phase === "assert-lease") {
    const decision = JSON.parse(fs.readFileSync(path.join(stateDir, "decision.json"), "utf8"));
    const proceed = await assertLeaseStillValid(decision, github, { env, stateDir });
    if (env.GITHUB_OUTPUT) {
      emitGithubOutput(env, {
        proceed: String(proceed.ok),
        code: proceed.code || "",
        message: proceed.message || "",
      });
    } else {
      process.stdout.write(JSON.stringify(proceed, null, 2) + "\n");
    }
    return proceed;
  }

  if (phase === "rewrite-mcp") {
    const cfg = rewriteMcpConfig(stateDir);
    process.stdout.write(JSON.stringify({ ok: true, mcp: cfg }, null, 2) + "\n");
    return { ok: true, mcp: cfg };
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
      incomplete_output: probes.filter((p) => p.executor?.output_incomplete || p.executor?.output_truncated)
        .length,
      has_model_result: fs.existsSync(modelPath),
      has_checkpoint: fs.existsSync(checkpointPath),
    };
    fs.writeFileSync(path.join(stateDir, "executor-summary.json"), JSON.stringify(summary, null, 2));
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
    return summary;
  }

  if (phase === "publish-from-state") {
    const result = await publishFromState({
      stateDir,
      github,
      issueNumber: env.ISSUE_NUMBER,
      repoDir: env.STOCKY_PUBLISH_REPO_DIR || "",
      publishBranch: env.STOCKY_PUBLISH_BRANCH === "1",
    });
    process.stdout.write(
      JSON.stringify(
        {
          ok: result.ok,
          code: result.code,
          status: result.combined?.status,
          reason: result.combined?.reason,
          posted: Boolean(result.comment),
        },
        null,
        2,
      ) + "\n",
    );
    return result;
  }

  if (phase === "publish-reject") {
    const decision = JSON.parse(fs.readFileSync(path.join(stateDir, "decision.json"), "utf8"));
    const body = buildTrustedResultComment({
      lease: decision.lease || {
        dispatch_key: "propo:none",
        task_id: "none",
        attempt: "none",
        head: "0".repeat(40),
        status: "rejected",
      },
      combined: { status: decision.code || "REJECTED", reason: decision.message || "" },
      executor: [],
      modelText: "",
    });
    fs.writeFileSync(path.join(stateDir, "result-comment.md"), body);
    if (github && env.ISSUE_NUMBER) {
      const { owner, repo } = repoParts();
      await github.mutate("POST", `/repos/${owner}/${repo}/issues/${env.ISSUE_NUMBER}/comments`, {
        body,
      });
    }
    process.stdout.write(body);
    return { ok: true, body };
  }

  throw new Error(`unknown phase ${phase}`);
}
