import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { intakeComplianceWebhook } from "../privacy/intake.server";

/**
 * Mandatory App Store compliance webhooks.
 * Authenticate, then durable-ack. Processors run independently while ordinary
 * processing may stay disabled.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, webhookId } = await authenticate.webhook(request);
  await intakeComplianceWebhook({
    shop,
    topic,
    payload,
    webhookId,
  });
  return new Response();
};
