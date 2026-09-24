import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OWNER_ID,
  OWNER_LOGIN,
  PROFILE_ID,
  REPOSITORY,
} from "../lib/constants.js";
import { parseCommentBody, validateTask } from "../lib/parse-work-order.js";
import {
  assertImmutableOwnerActor,
  assertRepository,
  assertWritePermission,
  compareFetchedVsClaimed,
  detectEditedAuthorityComment,
  detectStaleHead,
} from "../lib/authority.js";

const HEAD = "b319b7a3262de1ccfc26c60f653a451ee1eec9cc";
const BASE = "c0dd99c5641692098b7a08dce3a53d21e22391a8";

function taskJson(over = {}) {
  return {
    task_id: "rev-pr45-test",
    dispatch_key: "propo:issue61-v1:REVIEW:test:claude-review",
    role: "independent_reviewer",
    subject: {
      repository: REPOSITORY,
      pr: 45,
      head: HEAD,
      base: BASE,
    },
    profile: PROFILE_ID,
    max_probes: 2,
    max_sandbox_seconds: 60,
    expected_artifact: "review-report.md",
    authority_comment_id: 5806012938,
    publish_review_branch: false,
    ...over,
  };
}

function taskComment(over) {
  return `@claude STOCKY_REVIEW_TASK_V1\n${JSON.stringify(taskJson(over), null, 2)}\n`;
}

describe("parseCommentBody", () => {
  it("accepts simple owner communication", () => {
    const r = parseCommentBody("@claude read AGENTS.md");
    assert.equal(r.ok, true);
    assert.equal(r.mode, "simple");
  });

  it("rejects missing trigger space", () => {
    const r = parseCommentBody("@claude\nSTOCKY_REVIEW_TASK_V1 {}");
    assert.equal(r.ok, false);
    assert.equal(r.code, "missing_trigger");
  });

  it("parses a valid executable work order", () => {
    const r = parseCommentBody(taskComment());
    assert.equal(r.ok, true);
    assert.equal(r.mode, "executable_review");
    assert.equal(r.work_order.subject.head, HEAD);
  });

  it("parses STOP", () => {
    const r = parseCommentBody(
      '@claude STOCKY_REVIEW_STOP_V1 {"task_id":"rev-pr45-test","dispatch_key":"propo:issue61-v1:REVIEW:test:claude-review"}',
    );
    assert.equal(r.ok, true);
    assert.equal(r.mode, "stop");
  });

  it("rejects malicious shell interpolation text as JSON", () => {
    const r = parseCommentBody(
      '@claude STOCKY_REVIEW_TASK_V1 { "task_id": "$(rm -rf /)", "dispatch_key": "propo:x" }',
    );
    assert.equal(r.ok, false);
  });

  it("rejects backticks and extra keys for merge/activation", () => {
    const r = parseCommentBody(
      taskComment({ merge: true, activation: "admitted" }),
    );
    assert.equal(r.ok, false);
    assert.equal(r.code, "forbidden_key");
  });

  it("rejects wrong repository / role / profile / short sha", () => {
    assert.equal(
      parseCommentBody(taskComment({ role: "writer" })).ok,
      false,
    );
    assert.equal(
      validateTask(
        taskJson({
          subject: { repository: "evil/repo", pr: 1, head: HEAD, base: BASE },
        }),
      ).code,
      "wrong_repository",
    );
    assert.equal(
      validateTask(
        taskJson({
          subject: { repository: REPOSITORY, pr: 1, head: "abc", base: BASE },
        }),
      ).code,
      "invalid_head",
    );
  });

  it("rejects oversized comments", () => {
    const r = parseCommentBody(`@claude ${"x".repeat(70_000)}`);
    assert.equal(r.code, "comment_too_large");
  });
});

describe("authority binding", () => {
  it("accepts the bound owner numeric id", () => {
    const r = assertImmutableOwnerActor({
      login: OWNER_LOGIN,
      id: OWNER_ID,
      type: "User",
    });
    assert.equal(r.ok, true);
  });

  it("rejects wrong login with matching fake id", () => {
    const r = assertImmutableOwnerActor({
      login: "not-owner",
      id: OWNER_ID,
      type: "User",
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, "wrong_login");
  });

  it("rejects owner login with a different numeric id", () => {
    const r = assertImmutableOwnerActor({
      login: OWNER_LOGIN,
      id: 1,
      type: "User",
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, "wrong_actor_id");
  });

  it("rejects bots even if login looks similar", () => {
    const r = assertImmutableOwnerActor({
      login: OWNER_LOGIN,
      id: OWNER_ID,
      type: "Bot",
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, "wrong_actor_type");
  });

  it("rejects read permission", () => {
    assert.equal(assertWritePermission("read").ok, false);
    assert.equal(assertWritePermission("write").ok, true);
    assert.equal(assertWritePermission("admin").ok, true);
  });

  it("rejects wrong repository", () => {
    assert.equal(assertRepository("other/repo").ok, false);
  });

  it("detects claimed vs fetched head mismatch", () => {
    const r = compareFetchedVsClaimed(
      { pr: 45, head: HEAD, base: BASE, repository: REPOSITORY },
      { pr: 45, head: "c".repeat(40), base: BASE, repository: REPOSITORY },
    );
    assert.equal(r.code, "authority_mismatch");
  });

  it("detects edited authority comment via body hash", () => {
    const r = detectEditedAuthorityComment(
      { id: 1, body_sha256: "aaa" },
      { id: 1, user: { id: OWNER_ID }, body: "x", body_sha256: "bbb" },
    );
    assert.equal(r.code, "authority_edited");
  });

  it("detects stale head", () => {
    const r = detectStaleHead(HEAD, "d".repeat(40));
    assert.equal(r.code, "stale_head");
    assert.equal(detectStaleHead(HEAD, HEAD).ok, true);
  });
});
