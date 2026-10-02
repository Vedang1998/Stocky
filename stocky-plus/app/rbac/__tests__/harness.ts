import { CompactSign } from "jose";
import type { Session } from "@shopify/shopify-api";
import { setAbstractFetchFunc } from "@shopify/shopify-api/runtime";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { createShopifyVerifier } from "../shopify-verifier.server";
import {
  authxFetch,
  CHROME_UA,
  SHOP_A,
  TEST_API_KEY,
  TEST_API_SECRET,
} from "./authx-mock";

export function installAuthxFetch(): void {
  globalThis.fetch = authxFetch as typeof fetch;
  setAbstractFetchFunc(authxFetch as typeof fetch);
}

export function hmacKey(secret: string): Uint8Array {
  const bytes = new Uint8Array(secret.length);
  for (let i = 0; i < secret.length; i += 1) {
    bytes[i] = secret.charCodeAt(i);
  }
  return bytes;
}

export async function signIdToken(opts: {
  sub: string | number;
  dest?: string;
  iss?: string;
  aud?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  alg?: string;
  secret?: string;
  extra?: Record<string, unknown>;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const dest = opts.dest ?? `https://${SHOP_A}`;
  const destHost = new URL(dest.includes("://") ? dest : `https://${dest}`)
    .hostname;
  const payload: Record<string, unknown> = {
    dest,
    iss: opts.iss ?? `https://${destHost}/admin`,
    aud: opts.aud ?? TEST_API_KEY,
    sub: opts.sub,
    exp: opts.exp ?? now + 3600,
    nbf: opts.nbf ?? now - 30,
    iat: opts.iat ?? now,
    jti: crypto.randomUUID(),
    sid: crypto.randomUUID(),
    ...opts.extra,
  };
  return new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg: opts.alg ?? "HS256", typ: "JWT" })
    .sign(hmacKey(opts.secret ?? TEST_API_SECRET));
}

export class MemorySessionStorage {
  readonly store = new Map<string, Session>();

  async storeSession(session: Session): Promise<boolean> {
    this.store.set(session.id, session);
    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    return this.store.get(id);
  }

  async deleteSession(id: string): Promise<boolean> {
    this.store.delete(id);
    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    for (const id of ids) this.store.delete(id);
    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    return [...this.store.values()].filter((session) => session.shop === shop);
  }
}

export function testVerifier() {
  return createShopifyVerifier({
    apiKey: TEST_API_KEY,
    apiSecretKey: TEST_API_SECRET,
    hostName: "example.com",
  });
}

export function createTestShopifyApp(opts?: {
  useOnlineTokens?: boolean;
  sessionStorage?: MemorySessionStorage;
}) {
  const sessionStorage = opts?.sessionStorage ?? new MemorySessionStorage();
  const app = shopifyApp({
    apiKey: TEST_API_KEY,
    apiSecretKey: TEST_API_SECRET,
    apiVersion: ApiVersion.July26,
    scopes: ["read_products"],
    appUrl: "https://example.com",
    authPathPrefix: "/auth",
    sessionStorage,
    distribution: AppDistribution.AppStore,
    future: { expiringOfflineAccessTokens: true },
    hooks: {},
    ...(opts?.useOnlineTokens ? { useOnlineTokens: true } : {}),
  });
  return { app, sessionStorage };
}

export function embeddedHostParam(shop = SHOP_A): string {
  return Buffer.from(`${shop}/admin`).toString("base64");
}

/**
 * Document-style embedded admin URL. authenticate.admin treats a missing
 * Authorization header as a document request and requires `embedded=1` plus
 * a sanitizable `host` before it will consume `id_token` (AUTH-X-31).
 */
export function embeddedIdTokenUrl(opts: {
  token: string;
  shop?: string;
}): string {
  const shop = opts.shop ?? SHOP_A;
  const host = embeddedHostParam(shop);
  return `https://example.com/app?embedded=1&shop=${shop}&host=${encodeURIComponent(host)}&id_token=${encodeURIComponent(opts.token)}`;
}

export function adminRequest(opts: {
  token?: string;
  shop?: string;
  url?: string;
  ua?: string;
  headers?: HeadersInit;
}): Request {
  const headers = new Headers(opts.headers);
  headers.set("User-Agent", opts.ua ?? CHROME_UA);
  if (opts.token) {
    headers.set("Authorization", `Bearer ${opts.token}`);
  }
  const shop = opts.shop ?? SHOP_A;
  const url = opts.url ?? `https://example.com/app?shop=${shop}`;
  return new Request(url, { headers });
}

export async function caughtResponse<T>(
  fn: () => Promise<T>,
): Promise<Response> {
  try {
    await fn();
    throw new Error("expected Response to be thrown");
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}

export const RETRY_INVALID_SESSION_HEADER =
  "x-shopify-retry-invalid-session-request";

export function assertRetryInvalidSessionResponse(response: Response): void {
  if (response.status !== 401) {
    throw new Error(`expected 401, received ${response.status}`);
  }
  if (response.headers.get(RETRY_INVALID_SESSION_HEADER) !== "1") {
    throw new Error("expected X-Shopify-Retry-Invalid-Session-Request: 1");
  }
}

export function assertBounceSessionTokenResponse(response: Response): void {
  if (response.status < 300 || response.status >= 400) {
    throw new Error(`expected redirect, received ${response.status}`);
  }
  const location = response.headers.get("location") ?? "";
  if (!location.includes("session-token")) {
    throw new Error(`expected bounce Location with session-token, got ${location}`);
  }
}
