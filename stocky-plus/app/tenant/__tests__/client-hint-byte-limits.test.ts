/**
 * F-PR2R2-07 / F-PR2R2-08 — UTF-8 body-byte accounting and key-specific shop hints.
 */

import { describe, expect, it } from "vitest";
import {
  CLIENT_HINT_MAX_BODY_BYTES,
  denyConflictingClientShop,
  extractClientShopHints,
} from "../client-shop.server";
import { SHOP_A_DOMAIN, SHOP_B_DOMAIN } from "./helpers";

const shopA = {
  id: "shop-a-id",
  myshopifyDomain: SHOP_A_DOMAIN,
};

describe("tenant request-byte and shop-hint tests (F-PR2R2-07/08)", () => {
  it("documents body limit as bytes", () => {
    expect(CLIENT_HINT_MAX_BODY_BYTES).toBe(1_048_576);
  });

  it("allows exact ASCII byte limit and denies one byte over", async () => {
    // {"pad":"<padding>"} => 9 overhead bytes for {"pad":""}
    const overhead = Buffer.byteLength('{"pad":""}', "utf8");
    const exactPad = "x".repeat(CLIENT_HINT_MAX_BODY_BYTES - overhead);
    const exactBody = `{"pad":"${exactPad}"}`;
    expect(Buffer.byteLength(exactBody, "utf8")).toBe(CLIENT_HINT_MAX_BODY_BYTES);

    await expect(
      denyConflictingClientShop(
        new Request("https://example.com/app", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: exactBody,
        }),
        shopA,
      ),
    ).resolves.toBeUndefined();

    const overBody = `{"pad":"${exactPad}x"}`;
    expect(Buffer.byteLength(overBody, "utf8")).toBe(
      CLIENT_HINT_MAX_BODY_BYTES + 1,
    );
    await expect(
      denyConflictingClientShop(
        new Request("https://example.com/app", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: overBody,
        }),
        shopA,
      ),
    ).rejects.toMatchObject({ code: "client_shop_hint_limit" });
  });

  it("multibyte UTF-8 under byte limit allowed; over denied", async () => {
    // Each '€' is 3 UTF-8 bytes, 1 JS code unit.
    const euro = "€";
    const euroBytes = Buffer.byteLength(euro, "utf8");
    expect(euroBytes).toBe(3);
    const overhead = Buffer.byteLength('{"pad":""}', "utf8");
    const maxChars = Math.floor((CLIENT_HINT_MAX_BODY_BYTES - overhead) / euroBytes);
    const under = `{"pad":"${euro.repeat(maxChars)}"}`;
    expect(Buffer.byteLength(under, "utf8")).toBeLessThanOrEqual(
      CLIENT_HINT_MAX_BODY_BYTES,
    );
    // JS string length is much smaller than UTF-8 bytes.
    expect(under.length).toBeLessThan(Buffer.byteLength(under, "utf8"));

    await expect(
      denyConflictingClientShop(
        new Request("https://example.com/app", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: under,
        }),
        shopA,
      ),
    ).resolves.toBeUndefined();

    const over = `{"pad":"${euro.repeat(maxChars + 1)}"}`;
    expect(Buffer.byteLength(over, "utf8")).toBeGreaterThan(
      CLIENT_HINT_MAX_BODY_BYTES,
    );
    await expect(
      denyConflictingClientShop(
        new Request("https://example.com/app", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: over,
        }),
        shopA,
      ),
    ).rejects.toMatchObject({ code: "client_shop_hint_limit" });
  });

  it("rejects malformed declared JSON; allows empty JSON object", async () => {
    await expect(
      denyConflictingClientShop(
        new Request("https://example.com/app", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{not-json",
        }),
        shopA,
      ),
    ).rejects.toMatchObject({ code: "client_shop_hint_malformed_json" });

    await expect(
      denyConflictingClientShop(
        new Request("https://example.com/app", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
        shopA,
      ),
    ).resolves.toBeUndefined();
  });

  it("allows business shop string arrays; denies foreign myshopify domain arrays", async () => {
    await expect(
      denyConflictingClientShop(
        new Request("https://example.com/app", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ shop: ["Downtown", "Uptown"] }),
        }),
        shopA,
      ),
    ).resolves.toBeUndefined();

    await expect(
      denyConflictingClientShop(
        new Request("https://example.com/app", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ shop: [SHOP_B_DOMAIN] }),
        }),
        shopA,
      ),
    ).rejects.toMatchObject({ code: "client_shop_conflict" });
  });

  it("multipart cumulative body above limit is denied", async () => {
    const boundary = "----stockyboundary";
    const pad = "x".repeat(CLIENT_HINT_MAX_BODY_BYTES);
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="pad"\r\n\r\n` +
      `${pad}\r\n` +
      `--${boundary}--\r\n`;
    expect(Buffer.byteLength(body, "utf8")).toBeGreaterThan(
      CLIENT_HINT_MAX_BODY_BYTES,
    );

    await expect(
      denyConflictingClientShop(
        new Request("https://example.com/app", {
          method: "POST",
          headers: {
            "content-type": `multipart/form-data; boundary=${boundary}`,
          },
          body,
        }),
        shopA,
      ),
    ).rejects.toMatchObject({ code: "client_shop_hint_limit" });
  });

  it("multipart file parts count toward byte limit but are not tenant hints", async () => {
    const boundary = "----stockyfile";
    const small =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="a.bin"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n` +
      `hello\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="note"\r\n\r\n` +
      `ok\r\n` +
      `--${boundary}--\r\n`;

    const hints = await extractClientShopHints(
      new Request("https://example.com/app", {
        method: "POST",
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
        body: small,
      }),
    );
    expect(hints).toEqual([]);
  });
});
