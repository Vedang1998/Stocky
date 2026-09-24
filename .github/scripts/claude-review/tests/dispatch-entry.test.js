import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { OWNER_ID, OWNER_LOGIN, PROFILE_ID, REPOSITORY } from "../lib/constants.js";
import { makeLease, renderLockMarker } from "../lib/session.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DISPATCH_BIN = path.resolve(HERE, "../bin/dispatch.mjs");
const HEAD = "b319b7a3262de1ccfc26c60f653a451ee1eec9cc";
const BASE = "c0dd99c5641692098b7a08dce3a53d21e22391a8";

function taskBody() {
  const wo = {
    task_id: "rev-pr45-test",
    dispatch_key: "propo:issue61-v1:REVIEW:test:claude-review",
    role: "independent_reviewer",
    subject: { repository: REPOSITORY, pr: 45, head: HEAD, base: BASE },
    profile: PROFILE_ID,
    max_probes: 2,
    max_sandbox_seconds: 60,
    expected_artifact: "review-report.md",
    authority_comment_id: 5806012938,
    publish_review_branch: false,
  };
  return `@claude STOCKY_REVIEW_TASK_V1\n${JSON.stringify(wo)}\n`;
}

function makeSubjectTar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-tar-"));
  fs.writeFileSync(path.join(dir, "README.md"), "subject-ok\n");
  const tar = path.join(dir, "s.tar.gz");
  const packed = spawnSync("tar", ["-czf", tar, "-C", dir, "README.md"], { encoding: "utf8" });
  assert.equal(packed.status, 0, packed.stderr);
  return fs.readFileSync(tar);
}

function startServer({
  head = HEAD,
  commentBody = taskBody(),
  comments = [],
  tarball = makeSubjectTar(),
  failTar = false,
} = {}) {
  const posted = [];
  const server = http.createServer((req, res) => {
    const url = req.url || "";
    if (url.includes("/tarball/")) {
      if (failTar) {
        res.statusCode = 200;
        res.end("this is not a gzip tarball");
        return;
      }
      res.statusCode = 200;
      res.end(tarball);
      return;
    }
    if (req.method === "POST" && /\/issues\/\d+\/comments/.test(url) && !/\/comments\/\d+/.test(url)) {
      let raw = "";
      req.on("data", (c) => {
        raw += c;
      });
      req.on("end", () => {
        const body = JSON.parse(raw || "{}");
        posted.push(body);
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            id: 9100 + posted.length,
            body: body.body,
            user: { login: OWNER_LOGIN, id: OWNER_ID },
          }),
        );
      });
      return;
    }
    let payload;
    if (url.includes("/collaborators/")) payload = { permission: "admin" };
    else if (url.includes("/pulls/45")) {
      payload = { number: 45, head: { sha: head }, base: { sha: BASE }, state: "open", draft: true };
    } else if (/\/issues\/comments\/5806012938/.test(url)) {
      payload = {
        id: 5806012938,
        user: { login: OWNER_LOGIN, id: OWNER_ID, type: "User" },
        body: commentBody,
        created_at: "2026-09-24T00:00:00Z",
        updated_at: "2026-09-24T00:00:00Z",
      };
    } else if (/\/issues\/\d+\/comments/.test(url)) payload = comments;
    else {
      res.statusCode = 404;
      res.end("{}");
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}`, posted });
    });
  });
}

function runDispatch(phase, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [DISPATCH_BIN, "--phase", phase], {
      env: { PATH: process.env.PATH, ...env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

describe("production dispatch.mjs entry with mock GitHub", () => {
  const servers = [];
  after(() => {
    for (const s of servers) s.close();
  });

  it("validate snapshots, posts lock, and keeps invoke_claude true", async () => {
    const mock = await startServer();
    servers.push(mock.server);
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-entry-"));
    const out = path.join(stateDir, "github-output");
    fs.writeFileSync(out, "");
    const r = await runDispatch("validate", {
      GITHUB_REPOSITORY: REPOSITORY,
      ACTOR_LOGIN: OWNER_LOGIN,
      ACTOR_ID: String(OWNER_ID),
      ACTOR_TYPE: "User",
      COMMENT_BODY: taskBody(),
      COMMENT_ID: "1",
      ISSUE_NUMBER: "61",
      GITHUB_RUN_ID: "entry-1",
      STOCKY_REVIEW_RUNNER_ACTIVATED: "admitted",
      STOCKY_REVIEW_STATE_DIR: stateDir,
      STOCKY_REVIEW_MOCK_GITHUB_URL: mock.baseUrl,
      GITHUB_TOKEN: "test-only",
      GITHUB_OUTPUT: out,
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const ghOut = fs.readFileSync(out, "utf8");
    assert.match(ghOut, /invoke_claude=true/);
    assert.match(ghOut, /dispatch_key=propo:issue61-v1:REVIEW:test:claude-review/);
    assert.equal(fs.existsSync(path.join(stateDir, "subject", "README.md")), true);
    assert.ok(mock.posted.some((p) => /STOCKY_REVIEW_LOCK/.test(p.body)));
  });

  it("snapshot failure keeps invoke_claude false and records BLOCKED evidence", async () => {
    const mock = await startServer({ failTar: true });
    servers.push(mock.server);
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-snap-"));
    const out = path.join(stateDir, "github-output");
    fs.writeFileSync(out, "");
    const r = await runDispatch("validate", {
      GITHUB_REPOSITORY: REPOSITORY,
      ACTOR_LOGIN: OWNER_LOGIN,
      ACTOR_ID: String(OWNER_ID),
      ACTOR_TYPE: "User",
      COMMENT_BODY: taskBody(),
      COMMENT_ID: "1",
      ISSUE_NUMBER: "61",
      GITHUB_RUN_ID: "entry-2",
      STOCKY_REVIEW_RUNNER_ACTIVATED: "admitted",
      STOCKY_REVIEW_STATE_DIR: stateDir,
      STOCKY_REVIEW_MOCK_GITHUB_URL: mock.baseUrl,
      GITHUB_TOKEN: "test-only",
      GITHUB_OUTPUT: out,
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const ghOut = fs.readFileSync(out, "utf8");
    assert.match(ghOut, /invoke_claude=false/);
    const decision = JSON.parse(fs.readFileSync(path.join(stateDir, "decision.json"), "utf8"));
    assert.equal(decision.invoke_claude, false);
    assert.match(String(decision.code), /tar_|snapshot_/);
  });

  it("assert-lease fails closed on STOP comments", async () => {
    const lease = makeLease({
      dispatchKey: "propo:issue61-v1:REVIEW:test:claude-review",
      taskId: "rev-pr45-test",
      attempt: "entry-3-aaaa",
      head: HEAD,
      status: "leased",
    });
    const mock = await startServer({
      comments: [
        {
          id: 12,
          body: '@claude STOCKY_REVIEW_STOP_V1 {"task_id":"rev-pr45-test","dispatch_key":"propo:issue61-v1:REVIEW:test:claude-review"}',
        },
      ],
    });
    servers.push(mock.server);
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-assert-"));
    fs.writeFileSync(
      path.join(stateDir, "decision.json"),
      JSON.stringify({
        lease,
        work_order: {
          task_id: "rev-pr45-test",
          dispatch_key: "propo:issue61-v1:REVIEW:test:claude-review",
          authority_comment_id: 5806012938,
          subject: { pr: 45, head: HEAD, base: BASE },
        },
      }),
    );
    fs.writeFileSync(
      path.join(stateDir, "authority-capture.json"),
      JSON.stringify({ id: 5806012938, body_sha256: "abc" }),
    );
    const r = await runDispatch("assert-lease", {
      STOCKY_REVIEW_STATE_DIR: stateDir,
      STOCKY_REVIEW_MOCK_GITHUB_URL: mock.baseUrl,
      GITHUB_TOKEN: "test-only",
      ISSUE_NUMBER: "61",
    });
    assert.equal(r.status, 2);
    assert.match(r.stdout, /stopped/);
  });

  it("duplicate lock marker on comments is read through validate", async () => {
    const existing = makeLease({
      dispatchKey: "propo:issue61-v1:REVIEW:test:claude-review",
      taskId: "rev-pr45-test",
      attempt: "other-attempt",
      head: HEAD,
      status: "running",
    });
    const mock = await startServer({
      comments: [{ id: 4, body: `${renderLockMarker(existing)}\nleased` }],
    });
    servers.push(mock.server);
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-dup-"));
    const out = path.join(stateDir, "github-output");
    fs.writeFileSync(out, "");
    const r = await runDispatch("validate", {
      GITHUB_REPOSITORY: REPOSITORY,
      ACTOR_LOGIN: OWNER_LOGIN,
      ACTOR_ID: String(OWNER_ID),
      ACTOR_TYPE: "User",
      COMMENT_BODY: taskBody(),
      COMMENT_ID: "1",
      ISSUE_NUMBER: "61",
      GITHUB_RUN_ID: "entry-4",
      STOCKY_REVIEW_RUNNER_ACTIVATED: "admitted",
      STOCKY_REVIEW_STATE_DIR: stateDir,
      STOCKY_REVIEW_MOCK_GITHUB_URL: mock.baseUrl,
      GITHUB_TOKEN: "test-only",
      GITHUB_OUTPUT: out,
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const ghOut = fs.readFileSync(out, "utf8");
    assert.match(ghOut, /invoke_claude=false/);
    assert.match(ghOut, /duplicate_dispatch/);
  });
});
