import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const webhook = vi.hoisted(() => vi.fn());
const ingestAuthenticatedWebhook = vi.hoisted(() => vi.fn());
const dispatchPendingJobs = vi.hoisted(() => vi.fn());

vi.mock("../shopify.server", () => ({ authenticate: { webhook } }));
vi.mock("./intake.server", () => ({ ingestAuthenticatedWebhook }));
vi.mock("./dispatcher.server", () => ({ dispatchPendingJobs }));

import { action } from "../routes/webhooks.catalog-facts";

const ROUTE_URI = "/webhooks/catalog-facts";
const SHOP = "catalog-topics.myshopify.com";

/** Topics `shopify.app.toml` delivers to this route. */
function subscribedTopics(): string[] {
  const toml = readFileSync(
    fileURLToPath(new URL("../../shopify.app.toml", import.meta.url)),
    "utf8",
  );
  const topics: string[] = [];
  for (const block of toml.split("[[webhooks.subscriptions]]").slice(1)) {
    if (!block.includes(`uri = "${ROUTE_URI}"`)) continue;
    const list = /^\s*topics\s*=\s*\[([^\]]*)\]/m.exec(block);
    if (!list) continue;
    topics.push(...Array.from(list[1].matchAll(/"([^"]+)"/g), (m) => m[1]));
  }
  return topics;
}

function libraryForm(topic: string): string {
  return topic.toUpperCase().replace(/[/.]/g, "_");
}

function deliver(topic: string) {
  webhook.mockResolvedValue({
    shop: SHOP,
    topic,
    payload: { id: 42 },
    webhookId: "delivery-1",
  });
  const request = new Request(`https://app.example.com${ROUTE_URI}`, {
    method: "POST",
    headers: { "X-Shopify-API-Version": "2026-07" },
  });
  return action({ request, params: {}, context: {} } as never);
}

describe("catalog facts webhook route", () => {
  beforeEach(() => {
    webhook.mockReset();
    ingestAuthenticatedWebhook.mockReset();
    ingestAuthenticatedWebhook.mockResolvedValue(undefined);
    dispatchPendingJobs.mockReset();
    dispatchPendingJobs.mockResolvedValue(undefined);
  });

  it("is subscribed to the catalog, inventory, location and bulk topics", () => {
    expect(subscribedTopics()).toEqual([
      "products/create",
      "products/update",
      "products/delete",
      "inventory_items/create",
      "inventory_items/update",
      "inventory_items/delete",
      "inventory_levels/connect",
      "inventory_levels/update",
      "inventory_levels/disconnect",
      "locations/create",
      "locations/update",
      "locations/delete",
      "locations/activate",
      "locations/deactivate",
      "bulk_operations/finish",
    ]);
  });

  it.each(subscribedTopics())(
    "ingests %s when the delivery carries the library's topic form",
    async (topic) => {
      const response = await deliver(libraryForm(topic));

      expect(response.status).toBe(200);
      expect(ingestAuthenticatedWebhook).toHaveBeenCalledExactlyOnceWith({
        verifiedShop: SHOP,
        topic,
        webhookId: "delivery-1",
        apiVersion: "2026-07",
        payload: { id: 42 },
      });
      expect(dispatchPendingJobs).toHaveBeenCalledOnce();
    },
  );

  it.each(subscribedTopics())(
    "ingests %s when the delivery carries the subscription topic form",
    async (topic) => {
      const response = await deliver(topic);

      expect(response.status).toBe(200);
      expect(ingestAuthenticatedWebhook).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ topic }),
      );
    },
  );

  it("rejects a topic the sync pipeline has no sanitizer for", async () => {
    const response = await deliver("CUSTOMERS_UPDATE");

    expect(response.status).toBe(400);
    expect(ingestAuthenticatedWebhook).not.toHaveBeenCalled();
    expect(dispatchPendingJobs).not.toHaveBeenCalled();
  });

  it("still answers 200 when the dispatcher kick fails", async () => {
    dispatchPendingJobs.mockRejectedValue(new Error("redis down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await deliver("PRODUCTS_UPDATE");
    await Promise.resolve();

    expect(response.status).toBe(200);
    warn.mockRestore();
  });
});
