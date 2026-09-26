import {
  COMMENT_HISTORY_MAX_BYTES,
  COMMENT_HISTORY_MAX_MS,
  COMMENT_HISTORY_MAX_PAGES,
  COMMENT_PAGE_SIZE,
  REPOSITORY,
} from "./constants.js";
import { resultErr, resultOk } from "./util.js";

export function parseLinkNext(linkHeader) {
  if (!linkHeader) return null;
  for (const part of String(linkHeader).split(",")) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="?next"?/i);
    if (m) return m[1].trim();
  }
  return null;
}

export function expectedCommentsPath(owner, repo, issueNumber) {
  return `/repos/${owner}/${repo}/issues/${issueNumber}/comments`;
}

/**
 * Credentials may follow only same-origin, same-path pagination that GitHub
 * advertised in Link. Unsafe URLs must not be fetched with a token.
 */
export function assertSafeNextPage(nextUrl, { baseUrl, expectedPath }) {
  if (!nextUrl || typeof nextUrl !== "string") {
    return resultErr("unsafe_next_page", "next page URL missing");
  }
  let base;
  let next;
  try {
    base = new URL(baseUrl);
    next = new URL(nextUrl, baseUrl);
  } catch {
    return resultErr("unsafe_next_page", "next page URL is not parseable", { nextUrl });
  }
  if (next.username || next.password) {
    return resultErr("unsafe_next_page", "next page URL must not include userinfo");
  }
  if (next.protocol !== base.protocol || next.hostname !== base.hostname || next.port !== base.port) {
    return resultErr("unsafe_next_page", "next page URL is not the authenticated GitHub origin", {
      nextUrl,
    });
  }
  if (next.pathname !== expectedPath) {
    return resultErr("unsafe_next_page", "next page path is not the expected comments endpoint", {
      nextUrl,
      expectedPath,
    });
  }
  for (const key of next.searchParams.keys()) {
    if (!["page", "per_page", "since"].includes(key)) {
      return resultErr("unsafe_next_page", "next page query has unexpected keys", { key });
    }
  }
  return resultOk({ url: next.toString() });
}

export function parseIssueUrl(issueUrl) {
  if (typeof issueUrl !== "string" || !issueUrl) {
    return resultErr("authority_thread_missing", "authority comment issue_url missing");
  }
  let u;
  try {
    u = new URL(issueUrl);
  } catch {
    return resultErr("authority_thread_invalid", "issue_url is not a URL");
  }
  const m = u.pathname.match(/\/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)$/);
  if (!m) {
    return resultErr("authority_thread_invalid", "issue_url path is not an issue");
  }
  const repository = `${m[1]}/${m[2]}`;
  if (repository !== REPOSITORY) {
    return resultErr("canonical_thread_mismatch", "authority issue_url repository mismatch", {
      repository,
    });
  }
  return resultOk({ issue_number: Number(m[3]), repository });
}

export function assertCanonicalThread({ issueUrl, eventIssueNumber }) {
  const parsed = parseIssueUrl(issueUrl);
  if (!parsed.ok) return parsed;
  if (!eventIssueNumber || Number(eventIssueNumber) !== parsed.issue_number) {
    return resultErr(
      "canonical_thread_mismatch",
      "request is not on the authority comment's canonical thread",
      { expected: parsed.issue_number, observed: eventIssueNumber },
    );
  }
  return parsed;
}

/**
 * Complete comment history under finite page/byte/time budgets.
 * Incomplete, malformed, capped, or failed retrieval is BLOCKED — never [].
 */
export async function fetchCommentHistory(
  client,
  {
    owner,
    repo,
    issueNumber,
    now = Date.now,
    maxPages = COMMENT_HISTORY_MAX_PAGES,
    maxBytes = COMMENT_HISTORY_MAX_BYTES,
    maxMs = COMMENT_HISTORY_MAX_MS,
    pageSize = COMMENT_PAGE_SIZE,
  } = {},
) {
  if (!issueNumber) {
    return resultErr("incomplete_comment_history", "issue number required for comment history");
  }
  if (!client || typeof client.getJsonWithMeta !== "function") {
    return resultErr("incomplete_comment_history", "GitHub client cannot page comment history");
  }
  const started = now();
  const expectedPath = expectedCommentsPath(owner, repo, issueNumber);
  const comments = [];
  const seenIds = new Set();
  let bytes = 0;
  let pages = 0;
  let nextUrl = null;
  const remainingMs = () => Math.max(1, maxMs - (now() - started));

  while (pages < maxPages) {
    if (now() - started > maxMs) {
      return resultErr("incomplete_comment_history", "comment history exceeded time budget", {
        pages,
        bytes,
      });
    }
    pages += 1;
    const remainingBytes = maxBytes - bytes;
    if (remainingBytes <= 0) {
      return resultErr("incomplete_comment_history", "comment history exceeded byte budget", {
        pages,
        bytes,
      });
    }
    let meta;
    try {
      if (nextUrl) {
        const safe = assertSafeNextPage(nextUrl, {
          baseUrl: client.baseUrl,
          expectedPath,
        });
        if (!safe.ok) {
          return resultErr("incomplete_comment_history", safe.message, {
            cause: "unsafe_next_page",
            nextUrl,
          });
        }
        meta = await client.getJsonWithMeta(safe.url, {
          absolute: true,
          maxBytes: remainingBytes,
          timeoutMs: remainingMs(),
        });
      } else {
        meta = await client.getJsonWithMeta(
          `${expectedPath}?per_page=${pageSize}&page=1`,
          { maxBytes: remainingBytes, timeoutMs: remainingMs() },
        );
      }
    } catch (err) {
      return resultErr(
        "incomplete_comment_history",
        err?.code === "response_too_large"
          ? "comment history exceeded byte budget"
          : err?.message || "comment history request failed",
        { pages, bytes, cause: err?.code || err?.status },
      );
    }
    bytes += meta.bytes || 0;
    if (bytes > maxBytes) {
      return resultErr("incomplete_comment_history", "comment history exceeded byte budget", {
        pages,
        bytes,
      });
    }
    if (!meta.ok) {
      return resultErr(
        "incomplete_comment_history",
        `GitHub comments page failed: ${meta.status}`,
        { pages, status: meta.status },
      );
    }
    if (!Array.isArray(meta.json)) {
      return resultErr("incomplete_comment_history", "comments page is not an array", { pages });
    }
    for (const comment of meta.json) {
      const id = Number(comment?.id);
      if (!Number.isInteger(id) || id <= 0) {
        return resultErr("incomplete_comment_history", "comment page contained a malformed id", {
          pages,
        });
      }
      if (seenIds.has(id)) {
        return resultErr("incomplete_comment_history", "duplicate comment id in history", { id });
      }
      seenIds.add(id);
      comments.push(comment);
    }
    const headerLink = meta.headers?.link || meta.headers?.Link || "";
    const next = parseLinkNext(headerLink);
    if (!next) {
      return resultOk({
        comments,
        pages,
        bytes,
        complete: true,
        exact_full_final_page: meta.json.length === pageSize,
      });
    }
    if (meta.json.length === 0) {
      return resultErr(
        "incomplete_comment_history",
        "empty comments page advertised a next link",
        { pages },
      );
    }
    nextUrl = next;
  }
  return resultErr("incomplete_comment_history", "comment history exceeded page budget", {
    pages,
    bytes,
  });
}
