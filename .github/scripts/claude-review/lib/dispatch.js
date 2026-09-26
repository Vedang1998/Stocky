import fs from "node:fs";
import path from "node:path";
import {
  ACTIVATION_VALUE,
  ACTIVATION_VAR,
  EXECUTABLE_ALLOWED_TOOLS,
  SIMPLE_ALLOWED_TOOLS,
  DISALLOWED_CLAUDE_TOOLS,
  MAX_TURNS,
  OWNER_LOGIN,
  REPOSITORY,
} from "./constants.js";
import {
  assertCanonicalThread,
  assertImmutableOwnerActor,
  assertRepository,
  assertWritePermission,
  bindAuthorityComment,
  compareFetchedVsClaimed,
  detectEditedAuthorityComment,
  detectStaleHead,
  fetchIssueComment,
  fetchCommentHistory,
  fetchPermissionLevel,
  fetchPull,
  isActivationAdmitted,
} from "./authority.js";
import { parseCommentBody } from "./parse-work-order.js";
import {
  acquireLease,
  applyStop,
  makeLease,
  makeStoppedLease,
  reduceControlState,
  renderLockMarker,
} from "./session.js";
import { bodySha256 } from "./sanitize.js";
import { buildTrustedPrompt, writeEvidencePack } from "./evidence.js";
import { mcpConfig } from "./mcp-broker.js";
import { fileURLToPath } from "node:url";
import { githubOutput, nowIso, resultErr, sha256Hex, writeGithubOutput } from "./util.js";

const BROKER_BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../bin/broker.mjs");

export function collectEvent(env = process.env) {
  return {
    repository: env.GITHUB_REPOSITORY || "",
    comment_body: env.COMMENT_BODY || "",
    comment_id: env.COMMENT_ID || "",
    actor_login: env.ACTOR_LOGIN || "",
    actor_id: env.ACTOR_ID || "",
    actor_type: env.ACTOR_TYPE || "",
    issue_number: env.ISSUE_NUMBER || "",
    run_id: env.GITHUB_RUN_ID || "local",
    activation: env.STOCKY_REVIEW_RUNNER_ACTIVATED || env[ACTIVATION_VAR] || "",
    permission: env.ACTOR_PERMISSION || "",
  };
}

export async function dispatchValidate({ env = process.env, github, existingLease, capturedAuthority } = {}) {
  const event = collectEvent(env);
  const repo = assertRepository(event.repository);
  if (!repo.ok) return finalize(repo, event);
  const actor = assertImmutableOwnerActor({
    login: event.actor_login,
    id: Number(event.actor_id),
    type: event.actor_type,
  });
  if (!actor.ok) return finalize(actor, event);
  const parsed = parseCommentBody(event.comment_body);
  if (!parsed.ok) return finalize(parsed, event);

  if (parsed.mode === "stop") {
    let existing = existingLease;
    if (github && event.issue_number) {
      const [owner, repoName] = REPOSITORY.split("/");
      const history = await fetchCommentHistory(github, {
        owner,
        repo: repoName,
        issueNumber: event.issue_number,
      });
      if (!history.ok) return finalize(history, event);
      const control = reduceControlState(history.comments, {
        dispatchKey: parsed.dispatch_key,
        taskId: parsed.task_id,
        thread: event.issue_number,
      });
      if (!control.ok) return finalize(control, event);
      existing = existing || control.lease;
    } else if (github && !event.issue_number) {
      return finalize(
        resultErr("incomplete_comment_history", "STOP requires a canonical issue thread"),
        event,
      );
    }
    if (!existing) {
      if (!github) {
        return finalize(resultErr("stop_without_lease", "STOP requires a fetched lease"), event);
      }
      const lease = makeStoppedLease({ ...parsed, thread: event.issue_number });
      return finalize(
        { ok: true, mode: "stop", invoke_claude: false, lease, post_lock: true },
        event,
      );
    }
    const stopped = applyStop(existing, parsed);
    if (!stopped.ok) return finalize(stopped, event);
    return finalize(
      {
        ok: true,
        mode: "stop",
        invoke_claude: false,
        lease: stopped.lease,
        post_lock: true,
      },
      event,
    );
  }

  if (parsed.mode === "simple") {
    const perm = event.permission
      ? assertWritePermission(event.permission)
      : github
        ? assertWritePermission(
            await fetchPermissionLevel(github, {
              owner: OWNER_LOGIN,
              repo: REPOSITORY.split("/")[1],
              username: OWNER_LOGIN,
            }),
          )
        : { ok: false, code: "permission_unverified", message: "write permission not fetched" };
    if (!perm.ok) return finalize(perm, event);
    return finalize(
      {
        ok: true,
        mode: "simple",
        invoke_claude: true,
        allowed_tools: SIMPLE_ALLOWED_TOOLS.join(","),
        disallowed_tools: DISALLOWED_CLAUDE_TOOLS.join(","),
        max_turns: MAX_TURNS,
        prompt: buildTrustedPrompt({ mode: "simple", requestText: parsed.request_text }),
      },
      event,
    );
  }

  const admitted = isActivationAdmitted(event.activation);
  if (!admitted) {
    return finalize(
      {
        ok: true,
        mode: "executable_review",
        invoke_claude: false,
        rejected: true,
        code: "runner_not_admitted",
        message: `${ACTIVATION_VAR} must equal ${ACTIVATION_VALUE} before executable review runs`,
        work_order: parsed.work_order,
      },
      event,
    );
  }

  const perm = event.permission
    ? assertWritePermission(event.permission)
    : github
      ? assertWritePermission(
          await fetchPermissionLevel(github, {
            owner: OWNER_LOGIN,
            repo: REPOSITORY.split("/")[1],
            username: OWNER_LOGIN,
          }),
        )
      : resultErr("permission_unverified", "write permission not fetched");
  if (!perm.ok) return finalize(perm, event);

  let captured = capturedAuthority || null;
  let comments = [];
  let leaseState = existingLease;
  if (github) {
    const [owner, repoName] = REPOSITORY.split("/");
    const pr = await fetchPull(github, {
      owner,
      repo: repoName,
      pr: parsed.work_order.subject.pr,
    });
    const compared = compareFetchedVsClaimed(parsed.work_order.subject, pr);
    if (!compared.ok) return finalize(compared, event);
    const comment = await fetchIssueComment(github, {
      owner,
      repo: repoName,
      commentId: parsed.work_order.authority_comment_id,
    });
    const bound = bindAuthorityComment(parsed.work_order, comment);
    if (!bound.ok) return finalize(bound, event);
    if (captured) {
      const auth = detectEditedAuthorityComment(captured, {
        ...comment,
        body_sha256: bodySha256(comment.body),
      });
      if (!auth.ok) return finalize(auth, event);
    }
    captured = captured || bound.captured;
    const thread = assertCanonicalThread({
      issueUrl: comment.issue_url,
      eventIssueNumber: event.issue_number,
    });
    if (!thread.ok) return finalize(thread, event);
    const liveHead = pr.head;
    const stale = detectStaleHead(parsed.work_order.subject.head, liveHead);
    if (!stale.ok) return finalize(stale, event);
    if (!event.issue_number) {
      return finalize(
        resultErr("incomplete_comment_history", "executable review requires a canonical issue thread"),
        event,
      );
    }
    const history = await fetchCommentHistory(github, {
      owner,
      repo: repoName,
      issueNumber: event.issue_number,
    });
    if (!history.ok) return finalize(history, event);
    comments = history.comments;
    const control = reduceControlState(comments, {
      dispatchKey: parsed.work_order.dispatch_key,
      taskId: parsed.work_order.task_id,
      thread: event.issue_number,
    });
    if (!control.ok) return finalize(control, event);
    if (control.stopped) {
      return finalize(
        {
          ok: true,
          mode: "executable_review",
          invoke_claude: false,
          rejected: true,
          code: "stopped",
          message: "authenticated STOP or stopped lease is present",
          work_order: parsed.work_order,
          lease: makeStoppedLease({
            dispatch_key: parsed.work_order.dispatch_key,
            task_id: parsed.work_order.task_id,
            thread: event.issue_number,
          }),
        },
        event,
      );
    }
    leaseState = leaseState || control.lease;
  }

  const attempt = `${event.run_id}-${sha256Hex(parsed.work_order.dispatch_key).slice(0, 8)}`;
  const incoming = makeLease({
    dispatchKey: parsed.work_order.dispatch_key,
    taskId: parsed.work_order.task_id,
    attempt,
    runId: event.run_id,
    head: parsed.work_order.subject.head,
    status: "leased",
    thread: event.issue_number,
    authorityCommentId: parsed.work_order.authority_comment_id,
  });
  if (parsed.work_order.continuation_of) {
    incoming.continuation_of = parsed.work_order.continuation_of;
  }
  const lease = acquireLease(leaseState, incoming);
  if (!lease.ok) return finalize(lease, event);

  return finalize(
    {
      ok: true,
      mode: "executable_review",
      invoke_claude: true,
      admitted: true,
      work_order: parsed.work_order,
      lease: lease.lease,
      captured_authority: captured,
      post_lock: true,
      allowed_tools: EXECUTABLE_ALLOWED_TOOLS.join(","),
      disallowed_tools: DISALLOWED_CLAUDE_TOOLS.join(","),
      max_turns: MAX_TURNS,
    },
    event,
  );
}

export function prepareStateDir(baseDir, decision) {
  fs.mkdirSync(baseDir, { recursive: true });
  const files = {
    "decision.json": decision,
    "work-order.json": decision.work_order || null,
    "lease.json": decision.lease || null,
  };
  if (decision.mode === "executable_review" && decision.work_order) {
    files["prompt.txt"] = buildTrustedPrompt({
      mode: "executable_review",
      workOrder: decision.work_order,
      evidenceDir: path.join(baseDir, "evidence"),
      limits: {
        max_probes: decision.work_order.max_probes,
        max_sandbox_seconds: decision.work_order.max_sandbox_seconds,
      },
    });
  } else if (decision.mode === "simple") {
    files["prompt.txt"] = decision.prompt;
  }
  writeEvidencePack(path.join(baseDir, "evidence"), {
    "README.txt": "Trusted evidence pack. Broker may only read these files.",
  });
  if (decision.work_order && decision.lease) {
    files["provenance.json"] = {
      task_id: decision.work_order.task_id,
      attempt: decision.lease.attempt,
      dispatch_key: decision.work_order.dispatch_key,
      authority_comment_id: decision.work_order.authority_comment_id,
      head: decision.work_order.subject?.head,
      base: decision.work_order.subject?.base,
      pr: decision.work_order.subject?.pr,
      max_probes: decision.work_order.max_probes,
      max_sandbox_seconds: decision.work_order.max_sandbox_seconds,
    };
  }
  if (decision.captured_authority) {
    files["authority-capture.json"] = decision.captured_authority;
  }
  rewriteMcpConfig(baseDir);
  for (const [name, value] of Object.entries(files)) {
    if (value == null) continue;
    const dest = path.join(baseDir, name);
    fs.writeFileSync(
      dest,
      typeof value === "string" ? value : JSON.stringify(value, null, 2),
    );
  }
  return baseDir;
}

export function rewriteMcpConfig(stateDir) {
  fs.mkdirSync(stateDir, { recursive: true });
  const cfg = mcpConfig({ brokerPath: BROKER_BIN, stateDir });
  fs.writeFileSync(path.join(stateDir, "mcp.json"), JSON.stringify(cfg, null, 2));
  return cfg;
}

function finalize(decision, event) {
  const dispatchKey =
    decision.work_order?.dispatch_key ||
    decision.lease?.dispatch_key ||
    (decision.dispatch_key ?? "");
  const invoke = Boolean(decision.invoke_claude);
  const outputs = {
    ok: String(Boolean(decision.ok)),
    mode: decision.mode || "rejected",
    invoke_claude: String(invoke),
    admitted: String(Boolean(decision.admitted)),
    code: decision.code || "",
    message: decision.message || "",
    dispatch_key: dispatchKey,
    lock_marker: decision.lease ? renderLockMarker(decision.lease) : "",
    at: nowIso(),
  };
  if (decision.allowed_tools) outputs.allowed_tools = decision.allowed_tools;
  if (decision.disallowed_tools) outputs.disallowed_tools = decision.disallowed_tools;
  if (decision.prompt) outputs.prompt = decision.prompt;
  return {
    ...decision,
    invoke_claude: invoke,
    event,
    outputs,
    github_output: Object.entries(outputs).map(([k, v]) => githubOutput(k, v)).join(""),
  };
}

export { writeGithubOutput };
