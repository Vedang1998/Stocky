/**
 * The exported `authenticate.webhook` must bound the request body before the
 * Shopify library buffers it for HMAC verification.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { libraryWebhook, libraryAdmin } = vi.hoisted(() => ({
  libraryWebhook: vi.fn(),
  libraryAdmin: vi.fn(),
}));

vi.mock("@shopify/shopify-app-react-router/adapters/node", () => ({}));
vi.mock("@shopify/shopify-app-react-router/server", () => ({
  ApiVersion: { July26: "2026-07" },
  AppDistribution: { AppStore: "app_store" },
  shopifyApp: () => ({
    addDocumentResponseHeaders: vi.fn(),
    authenticate: { admin: libraryAdmin, webhook: libraryWebhook },
    unauthenticated: {},
    login: vi.fn(),
    registerWebhooks: vi.fn(),
    sessionStorage: {},
  }),
}));
vi.mock("../../tenant/bootstrap.server", () => ({ shopifySessionStorage: {} }));
vi.mock("../../tenant/after-auth.server", () => ({
  runAfterAuthTenantBootstrap: vi.fn(),
}));
vi.mock("../../jobs/queue.server", () => ({
  enqueueAfterAuthCatalogSync: vi.fn(),
}));

import { authenticate } from "../../shopify.server";
import { WEBHOOK_MAX_BODY_BYTES } from "./bounded-request.server";

const WEBHOOK_URL = "https://app.example/webhooks/orders/create";

describe("authenticate.webhook body limit", () => {
  beforeEach(() => {
    libraryWebhook.mockReset();
    libraryWebhook.mockResolvedValue({ shop: "shop.myshopify.com" });
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
    expect(libraryWebhook).not.toHaveBeenCalled();
  });

  it("hands in-limit bodies to the library unchanged", async () => {
    const body = JSON.stringify({ id: 42 });
    const result = await authenticate.webhook(
      new Request(WEBHOOK_URL, {
        method: "POST",
        headers: { "x-shopify-hmac-sha256": "sig", "x-shopify-topic": "orders/create" },
        body,
      }),
    );

    expect(result).toEqual({ shop: "shop.myshopify.com" });
    expect(libraryWebhook).toHaveBeenCalledTimes(1);
    const forwarded = libraryWebhook.mock.calls[0][0] as Request;
    expect(forwarded.headers.get("x-shopify-hmac-sha256")).toBe("sig");
    expect(forwarded.headers.get("x-shopify-topic")).toBe("orders/create");
    expect(await forwarded.text()).toBe(body);
  });

  it("leaves admin authentication untouched", () => {
    expect(authenticate.admin).toBe(libraryAdmin);
  });
});
