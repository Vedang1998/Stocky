import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { dispatchPendingJobs } from "../sync/dispatcher.server";
import { ingestAuthenticatedWebhook } from "../sync/intake.server";
import { resolveSanitizedWebhookTopic } from "../sync/sanitize.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const verified = await authenticate.webhook(request);
  const { shop, payload, webhookId } = verified;
  const topic = resolveSanitizedWebhookTopic(verified.topic);
  if (!topic) {
    return new Response("Unsupported webhook topic", { status: 400 });
  }
  await ingestAuthenticatedWebhook({
    verifiedShop: shop,
    topic,
    webhookId: webhookId ?? null,
    apiVersion: request.headers.get("X-Shopify-API-Version"),
    payload,
  });
  void dispatchPendingJobs({ batchSize: 10 }).catch((error) => {
    console.warn(
      `${topic} dispatcher kick skipped:`,
      error instanceof Error ? error.message : error,
    );
  });
  return new Response();
};
