import { OWNER_ID, OWNER_LOGIN, OWNER_TYPE, REPOSITORY } from "./constants.js";
import { bodySha256 } from "./sanitize.js";
import { isFullSha, resultErr, resultOk } from "./util.js";

export { OWNER_ID, OWNER_LOGIN, OWNER_TYPE, REPOSITORY };

/**
 * Immutable actor binding. Login match is not enough.
 * Tests disable this function in a disposable copy to revive wrong-actor success.
 */
export function assertImmutableOwnerActor(actor) {
  if (!actor || typeof actor !== "object") {
    return resultErr("missing_actor", "actor is required");
  }
  if (actor.login !== OWNER_LOGIN) {
    return resultErr("wrong_login", "actor login is not the bound owner");
  }
  if (Number(actor.id) !== OWNER_ID) {
    return resultErr("wrong_actor_id", "actor id is not the bound owner numeric id");
  }
  if (actor.type !== OWNER_TYPE) {
    return resultErr("wrong_actor_type", "actor type must be User");
  }
  return resultOk({ actor: { login: OWNER_LOGIN, id: OWNER_ID, type: OWNER_TYPE } });
}

export function assertRepository(fullName) {
  if (fullName !== REPOSITORY) {
    return resultErr("wrong_repository", "repository mismatch");
  }
  return resultOk({ repository: REPOSITORY });
}

export function assertWritePermission(permission) {
  if (permission === "admin" || permission === "write") {
    return resultOk({ permission });
  }
  return resultErr("insufficient_permission", "actor lacks repository write authority", {
    permission,
  });
}

export function compareFetchedVsClaimed(claimed, fetched) {
  if (!claimed || !fetched) {
    return resultErr("missing_compare", "claimed and fetched records are required");
  }
  const mismatches = [];
  if (claimed.pr !== fetched.pr) mismatches.push("pr");
  if (claimed.head !== fetched.head) mismatches.push("head");
  if (claimed.base !== fetched.base) mismatches.push("base");
  if (claimed.repository && claimed.repository !== fetched.repository) {
    mismatches.push("repository");
  }
  if (mismatches.length) {
    return resultErr("authority_mismatch", "caller locators do not match fetched metadata", {
      mismatches,
      claimed,
      fetched,
    });
  }
  return resultOk({ subject: fetched });
}

export function detectEditedAuthorityComment(expected, fetched) {
  if (!fetched) {
    return resultErr("authority_missing", "authority comment could not be fetched");
  }
  if (Number(fetched.id) !== Number(expected.id)) {
    return resultErr("authority_id_mismatch", "authority comment id mismatch");
  }
  if (fetched.user?.id && Number(fetched.user.id) !== OWNER_ID) {
    return resultErr("authority_wrong_author", "authority comment author is not the owner");
  }
  if (typeof fetched.body !== "string" || fetched.body.length === 0) {
    return resultErr("authority_empty", "authority comment body missing");
  }
  if (expected.body_sha256 && fetched.body_sha256 !== expected.body_sha256) {
    return resultErr("authority_edited", "authority comment body changed after capture");
  }
  return resultOk({ comment: fetched });
}

export function detectStaleHead(capturedHead, liveHead) {
  if (!isFullSha(capturedHead) || !isFullSha(liveHead)) {
    return resultErr("invalid_head_compare", "head SHAs must be full hashes");
  }
  if (capturedHead !== liveHead) {
    return resultErr("stale_head", "subject head moved during execution", {
      capturedHead,
      liveHead,
    });
  }
  return resultOk({ head: capturedHead });
}

export function isActivationAdmitted(value) {
  return value === "admitted";
}

export async function fetchPermissionLevel(client, { owner, repo, username }) {
  const data = await client.getJson(
    `/repos/${owner}/${repo}/collaborators/${encodeURIComponent(username)}/permission`,
  );
  return data.permission ?? data.data?.permission;
}

export async function fetchPull(client, { owner, repo, pr }) {
  const data = await client.getJson(`/repos/${owner}/${repo}/pulls/${pr}`);
  return {
    pr: data.number,
    repository: `${owner}/${repo}`,
    head: data.head?.sha,
    base: data.base?.sha,
    state: data.state,
    draft: data.draft,
    title: data.title,
    html_url: data.html_url,
    changed_files: data.changed_files,
  };
}

export async function fetchIssueComment(client, { owner, repo, commentId }) {
  const data = await client.getJson(
    `/repos/${owner}/${repo}/issues/comments/${commentId}`,
  );
  return {
    id: data.id,
    user: data.user,
    body: data.body,
    updated_at: data.updated_at,
    created_at: data.created_at,
    html_url: data.html_url,
  };
}

export async function fetchIssueComments(client, { owner, repo, issueNumber }) {
  if (!issueNumber) return [];
  const data = await client.getJson(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`,
  );
  return Array.isArray(data) ? data : [];
}

/**
 * Authority body must contain the task/dispatch/head locators. GitHub
 * created_at vs updated_at is durable edit evidence (not a self-hash).
 */
export function bindAuthorityComment(workOrder, comment) {
  if (!comment || typeof comment.body !== "string" || comment.body.length === 0) {
    return resultErr("authority_missing", "authority comment could not be fetched");
  }
  if (Number(comment.id) !== Number(workOrder.authority_comment_id)) {
    return resultErr("authority_id_mismatch", "authority comment id mismatch");
  }
  if (comment.user?.id && Number(comment.user.id) !== OWNER_ID) {
    return resultErr("authority_wrong_author", "authority comment author is not the owner");
  }
  const body = comment.body;
  if (!body.includes(workOrder.task_id)) {
    return resultErr("authority_unbound_task", "authority body does not contain task_id");
  }
  if (!body.includes(workOrder.dispatch_key)) {
    return resultErr("authority_unbound_dispatch", "authority body does not contain dispatch_key");
  }
  if (!body.includes(workOrder.subject.head)) {
    return resultErr("authority_unbound_head", "authority body does not contain subject head");
  }
  if (comment.created_at && comment.updated_at && comment.created_at !== comment.updated_at) {
    return resultErr("authority_edited", "authority comment was edited after creation");
  }
  return resultOk({
    comment,
    captured: {
      id: comment.id,
      body_sha256: bodySha256(body),
      created_at: comment.created_at || null,
    },
  });
}
