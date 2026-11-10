import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { updateSessionScope } from "../tenant/bootstrap.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const current: unknown = payload.current;
  if (
    !Array.isArray(current) ||
    !current.every((scope) => typeof scope === "string")
  ) {
    return new Response("Invalid scopes payload", { status: 400 });
  }

  if (session) {
    await updateSessionScope({
      sessionId: session.id,
      scope: current.join(","),
    });
  }
  return new Response();
};
