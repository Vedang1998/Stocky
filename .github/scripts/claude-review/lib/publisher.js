import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  EXPECTED_ARTIFACT_NAME,
  MAX_ARTIFACT_BYTES,
  REVIEW_BRANCH_PREFIX,
  REVIEW_PATH_PREFIX,
} from "./constants.js";
import { looksLikeGateOverride, sanitizePublicText } from "./sanitize.js";
import { parseLockMarker, readbackMatches, renderLockMarker } from "./session.js";
import { isFullSha, resultErr, resultOk, sha256Hex } from "./util.js";

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
  const marker = renderLockMarker({ ...lease, status });
  const sanitized = sanitizePublicText(body, 32_000);
  return `${marker}\n\n${sanitized}\n`;
}

export function publisherReadback(body, lease) {
  const marker = renderLockMarker(lease);
  return readbackMatches(body, marker);
}

export { parseLockMarker };
