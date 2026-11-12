import type { Config } from "@react-router/dev/config";
import { allowedActionOrigins } from "./server/action-origins.mjs";

export default {
  // Read by `react-router dev`, which the Shopify CLI starts with
  // SHOPIFY_APP_URL set to the tunnel URL. The production server sets the
  // same value at start-up instead (server/build.mjs), because a build does
  // not know its public host.
  allowedActionOrigins: allowedActionOrigins(process.env.SHOPIFY_APP_URL),
} satisfies Config;
