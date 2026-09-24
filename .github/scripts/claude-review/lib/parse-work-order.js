import {
  FORBIDDEN_WORK_ORDER_KEYS,
  MAX_COMMENT_BYTES,
  MAX_PROBES,
  MAX_SANDBOX_SECONDS,
  EXPECTED_ARTIFACT_NAME,
  PROFILE_ID,
  REPOSITORY,
  ROLE_INDEPENDENT_REVIEWER,
  STOP_MARKER,
  SUBJECT_ALLOWED_KEYS,
  TASK_ALLOWED_KEYS,
  TASK_MARKER,
  TRIGGER_PREFIX,
} from "./constants.js";
import { isFullSha, isPositiveInt, resultErr, resultOk } from "./util.js";

export function parseCommentBody(body) {
  if (typeof body !== "string") {
    return resultErr("invalid_body", "comment body must be a string");
  }
  const bytes = Buffer.byteLength(body, "utf8");
  if (bytes > MAX_COMMENT_BYTES) {
    return resultErr("comment_too_large", "comment exceeds size cap", { bytes });
  }
  if (!body.startsWith(TRIGGER_PREFIX)) {
    return resultErr("missing_trigger", "comment must start with '@claude '");
  }
  const rest = body.slice(TRIGGER_PREFIX.length);
  const trimmed = rest.trimStart();
  if (trimmed.startsWith(STOP_MARKER)) {
    return parseMarkedJson("stop", STOP_MARKER, trimmed);
  }
  if (trimmed.startsWith(TASK_MARKER)) {
    return parseMarkedJson("executable_review", TASK_MARKER, trimmed);
  }
  if (trimmed.startsWith("STOCKY_REVIEW_")) {
    return resultErr("unknown_marker", "unrecognized STOCKY_REVIEW marker");
  }
  return resultOk({
    mode: "simple",
    request_text: rest,
  });
}

function parseMarkedJson(mode, marker, trimmed) {
  const after = trimmed.slice(marker.length);
  const json = parseExactJsonObject(after);
  if (!json.ok) return json;
  if (mode === "stop") {
    return validateStop(json.value);
  }
  return validateTask(json.value);
}

export function parseExactJsonObject(text) {
  if (typeof text !== "string") {
    return resultErr("invalid_json", "JSON payload must be a string");
  }
  const start = text.search(/\S/);
  if (start < 0) {
    return resultErr("missing_json", "expected a JSON object after the marker");
  }
  const payload = text.slice(start);
  if (!payload.startsWith("{")) {
    return resultErr("garbage_before_json", "JSON object must be the next token");
  }
  let value;
  try {
    value = JSON.parse(payload);
  } catch {
    return resultErr("invalid_json", "JSON.parse failed");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return resultErr("json_not_object", "payload must be a JSON object");
  }
  return resultOk({ value });
}

function extraKeys(obj, allowed) {
  return Object.keys(obj).filter((k) => !allowed.includes(k));
}

function forbiddenHit(obj) {
  const keys = Object.keys(obj).map((k) => k.toLowerCase());
  return FORBIDDEN_WORK_ORDER_KEYS.filter((k) => keys.includes(k));
}

function validateStop(value) {
  const forbidden = forbiddenHit(value);
  if (forbidden.length) {
    return resultErr("forbidden_key", "stop payload includes forbidden keys", {
      forbidden,
    });
  }
  const extra = extraKeys(value, ["task_id", "dispatch_key"]);
  if (extra.length) {
    return resultErr("unexpected_key", "stop payload has unexpected keys", { extra });
  }
  const taskId = checkTaskId(value.task_id);
  if (!taskId.ok) return taskId;
  const dispatchKey = checkDispatchKey(value.dispatch_key);
  if (!dispatchKey.ok) return dispatchKey;
  return resultOk({
    mode: "stop",
    task_id: value.task_id,
    dispatch_key: value.dispatch_key,
  });
}

export function validateTask(value) {
  const forbidden = forbiddenHit(value);
  if (forbidden.length) {
    return resultErr("forbidden_key", "work order includes forbidden keys", {
      forbidden,
    });
  }
  const extra = extraKeys(value, [...TASK_ALLOWED_KEYS]);
  if (extra.length) {
    return resultErr("unexpected_key", "work order has unexpected keys", { extra });
  }
  const taskId = checkTaskId(value.task_id);
  if (!taskId.ok) return taskId;
  const dispatchKey = checkDispatchKey(value.dispatch_key);
  if (!dispatchKey.ok) return dispatchKey;
  if (value.role !== ROLE_INDEPENDENT_REVIEWER) {
    return resultErr("wrong_role", "role must be independent_reviewer");
  }
  if (value.profile !== PROFILE_ID) {
    return resultErr("wrong_profile", `profile must be ${PROFILE_ID}`);
  }
  if (value.expected_artifact !== EXPECTED_ARTIFACT_NAME) {
    return resultErr(
      "wrong_artifact_name",
      `expected_artifact must be ${EXPECTED_ARTIFACT_NAME}`,
    );
  }
  if (!isPositiveInt(value.max_probes, 1, MAX_PROBES)) {
    return resultErr("invalid_max_probes", "max_probes out of range");
  }
  if (!isPositiveInt(value.max_sandbox_seconds, 1, MAX_SANDBOX_SECONDS)) {
    return resultErr(
      "invalid_max_sandbox_seconds",
      "max_sandbox_seconds out of range",
    );
  }
  if (!isPositiveInt(value.authority_comment_id, 1, 2 ** 53 - 1)) {
    return resultErr(
      "invalid_authority_comment_id",
      "authority_comment_id must be a positive integer locator",
    );
  }
  if (
    value.publish_review_branch !== undefined &&
    typeof value.publish_review_branch !== "boolean"
  ) {
    return resultErr(
      "invalid_publish_review_branch",
      "publish_review_branch must be boolean",
    );
  }
  if (value.continuation_of != null) {
    const cont = checkTaskId(value.continuation_of);
    if (!cont.ok) {
      return resultErr("invalid_continuation_of", "continuation_of is invalid");
    }
  }
  const subject = validateSubject(value.subject);
  if (!subject.ok) return subject;
  return resultOk({
    mode: "executable_review",
    work_order: {
      task_id: value.task_id,
      dispatch_key: value.dispatch_key,
      role: value.role,
      profile: value.profile,
      max_probes: value.max_probes,
      max_sandbox_seconds: value.max_sandbox_seconds,
      expected_artifact: value.expected_artifact,
      authority_comment_id: value.authority_comment_id,
      publish_review_branch: Boolean(value.publish_review_branch),
      continuation_of: value.continuation_of ?? null,
      subject: subject.subject,
    },
  });
}

function validateSubject(subject) {
  if (!subject || typeof subject !== "object" || Array.isArray(subject)) {
    return resultErr("invalid_subject", "subject must be an object");
  }
  const extra = extraKeys(subject, [...SUBJECT_ALLOWED_KEYS]);
  if (extra.length) {
    return resultErr("unexpected_subject_key", "subject has unexpected keys", {
      extra,
    });
  }
  if (subject.repository !== REPOSITORY) {
    return resultErr("wrong_repository", "subject.repository mismatch");
  }
  if (!isPositiveInt(subject.pr, 1, 1_000_000)) {
    return resultErr("invalid_pr", "subject.pr must be a positive integer");
  }
  if (!isFullSha(subject.head)) {
    return resultErr("invalid_head", "subject.head must be a 40-char lowercase SHA");
  }
  if (!isFullSha(subject.base)) {
    return resultErr("invalid_base", "subject.base must be a 40-char lowercase SHA");
  }
  if (subject.head === subject.base) {
    return resultErr("head_equals_base", "subject head and base must differ");
  }
  return resultOk({
    subject: {
      repository: subject.repository,
      pr: subject.pr,
      head: subject.head,
      base: subject.base,
    },
  });
}

export function checkTaskId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(value)) {
    return resultErr("invalid_task_id", "task_id failed allowlist");
  }
  return resultOk({ task_id: value });
}

export function checkDispatchKey(value) {
  if (typeof value !== "string" || !/^propo:[A-Za-z0-9._:-]{1,200}$/.test(value)) {
    return resultErr("invalid_dispatch_key", "dispatch_key failed allowlist");
  }
  return resultOk({ dispatch_key: value });
}
