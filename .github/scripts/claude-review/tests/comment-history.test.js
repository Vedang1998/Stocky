import assert from "node:assert/strict";
import http from "node:http";
import { after, describe, it } from "node:test";
import {
  COMMENT_PAGE_SIZE,
  OWNER_ID,
  OWNER_LOGIN,
  REPOSITORY,
} from "../lib/constants.js";
import { createGithubClient } from "../lib/github-client.js";
import {
  assertSafeNextPage,
  fetchCommentHistory,
  parseLinkNext,
} from "../lib/comment-history.js";

const [owner, repo] = REPOSITORY.split("/");

function comment(id, over = {}) {
  return {
    id,
    user: { login: OWNER_LOGIN, id: OWNER_ID, type: "User" },
    body: `comment-${id}`,
    ...over,
  };
}

function startPagedServer({ pages, links, statusForPage = {}, delayMs = 0, bytesPad = 0 } = {}) {
  const fetched = [];
  const server = http.createServer((req, res) => {
    fetched.push({ url: req.url, auth: req.headers.authorization || "" });
    const url = new URL(req.url, "http://127.0.0.1");
    const page = Number(url.searchParams.get("page") || "1");
    if (delayMs) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
    }
    if (statusForPage[page]) {
      res.statusCode = statusForPage[page];
      res.end("boom");
      return;
    }
    const payload = pages[page] || [];
    let body = JSON.stringify(payload);
    if (bytesPad) body += " ".repeat(bytesPad);
    if (links[page]) res.setHeader("Link", links[page]);
    res.setHeader("Content-Type", "application/json");
    res.end(body);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${server.address().port}`,
        fetched,
      });
    });
  });
}

describe("comment history pagination", () => {
  const servers = [];
  after(() => {
    for (const s of servers) s.close();
  });

  it("parses Link next and rejects unsafe next URLs without sending credentials", () => {
    assert.equal(
      parseLinkNext('<https://api.github.com/repos/Vedang1998/Stocky/issues/61/comments?page=2>; rel="next"'),
      "https://api.github.com/repos/Vedang1998/Stocky/issues/61/comments?page=2",
    );
    const unsafe = assertSafeNextPage("https://evil.example/steal", {
      baseUrl: "https://api.github.com",
      expectedPath: "/repos/Vedang1998/Stocky/issues/61/comments",
    });
    assert.equal(unsafe.ok, false);
    assert.equal(unsafe.code, "unsafe_next_page");
  });

  it("treats an exact-full final page as complete only when Link has no next", async () => {
    const page1 = Array.from({ length: COMMENT_PAGE_SIZE }, (_, i) => comment(i + 1));
    const mock = await startPagedServer({ pages: { 1: page1 }, links: {} });
    servers.push(mock.server);
    const github = createGithubClient({ baseUrl: mock.baseUrl, token: "secret-token" });
    const history = await fetchCommentHistory(github, { owner, repo, issueNumber: 61 });
    assert.equal(history.ok, true);
    assert.equal(history.complete, true);
    assert.equal(history.exact_full_final_page, true);
    assert.equal(history.comments.length, 100);
    assert.equal(mock.fetched.length, 1);
  });

  it("follows a remaining next page inside the expected repository endpoint", async () => {
    const page1 = Array.from({ length: COMMENT_PAGE_SIZE }, (_, i) => comment(i + 1));
    const page2 = [comment(101), comment(102)];
    const links = {};
    const mock = await startPagedServer({
      pages: { 1: page1, 2: page2 },
      links,
    });
    servers.push(mock.server);
    links[1] = `<${mock.baseUrl}/repos/${owner}/${repo}/issues/61/comments?page=2&per_page=100>; rel="next"`;
    const github = createGithubClient({ baseUrl: mock.baseUrl, token: "secret-token" });
    const history = await fetchCommentHistory(github, { owner, repo, issueNumber: 61 });
    assert.equal(history.ok, true, history.message);
    assert.equal(history.comments.length, 102);
    assert.equal(history.pages, 2);
    assert.equal(mock.fetched.length, 2);
    assert.match(mock.fetched[1].url, /page=2/);
    assert.match(mock.fetched[1].auth, /secret-token/);
  });

  it("trusted lease/STOP locators at 101 and 201 remain visible", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => comment(i + 1));
    const page2 = Array.from({ length: 100 }, (_, i) => comment(i + 101));
    page2[0] = comment(101, { body: "lease-at-101" });
    const page3 = [comment(201, { body: "stop-at-201" })];
    const links = {};
    const mock = await startPagedServer({
      pages: { 1: page1, 2: page2, 3: page3 },
      links,
    });
    servers.push(mock.server);
    links[1] = `<${mock.baseUrl}/repos/${owner}/${repo}/issues/61/comments?page=2&per_page=100>; rel="next"`;
    links[2] = `<${mock.baseUrl}/repos/${owner}/${repo}/issues/61/comments?page=3&per_page=100>; rel="next"`;
    const github = createGithubClient({ baseUrl: mock.baseUrl, token: "t" });
    const history = await fetchCommentHistory(github, { owner, repo, issueNumber: 61 });
    assert.equal(history.ok, true, history.message);
    assert.equal(history.comments.some((c) => c.body === "lease-at-101"), true);
    assert.equal(history.comments.some((c) => c.body === "stop-at-201"), true);
  });

  it("caps, errors, duplicate ids, and unsafe next fail closed rather than returning []", async () => {
    const page1 = [comment(1)];
    const mockUnsafe = await startPagedServer({
      pages: { 1: page1 },
      links: {
        1: '<https://evil.example/steal>; rel="next"',
      },
    });
    servers.push(mockUnsafe.server);
    const githubUnsafe = createGithubClient({ baseUrl: mockUnsafe.baseUrl, token: "secret-token" });
    const unsafe = await fetchCommentHistory(githubUnsafe, { owner, repo, issueNumber: 61 });
    assert.equal(unsafe.ok, false);
    assert.equal(unsafe.code, "incomplete_comment_history");
    assert.equal(mockUnsafe.fetched.length, 1);

    const mockErr = await startPagedServer({ pages: { 1: page1 }, links: {}, statusForPage: { 1: 500 } });
    servers.push(mockErr.server);
    const githubErr = createGithubClient({ baseUrl: mockErr.baseUrl, token: "t" });
    const errored = await fetchCommentHistory(githubErr, { owner, repo, issueNumber: 61 });
    assert.equal(errored.ok, false);
    assert.equal(errored.code, "incomplete_comment_history");

    const mockDup = await startPagedServer({
      pages: { 1: [comment(7), comment(7)] },
      links: {},
    });
    servers.push(mockDup.server);
    const githubDup = createGithubClient({ baseUrl: mockDup.baseUrl, token: "t" });
    const dup = await fetchCommentHistory(githubDup, { owner, repo, issueNumber: 61 });
    assert.equal(dup.ok, false);
    assert.match(dup.message, /duplicate/);

    const missing = await fetchCommentHistory(githubDup, { owner, repo, issueNumber: 0 });
    assert.equal(missing.ok, false);

    const linksP2 = {};
    const mockP2 = await startPagedServer({
      pages: { 1: [comment(1)], 2: [comment(2)] },
      links: linksP2,
      statusForPage: { 2: 500 },
    });
    servers.push(mockP2.server);
    linksP2[1] = `<${mockP2.baseUrl}/repos/${owner}/${repo}/issues/61/comments?page=2&per_page=100>; rel="next"`;
    const githubP2 = createGithubClient({ baseUrl: mockP2.baseUrl, token: "secret-token" });
    const page2Fail = await fetchCommentHistory(githubP2, { owner, repo, issueNumber: 61 });
    assert.equal(page2Fail.ok, false);
    assert.equal(page2Fail.code, "incomplete_comment_history");
    assert.equal(mockP2.fetched.length, 2);
    assert.match(mockP2.fetched[1].auth, /secret-token/);

    const linksCap = {};
    const mockCap = await startPagedServer({
      pages: { 1: [comment(1)], 2: [comment(2)] },
      links: linksCap,
    });
    servers.push(mockCap.server);
    linksCap[1] = `<${mockCap.baseUrl}/repos/${owner}/${repo}/issues/61/comments?page=2&per_page=100>; rel="next"`;
    const githubCap = createGithubClient({ baseUrl: mockCap.baseUrl, token: "t" });
    const capped = await fetchCommentHistory(githubCap, {
      owner,
      repo,
      issueNumber: 61,
      maxPages: 1,
    });
    assert.equal(capped.ok, false);
    assert.equal(capped.code, "incomplete_comment_history");
  });

  it("byte and time budgets are enforced on the response path", async () => {
    const mockBytes = await startPagedServer({
      pages: { 1: [comment(1)] },
      links: {},
      bytesPad: 5000,
    });
    servers.push(mockBytes.server);
    const githubBytes = createGithubClient({ baseUrl: mockBytes.baseUrl, token: "t" });
    const oversized = await fetchCommentHistory(githubBytes, {
      owner,
      repo,
      issueNumber: 61,
      maxBytes: 100,
    });
    assert.equal(oversized.ok, false);
    assert.equal(oversized.code, "incomplete_comment_history");

    const mockTime = await startPagedServer({
      pages: { 1: [comment(1)] },
      links: {},
      delayMs: 30,
    });
    servers.push(mockTime.server);
    const githubTime = createGithubClient({ baseUrl: mockTime.baseUrl, token: "t" });
    let now = 0;
    const timed = await fetchCommentHistory(githubTime, {
      owner,
      repo,
      issueNumber: 61,
      maxMs: 1,
      now: () => {
        now += 50;
        return now;
      },
    });
    assert.equal(timed.ok, false);
    assert.equal(timed.code, "incomplete_comment_history");
  });
});
