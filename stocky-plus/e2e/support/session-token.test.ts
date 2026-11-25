import "@shopify/shopify-api/adapters/node";
import { ApiVersion, shopifyApi } from "@shopify/shopify-api";
import { describe, expect, it } from "vitest";
import { DEV_TEST_STORE, assertDevTestStore, mintSessionToken } from "./session-token";

const apiKey = "e2e-unit-key";
const apiSecret = "e2e-unit-secret";

function shopifyFor(secret: string) {
  return shopifyApi({
    apiKey,
    apiSecretKey: secret,
    apiVersion: ApiVersion.July25,
    hostName: "localhost:3000",
    isEmbeddedApp: true,
  });
}

describe("store E2E session tokens", () => {
  it("are accepted by the Shopify API library the app authenticates with", async () => {
    const token = mintSessionToken({ shop: DEV_TEST_STORE, apiKey, apiSecret });
    const payload = await shopifyFor(apiSecret).session.decodeSessionToken(token);
    expect(payload.dest).toBe(`https://${DEV_TEST_STORE}`);
    expect(payload.aud).toBe(apiKey);
  });

  it("are rejected when signed with a different secret", async () => {
    const token = mintSessionToken({ shop: DEV_TEST_STORE, apiKey, apiSecret: "other" });
    await expect(shopifyFor(apiSecret).session.decodeSessionToken(token)).rejects.toThrow();
  });

  it("expire after 60 seconds", async () => {
    const token = mintSessionToken({
      shop: DEV_TEST_STORE,
      apiKey,
      apiSecret,
      now: new Date(Date.now() - 120_000),
    });
    await expect(shopifyFor(apiSecret).session.decodeSessionToken(token)).rejects.toThrow();
  });

  it("are refused for any shop other than the dev test store", () => {
    expect(() =>
      mintSessionToken({ shop: "real-merchant.myshopify.com", apiKey, apiSecret }),
    ).toThrow(/refusing "real-merchant.myshopify.com"/);
    expect(() => assertDevTestStore(`${DEV_TEST_STORE}.evil.example`)).toThrow();
  });

  it("are refused without the app's client ID and secret", () => {
    expect(() => mintSessionToken({ shop: DEV_TEST_STORE, apiKey: "", apiSecret })).toThrow(
      /client ID and client secret/,
    );
    expect(() => mintSessionToken({ shop: DEV_TEST_STORE, apiKey, apiSecret: "" })).toThrow();
  });
});
