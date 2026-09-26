/**
 * Read-only GitHub client. Token is optional and never logged.
 * Pagination helpers count actual decoded bytes and honour timeouts.
 */
export function createGithubClient({
  baseUrl = "https://api.github.com",
  token = "",
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetchImpl required");
  }
  const origin = baseUrl.replace(/\/$/, "");

  function headersFor(extra = {}, { allowCredentials = true } = {}) {
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "stocky-claude-review-runner",
      ...extra,
    };
    if (allowCredentials && token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  function resolveUrl(pathnameOrUrl, absolute) {
    if (absolute) return pathnameOrUrl;
    const path = pathnameOrUrl.startsWith("/") ? pathnameOrUrl : `/${pathnameOrUrl}`;
    return `${origin}${path}`;
  }

  async function readLimited(res, maxBytes) {
    if (res.body && typeof res.body.getReader === "function") {
      const reader = res.body.getReader();
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value);
        total += chunk.length;
        if (Number.isInteger(maxBytes) && total > maxBytes) {
          try {
            await reader.cancel();
          } catch {
            /* ignore */
          }
          const err = new Error("response_too_large");
          err.code = "response_too_large";
          err.bytes = total;
          throw err;
        }
        chunks.push(chunk);
      }
      return Buffer.concat(chunks, total);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (Number.isInteger(maxBytes) && buf.length > maxBytes) {
      const err = new Error("response_too_large");
      err.code = "response_too_large";
      err.bytes = buf.length;
      throw err;
    }
    return buf;
  }

  function headerMap(res) {
    const headers = {};
    if (res.headers && typeof res.headers.forEach === "function") {
      res.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
        headers[key] = value;
      });
    }
    return headers;
  }

  return {
    baseUrl: origin,
    async getJsonWithMeta(pathnameOrUrl, { extraHeaders = {}, absolute = false, maxBytes, timeoutMs, allowCredentials = true } = {}) {
      const url = resolveUrl(pathnameOrUrl, absolute);
      let creds = allowCredentials;
      if (absolute) {
        try {
          const next = new URL(url);
          const base = new URL(origin);
          if (next.origin !== base.origin) creds = false;
        } catch {
          creds = false;
        }
      }
      const signal =
        Number.isInteger(timeoutMs) && timeoutMs > 0 && typeof AbortSignal !== "undefined" && AbortSignal.timeout
          ? AbortSignal.timeout(timeoutMs)
          : undefined;
      const res = await fetchImpl(url, {
        method: "GET",
        headers: headersFor(extraHeaders, { allowCredentials: creds }),
        signal,
      });
      const buf = await readLimited(res, maxBytes);
      let json = null;
      try {
        json = JSON.parse(buf.toString("utf8"));
      } catch {
        json = null;
      }
      return {
        ok: res.ok,
        status: res.status,
        bytes: buf.length,
        headers: headerMap(res),
        json,
        text: buf.toString("utf8"),
      };
    },
    async getJson(pathname) {
      const meta = await this.getJsonWithMeta(pathname);
      if (!meta.ok) {
        const err = new Error(`GitHub GET ${pathname} failed: ${meta.status}`);
        err.status = meta.status;
        throw err;
      }
      return meta.json;
    },
    async getBuffer(pathname, extraHeaders = {}) {
      const url = resolveUrl(pathname, false);
      const res = await fetchImpl(url, { method: "GET", headers: headersFor(extraHeaders) });
      if (!res.ok) {
        const err = new Error(`GitHub GET ${pathname} failed: ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return Buffer.from(await res.arrayBuffer());
    },
    async mutate(method, pathname, body) {
      const url = resolveUrl(pathname, false);
      const res = await fetchImpl(url, {
        method,
        headers: {
          ...headersFor(),
          "Content-Type": "application/json",
        },
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
