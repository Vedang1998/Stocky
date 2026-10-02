import { createHash } from "node:crypto";

export const TEST_API_KEY = "pr7-a-test-api-key";
export const TEST_API_SECRET = "pr7-a-test-api-secret";
export const SHOP_A = "authx-test-shop.myshopify.com";
export const SHOP_B = "authx-other-shop.myshopify.com";
export const SAFE_SUB = "548380009";
export const WIDE_SUB = "9007199254740993";
export const WIDE_ROUNDED = "9007199254740992";
export const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
export const BOT_UA = "Googlebot/2.1 (+http://www.google.com/bot.html)";

export type AuthxCallKind = "token_exchange" | "graphql" | "other";

export type AuthxCall = {
  kind: AuthxCallKind;
  url: string;
  hostname: string;
  requestedTokenType: string | null;
  accessTokenSha256: string | null;
  subjectTokenSha256: string | null;
  status: number;
};

export type TokenExchangePlan = {
  status?: number;
  body?: Record<string, unknown>;
};

type AuthxState = {
  calls: AuthxCall[];
  allowGraphql: boolean;
  exchangeDelayMs: number;
  onlineAssociatedUser: (
    payload: Record<string, unknown>,
  ) => Record<string, unknown> | null;
  offlineTokenFor: (shop: string) => string;
  onlineTokenFor: (shop: string, sub: string) => string;
  exchangeOverride: ((input: {
    shop: string;
    requestedTokenType: string | null;
    payload: Record<string, unknown>;
  }) => TokenExchangePlan | null) | null;
};

const state: AuthxState = {
  calls: [],
  allowGraphql: false,
  exchangeDelayMs: 0,
  onlineAssociatedUser: defaultAssociatedUser,
  offlineTokenFor: (shop) => `shpat_offline_${shop}`,
  onlineTokenFor: (shop, sub) => `shpat_online_${shop}_${sub}`,
  exchangeOverride: null,
};

export function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) return {};
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
}

function defaultAssociatedUser(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const sub = payload.sub;
  const id = typeof sub === "number" ? sub : Number(sub);
  return {
    id,
    first_name: "Ada",
    last_name: "Admin",
    email: "ada@example.com",
    email_verified: true,
    account_owner: false,
    locale: "en",
    collaborator: false,
  };
}

function hostnameOfUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function jsonResponse(status: number, body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const headers = new Headers({ "content-type": "application/json" });
  return new Response(text, { status, headers });
}

async function readBody(init?: RequestInit): Promise<string> {
  if (init?.body == null) return "";
  if (typeof init.body === "string") return init.body;
  if (init.body instanceof Uint8Array) return Buffer.from(init.body).toString("utf8");
  return String(init.body);
}

export async function authxFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const hostname = hostnameOfUrl(url);
  const method = (init?.method ?? "GET").toUpperCase();

  const shopifyHost =
    hostname.endsWith(".myshopify.com") ||
    hostname.endsWith(".shopify.com") ||
    hostname === "partners.shopify.com";

  if (!shopifyHost) {
    throw new Error(`FAIL-CLOSED: unexpected host ${hostname}`);
  }

  if (url.includes("/admin/oauth/access_token") && method === "POST") {
    const raw = await readBody(init);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const requestedTokenType =
      typeof parsed.requested_token_type === "string"
        ? parsed.requested_token_type
        : null;
    const subjectToken =
      typeof parsed.subject_token === "string" ? parsed.subject_token : "";
    const payload = subjectToken ? decodeJwtPayloadUnsafe(subjectToken) : {};
    const dest =
      typeof payload.dest === "string" ? payload.dest : `https://${hostname}`;
    const destHost = hostnameOfUrl(
      dest.includes("://") ? dest : `https://${dest}`,
    );
    const subRaw = payload.sub;
    const subString = typeof subRaw === "string" ? subRaw : String(subRaw ?? "");

    const override = state.exchangeOverride?.({
      shop: destHost || hostname,
      requestedTokenType,
      payload,
    });
    const status = override?.status ?? 200;
    let body = override?.body;
    if (!body) {
      const isOnline =
        requestedTokenType ===
        "urn:shopify:params:oauth:token-type:online-access-token";
      if (isOnline) {
        const associated = state.onlineAssociatedUser(payload);
        body = {
          access_token: state.onlineTokenFor(destHost || hostname, subString),
          scope: "read_products",
          expires_in: 3600,
          associated_user_scope: "read_products",
          ...(associated ? { associated_user: associated } : {}),
        };
      } else {
        body = {
          access_token: state.offlineTokenFor(destHost || hostname),
          scope: "read_products",
          expires_in: 3600,
          refresh_token: `shprt_offline_${destHost || hostname}`,
          refresh_token_expires_in: 7776000,
        };
      }
    }

    if (state.exchangeDelayMs > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, state.exchangeDelayMs);
      });
    }

    state.calls.push({
      kind: "token_exchange",
      url,
      hostname,
      requestedTokenType,
      accessTokenSha256: null,
      subjectTokenSha256: subjectToken ? sha256Utf8(subjectToken) : null,
      status,
    });
    return jsonResponse(status, body);
  }

  if (url.includes("/graphql.json")) {
    const headers = new Headers(init?.headers);
    const token = headers.get("X-Shopify-Access-Token") ?? "";
    state.calls.push({
      kind: "graphql",
      url,
      hostname,
      requestedTokenType: null,
      accessTokenSha256: token ? sha256Utf8(token) : null,
      subjectTokenSha256: null,
      status: state.allowGraphql ? 200 : 599,
    });
    if (!state.allowGraphql) {
      throw new Error("FAIL-CLOSED graphql");
    }
    return jsonResponse(200, { data: { shop: { name: "authx-mock-shop" } } });
  }

  state.calls.push({
    kind: "other",
    url,
    hostname,
    requestedTokenType: null,
    accessTokenSha256: null,
    subjectTokenSha256: null,
    status: 599,
  });
  throw new Error(`FAIL-CLOSED: ${method} ${url}`);
}

export function resetAuthxMock(): void {
  state.calls = [];
  state.allowGraphql = false;
  state.exchangeDelayMs = 0;
  state.onlineAssociatedUser = defaultAssociatedUser;
  state.offlineTokenFor = (shop) => `shpat_offline_${shop}`;
  state.onlineTokenFor = (shop, sub) => `shpat_online_${shop}_${sub}`;
  state.exchangeOverride = null;
}

export function authxCalls(): AuthxCall[] {
  return state.calls.slice();
}

export function authxExchanges(): AuthxCall[] {
  return state.calls.filter((call) => call.kind === "token_exchange");
}

export function authxGraphql(): AuthxCall[] {
  return state.calls.filter((call) => call.kind === "graphql");
}

export function setAuthxGraphqlCapture(allow: boolean): void {
  state.allowGraphql = allow;
}

export function setOnlineAssociatedUser(
  factory: AuthxState["onlineAssociatedUser"],
): void {
  state.onlineAssociatedUser = factory;
}

export function setExchangeOverride(handler: AuthxState["exchangeOverride"]): void {
  state.exchangeOverride = handler;
}

export function setExchangeDelayMs(ms: number): void {
  state.exchangeDelayMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
}

export function offlineTokenSha256(shop: string): string {
  return sha256Utf8(state.offlineTokenFor(shop));
}

export function onlineTokenSha256(shop: string, sub: string): string {
  return sha256Utf8(state.onlineTokenFor(shop, sub));
}

export { state as authxState };
