import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { shopifySessionStorage } from "./tenant/bootstrap.server";
import { runAfterAuthTenantBootstrap } from "./tenant/after-auth.server";
import { enqueueAfterAuthCatalogSync } from "./jobs/queue.server";
import {
  readBoundedRequest,
  WEBHOOK_MAX_BODY_BYTES,
} from "./lib/http/bounded-request.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July26,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: shopifySessionStorage,
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({ session }) => {
      const { tenant } = await runAfterAuthTenantBootstrap(session);
      try {
        await enqueueAfterAuthCatalogSync(tenant);
      } catch (err) {
        // Redis may be down — durable PENDING job still created when DB available.
        console.warn("Catalog sync enqueue skipped:", err);
      }
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;

/**
 * Webhook routes are reachable without credentials and the library buffers the
 * full body before it can reject a bad HMAC, so every webhook request is
 * size-bounded here before verification (413 above WEBHOOK_MAX_BODY_BYTES).
 */
export const authenticate: typeof shopify.authenticate = {
  ...shopify.authenticate,
  webhook: async (request) =>
    shopify.authenticate.webhook(
      await readBoundedRequest(request, WEBHOOK_MAX_BODY_BYTES),
    ),
};
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
