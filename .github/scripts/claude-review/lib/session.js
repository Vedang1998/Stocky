import { bodySha256, sanitizePublicText } from "./sanitize.js";
import {
  LOCK_MARKER_PREFIX,
  LOCK_MARKER_SUFFIX,
  OWNER_ID,
  OWNER_TYPE,
  TRIGGER_PREFIX,
  WORKFLOW_BOT_ID,
  WORKFLOW_BOT_TYPE,
} from "./constants.js";
import { parseCommentBody } from "./parse-work-order.js";
import { nowIso, resultErr, resultOk, sha256Hex } from "./util.js";

export function makeLease({
  dispatchKey,
  taskId,
  attempt,
  runId,
  head,
  status,
  thread,
  authorityCommentId,
}) {
  return {
    dispatch_key: dispatchKey,
    task_id: taskId,
    attempt,
    run_id: runId ?? null,
    head,
    status,
    thread: thread ?? null,
    authority_comment_id: authorityCommentId ?? null,
    updated_at: nowIso(),
  };
}

export function renderLockMarker(lease) {
  const payload = [
    `dispatch_key=${lease.dispatch_key}`,
    `task_id=${lease.task_id}`,
    `attempt=${lease.attempt}`,
    `status=${lease.status}`,
    `head=${lease.head}`,
  ];
  if (lease.thread != null) payload.push(`thread=${lease.thread}`);
  if (lease.authority_comment_id != null) {
    payload.push(`authority=${lease.authority_comment_id}`);
  }
  if (lease.run_id != null) payload.push(`run=${lease.run_id}`);
  return `${LOCK_MARKER_PREFIX} ${payload.join(" ")} ${LOCK_MARKER_SUFFIX}`;
}

/**
 * Only a designated top-level envelope is a control record.
 * Markers embedded in narrative, quoted opinion, or code fences are ignored.
 */
export function parseTopLevelLockEnvelope(body) {
  const text = String(body ?? "").replace(/^\uFEFF/, "");
  const trimmedStart = text.replace(/^[ \t]+/, "");
  if (!trimmedStart.startsWith(LOCK_MARKER_PREFIX)) {
    return resultErr("no_lock_marker", "body does not start with the lock envelope");
  }
  return parseLockMarker(trimmedStart);
}

export function parseLockMarker(body) {
  const text = String(body ?? "");
  const start = text.indexOf(LOCK_MARKER_PREFIX);
  if (start < 0) return resultErr("no_lock_marker", "tracking comment has no lock marker");
  const end = text.indexOf(LOCK_MARKER_SUFFIX, start);
  if (end < 0) return resultErr("broken_lock_marker", "lock marker is not closed");
  const inner = text.slice(start + LOCK_MARKER_PREFIX.length, end).trim();
  const lease = {};
  for (const part of inner.split(/\s+/)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    lease[part.slice(0, eq)] = part.slice(eq + 1);
  }
  if (!lease.dispatch_key || !lease.task_id || !lease.status) {
    return resultErr("incomplete_lock_marker", "lock marker missing fields", { lease });
  }
  return resultOk({ lease, marker: text.slice(start, end + LOCK_MARKER_SUFFIX.length) });
}

export function acquireLease(existing, incoming) {
  if (!existing) {
    return resultOk({ lease: incoming, action: "create" });
  }
  if (existing.status === "stopped") {
    return resultErr("stopped", "task was stopped", { existing });
  }
  if (existing.status === "completed") {
    return resultErr("stale_attempt", "completed attempt cannot be overwritten", { existing });
  }
  if (existing.status === "released") {
    return resultErr("invalid_lease_status", "released markers are not control state", { existing });
  }
  if (existing.dispatch_key !== incoming.dispatch_key) {
    return resultErr("dispatch_key_conflict", "tracking comment bound to another key", {
      existing,
      incoming,
    });
  }
  if (existing.status === "running" || existing.status === "leased") {
    if (existing.attempt !== incoming.attempt) {
      return resultErr("duplicate_dispatch", "an attempt is already leased", { existing });
    }
    return resultErr("stale_attempt", "attempt is already in progress or finished", {
      existing,
    });
  }
  if (existing.status === "unknown" || existing.status === "checkpointed" || existing.status === "blocked") {
    if (incoming.continuation_of && incoming.continuation_of === existing.attempt) {
      return resultOk({ lease: incoming, action: "continue" });
    }
    return resultErr(
      "needs_continuation",
      "interrupted run requires continuation_of bound to prior attempt",
      { existing },
    );
  }
  return resultOk({ lease: incoming, action: "replace" });
}

export function applyStop(existing, stop) {
  if (!existing) {
    return resultErr("stop_without_lease", "STOP requires a fetched lease");
  }
  if (existing.dispatch_key !== stop.dispatch_key || existing.task_id !== stop.task_id) {
    return resultErr("stop_mismatch", "STOP does not match the leased task");
  }
  return resultOk({
    lease: { ...existing, status: "stopped", updated_at: nowIso() },
  });
}

export function makeStoppedLease(stop) {
  return makeLease({
    dispatchKey: stop.dispatch_key,
    taskId: stop.task_id,
    attempt: "stop",
    head: "0".repeat(40),
    status: "stopped",
    thread: stop.thread,
    authorityCommentId: stop.authority_comment_id,
  });
}

function actorId(comment) {
  const id = Number(comment?.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isOwnerActor(comment) {
  return actorId(comment) === OWNER_ID && comment?.user?.type === OWNER_TYPE;
}

function isWorkflowBot(comment) {
  return actorId(comment) === WORKFLOW_BOT_ID && comment?.user?.type === WORKFLOW_BOT_TYPE;
}

/**
 * Authenticated control-state reduction. Incomplete identity or ambiguous
 * trusted envelopes fail closed. Outsider lookalikes are diagnostics only.
 * Released text never clears a live/sticky state.
 */
export function reduceControlState(comments, { dispatchKey, taskId, thread } = {}) {
  if (!Array.isArray(comments)) {
    return resultErr("incomplete_comment_history", "comments must be an array");
  }
  const diagnostics = [];
  let lease = null;
  let stickyStop = false;
  let stickyCompleted = false;
  let runningAttempt = null;

  for (const comment of comments) {
    const body = String(comment?.body || "");
    const id = actorId(comment);

    if (body.startsWith(TRIGGER_PREFIX)) {
      const parsed = parseCommentBody(body);
      if (parsed.ok && parsed.mode === "stop") {
        if (id == null) {
          return resultErr("control_identity_missing", "STOP-like comment missing actor id", {
            comment_id: comment?.id,
          });
        }
        if (isOwnerActor(comment) && parsed.dispatch_key === dispatchKey && parsed.task_id === taskId) {
          stickyStop = true;
          lease = makeStoppedLease({ ...parsed, thread });
          continue;
        }
        diagnostics.push({ kind: "inert_outsider_stop", id: comment?.id, user_id: id });
      }
    }

    const top = parseTopLevelLockEnvelope(body);
    if (!top.ok) continue;
    if (id == null) {
      return resultErr("control_identity_missing", "lock envelope missing actor id", {
        comment_id: comment?.id,
      });
    }
    if (!isWorkflowBot(comment)) {
      diagnostics.push({ kind: "inert_outsider_lock", id: comment?.id, user_id: id });
      continue;
    }
    const L = top.lease;
    if (dispatchKey && L.dispatch_key !== dispatchKey) continue;
    if (taskId && L.task_id !== taskId) continue;
    if (thread != null && L.thread && Number(L.thread) !== Number(thread)) {
      return resultErr("canonical_thread_mismatch", "lease thread does not match canonical thread", {
        expected: thread,
        observed: L.thread,
      });
    }
    if (L.status === "released") {
      diagnostics.push({ kind: "ignored_released", id: comment?.id });
      continue;
    }
    if (L.status === "stopped" || stickyStop) {
      stickyStop = true;
      lease = { ...L, status: "stopped" };
      continue;
    }
    if (L.status === "completed" || stickyCompleted) {
      stickyCompleted = true;
      if (!stickyStop) lease = { ...L, status: "completed" };
      continue;
    }
    if (L.status === "running" || L.status === "leased") {
      if (runningAttempt && runningAttempt !== L.attempt) {
        return resultErr("duplicate_dispatch", "multiple authenticated running leases", {
          existing: runningAttempt,
          incoming: L.attempt,
        });
      }
      runningAttempt = L.attempt;
      lease = L;
      continue;
    }
    if (L.status === "blocked" || L.status === "unknown" || L.status === "checkpointed") {
      lease = L;
      continue;
    }
    return resultErr("invalid_lease_status", `unrecognized lease status ${L.status}`, { lease: L });
  }

  return resultOk({
    lease,
    stopped: stickyStop,
    completed: stickyCompleted,
    diagnostics,
  });
}

export function readbackMatches(postedBody, expectedMarker) {
  const parsed = parseTopLevelLockEnvelope(postedBody);
  if (!parsed.ok) return parsed;
  if (parsed.marker !== expectedMarker) {
    return resultErr("lost_ack", "readback marker does not match posted marker", {
      posted: sanitizePublicText(postedBody, 500),
    });
  }
  return resultOk({ lease: parsed.lease });
}

export function commentFingerprint(body) {
  return bodySha256(body);
}

export function checkpoint(state, reason) {
  return {
    at: nowIso(),
    reason,
    sha256: sha256Hex(JSON.stringify(state)),
    state: JSON.parse(JSON.stringify(state)),
  };
}

export { OWNER_ID, WORKFLOW_BOT_ID };
