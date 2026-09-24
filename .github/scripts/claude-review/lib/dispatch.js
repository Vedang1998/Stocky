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
  assertImmutableOwnerActor,
  assertRepository,
  assertWritePermission,
  compareFetchedVsClaimed,
  detectEditedAuthorityComment,
  detectStaleHead,
  fetchIssueComment,
  fetchPermissionLevel,
  fetchPull,
  isActivationAdmitted,
} from "./authority.js";
import { parseCommentBody } from "./parse-work-order.js";
import { acquireLease, applyStop, makeLease, renderLockMarker } from "./session.js";
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
    const stopped = applyStop(existingLease, parsed);
    if (!stopped.ok) return finalize(stopped, event);
    return finalize(
      {
        ok: true,
        mode: "stop",
        invoke_claude: false,
        lease: stopped.lease,
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
    const expected = capturedAuthority || {
      id: parsed.work_order.authority_comment_id,
      body_sha256: bodySha256(comment.body),
    };
    const auth = detectEditedAuthorityComment(expected, {
      ...comment,
      body_sha256: bodySha256(comment.body),
    });
    if (!auth.ok) return finalize(auth, event);
    const liveHead = pr.head;
    const stale = detectStaleHead(parsed.work_order.subject.head, liveHead);
    if (!stale.ok) return finalize(stale, event);
  }

  const attempt = `${event.run_id}-${sha256Hex(parsed.work_order.dispatch_key).slice(0, 8)}`;
  const incoming = makeLease({
    dispatchKey: parsed.work_order.dispatch_key,
    taskId: parsed.work_order.task_id,
    attempt,
    runId: event.run_id,
    head: parsed.work_order.subject.head,
    status: "leased",
  });
  const lease = acquireLease(existingLease, incoming);
  if (!lease.ok) return finalize(lease, event);

  return finalize(
    {
      ok: true,
      mode: "executable_review",
      invoke_claude: true,
      admitted: true,
      work_order: parsed.work_order,
      lease: lease.lease,
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
  fs.writeFileSync(
    path.join(baseDir, "mcp.json"),
    JSON.stringify(mcpConfig({ brokerPath: BROKER_BIN, stateDir: baseDir }), null, 2),
  );
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

function finalize(decision, event) {
  const outputs = {
    ok: String(Boolean(decision.ok)),
    mode: decision.mode || "rejected",
    invoke_claude: String(Boolean(decision.invoke_claude)),
    code: decision.code || "",
    message: decision.message || "",
    lock_marker: decision.lease ? renderLockMarker(decision.lease) : "",
    at: nowIso(),
  };
  if (decision.allowed_tools) outputs.allowed_tools = decision.allowed_tools;
  if (decision.disallowed_tools) outputs.disallowed_tools = decision.disallowed_tools;
  if (decision.prompt) outputs.prompt = decision.prompt;
  return { ...decision, event, outputs, github_output: Object.entries(outputs).map(([k, v]) => githubOutput(k, v)).join("") };
}

export { writeGithubOutput };
