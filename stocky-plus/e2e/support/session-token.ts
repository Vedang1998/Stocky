import { createHmac, randomUUID } from "node:crypto";

/**
 * The only shop the dev-store E2E run may sign in to. Section 11 of the
 * project rules allows store tests against this dev test store only.
 */
export const DEV_TEST_STORE = "stocky-test-store.myshopify.com";

/** Synthetic staff id carried in the token's `sub` claim. */
export const E2E_STAFF_ID = "1";

export type SessionTokenOptions = {
  shop: string;
  apiKey: string;
  apiSecret: string;
  now?: Date;
};

export function assertDevTestStore(shop: string): void {
  if (shop !== DEV_TEST_STORE) {
    throw new Error(
      `Store E2E runs only against ${DEV_TEST_STORE}; refusing "${shop}"`,
    );
  }
}

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/**
 * Signs a session token with the same claims and HS256 signature the Shopify
 * admin gives an embedded app, so the app's own `authenticate.admin` and
 * Shopify's token exchange treat the E2E browser like an admin session.
 * Tokens live 60 seconds, as Shopify's do; mint one per request.
 */
export function mintSessionToken({
  shop,
  apiKey,
  apiSecret,
  now = new Date(),
}: SessionTokenOptions): string {
  assertDevTestStore(shop);
  if (!apiKey || !apiSecret) {
    throw new Error("Store E2E needs the app's client ID and client secret");
  }
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload = {
    iss: `https://${shop}/admin`,
    dest: `https://${shop}`,
    aud: apiKey,
    sub: E2E_STAFF_ID,
    exp: issuedAt + 60,
    nbf: issuedAt - 5,
    iat: issuedAt - 5,
    jti: randomUUID(),
    sid: randomUUID(),
  };
  const unsigned = `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url(payload)}`;
  const signature = createHmac("sha256", apiSecret)
    .update(unsigned)
    .digest("base64url");
  return `${unsigned}.${signature}`;
}
