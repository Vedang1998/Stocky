import { bodySha256, sanitizePublicText } from "./sanitize.js";
import { LOCK_MARKER_PREFIX, LOCK_MARKER_SUFFIX, TRIGGER_PREFIX } from "./constants.js";
import { parseCommentBody } from "./parse-work-order.js";
import { nowIso, resultErr, resultOk, sha256Hex } from "./util.js";

export function makeLease({ dispatchKey, taskId, attempt, runId, head, status }) {
  return {
    dispatch_key: dispatchKey,
    task_id: taskId,
    attempt,
    run_id: runId ?? null,
    head,
    status,
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
  ].join(" ");
  return `${LOCK_MARKER_PREFIX} ${payload} ${LOCK_MARKER_SUFFIX}`;
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
  if (existing.dispatch_key !== incoming.dispatch_key) {
    return resultErr("dispatch_key_conflict", "tracking comment bound to another key", {
      existing,
      incoming,
    });
  }
  if (
    existing.status === "running" ||
    existing.status === "leased" ||
    existing.status === "completed"
  ) {
    if (existing.attempt !== incoming.attempt) {
      return resultErr("duplicate_dispatch", "an attempt is already leased", { existing });
    }
    return resultErr("stale_attempt", "attempt is already in progress or finished", {
      existing,
    });
  }
  if (existing.status === "unknown" || existing.status === "checkpointed") {
    if (incoming.continuation) {
      return resultOk({ lease: incoming, action: "continue" });
    }
    return resultErr("needs_continuation", "interrupted run requires continuation_of", {
      existing,
    });
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
  });
}

export function leaseFromComments(comments, { dispatchKey, taskId } = {}) {
  if (!Array.isArray(comments)) return null;
  let found = null;
  for (const c of comments) {
    const parsed = parseLockMarker(c?.body);
    if (!parsed.ok) continue;
    if (dispatchKey && parsed.lease.dispatch_key !== dispatchKey) continue;
    if (taskId && parsed.lease.task_id !== taskId) continue;
    found = parsed.lease;
  }
  return found;
}

export function stopFromComments(comments, { dispatchKey, taskId } = {}) {
  if (!Array.isArray(comments)) return null;
  for (const c of comments) {
    const body = String(c?.body || "");
    if (body.startsWith(TRIGGER_PREFIX)) {
      const parsed = parseCommentBody(body);
      if (
        parsed.ok &&
        parsed.mode === "stop" &&
        parsed.dispatch_key === dispatchKey &&
        parsed.task_id === taskId
      ) {
        return parsed;
      }
    }
    const lock = parseLockMarker(body);
    if (
      lock.ok &&
      lock.lease.status === "stopped" &&
      lock.lease.dispatch_key === dispatchKey &&
      lock.lease.task_id === taskId
    ) {
      return { mode: "stop", dispatch_key: dispatchKey, task_id: taskId, lease: lock.lease };
    }
  }
  return null;
}

export function checkpoint(state, reason) {
  return {
    at: nowIso(),
    reason,
    sha256: sha256Hex(JSON.stringify(state)),
    state: JSON.parse(JSON.stringify(state)),
  };
}

export function readbackMatches(postedBody, expectedMarker) {
  const parsed = parseLockMarker(postedBody);
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
