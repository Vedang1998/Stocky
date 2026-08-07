import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ingestAuthenticatedWebhook } from "../sync/intake.server";
import { dispatchPendingJobs } from "../sync/dispatcher.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, webhookId } = await authenticate.webhook(request);
  const apiVersion = request.headers.get("X-Shopify-API-Version");

  await ingestAuthenticatedWebhook({
    verifiedShop: shop,
    topic: "orders/cancelled",
    webhookId: webhookId ?? null,
    apiVersion,
    payload,
  });

  void dispatchPendingJobs({ batchSize: 10 }).catch((err) => {
    console.warn("orders/cancelled dispatcher kick skipped:", err);
  });

  return new Response();
};
