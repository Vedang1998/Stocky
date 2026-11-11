import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

const { authenticateWebhook, updateOfflineSessionScope } = vi.hoisted(() => ({
  authenticateWebhook: vi.fn(),
  updateOfflineSessionScope: vi.fn(),
}));

vi.mock("../shopify.server", () => ({
  authenticate: { webhook: authenticateWebhook },
}));
vi.mock("../tenant/bootstrap.server", () => ({
  updateOfflineSessionScope,
  normalizeVerifiedShopifyDomain: (domain: string) => domain.toLowerCase(),
}));

import { action } from "../routes/webhooks.app.scopes_update";

function args(): ActionFunctionArgs {
  return {
    request: new Request("https://app.example/webhooks/app/scopes_update", {
      method: "POST",
    }),
    params: {},
    context: {},
  } as ActionFunctionArgs;
}

function verified(payload: Record<string, unknown>) {
  // Webhook authentication carries no session; the route must not need one.
  authenticateWebhook.mockResolvedValue({
    payload,
    session: undefined,
    admin: undefined,
    topic: "APP_SCOPES_UPDATE",
    shop: "Shop-A.myshopify.com",
  });
}

describe("app/scopes_update webhook", () => {
  beforeEach(() => {
    authenticateWebhook.mockReset();
    updateOfflineSessionScope.mockReset();
    updateOfflineSessionScope.mockResolvedValue(1);
  });

  it("stores the granted scopes on the shop's offline session", async () => {
    verified({ previous: ["read_products"], current: ["read_products", "read_orders"] });

    const response = await action(args());

    expect(response.status).toBe(200);
    expect(updateOfflineSessionScope).toHaveBeenCalledWith({
      shopDomain: "shop-a.myshopify.com",
      scope: "read_products,read_orders",
    });
  });

  it("acknowledges the delivery when the shop has no stored session", async () => {
    verified({ current: ["read_products"] });
    updateOfflineSessionScope.mockResolvedValue(0);

    expect((await action(args())).status).toBe(200);
  });

  it.each([
    [{ previous: [] }],
    [{ current: "read_products" }],
    [{ current: ["read_products", 7] }],
    [{ current: null }],
  ])("answers 400 instead of throwing for payload %j", async (payload) => {
    verified(payload);

    const response = await action(args());

    expect(response.status).toBe(400);
    expect(updateOfflineSessionScope).not.toHaveBeenCalled();
  });
});
