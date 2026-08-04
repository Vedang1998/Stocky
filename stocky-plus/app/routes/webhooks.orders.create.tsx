import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ingestAuthenticatedWebhook } from "../sync/intake.server";
import { dispatchPendingJobs } from "../sync/dispatcher.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, webhookId } = await authenticate.webhook(request);
  const apiVersion = request.headers.get("X-Shopify-API-Version");

  // Durable DB-first intake — Redis is not required for HTTP 200.
  await ingestAuthenticatedWebhook({
    verifiedShop: shop,
    topic: "orders/create",
    webhookId: webhookId ?? `missing-${Date.now()}`,
    apiVersion,
    payload,
  });

  // Best-effort kick; intake already committed.
  void dispatchPendingJobs({ batchSize: 10 }).catch((err) => {
    console.warn("orders/create dispatcher kick skipped:", err);
  });

  return new Response();
};
