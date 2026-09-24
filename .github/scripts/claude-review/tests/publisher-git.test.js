import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { publishReviewBranch, refuseMainWrite } from "../lib/publisher.js";

function git(cwd, args) {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`${args.join(" ")} failed: ${r.stderr}`);
  }
  return r.stdout.trim();
}

describe("publisher against a local mock remote", () => {
  it("creates one allowlisted artifact commit with the declared sole parent", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-git-"));
    const bare = path.join(tmp, "remote.git");
    const repo = path.join(tmp, "work");
    spawnSync("git", ["init", "--bare", bare], { encoding: "utf8" });
    spawnSync("git", ["clone", bare, repo], { encoding: "utf8" });
    spawnSync("git", ["-C", repo, "config", "user.email", "runner@example.test"]);
    spawnSync("git", ["-C", repo, "config", "user.name", "runner"]);
    fs.writeFileSync(path.join(repo, "README.md"), "base\n");
    git(repo, ["add", "README.md"]);
    git(repo, ["commit", "-m", "base"]);
    const subject = git(repo, ["rev-parse", "HEAD"]);
    git(repo, ["branch", "-M", "main"]);
    git(repo, ["push", "origin", "main"]);

    const published = publishReviewBranch({
      repoDir: repo,
      remote: "origin",
      subjectSha: subject,
      taskId: "rev-test",
      attempt: "a1",
      artifactContent: "# review\nfindings: none claimed as PASS\n",
    });
    assert.equal(published.ok, true, published.message);
    assert.equal(published.parent, subject);
    assert.match(published.path, /reviews\/rev-test\/review-report.md/);

    const clone2 = path.join(tmp, "readback");
    spawnSync("git", ["clone", bare, clone2], { encoding: "utf8" });
    git(clone2, ["fetch", "origin", published.branch]);
    git(clone2, ["checkout", published.branch]);
    const parent = git(clone2, ["rev-parse", "HEAD^"]);
    assert.equal(parent, subject);
    assert.equal(
      fs.existsSync(path.join(clone2, published.path)),
      true,
    );
  });

  it("refuses a foreign parent", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-git-"));
    const repo = path.join(tmp, "work");
    spawnSync("git", ["init", repo], { encoding: "utf8" });
    spawnSync("git", ["-C", repo, "config", "user.email", "runner@example.test"]);
    spawnSync("git", ["-C", repo, "config", "user.name", "runner"]);
    fs.writeFileSync(path.join(repo, "README.md"), "a\n");
    git(repo, ["add", "README.md"]);
    git(repo, ["commit", "-m", "a"]);
    const a = git(repo, ["rev-parse", "HEAD"]);
    fs.appendFileSync(path.join(repo, "README.md"), "b\n");
    git(repo, ["add", "README.md"]);
    git(repo, ["commit", "-m", "b"]);
    const b = git(repo, ["rev-parse", "HEAD"]);
    assert.notEqual(a, b);
    const published = publishReviewBranch({
      repoDir: repo,
      subjectSha: a,
      taskId: "rev-test",
      attempt: "a1",
      artifactContent: "# review\n",
    });
    // checkout -B branch a should work; parent of new commit should be a, not b
    assert.equal(published.ok, true);
    assert.equal(published.parent, a);
  });

  it("refuses unexpected paths by validating artifact name/path first", () => {
    assert.equal(refuseMainWrite("main").ok, false);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-git-"));
    const repo = path.join(tmp, "work");
    spawnSync("git", ["init", repo], { encoding: "utf8" });
    spawnSync("git", ["-C", repo, "config", "user.email", "runner@example.test"]);
    spawnSync("git", ["-C", repo, "config", "user.name", "runner"]);
    fs.writeFileSync(path.join(repo, "README.md"), "a\n");
    git(repo, ["add", "README.md"]);
    git(repo, ["commit", "-m", "a"]);
    const sha = git(repo, ["rev-parse", "HEAD"]);
    const r = publishReviewBranch({
      repoDir: repo,
      subjectSha: sha,
      taskId: "../etc",
      attempt: "a1",
      artifactContent: "# review\n",
    });
    assert.equal(r.ok, false);
  });

  it("refuses missing subject parent SHA", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-git-"));
    const repo = path.join(tmp, "work");
    spawnSync("git", ["init", repo], { encoding: "utf8" });
    spawnSync("git", ["-C", repo, "config", "user.email", "runner@example.test"]);
    spawnSync("git", ["-C", repo, "config", "user.name", "runner"]);
    fs.writeFileSync(path.join(repo, "README.md"), "a\n");
    git(repo, ["add", "README.md"]);
    git(repo, ["commit", "-m", "a"]);
    const r = publishReviewBranch({
      repoDir: repo,
      subjectSha: "a".repeat(40),
      taskId: "rev-test",
      attempt: "a1",
      artifactContent: "# review\n",
    });
    assert.equal(r.ok, false);
    assert.ok(
      r.code === "missing_subject_parent" || r.code === "checkout_failed",
      r.code,
    );
  });
});
