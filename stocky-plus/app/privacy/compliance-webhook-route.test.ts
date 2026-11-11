import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const API_SECRET = vi.hoisted(() => "compliance-route-test-secret");
const recordPrivacyRequest = vi.hoisted(() => vi.fn());

// The route runs against the library's real webhook verification.
vi.mock("../shopify.server", async () => {
  await import("@shopify/shopify-app-react-router/adapters/node");
  const { ApiVersion, AppDistribution, shopifyApp } = await import(
    "@shopify/shopify-app-react-router/server"
  );
  const shopify = shopifyApp({
    apiKey: "compliance-route-test-key",
    apiSecretKey: API_SECRET,
    apiVersion: ApiVersion.July26,
    appUrl: "https://app.example.com",
    distribution: AppDistribution.AppStore,
    sessionStorage: {
      storeSession: async () => true,
      loadSession: async () => undefined,
      deleteSession: async () => true,
      deleteSessions: async () => true,
      findSessionsByShop: async () => [],
    },
  });
  return { authenticate: shopify.authenticate };
});
vi.mock("./intake.server", () => ({ recordPrivacyRequest }));

import { action } from "../routes/webhooks.compliance";
import { COMPLIANCE_TOPICS } from "./topics";

const SHOP = "compliance-route.myshopify.com";
const WEBHOOK_ID = "b54557e4-bdd9-4b37-8a5f-bf7d70bcd043";

function delivery(
  topic: string,
  payload: unknown,
  options: { secret?: string; method?: string; headerShop?: string } = {},
): Request {
  const body = JSON.stringify(payload);
  const method = options.method ?? "POST";
  return new Request("https://app.example.com/webhooks/compliance", {
    method,
    body: method === "POST" ? body : undefined,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Hmac-Sha256": createHmac("sha256", options.secret ?? API_SECRET)
        .update(body, "utf8")
        .digest("base64"),
      "X-Shopify-Topic": topic,
      "X-Shopify-Shop-Domain": options.headerShop ?? SHOP,
      "X-Shopify-API-Version": "2026-07",
      "X-Shopify-Webhook-Id": WEBHOOK_ID,
    },
  });
}

/** The response the server would send, whether returned or thrown. */
async function respond(request: Request): Promise<Response> {
  try {
    return await action({ request, params: {}, context: {} } as never);
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
}

describe("compliance webhook route", () => {
  beforeEach(() => {
    recordPrivacyRequest.mockReset();
    recordPrivacyRequest.mockResolvedValue({
      requestId: "request-1",
      duplicate: false,
      resolution: null,
    });
  });

  it.each(COMPLIANCE_TOPICS)(
    "records a verified %s delivery before answering 200",
    async (topic) => {
      const payload = { shop_id: 954889, shop_domain: SHOP };

      const response = await respond(delivery(topic, payload));

      expect(response.status).toBe(200);
      expect(recordPrivacyRequest).toHaveBeenCalledTimes(1);
      expect(recordPrivacyRequest).toHaveBeenCalledWith({
        topic,
        verifiedShop: SHOP,
        webhookId: WEBHOOK_ID,
        payload,
      });
    },
  );

  it("answers 401 to a delivery signed with another secret and records nothing", async () => {
    const response = await respond(
      delivery("shop/redact", { shop_domain: SHOP }, { secret: "not-ours" }),
    );

    expect(response.status).toBe(401);
    expect(recordPrivacyRequest).not.toHaveBeenCalled();
  });

  // Shopify signs the body, not the headers. A body signed for one shop must
  // not be accepted under another shop's name.
  it.each(COMPLIANCE_TOPICS)(
    "answers 401 to a signed %s body replayed under another shop's header and records nothing",
    async (topic) => {
      const response = await respond(
        delivery(
          topic,
          { shop_id: 954889, shop_domain: SHOP },
          { headerShop: "victim-shop.myshopify.com" },
        ),
      );

      expect(response.status).toBe(401);
      expect(recordPrivacyRequest).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["no shop_domain", { shop_id: 954889 }],
    ["a shop_domain that is not a string", { shop_domain: 954889 }],
    [
      "another topic's body",
      { id: 1, myshopify_domain: SHOP, name: "A signed shop payload" },
    ],
  ])(
    "answers 401 to a signed shop/redact body with %s and records nothing",
    async (_case, payload) => {
      const response = await respond(delivery("shop/redact", payload));

      expect(response.status).toBe(401);
      expect(recordPrivacyRequest).not.toHaveBeenCalled();
    },
  );

  it("answers 405 to a request that is not a POST", async () => {
    const response = await respond(
      delivery("shop/redact", { shop_domain: SHOP }, { method: "GET" }),
    );

    expect(response.status).toBe(405);
    expect(recordPrivacyRequest).not.toHaveBeenCalled();
  });

  it("answers 400 to a verified delivery for any other topic", async () => {
    const response = await respond(
      delivery("app/uninstalled", { shop_domain: SHOP }),
    );

    expect(response.status).toBe(400);
    expect(recordPrivacyRequest).not.toHaveBeenCalled();
  });

  it("does not acknowledge a request it could not store", async () => {
    recordPrivacyRequest.mockRejectedValue(new Error("database unavailable"));

    await expect(
      respond(delivery("customers/redact", { shop_domain: SHOP })),
    ).rejects.toThrow("database unavailable");
  });
});
