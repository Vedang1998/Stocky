/**
 * Read-only GitHub client. Token is optional and never logged.
 */
export function createGithubClient({
  baseUrl = "https://api.github.com",
  token = "",
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetchImpl required");
  }
  return {
    async getJson(pathname) {
      const url = `${baseUrl.replace(/\/$/, "")}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
      const headers = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "stocky-claude-review-runner",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetchImpl(url, { method: "GET", headers });
      if (!res.ok) {
        const err = new Error(`GitHub GET ${pathname} failed: ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return res.json();
    },
    async getBuffer(pathname, extraHeaders = {}) {
      const url = `${baseUrl.replace(/\/$/, "")}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
      const headers = {
        Accept: "application/vnd.github+json",
        "User-Agent": "stocky-claude-review-runner",
        ...extraHeaders,
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetchImpl(url, { method: "GET", headers });
      if (!res.ok) {
        const err = new Error(`GitHub GET ${pathname} failed: ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return Buffer.from(await res.arrayBuffer());
    },
    async mutate(method, pathname, body) {
      const url = `${baseUrl.replace(/\/$/, "")}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
      const headers = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "stocky-claude-review-runner",
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetchImpl(url, {
        method,
        headers,
        body: body == null ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        const err = new Error(`GitHub ${method} ${pathname} failed: ${res.status}`);
        err.status = res.status;
        throw err;
      }
      if (res.status === 204) return null;
      return res.json();
    },
  };
}
