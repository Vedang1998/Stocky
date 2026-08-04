import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ingestAuthenticatedWebhook } from "../sync/intake.server";
import { dispatchPendingJobs } from "../sync/dispatcher.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, webhookId } = await authenticate.webhook(request);
  const apiVersion = request.headers.get("X-Shopify-API-Version");

  await ingestAuthenticatedWebhook({
    verifiedShop: shop,
    topic: "refunds/create",
    webhookId: webhookId ?? `missing-${Date.now()}`,
    apiVersion,
    payload,
  });

  void dispatchPendingJobs({ batchSize: 10 }).catch((err) => {
    console.warn("refunds/create dispatcher kick skipped:", err);
  });

  return new Response();
};
