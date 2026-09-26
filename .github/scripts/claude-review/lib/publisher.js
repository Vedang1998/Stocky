import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  EXPECTED_ARTIFACT_NAME,
  MAX_ARTIFACT_BYTES,
  OWNER_LOGIN,
  PUBLISH_STATE_FILES,
  REPOSITORY,
  REVIEW_BRANCH_PREFIX,
  REVIEW_PATH_PREFIX,
} from "./constants.js";
import { looksLikeGateOverride, sanitizePublicText } from "./sanitize.js";
import { parseTopLevelLockEnvelope, readbackMatches, reduceControlState, renderLockMarker } from "./session.js";
import { isFullSha, resultErr, resultOk, sha256Hex } from "./util.js";
import { detectStaleHead, fetchCommentHistory, fetchPull } from "./authority.js";
import { combineTaskVerdict, leaseStatusFromVerdict } from "./verdict.js";
import { renderInertOpinion } from "./inert.js";

export function validateArtifact({ name, content, taskId }) {
  if (name !== EXPECTED_ARTIFACT_NAME) {
    return resultErr("artifact_name_denied", "artifact name is not allowlisted");
  }
  if (typeof content !== "string") {
    return resultErr("artifact_type_denied", "artifact must be text");
  }
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > MAX_ARTIFACT_BYTES) {
    return resultErr("artifact_too_large", "artifact exceeds size cap", { bytes });
  }
  if (looksLikeGateOverride(content)) {
    return resultErr("artifact_gate_override", "artifact tries to alter gates or activate runner");
  }
  const rel = `${REVIEW_PATH_PREFIX}${taskId}/${EXPECTED_ARTIFACT_NAME}`;
  if (!rel.startsWith(REVIEW_PATH_PREFIX) || rel.includes("..")) {
    return resultErr("artifact_path_denied", rel);
  }
  return resultOk({
    path: rel,
    bytes,
    sha256: sha256Hex(content),
    content: sanitizePublicText(content, MAX_ARTIFACT_BYTES),
  });
}

export function validateBranchName(taskId, attempt) {
  const name = `${REVIEW_BRANCH_PREFIX}${taskId}/${attempt}`;
  if (name.includes("..") || name.includes("//")) {
    return resultErr("branch_name_denied", name);
  }
  if (name === "main" || name.startsWith("main/") || name === "HEAD") {
    return resultErr("branch_name_denied", name);
  }
  return resultOk({ branch: name });
}

function git(cwd, args) {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return r;
}

export function publishReviewBranch({
  repoDir,
  remote,
  subjectSha,
  taskId,
  attempt,
  artifactContent,
  allowExisting = false,
}) {
  if (!isFullSha(subjectSha)) {
    return resultErr("invalid_subject_sha", "subjectSha must be full SHA");
  }
  const artifact = validateArtifact({
    name: EXPECTED_ARTIFACT_NAME,
    content: artifactContent,
    taskId,
  });
  if (!artifact.ok) return artifact;
  const branch = validateBranchName(taskId, attempt);
  if (!branch.ok) return branch;

  const parent = git(repoDir, ["rev-parse", "--verify", `${subjectSha}^{commit}`]);
  if (parent.status !== 0) {
    return resultErr("missing_subject_parent", parent.stderr || parent.stdout);
  }

  const checkout = git(repoDir, ["checkout", "-B", branch.branch, subjectSha]);
  if (checkout.status !== 0) {
    return resultErr("checkout_failed", checkout.stderr);
  }
  const head = git(repoDir, ["rev-parse", "HEAD"]);
  if (head.stdout.trim() !== subjectSha) {
    return resultErr("foreign_parent", "branch HEAD is not the declared subject", {
      head: head.stdout.trim(),
      subjectSha,
    });
  }
  const rel = artifact.path;
  const abs = path.join(repoDir, rel);
  if (!abs.startsWith(path.resolve(repoDir) + path.sep)) {
    return resultErr("artifact_path_denied", rel);
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, artifact.content);
  git(repoDir, ["add", "--", rel]);
  const status = git(repoDir, ["status", "--porcelain"]);
  const lines = status.stdout.split("\n").filter(Boolean);
  for (const line of lines) {
    const p = line.slice(3);
    if (p !== rel) {
      return resultErr("unexpected_path_in_commit", p);
    }
  }
  const commit = git(repoDir, [
    "commit",
    "-m",
    `claude-review artifact ${taskId} ${attempt}`,
  ]);
  if (commit.status !== 0) {
    return resultErr("commit_failed", commit.stderr);
  }
  const newHead = git(repoDir, ["rev-parse", "HEAD"]).stdout.trim();
  const parents = git(repoDir, ["rev-list", "--parents", "-n", "1", "HEAD"])
    .stdout.trim()
    .split(/\s+/);
  // rev-list --parents: commit parent1 parent2
  if (parents[1] !== subjectSha) {
    return resultErr("foreign_parent", "commit parent is not the subject SHA", {
      parents,
    });
  }
  if (parents.length !== 2) {
    return resultErr("foreign_parent", "commit must have exactly one parent");
  }
  if (remote) {
    const push = git(repoDir, ["push", remote, `HEAD:refs/heads/${branch.branch}`]);
    if (push.status !== 0) {
      return resultErr("push_failed", push.stderr);
    }
  }
  return resultOk({
    branch: branch.branch,
    sha: newHead,
    parent: subjectSha,
    path: rel,
    artifact_sha256: artifact.sha256,
    allowExisting,
  });
}

export function refuseMainWrite(branch) {
  if (branch === "main" || branch === "refs/heads/main") {
    return resultErr("main_write_denied", "publisher must not write main");
  }
  return resultOk({ branch });
}

export function buildResultComment({ lease, status, body }) {
  return buildTrustedResultComment({
    lease: { ...lease, status },
    combined: { status, reason: "" },
    executor: [],
    modelText: body,
  });
}

export function buildTrustedResultComment({ lease, combined, executor, modelText }) {
  const status = leaseStatusFromVerdict(combined, lease);
  const marker = renderLockMarker({ ...lease, status });
  const machine = [
    "STOCKY_TASK_RESULT_V1",
    `Status: ${status}`,
    `Reason: ${combined?.reason || ""}`,
    "Opinion: not a gate",
    "Executor metadata (trusted):",
    JSON.stringify(executor || [], null, 2),
  ].join("\n");
  const opinion = renderInertOpinion(modelText || "");
  return `${marker}\n${machine}\n\nReviewer opinion (inert, not a gate):\n${opinion}\n`;
}

export function publisherReadback(body, lease) {
  const marker = renderLockMarker(lease);
  return readbackMatches(body, marker);
}

export function loadPublisherInput(stateDir) {
  const allow = new Set(PUBLISH_STATE_FILES);
  const loaded = {};
  for (const name of allow) {
    const abs = path.join(stateDir, name);
    if (!fs.existsSync(abs)) continue;
    const buf = fs.readFileSync(abs);
    if (name.endsWith(".json")) {
      try {
        loaded[name] = JSON.parse(buf.toString("utf8"));
      } catch {
        return resultErr("malformed_publisher_input", `${name} is not valid JSON`);
      }
    } else {
      loaded[name] = buf.toString("utf8");
    }
  }
  return resultOk({ loaded });
}

export function separateExecutorAndModel(loaded) {
  const probes = Array.isArray(loaded["probes.json"]) ? loaded["probes.json"] : [];
  const executor = probes.map((p) => ({
    kind: p.probe?.kind,
    backend: p.executor?.backend,
    isolation: p.executor?.isolation,
    exit_code: p.executor?.exit_code,
    timed_out: p.executor?.timed_out,
    tests_run: p.executor?.tests_run,
    stdout_sha256: p.executor?.stdout_sha256,
    classified: p.classified,
  }));
  const modelText = typeof loaded["model-result.md"] === "string" ? loaded["model-result.md"] : "";
  const modelClaimsPass = /\bPASS\b/.test(modelText) || /"status"\s*:\s*"PASS"/i.test(modelText);
  return { executor, modelText, modelClaimsPass };
}

export async function publishFromState({
  stateDir,
  github,
  issueNumber,
  repoDir,
  publishBranch = false,
}) {
  const input = loadPublisherInput(stateDir);
  if (!input.ok) return input;
  const decision = input.loaded["decision.json"] || {};
  const lease = input.loaded["lease.json"] || decision.lease;
  if (!lease) {
    return resultErr("missing_lease", "publisher requires lease provenance");
  }
  if (decision.work_order?.subject?.head) {
    if (github) {
      const [owner, repoName] = REPOSITORY.split("/");
      const pr = await fetchPull(github, {
        owner,
        repo: repoName,
        pr: decision.work_order.subject.pr,
      });
      const stale = detectStaleHead(decision.work_order.subject.head, pr.head);
      if (!stale.ok) return stale;
      if (issueNumber) {
        const history = await fetchCommentHistory(github, {
          owner,
          repo: repoName,
          issueNumber,
        });
        if (!history.ok) return history;
        const control = reduceControlState(history.comments, {
          dispatchKey: lease.dispatch_key,
          taskId: lease.task_id,
          thread: issueNumber,
        });
        if (!control.ok) return control;
        if (control.stopped) {
          return resultErr("stopped", "STOP observed at trusted publication");
        }
        if (control.completed && control.lease?.attempt && control.lease.attempt !== lease.attempt) {
          return resultErr("stale_attempt", "completed attempt cannot be overwritten by publication");
        }
      }
    }
  }
  const split = separateExecutorAndModel(input.loaded);
  if (looksLikeGateOverride(split.modelText)) {
    return resultErr("artifact_gate_override", "model output tries to alter gates");
  }
  const hostProbe = split.executor.find(
    (p) =>
      p.backend === "process" ||
      (typeof p.isolation === "string" && p.isolation.startsWith("host-")),
  );
  if (hostProbe) {
    return resultErr(
      "host_backend_denied",
      "trusted publication refuses host-process probe execution",
    );
  }
  const combined = combineTaskVerdict({
    activation: decision.admitted === true,
    staleHead: false,
    lease,
    probes: split.executor.map((p) => p.classified || { verdict: "BLOCKED" }),
    modelClaimsPass: split.modelClaimsPass,
  });
  const leaseStatus = leaseStatusFromVerdict(combined, lease);
  const body = buildTrustedResultComment({
    lease: { ...lease, status: leaseStatus },
    combined,
    executor: split.executor,
    modelText: split.modelText,
  });
  fs.writeFileSync(path.join(stateDir, "result-comment.md"), body);
  let comment = null;
  if (github && issueNumber) {
    const [owner, repoName] = REPOSITORY.split("/");
    try {
      comment = await github.mutate("POST", `/repos/${owner}/${repoName}/issues/${issueNumber}/comments`, {
        body,
      });
    } catch (err) {
      return resultErr("publication_post_unknown", err?.message || "publication POST failed", {
        combined,
      });
    }
    try {
      const readback = await github.getJson(
        `/repos/${owner}/${repoName}/issues/comments/${comment.id}`,
      );
      const ack = publisherReadback(readback.body, { ...lease, status: leaseStatus });
      if (!ack.ok) {
        return {
          ok: false,
          code: "publication_readback_unknown",
          message: ack.message || "publication POST succeeded but readback did not match",
          combined,
          posted: comment,
          body,
        };
      }
    } catch (err) {
      return {
        ok: false,
        code: "publication_readback_unknown",
        message: err?.message || "publication POST succeeded but readback was lost",
        combined,
        posted: comment,
        body,
      };
    }
  }
  let branch = null;
  if (publishBranch && decision.work_order?.publish_review_branch && repoDir) {
    const named = validateBranchName(decision.work_order.task_id, lease.attempt);
    if (!named.ok) return named;
    const main = refuseMainWrite(named.branch);
    if (!main.ok) return main;
    branch = publishReviewBranch({
      repoDir,
      remote: "",
      subjectSha: decision.work_order.subject.head,
      taskId: decision.work_order.task_id,
      attempt: lease.attempt,
      artifactContent: split.modelText || "# review\n",
    });
    if (!branch.ok) return branch;
  }
  return resultOk({ combined, body, comment, branch, owner: OWNER_LOGIN });
}
