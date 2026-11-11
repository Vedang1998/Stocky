/**
 * The exported `authenticate.webhook` must bound the request body before the
 * Shopify library buffers it for HMAC verification, and must verify through
 * the session-less app instance rather than the one that holds sessions.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { appWebhook, verifierWebhook, libraryAdmin, appConfigs } = vi.hoisted(
  () => ({
    appWebhook: vi.fn(),
    verifierWebhook: vi.fn(),
    libraryAdmin: vi.fn(),
    appConfigs: [] as Array<Record<string, unknown>>,
  }),
);

vi.mock("@shopify/shopify-app-react-router/adapters/node", () => ({}));
vi.mock("@shopify/shopify-app-react-router/server", () => ({
  ApiVersion: { July26: "2026-07" },
  AppDistribution: { AppStore: "app_store" },
  shopifyApp: (config: Record<string, unknown>) => {
    appConfigs.push(config);
    // The merchant-facing app is the one configured with the afterAuth hook.
    const isMerchantApp = "hooks" in config;
    return {
      addDocumentResponseHeaders: vi.fn(),
      authenticate: {
        admin: libraryAdmin,
        webhook: isMerchantApp ? appWebhook : verifierWebhook,
      },
      unauthenticated: {},
      login: vi.fn(),
      registerWebhooks: vi.fn(),
      sessionStorage: config.sessionStorage,
    };
  },
}));
vi.mock("../../tenant/bootstrap.server", () => ({
  shopifySessionStorage: { name: "prisma-session-storage" },
}));
vi.mock("../../tenant/after-auth.server", () => ({
  runAfterAuthTenantBootstrap: vi.fn(),
}));
vi.mock("../../jobs/queue.server", () => ({
  enqueueAfterAuthCatalogSync: vi.fn(),
}));

import { authenticate, sessionStorage } from "../../shopify.server";
import { WEBHOOK_MAX_BODY_BYTES } from "./bounded-request.server";

const WEBHOOK_URL = "https://app.example/webhooks/orders/create";

describe("authenticate.webhook", () => {
  beforeEach(() => {
    appWebhook.mockReset();
    verifierWebhook.mockReset();
    verifierWebhook.mockResolvedValue({ shop: "shop.myshopify.com" });
  });

  it("refuses oversized bodies with 413 before HMAC verification runs", async () => {
    const request = new Request(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-length": String(WEBHOOK_MAX_BODY_BYTES + 1),
        "x-shopify-hmac-sha256": "forged",
      },
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new Uint8Array(1024));
        },
      }),
      duplex: "half",
    } as RequestInit);

    const thrown = await authenticate.webhook(request).then(
      () => null,
      (error: unknown) => error,
    );

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(413);
    expect(verifierWebhook).not.toHaveBeenCalled();
  });

  it("hands in-limit bodies to the verifier unchanged", async () => {
    const body = JSON.stringify({ id: 42 });
    const result = await authenticate.webhook(
      new Request(WEBHOOK_URL, {
        method: "POST",
        headers: { "x-shopify-hmac-sha256": "sig", "x-shopify-topic": "orders/create" },
        body,
      }),
    );

    expect(result).toEqual({ shop: "shop.myshopify.com" });
    expect(verifierWebhook).toHaveBeenCalledTimes(1);
    const forwarded = verifierWebhook.mock.calls[0][0] as Request;
    expect(forwarded.headers.get("x-shopify-hmac-sha256")).toBe("sig");
    expect(forwarded.headers.get("x-shopify-topic")).toBe("orders/create");
    expect(await forwarded.text()).toBe(body);
  });

  it("never verifies through the app instance that holds sessions (#83)", async () => {
    await authenticate.webhook(
      new Request(WEBHOOK_URL, { method: "POST", body: "{}" }),
    );
    expect(appWebhook).not.toHaveBeenCalled();
  });

  it("gives the verifier the same credentials but a storage with no sessions", async () => {
    const [merchantApp, verifier] = appConfigs;
    expect(appConfigs).toHaveLength(2);
    for (const key of ["apiKey", "apiSecretKey", "apiVersion", "appUrl", "distribution"]) {
      expect(verifier[key]).toBe(merchantApp[key]);
    }
    expect(verifier).not.toHaveProperty("hooks");

    const storage = verifier.sessionStorage as {
      loadSession(id: string): Promise<unknown>;
      findSessionsByShop(shop: string): Promise<unknown[]>;
      storeSession(session: unknown): Promise<boolean>;
    };
    expect(storage).not.toBe(merchantApp.sessionStorage);
    expect(await storage.loadSession("offline_shop.myshopify.com")).toBeUndefined();
    expect(await storage.findSessionsByShop("shop.myshopify.com")).toEqual([]);
    await expect(storage.storeSession({})).rejects.toThrow(/must not store/);
  });

  it("leaves admin authentication and merchant session storage untouched", () => {
    expect(authenticate.admin).toBe(libraryAdmin);
    expect(sessionStorage).toEqual({ name: "prisma-session-storage" });
  });
});
