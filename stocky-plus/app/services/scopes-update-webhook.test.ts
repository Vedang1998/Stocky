import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

const { authenticateWebhook, updateSessionScope } = vi.hoisted(() => ({
  authenticateWebhook: vi.fn(),
  updateSessionScope: vi.fn(),
}));

vi.mock("../shopify.server", () => ({
  authenticate: { webhook: authenticateWebhook },
}));
vi.mock("../tenant/bootstrap.server", () => ({ updateSessionScope }));

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
  authenticateWebhook.mockResolvedValue({
    payload,
    session: { id: "offline_shop-a.myshopify.com" },
    topic: "APP_SCOPES_UPDATE",
    shop: "shop-a.myshopify.com",
  });
}

describe("app/scopes_update webhook", () => {
  beforeEach(() => {
    authenticateWebhook.mockReset();
    updateSessionScope.mockReset();
  });

  it("stores the granted scopes on the offline session", async () => {
    verified({ previous: ["read_products"], current: ["read_products", "read_orders"] });

    const response = await action(args());

    expect(response.status).toBe(200);
    expect(updateSessionScope).toHaveBeenCalledWith({
      sessionId: "offline_shop-a.myshopify.com",
      scope: "read_products,read_orders",
    });
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
    expect(updateSessionScope).not.toHaveBeenCalled();
  });
});
