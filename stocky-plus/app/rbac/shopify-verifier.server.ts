/**
 * Isolated Shopify API verifier for PR7 checkpoint A.
 *
 * Uses lockfile-pinned `@shopify/shopify-api` decodeSessionToken / tokenExchange.
 * This instance has no session store and is not the configured shopifyApp.
 */

import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  LogSeverity,
  shopifyApi,
  type Shopify,
} from "@shopify/shopify-api";

export type ShopifyVerifierConfig = {
  apiKey: string;
  apiSecretKey: string;
  hostName?: string;
};

export type ShopifyVerifier = {
  readonly api: Shopify;
  readonly apiKey: string;
};

export function createShopifyVerifier(
  config: ShopifyVerifierConfig,
): ShopifyVerifier {
  const apiKey = config.apiKey;
  const apiSecretKey = config.apiSecretKey;
  if (!apiKey || !apiSecretKey) {
    throw new Error("Shopify verifier requires apiKey and apiSecretKey");
  }

  const api = shopifyApi({
    apiKey,
    apiSecretKey,
    apiVersion: ApiVersion.July26,
    hostName: config.hostName ?? "example.com",
    isEmbeddedApp: true,
    logger: { level: LogSeverity.Error },
  });

  return { api, apiKey };
}

export function verifierFromEnv(
  overrides?: Partial<ShopifyVerifierConfig>,
): ShopifyVerifier {
  return createShopifyVerifier({
    apiKey: overrides?.apiKey ?? process.env.SHOPIFY_API_KEY ?? "",
    apiSecretKey: overrides?.apiSecretKey ?? process.env.SHOPIFY_API_SECRET ?? "",
    hostName: overrides?.hostName,
  });
}
