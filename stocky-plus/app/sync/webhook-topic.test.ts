import "@shopify/shopify-app-react-router/adapters/node";
import { createHmac } from "node:crypto";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { describe, expect, it } from "vitest";

import {
  WEBHOOK_PROJECTION_SCHEMA_VERSIONS,
  resolveSanitizedWebhookTopic,
  type SanitizedWebhookTopic,
} from "./sanitize.server";

const TOPICS = Object.keys(
  WEBHOOK_PROJECTION_SCHEMA_VERSIONS,
) as SanitizedWebhookTopic[];

const API_SECRET = "webhook-topic-test-secret";

function signedDelivery(topic: string): Request {
  const body = JSON.stringify({ id: 1 });
  return new Request("https://app.example.com/webhooks/catalog-facts", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Hmac-Sha256": createHmac("sha256", API_SECRET)
        .update(body, "utf8")
        .digest("base64"),
      "X-Shopify-Topic": topic,
      "X-Shopify-Shop-Domain": "topic-form.myshopify.com",
      "X-Shopify-API-Version": "2026-07",
      "X-Shopify-Webhook-Id": "b54557e4-bdd9-4b37-8a5f-bf7d70bcd043",
    },
  });
}

function shopifyWithoutSessions() {
  return shopifyApp({
    apiKey: "webhook-topic-test-key",
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
}

describe("resolveSanitizedWebhookTopic", () => {
  it("keeps the subscription form unchanged", () => {
    for (const topic of TOPICS) {
      expect(resolveSanitizedWebhookTopic(topic)).toBe(topic);
    }
  });

  it("maps the form a verified delivery carries back to the subscription form", async () => {
    const shopify = shopifyWithoutSessions();

    for (const topic of TOPICS) {
      const verified = await shopify.authenticate.webhook(
        signedDelivery(topic),
      );
      expect(verified.topic).not.toBe(topic);
      expect(resolveSanitizedWebhookTopic(verified.topic)).toBe(topic);
    }
  });

  it("gives every sanitized topic its own delivered form", () => {
    const delivered = new Set(
      TOPICS.map((topic) => topic.toUpperCase().replace(/[/.]/g, "_")),
    );
    expect(delivered.size).toBe(TOPICS.length);
  });

  it("returns null for topics without a sanitizer", () => {
    expect(resolveSanitizedWebhookTopic("CUSTOMERS_UPDATE")).toBeNull();
    expect(resolveSanitizedWebhookTopic("customers/update")).toBeNull();
    expect(resolveSanitizedWebhookTopic("")).toBeNull();
    expect(resolveSanitizedWebhookTopic("toString")).toBeNull();
  });
});
