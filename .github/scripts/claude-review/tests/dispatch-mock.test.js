import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { OWNER_ID, OWNER_LOGIN, PROFILE_ID, REPOSITORY } from "../lib/constants.js";
import { dispatchValidate } from "../lib/dispatch.js";
import { createGithubClient } from "../lib/github-client.js";
import { createBroker, handleJsonRpc } from "../lib/mcp-broker.js";
import { makeLease } from "../lib/session.js";

const HEAD = "b319b7a3262de1ccfc26c60f653a451ee1eec9cc";
const BASE = "c0dd99c5641692098b7a08dce3a53d21e22391a8";
const AUTH_BODY = "owner go-ahead recorded";

function taskBody(over = {}) {
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
    ...over,
  };
  return `@claude STOCKY_REVIEW_TASK_V1\n${JSON.stringify(wo)}\n`;
}

function startMock({ head = HEAD, commentBody = AUTH_BODY, permission = "admin" } = {}) {
  const server = http.createServer((req, res) => {
    const url = req.url || "";
    let payload;
    if (url.includes("/collaborators/")) {
      payload = { permission };
    } else if (url.includes("/pulls/45")) {
      payload = {
        number: 45,
        head: { sha: head },
        base: { sha: BASE },
        state: "open",
        draft: true,
        title: "subject",
        html_url: "https://github.com/Vedang1998/Stocky/pull/45",
      };
    } else if (url.includes("/issues/comments/5806012938")) {
      payload = {
        id: 5806012938,
        user: { login: OWNER_LOGIN, id: OWNER_ID, type: "User" },
        body: commentBody,
        updated_at: "2026-09-24T00:00:00Z",
        created_at: "2026-09-24T00:00:00Z",
      };
    } else {
      res.statusCode = 404;
      res.end("{}");
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

const envBase = {
  GITHUB_REPOSITORY: REPOSITORY,
  ACTOR_LOGIN: OWNER_LOGIN,
  ACTOR_ID: String(OWNER_ID),
  ACTOR_TYPE: "User",
  COMMENT_ID: "1",
  ISSUE_NUMBER: "61",
  GITHUB_RUN_ID: "local-test",
  STOCKY_REVIEW_RUNNER_ACTIVATED: "admitted",
};

describe("dispatch with mocked GitHub", () => {
  const servers = [];
  after(() => {
    for (const s of servers) s.close();
  });

  it("accepts the valid owner/task path", async () => {
    const mock = await startMock();
    servers.push(mock.server);
    const github = createGithubClient({ baseUrl: mock.baseUrl, token: "test-only" });
    const decision = await dispatchValidate({
      env: { ...envBase, COMMENT_BODY: taskBody() },
      github,
    });
    assert.equal(decision.ok, true, decision.message);
    assert.equal(decision.mode, "executable_review");
    assert.equal(decision.invoke_claude, true);
  });

  it("rejects wrong actor even if GitHub would say write", async () => {
    const decision = await dispatchValidate({
      env: {
        ...envBase,
        ACTOR_LOGIN: "evil",
        ACTOR_ID: "999",
        COMMENT_BODY: "@claude ping",
        ACTOR_PERMISSION: "admin",
      },
    });
    assert.equal(decision.ok, false);
    assert.equal(decision.code, "wrong_login");
  });

  it("rejects wrong repository", async () => {
    const decision = await dispatchValidate({
      env: { ...envBase, GITHUB_REPOSITORY: "evil/repo", COMMENT_BODY: "@claude ping" },
    });
    assert.equal(decision.ok, false);
    assert.equal(decision.code, "wrong_repository");
  });

  it("rejects executable review when activation is not admitted", async () => {
    const decision = await dispatchValidate({
      env: {
        ...envBase,
        STOCKY_REVIEW_RUNNER_ACTIVATED: "",
        COMMENT_BODY: taskBody(),
        ACTOR_PERMISSION: "admin",
      },
    });
    assert.equal(decision.ok, true);
    assert.equal(decision.invoke_claude, false);
    assert.equal(decision.code, "runner_not_admitted");
  });

  it("rejects fetched vs claimed head mismatch", async () => {
    const mock = await startMock({ head: "e".repeat(40) });
    servers.push(mock.server);
    const github = createGithubClient({ baseUrl: mock.baseUrl });
    const decision = await dispatchValidate({
      env: { ...envBase, COMMENT_BODY: taskBody() },
      github,
    });
    assert.equal(decision.ok, false);
    assert.equal(decision.code, "authority_mismatch");
  });

  it("rejects edited authority comment when captured hash differs", async () => {
    const mock = await startMock({ commentBody: "changed later" });
    servers.push(mock.server);
    const github = createGithubClient({ baseUrl: mock.baseUrl });
    const decision = await dispatchValidate({
      env: { ...envBase, COMMENT_BODY: taskBody() },
      github,
      capturedAuthority: { id: 5806012938, body_sha256: "deadbeef" },
    });
    assert.equal(decision.ok, false);
    assert.equal(decision.code, "authority_edited");
  });

  it("rejects branch movement / stale head at validate time", async () => {
    const mock = await startMock({ head: "f".repeat(40) });
    servers.push(mock.server);
    const github = createGithubClient({ baseUrl: mock.baseUrl });
    const decision = await dispatchValidate({
      env: { ...envBase, COMMENT_BODY: taskBody() },
      github,
    });
    assert.equal(decision.ok, false);
  });

  it("rejects duplicate dispatch using an existing lease", async () => {
    const mock = await startMock();
    servers.push(mock.server);
    const github = createGithubClient({ baseUrl: mock.baseUrl });
    const existing = makeLease({
      dispatchKey: "propo:issue61-v1:REVIEW:test:claude-review",
      taskId: "rev-pr45-test",
      attempt: "other",
      head: HEAD,
      status: "running",
    });
    const decision = await dispatchValidate({
      env: { ...envBase, COMMENT_BODY: taskBody() },
      github,
      existingLease: existing,
    });
    assert.equal(decision.code, "duplicate_dispatch");
  });

  it("handles STOP", async () => {
    const decision = await dispatchValidate({
      env: {
        ...envBase,
        COMMENT_BODY:
          '@claude STOCKY_REVIEW_STOP_V1 {"task_id":"rev-pr45-test","dispatch_key":"propo:issue61-v1:REVIEW:test:claude-review"}',
      },
      existingLease: makeLease({
        dispatchKey: "propo:issue61-v1:REVIEW:test:claude-review",
        taskId: "rev-pr45-test",
        attempt: "1",
        head: HEAD,
        status: "running",
      }),
    });
    assert.equal(decision.mode, "stop");
    assert.equal(decision.invoke_claude, false);
    assert.equal(decision.lease.status, "stopped");
  });

  it("rejects read permission", async () => {
    const mock = await startMock({ permission: "read" });
    servers.push(mock.server);
    const github = createGithubClient({ baseUrl: mock.baseUrl });
    const decision = await dispatchValidate({
      env: { ...envBase, COMMENT_BODY: taskBody() },
      github,
    });
    assert.equal(decision.code, "insufficient_permission");
  });
});

describe("mcp broker", () => {
  it("lists tools and rejects unknown methods", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-mcp-"));
    fs.mkdirSync(path.join(dir, "evidence"));
    fs.writeFileSync(path.join(dir, "evidence", "README.txt"), "hi");
    const broker = createBroker({
      evidenceDir: path.join(dir, "evidence"),
      subjectRoot: path.join(dir, "evidence"),
      workDir: dir,
      maxProbes: 2,
    });
    const listed = handleJsonRpc(broker, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    assert.equal(listed.result.tools.length, 4);
    const missing = handleJsonRpc(broker, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "get_evidence", arguments: { name: "nope.json" } },
    });
    const parsed = JSON.parse(missing.result.content[0].text);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.code, "missing_evidence");
  });

  it("enforces probe quota", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-mcp-"));
    fs.mkdirSync(path.join(dir, "evidence"));
    const broker = createBroker({
      evidenceDir: path.join(dir, "evidence"),
      subjectRoot: dir,
      workDir: dir,
      maxProbes: 1,
    });
    const first = broker.tools.run_probe({ kind: "zero_test_control" });
    assert.equal(first.ok, true);
    const second = broker.tools.run_probe({ kind: "zero_test_control" });
    assert.equal(second.code, "probe_quota");
  });
});
