/**
 * Regression tests for #83, run against the real Shopify library.
 *
 * After an uninstall Shopify revokes the shop's tokens, then delivers
 * app/uninstalled and later the compliance topics. The library's webhook
 * authentication loaded the stored offline session and, because it was close
 * to expiry, tried to refresh it before the route ran; Shopify rejected the
 * refresh and every such delivery answered HTTP 500.
 *
 * The stored session here is expired and any outbound call fails, which is
 * what an uninstalled shop looks like. Deliveries must still authenticate,
 * without the session being read and without calling Shopify.
 */
import { createHmac } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";
import { Session } from "@shopify/shopify-api";

const { outboundFetch, loadSession, storeSession, processUninstall, apiSecret } =
  vi.hoisted(() => {
    process.env.SHOPIFY_API_KEY ||= "test-api-key";
    process.env.SHOPIFY_API_SECRET ||= "test-api-secret";
    process.env.SHOPIFY_APP_URL ||= "https://app.example";

    // The library binds `fetch` when its adapter is imported, so the stub has
    // to be in place before any import below is evaluated.
    const outboundFetch = vi.fn();
    vi.stubGlobal("fetch", outboundFetch);

    return {
      outboundFetch,
      loadSession: vi.fn(),
      storeSession: vi.fn(),
      processUninstall: vi.fn(),
      apiSecret: process.env.SHOPIFY_API_SECRET,
    };
  });

vi.mock("../tenant/bootstrap.server", () => ({
  shopifySessionStorage: {
    loadSession,
    storeSession,
    findSessionsByShop: vi.fn(async () => []),
    deleteSession: vi.fn(async () => true),
    deleteSessions: vi.fn(async () => true),
  },
}));
vi.mock("../tenant/after-auth.server", () => ({
  runAfterAuthTenantBootstrap: vi.fn(),
}));
vi.mock("../jobs/queue.server", () => ({
  enqueueAfterAuthCatalogSync: vi.fn(),
}));
vi.mock("../sync/uninstall.server", () => ({ processUninstall }));

import { authenticate } from "../shopify.server";
import { action as uninstalledAction } from "../routes/webhooks.app.uninstalled";

const SHOP = "uninstalled-shop.myshopify.com";
const API_VERSION = "2026-07";

function sign(body: string, secret: string = apiSecret): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

function delivery(input: {
  topic: string;
  body?: string;
  hmac?: string | null;
  method?: string;
}): Request {
  const body = input.body ?? JSON.stringify({ shop_domain: SHOP });
  const headers = new Headers({
    "content-type": "application/json",
    "x-shopify-topic": input.topic,
    "x-shopify-shop-domain": SHOP,
    "x-shopify-api-version": API_VERSION,
    "x-shopify-webhook-id": "b54557e4-bdd9-4b37-8a5f-bf7d70bcd043",
  });
  const hmac = input.hmac === undefined ? sign(body) : input.hmac;
  if (hmac !== null) headers.set("x-shopify-hmac-sha256", hmac);

  const method = input.method ?? "POST";
  return new Request(`https://app.example/webhooks/${input.topic}`, {
    method,
    headers,
    ...(method === "POST" ? { body } : {}),
  });
}

function routeArgs(request: Request): ActionFunctionArgs {
  return { request, params: {}, context: {} } as ActionFunctionArgs;
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  );
}

describe("webhook authentication for an uninstalled shop (#83)", () => {
  beforeEach(() => {
    outboundFetch.mockReset();
    outboundFetch.mockRejectedValue(new Error("Shopify rejected the request"));
    storeSession.mockReset();
    processUninstall.mockReset();
    processUninstall.mockResolvedValue({ duplicate: false });

    // An offline session past its expiry with a refresh token Shopify no
    // longer honours.
    loadSession.mockReset();
    loadSession.mockResolvedValue(
      new Session({
        id: `offline_${SHOP}`,
        shop: SHOP,
        state: "",
        isOnline: false,
        accessToken: "revoked-access-token",
        expires: new Date(Date.now() - 60_000),
        refreshToken: "revoked-refresh-token",
        refreshTokenExpires: new Date(Date.now() + 86_400_000),
      }),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("processes app/uninstalled instead of failing on the token refresh", async () => {
    const body = JSON.stringify({ id: 1, myshopify_domain: SHOP });

    const response = await uninstalledAction(
      routeArgs(delivery({ topic: "app/uninstalled", body })),
    );

    expect(response.status).toBe(200);
    expect(processUninstall).toHaveBeenCalledTimes(1);
    expect(processUninstall).toHaveBeenCalledWith({
      verifiedShop: SHOP,
      webhookId: "b54557e4-bdd9-4b37-8a5f-bf7d70bcd043",
      apiVersion: API_VERSION,
      payload: { id: 1, myshopify_domain: SHOP },
    });
    expect(loadSession).not.toHaveBeenCalled();
    expect(storeSession).not.toHaveBeenCalled();
    expect(outboundFetch).not.toHaveBeenCalled();
  });

  // Shopify signs the body, not the shop header: a correctly signed body
  // that names another shop, or no shop, must not uninstall the header's shop.
  it.each([
    [
      "a body signed for another shop",
      { id: 2, myshopify_domain: "other-shop.myshopify.com" },
    ],
    ["a signed body from another topic", { id: 7001, title: "A product" }],
    ["a body with no shop name", { id: 1, myshopify_domain: null }],
  ])("does not uninstall the header's shop on %s", async (_case, payload) => {
    const response = await uninstalledAction(
      routeArgs(
        delivery({ topic: "app/uninstalled", body: JSON.stringify(payload) }),
      ),
    );

    expect(response.status).toBe(401);
    expect(processUninstall).not.toHaveBeenCalled();
  });

  it.each([
    ["customers/data_request", "CUSTOMERS_DATA_REQUEST"],
    ["customers/redact", "CUSTOMERS_REDACT"],
    ["shop/redact", "SHOP_REDACT"],
  ])("authenticates %s without a session", async (topic, storedTopic) => {
    const context = await authenticate.webhook(delivery({ topic }));

    expect(context.shop).toBe(SHOP);
    expect(context.topic).toBe(storedTopic);
    expect(context.payload).toEqual({ shop_domain: SHOP });
    expect(context.session).toBeUndefined();
    expect(context.admin).toBeUndefined();
    expect(loadSession).not.toHaveBeenCalled();
    expect(outboundFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["a forged signature", { hmac: sign("{}", "not-the-app-secret") }, 401],
    ["a body changed after signing", { hmac: sign('{"id":2}') }, 401],
    ["no signature", { hmac: null }, 400],
    ["a non-POST request", { method: "GET" }, 405],
  ])("still refuses %s", async (_case, override, status) => {
    const thrown = await rejection(
      uninstalledAction(
        routeArgs(delivery({ topic: "app/uninstalled", ...override })),
      ),
    );

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(status);
    expect(processUninstall).not.toHaveBeenCalled();
  });
});
