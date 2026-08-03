import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { enqueueWebhook } from "../jobs/queue.server";
import { resolveWebhookTenant } from "../tenant/webhook-tenant.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, webhookId, topic } = await authenticate.webhook(request);

  // Use verified `shop` from authenticate.webhook only
  const { tenant } = await resolveWebhookTenant(
    shop,
    topic ?? "refunds/create",
  );
  await enqueueWebhook(
    {
      topic: "refunds/create",
      payloadShop: shop,
      payload: payload as Record<string, unknown>,
      tenant,
    },
    webhookId,
  );

  return new Response();
};
