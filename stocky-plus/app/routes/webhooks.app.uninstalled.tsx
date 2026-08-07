import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { processUninstall } from "../sync/uninstall.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, webhookId, payload } = await authenticate.webhook(request);
  const apiVersion = request.headers.get("X-Shopify-API-Version");

  console.log(`Received ${topic} webhook for ${shop}`);

  await processUninstall({
    verifiedShop: shop,
    webhookId: webhookId ?? null,
    apiVersion,
    payload,
  });

  return new Response();
};
