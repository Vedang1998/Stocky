/**
 * Isolated Shopify API verifier for PR7 checkpoint A.
 *
 * Uses lockfile-pinned `@shopify/shopify-api` decodeSessionToken / tokenExchange.
 * This instance has no session store and is not the configured shopifyApp.
 *
 * `identity` is a non-reversible digest of apiKey + apiSecretKey + hostName.
 * The secret itself is not stored on the object and is not logged.
 */

import { createHash } from "node:crypto";
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
  readonly identity: string;
};

function verifierIdentity(
  apiKey: string,
  apiSecretKey: string,
  hostName: string,
): string {
  return createHash("sha256")
    .update("pr7-verifier-v1")
    .update("\0")
    .update(apiKey)
    .update("\0")
    .update(apiSecretKey)
    .update("\0")
    .update(hostName)
    .digest("hex");
}

export function createShopifyVerifier(
  config: ShopifyVerifierConfig,
): ShopifyVerifier {
  const apiKey = config.apiKey;
  const apiSecretKey = config.apiSecretKey;
  if (!apiKey || !apiSecretKey) {
    throw new Error("Shopify verifier requires apiKey and apiSecretKey");
  }

  const hostName = config.hostName ?? "example.com";
  const api = shopifyApi({
    apiKey,
    apiSecretKey,
    apiVersion: ApiVersion.July26,
    hostName,
    isEmbeddedApp: true,
    logger: { level: LogSeverity.Error },
  });

  return Object.freeze({
    api,
    apiKey,
    identity: verifierIdentity(apiKey, apiSecretKey, hostName),
  });
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
