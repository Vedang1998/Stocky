import type { ActionFunctionArgs } from "react-router";
import { signedShopMatches } from "../lib/http/signed-webhook-shop";
import { authenticate } from "../shopify.server";
import { processUninstall } from "../sync/uninstall.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, webhookId, payload } = await authenticate.webhook(request);

  // The shop header is not covered by the signature; the body is. Only the
  // shop the body names may be uninstalled.
  if (!signedShopMatches(payload, "myshopify_domain", shop)) {
    console.warn(
      `Rejected ${topic} webhook: the signed body does not name ${shop}`,
    );
    return new Response(null, { status: 401 });
  }

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
