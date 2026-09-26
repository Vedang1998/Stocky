import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  COMMENT_PAGE_SIZE,
  OWNER_ID,
  OWNER_LOGIN,
  PROFILE_ID,
  REPOSITORY,
  WORKFLOW_BOT_ID,
  WORKFLOW_BOT_TYPE,
} from "../lib/constants.js";
import { createGithubClient } from "../lib/github-client.js";
import { runDispatchPhase } from "../lib/dispatch-cli.js";
import { makeLease, renderLockMarker } from "../lib/session.js";

const HEAD = "b319b7a3262de1ccfc26c60f653a451ee1eec9cc";
const BASE = "c0dd99c5641692098b7a08dce3a53d21e22391a8";
const [owner, repo] = REPOSITORY.split("/");

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

function dummy(id) {
  return {
    id,
    user: { login: "bystander", id: 7, type: "User" },
    body: `noise-${id}`,
  };
}

function startPagedDispatch({ pages } = {}) {
  const posted = [];
  const fetched = [];
  const holder = { baseUrl: "" };
  const server = http.createServer((req, res) => {
    const url = req.url || "";
    fetched.push({ method: req.method, url, auth: req.headers.authorization || "" });
    if (url.includes("/tarball/")) {
      res.statusCode = 200;
      res.end("placeholder");
      return;
    }
    if (req.method === "POST" && /\/issues\/\d+\/comments/.test(url) && !/\/comments\/\d+$/.test(url)) {
      let raw = "";
      req.on("data", (c) => {
        raw += c;
      });
      req.on("end", () => {
        posted.push(JSON.parse(raw || "{}"));
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ id: 9100 + posted.length, body: posted[posted.length - 1].body }));
      });
      return;
    }
    if (url.includes("/collaborators/")) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ permission: "admin" }));
      return;
    }
    if (url.includes("/pulls/45")) {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          number: 45,
          head: { sha: HEAD },
          base: { sha: BASE },
          state: "open",
          draft: true,
        }),
      );
      return;
    }
    if (/\/issues\/comments\/5806012938/.test(url)) {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          id: 5806012938,
          user: { login: OWNER_LOGIN, id: OWNER_ID, type: "User" },
          body: taskBody(),
          created_at: "2026-09-24T00:00:00Z",
          updated_at: "2026-09-24T00:00:00Z",
          issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/61`,
        }),
      );
      return;
    }
    if (/\/issues\/61\/comments/.test(url)) {
      const u = new URL(url, holder.baseUrl || "http://127.0.0.1");
      const page = Number(u.searchParams.get("page") || "1");
      const payload = pages[page] || [];
      if (pages[page + 1] && holder.baseUrl) {
        res.setHeader(
          "Link",
          `<${holder.baseUrl}/repos/${owner}/${repo}/issues/61/comments?page=${page + 1}&per_page=100>; rel="next"`,
        );
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(payload));
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      holder.baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve({ server, baseUrl: holder.baseUrl, posted, fetched });
    });
  });
}

async function runValidate(mock, extraEnv = {}) {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-page-"));
  const out = path.join(stateDir, "github-output");
  fs.writeFileSync(out, "");
  const github = createGithubClient({ baseUrl: mock.baseUrl, token: "paged-secret" });
  const snapDest = fs.mkdtempSync(path.join(os.tmpdir(), "stocky-snap-"));
  fs.writeFileSync(path.join(snapDest, "README.md"), "ok\n");
  const decision = await runDispatchPhase({
    phase: "validate",
    github,
    stateDir,
    snapshotSubjectTarball: async () => ({ ok: true, dest: snapDest }),
    env: {
      GITHUB_REPOSITORY: REPOSITORY,
      ACTOR_LOGIN: OWNER_LOGIN,
      ACTOR_ID: String(OWNER_ID),
      ACTOR_TYPE: "User",
      COMMENT_BODY: taskBody(),
      COMMENT_ID: "1",
      ISSUE_NUMBER: "61",
      GITHUB_RUN_ID: extraEnv.GITHUB_RUN_ID || "page-1",
      STOCKY_REVIEW_RUNNER_ACTIVATED: "admitted",
      GITHUB_OUTPUT: out,
      ...extraEnv,
    },
  });
  return { decision, stateDir, ghOut: fs.readFileSync(out, "utf8") };
}

describe("dispatch entry pagination at 101/201", () => {
  const servers = [];
  after(() => {
    for (const s of servers) s.close();
  });

  it("honors an owner STOP on comment 101 through runDispatchPhase", async () => {
    const page1 = Array.from({ length: COMMENT_PAGE_SIZE }, (_, i) => dummy(i + 1));
    const page2 = [
      {
        id: 101,
        user: { login: OWNER_LOGIN, id: OWNER_ID, type: "User" },
        body: `@claude STOCKY_REVIEW_STOP_V1 ${JSON.stringify({
          task_id: "rev-pr45-test",
          dispatch_key: "propo:issue61-v1:REVIEW:test:claude-review",
        })}`,
      },
    ];
    const mock = await startPagedDispatch({ pages: { 1: page1, 2: page2 } });
    servers.push(mock.server);
    const r = await runValidate(mock, { GITHUB_RUN_ID: "page-stop" });
    assert.equal(r.decision.invoke_claude, false, r.decision.message);
    assert.equal(r.decision.code, "stopped");
    assert.ok(mock.fetched.filter((f) => /\/issues\/61\/comments/.test(f.url)).length >= 2);
  });

  it("sees a workflow-bot running lease at comment 201", async () => {
    const page1 = Array.from({ length: COMMENT_PAGE_SIZE }, (_, i) => dummy(i + 1));
    const page2 = Array.from({ length: COMMENT_PAGE_SIZE }, (_, i) => dummy(i + 101));
    const existing = makeLease({
      dispatchKey: "propo:issue61-v1:REVIEW:test:claude-review",
      taskId: "rev-pr45-test",
      attempt: "other-201",
      head: HEAD,
      status: "running",
      thread: 61,
    });
    const page3 = [
      {
        id: 201,
        user: { login: "github-actions[bot]", id: WORKFLOW_BOT_ID, type: WORKFLOW_BOT_TYPE },
        body: `${renderLockMarker(existing)}\nleased`,
      },
    ];
    const mock = await startPagedDispatch({ pages: { 1: page1, 2: page2, 3: page3 } });
    servers.push(mock.server);
    const r = await runValidate(mock, { GITHUB_RUN_ID: "page-lease" });
    assert.equal(r.decision.invoke_claude, false, r.decision.message);
    assert.equal(r.decision.code, "duplicate_dispatch");
  });
});
