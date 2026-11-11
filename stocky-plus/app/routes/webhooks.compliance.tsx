import type { ActionFunctionArgs } from "react-router";
import { recordPrivacyRequest } from "../privacy/intake.server";
import { resolveComplianceTopic } from "../privacy/topics";
import { authenticate } from "../shopify.server";

/**
 * Mandatory compliance webhooks: customers/data_request, customers/redact and
 * shop/redact. The request is stored before Shopify gets its 200; a failure to
 * store it answers 500 so Shopify delivers it again. shop/redact is carried
 * out by the worker (app/privacy/maintenance.server.ts).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, webhookId, payload } =
    await authenticate.webhook(request);

  const complianceTopic = resolveComplianceTopic(topic);
  if (!complianceTopic) {
    return new Response("Unsupported webhook topic", { status: 400 });
  }

  const recorded = await recordPrivacyRequest({
    topic: complianceTopic,
    verifiedShop: shop,
    webhookId,
    payload,
  });
  console.log(
    `Compliance webhook ${complianceTopic} for ${shop}: request ${recorded.requestId}${recorded.duplicate ? " (redelivery)" : ""}`,
  );

  return new Response();
};
