import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import { shopifySessionStorage } from "./tenant/bootstrap.server";
import { runAfterAuthTenantBootstrap } from "./tenant/after-auth.server";
import {
  enqueueAfterAuthCatalogSync,
  enqueueOrderFactsSync,
} from "./jobs/queue.server";
import {
  readBoundedRequest,
  WEBHOOK_MAX_BODY_BYTES,
} from "./lib/http/bounded-request.server";

const appConfig = {
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July26,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  distribution: AppDistribution.AppStore as const,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
};

const shopify = shopifyApp({
  ...appConfig,
  sessionStorage: shopifySessionStorage,
  hooks: {
    afterAuth: async ({ session }) => {
      const { tenant } = await runAfterAuthTenantBootstrap(session);
      try {
        await enqueueAfterAuthCatalogSync(tenant);
      } catch (err) {
        // Redis may be down — durable PENDING job still created when DB available.
        console.warn("Catalog sync enqueue skipped:", err);
      }
      try {
        // Imports the order history and stores the shop's time zone and
        // currency, which the reports need. Idempotent per shop.
        await enqueueOrderFactsSync(tenant);
      } catch (err) {
        console.warn("Order history import enqueue skipped:", err);
      }
    },
  },
});

/**
 * Session storage for webhook verification: it holds nothing and refuses
 * writes, so verifying a delivery can never load, refresh or store a token.
 */
const noSessionStorage: SessionStorage = {
  loadSession: async () => undefined,
  findSessionsByShop: async () => [],
  storeSession: async () => {
    throw new Error("Webhook verification must not store sessions");
  },
  deleteSession: async () => {
    throw new Error("Webhook verification must not delete sessions");
  },
  deleteSessions: async () => {
    throw new Error("Webhook verification must not delete sessions");
  },
};

/**
 * Verifies webhook deliveries from the HMAC and headers alone.
 *
 * The library's webhook authentication also loads the shop's offline session
 * and, with expiring offline tokens, refreshes it when it is close to expiry
 * before the route runs. Shopify rejects that refresh once the app is
 * uninstalled, which turned app/uninstalled and the compliance topics into
 * HTTP 500 so they were never processed (#83). No webhook route calls the
 * Admin API, so deliveries are verified against an app instance that has no
 * sessions; `session` and `admin` are always undefined in the result.
 */
const webhookVerifier = shopifyApp({
  ...appConfig,
  sessionStorage: noSessionStorage,
});

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;

/**
 * Webhook routes are reachable without credentials and the library buffers
 * the full body before it can reject a bad HMAC, so every webhook request is
 * size-bounded before verification (413 above WEBHOOK_MAX_BODY_BYTES).
 */
export const authenticate: typeof shopify.authenticate = {
  ...shopify.authenticate,
  webhook: async (request) =>
    webhookVerifier.authenticate.webhook(
      await readBoundedRequest(request, WEBHOOK_MAX_BODY_BYTES),
    ),
};
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
