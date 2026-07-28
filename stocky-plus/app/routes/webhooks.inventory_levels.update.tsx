import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { enqueueWebhook } from "../jobs/queue.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, webhookId } = await authenticate.webhook(request);

  await enqueueWebhook(
    {
      topic: "inventory_levels/update",
      shop,
      payload: payload as Record<string, unknown>,
    },
    webhookId,
  );

  return new Response();
};
