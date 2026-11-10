import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  normalizeVerifiedShopifyDomain,
  updateOfflineSessionScope,
} from "../tenant/bootstrap.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const current: unknown = payload.current;
  if (
    !Array.isArray(current) ||
    !current.every((scope) => typeof scope === "string")
  ) {
    return new Response("Invalid scopes payload", { status: 400 });
  }

  // The offline session is looked up by the verified shop; webhook
  // authentication does not load sessions. No stored session is not an error.
  await updateOfflineSessionScope({
    shopDomain: normalizeVerifiedShopifyDomain(shop),
    scope: current.join(","),
  });
  return new Response();
};
