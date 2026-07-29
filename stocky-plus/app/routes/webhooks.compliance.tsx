import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * Mandatory App Store compliance webhooks.
 * Topics: customers/data_request, customers/redact, shop/redact.
 *
 * Phase 0: authenticate + acknowledge. Full redaction/export workflows are
 * Phase 1 (requires Shop entity, retention policy, and operational runbook).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received compliance webhook ${topic} for ${shop}`);

  // Acknowledge immediately. Do not claim customer/shop data was erased until
  // the Phase 1 retention/redaction pipeline exists and is tested.
  return new Response();
};
