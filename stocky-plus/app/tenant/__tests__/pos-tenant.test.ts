import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import type { PrismaClient } from "@prisma/client";
import type { JwtPayload } from "@shopify/shopify-api";
import { isTenantAuthority } from "../authority.server";
import { requirePosTenant } from "../require-pos-tenant.server";
import { resolveScannedCode } from "../../services/barcode-lookup.server";
import { getVariantStock } from "../../services/stock-lookup.server";
import {
  clearCatalogFacts,
  createPrisma,
  resetPublicSchema,
  seedCatalogVariant,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

// Placeholder credentials for the test-only Shopify app instance below.
const API_KEY = "pos-test-api-key";
const API_SECRET = "pos-test-api-secret"; // pragma: allowlist secret
const APP_URL = "https://propo-app.example.com";
const POS_ORIGIN = "https://extensions.shopifycdn.com";

// The routes authenticate through app/shopify.server. Replace only its
// configuration (test credentials, no session storage or queue) so the real
// Shopify library still verifies every token.
vi.mock("../../shopify.server", async () => {
  await import("@shopify/shopify-app-react-router/adapters/node");
  const { ApiVersion, AppDistribution, shopifyApp } = await import(
    "@shopify/shopify-app-react-router/server"
  );
  const unused = () => Promise.reject(new Error("session storage is not used"));
  const app = shopifyApp({
    apiKey: "pos-test-api-key",
    apiSecretKey: "pos-test-api-secret", // pragma: allowlist secret
    apiVersion: ApiVersion.July26,
    appUrl: "https://propo-app.example.com",
    scopes: ["read_products"],
    distribution: AppDistribution.AppStore,
    sessionStorage: {
      storeSession: unused,
      loadSession: unused,
      deleteSession: unused,
      deleteSessions: unused,
      findSessionsByShop: unused,
    },
  });
  return { authenticate: app.authenticate };
});

function base64url(value: object | Buffer): string {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
  return buffer.toString("base64url");
}

/** Session token shaped like the ones Shopify POS mints, signed with HS256. */
function signSessionToken(
  shopDomain: string,
  overrides: Record<string, unknown> = {},
  secret = API_SECRET,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://${shopDomain}/admin`,
    dest: `https://${shopDomain}`,
    aud: API_KEY,
    sub: "4242",
    exp: now + 60,
    nbf: now - 5,
    iat: now - 5,
    jti: "0a1b2c3d",
    sid: "session",
    ...overrides,
  };
  const body = `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url(payload)}`;
  const signature = createHmac("sha256", secret).update(body).digest();
  return `${body}.${base64url(signature)}`;
}

function signedRequest(path: string, token: string | null, method = "GET") {
  const headers: Record<string, string> = { Origin: POS_ORIGIN };
  if (token) headers.Authorization = `Bearer ${token}`;
  const request = new Request(`${APP_URL}${path}`, { method, headers });
  return { request, params: {}, context: {} } as LoaderFunctionArgs;
}

function posAuth(overrides: Partial<JwtPayload> = {}) {
  const sessionToken = {
    iss: `https://${SHOP_A_DOMAIN}/admin`,
    dest: `https://${SHOP_A_DOMAIN}`,
    aud: API_KEY,
    sub: "4242",
    exp: Math.floor(Date.now() / 1000) + 60,
    nbf: Math.floor(Date.now() / 1000) - 5,
    iat: Math.floor(Date.now() / 1000) - 5,
    jti: "jti",
    sid: "sid",
    ...overrides,
  } as JwtPayload;
  return async () => ({ sessionToken, cors: (response: Response) => response });
}

function posRequest(url = "https://example.com/api/pos/scan?code=1") {
  return new Request(url, { headers: { Authorization: "Bearer token" } });
}

describe("POS tenant authority", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await clearCatalogFacts(prisma);
    const shops = await seedTwoShops(prisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("issues Shop A authority and a POS actor from a verified token", async () => {
    const ctx = await requirePosTenant({
      request: posRequest(),
      authenticatePos: posAuth(),
      apiKey: API_KEY,
    });
    expect(ctx.tenant.shopId).toBe(shopAId);
    expect(ctx.tenant.myshopifyDomain).toBe(SHOP_A_DOMAIN);
    expect(ctx.tenant.source).toBe("verified_pos_request");
    expect(isTenantAuthority(ctx.tenant)).toBe(true);
    expect(ctx.actor).toEqual({
      shopifyUserId: "4242",
      displayName: null,
      channel: "POS",
    });
  });

  it("accepts a User GID subject and an audience list", async () => {
    const ctx = await requirePosTenant({
      request: posRequest(),
      authenticatePos: posAuth({
        sub: "gid://shopify/User/77",
        // JWT allows a list; the shopify-api payload type only models a string.
        aud: ["other", API_KEY] as unknown as string,
      }),
      apiKey: API_KEY,
    });
    expect(ctx.actor.shopifyUserId).toBe("77");
  });

  it("records no user for a malformed subject", async () => {
    const ctx = await requirePosTenant({
      request: posRequest(),
      authenticatePos: posAuth({ sub: "staff:abc" }),
      apiKey: API_KEY,
    });
    expect(ctx.actor.shopifyUserId).toBeNull();
  });

  it("rejects a token issued for another app", async () => {
    await expect(
      requirePosTenant({
        request: posRequest(),
        authenticatePos: posAuth({ aud: "someone-else" }),
        apiKey: API_KEY,
      }),
    ).rejects.toMatchObject({ code: "token_audience_mismatch" });
  });

  it("fails closed when the expected audience is not configured", async () => {
    await expect(
      requirePosTenant({
        request: posRequest(),
        authenticatePos: posAuth(),
        apiKey: "",
      }),
    ).rejects.toMatchObject({ code: "token_audience_mismatch" });
  });

  it.each([
    ["missing", undefined],
    ["http", `http://${SHOP_A_DOMAIN}`],
    ["with path", `https://${SHOP_A_DOMAIN}/admin`],
    ["with port", `https://${SHOP_A_DOMAIN}:8443`],
    ["with query", `https://${SHOP_A_DOMAIN}?shop=${SHOP_B_DOMAIN}`],
    ["with credentials", `https://${SHOP_B_DOMAIN}@${SHOP_A_DOMAIN}`],
    ["non-Shopify host", "https://evil.example.com"],
  ])("rejects a destination that is %s", async (_label, dest) => {
    await expect(
      requirePosTenant({
        request: posRequest(),
        authenticatePos: posAuth({ dest }),
        apiKey: API_KEY,
      }),
    ).rejects.toMatchObject({ code: "malformed_authenticated_domain" });
  });

  it("accepts a bare-domain destination", async () => {
    const ctx = await requirePosTenant({
      request: posRequest(),
      authenticatePos: posAuth({ dest: SHOP_A_DOMAIN }),
      apiKey: API_KEY,
    });
    expect(ctx.tenant.shopId).toBe(shopAId);
  });

  it("fails closed for a shop with no canonical record", async () => {
    await expect(
      requirePosTenant({
        request: posRequest(),
        authenticatePos: posAuth({ dest: "https://unknown-shop.myshopify.com" }),
        apiKey: API_KEY,
      }),
    ).rejects.toMatchObject({ code: "canonical_shop_missing" });
  });

  it("denies a shop whose processing is disabled", async () => {
    await prisma.shop.update({
      where: { id: shopAId },
      data: {
        processingEnabled: false,
        processingDisabledReason: "UNINSTALLED",
        processingDisabledAt: new Date(),
      },
    });
    await expect(
      requirePosTenant({
        request: posRequest(),
        authenticatePos: posAuth(),
        apiKey: API_KEY,
      }),
    ).rejects.toMatchObject({ code: "shop_processing_disabled" });
  });

  it("denies a conflicting client shop hint", async () => {
    await expect(
      requirePosTenant({
        request: posRequest(
          `https://example.com/api/pos/scan?code=1&shop=${SHOP_B_DOMAIN}`,
        ),
        authenticatePos: posAuth(),
        apiKey: API_KEY,
      }),
    ).rejects.toMatchObject({ code: "client_shop_conflict" });
  });

  it("scan lookup and stock never cross into another shop", async () => {
    const a = await seedCatalogVariant(prisma, shopAId, "1001", "036000291452", {
      available: 3,
    });
    const b = await seedCatalogVariant(prisma, shopBId, "2001", "036000291452", {
      available: 99,
    });
    await seedCatalogVariant(prisma, shopBId, "2002", "SHOP-B-ONLY");

    const { db } = await requirePosTenant({
      request: posRequest(),
      authenticatePos: posAuth(),
      apiKey: API_KEY,
    });

    const resolution = await resolveScannedCode(db, "0036000291452");
    expect(resolution).toMatchObject({
      status: "matched",
      matchedOn: "barcode",
      variant: { variantGid: a.variantGid, displayName: "Product 1001" },
    });

    expect(await resolveScannedCode(db, "SHOP-B-ONLY")).toEqual({
      status: "unknown",
      code: "SHOP-B-ONLY",
    });
    expect(await getVariantStock(db, b.variantGid)).toBeNull();

    const stock = await getVariantStock(db, a.variantGid);
    expect(stock?.locations).toEqual([
      expect.objectContaining({ locationGid: a.locationGid, available: 3 }),
    ]);
    expect(stock?.totals.available).toBe(3);
  });

  it("does not resolve variants Shopify reported as deleted", async () => {
    await seedCatalogVariant(prisma, shopAId, "1002", "DELETED-ITEM", { absent: true });
    const { db } = await requirePosTenant({
      request: posRequest(),
      authenticatePos: posAuth(),
      apiKey: API_KEY,
    });
    expect(await resolveScannedCode(db, "DELETED-ITEM")).toEqual({
      status: "unknown",
      code: "DELETED-ITEM",
    });
  });

  describe("POS API with Shopify-signed session tokens", () => {
    const BARCODE = "036000291452";
    let scan: (args: LoaderFunctionArgs) => Promise<Response>;
    let stock: (args: LoaderFunctionArgs) => Promise<Response>;

    beforeAll(async () => {
      scan = (await import("../../routes/api.pos.scan")).loader;
      stock = (await import("../../routes/api.pos.stock")).loader;
    });

    beforeEach(() => {
      vi.stubEnv("SHOPIFY_API_KEY", API_KEY);
      vi.stubEnv("SHOPIFY_APP_URL", APP_URL);
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    it("returns the calling shop's match and stock, never the other shop's", async () => {
      const a = await seedCatalogVariant(prisma, shopAId, "1001", BARCODE, { available: 3 });
      const b = await seedCatalogVariant(prisma, shopBId, "2001", BARCODE, { available: 99 });

      const responseA = await scan(
        signedRequest(`/api/pos/scan?code=${BARCODE}&location=1001`, signSessionToken(SHOP_A_DOMAIN)),
      );
      expect(responseA.status).toBe(200);
      expect(responseA.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(responseA.headers.get("Cache-Control")).toBe("no-store");
      const bodyA = await responseA.json();
      expect(bodyA.resolution).toMatchObject({
        status: "matched",
        variant: { variantGid: a.variantGid },
      });
      expect(bodyA.stock.locations).toEqual([
        expect.objectContaining({ locationGid: a.locationGid, available: 3 }),
      ]);

      const responseB = await scan(
        signedRequest(`/api/pos/scan?code=${BARCODE}`, signSessionToken(SHOP_B_DOMAIN)),
      );
      const bodyB = await responseB.json();
      expect(bodyB.resolution.variant.variantGid).toBe(b.variantGid);
      expect(bodyB.stock.totals.available).toBe(99);

      const crossShop = await stock(
        signedRequest(
          `/api/pos/stock?variant=${encodeURIComponent(b.variantGid)}`,
          signSessionToken(SHOP_A_DOMAIN),
        ),
      );
      expect(crossShop.status).toBe(404);
    });

    it.each([
      ["no token", () => null],
      ["a token signed with another secret", () => signSessionToken(SHOP_A_DOMAIN, {}, "wrong-secret")],
      ["an expired token", () => {
        const past = Math.floor(Date.now() / 1000) - 3600;
        return signSessionToken(SHOP_A_DOMAIN, { exp: past, nbf: past - 60, iat: past - 60 });
      }],
      ["an unsigned token", () => {
        const [, payload] = signSessionToken(SHOP_A_DOMAIN).split(".");
        return `${base64url({ alg: "none", typ: "JWT" })}.${payload}.`;
      }],
    ])("rejects %s with a CORS-readable 401", async (_label, token) => {
      await seedCatalogVariant(prisma, shopAId, "1001", BARCODE);
      const response = await scan(signedRequest(`/api/pos/scan?code=${BARCODE}`, token()));
      expect(response.status).toBe(401);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(await response.text()).toBe("");
    });

    it.each([
      ["minted for another app", SHOP_A_DOMAIN, { aud: "another-app" }],
      ["for a shop that never installed", "never-installed.myshopify.com", {}],
    ])("refuses a valid token %s", async (_label, shopDomain, claims) => {
      const response = await scan(
        signedRequest(`/api/pos/scan?code=${BARCODE}`, signSessionToken(shopDomain, claims)),
      );
      expect(response.status).toBe(403);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect((await response.json()).error.code).toBe("forbidden");
    });

    it("refuses an uninstalled shop even with a still-valid token", async () => {
      await seedCatalogVariant(prisma, shopAId, "1001", BARCODE);
      await prisma.shop.update({
        where: { id: shopAId },
        data: {
          processingEnabled: false,
          processingDisabledReason: "UNINSTALLED",
          processingDisabledAt: new Date(),
        },
      });
      const response = await scan(
        signedRequest(`/api/pos/scan?code=${BARCODE}`, signSessionToken(SHOP_A_DOMAIN)),
      );
      expect(response.status).toBe(403);
    });

    it("answers the CORS preflight without a token", async () => {
      const response = await scan(signedRequest("/api/pos/scan?code=1", null, "OPTIONS"));
      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    });
  });
});
