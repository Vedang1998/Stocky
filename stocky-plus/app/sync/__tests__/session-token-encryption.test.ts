/**
 * R-191: access and refresh tokens are encrypted in the Session table, and
 * the Shopify library still gets back the tokens it stored.
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Session } from "@shopify/shopify-api";
import { createSessionTokenCipher } from "../../lib/session-tokens/cipher.server";

const SHOP = "session-token-encryption.myshopify.com";
const ID = `offline_${SHOP}`;
const ACCESS = "fixture-access-integration_0123456789abcdef";
const REFRESH = "fixture-refresh-integration_0123456789abcdef";

function offlineSession(): Session {
  return new Session({
    id: ID,
    shop: SHOP,
    state: "state",
    isOnline: false,
    scope: "read_products,read_inventory",
    accessToken: ACCESS,
    refreshToken: REFRESH,
    expires: new Date("2026-12-01T00:00:00.000Z"),
    refreshTokenExpires: new Date("2027-01-01T00:00:00.000Z"),
  });
}

describe("session tokens at rest (R-191)", () => {
  let prisma: PrismaClient;
  let storage: typeof import("../../tenant/bootstrap.server").shopifySessionStorage;
  let updateOfflineSessionScope: typeof import("../../tenant/bootstrap.server").updateOfflineSessionScope;
  let reencryptSessionTokens: typeof import("../../tenant/bootstrap.server").reencryptSessionTokens;
  const KEY = randomBytes(32).toString("base64");

  beforeAll(async () => {
    process.env.SESSION_TOKEN_ENCRYPTION_KEY = KEY;
    ({
      shopifySessionStorage: storage,
      updateOfflineSessionScope,
      reencryptSessionTokens,
    } = await import("../../tenant/bootstrap.server"));
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { shop: SHOP } });
    await prisma.$disconnect();
    delete process.env.SESSION_TOKEN_ENCRYPTION_KEY;
  });

  beforeEach(async () => {
    process.env.SESSION_TOKEN_ENCRYPTION_KEY = KEY;
    await prisma.session.deleteMany({ where: { shop: SHOP } });
  });

  it("writes encrypted tokens and reads back what Shopify issued", async () => {
    await storage.storeSession(offlineSession());

    const row = await prisma.session.findUniqueOrThrow({ where: { id: ID } });
    expect(row.accessToken).toMatch(/^enc:v1:/);
    expect(row.refreshToken).toMatch(/^enc:v1:/);
    expect(row.accessToken).not.toContain(ACCESS);
    expect(row.refreshToken).not.toContain(REFRESH);
    expect(row.scope).toBe("read_products,read_inventory");

    const loaded = await storage.loadSession(ID);
    expect(loaded?.accessToken).toBe(ACCESS);
    expect(loaded?.refreshToken).toBe(REFRESH);
    expect(loaded?.expires?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(loaded?.refreshTokenExpires?.toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );

    const [found] = await storage.findSessionsByShop(SHOP);
    expect(found.accessToken).toBe(ACCESS);
  });

  it("re-encrypts on every store, so a refreshed token replaces the old one", async () => {
    await storage.storeSession(offlineSession());
    const first = await prisma.session.findUniqueOrThrow({ where: { id: ID } });

    const refreshed = offlineSession();
    refreshed.accessToken = "fixture-access-integration_refreshed";
    await storage.storeSession(refreshed);

    const second = await prisma.session.findUniqueOrThrow({
      where: { id: ID },
    });
    expect(second.accessToken).not.toBe(first.accessToken);
    expect((await storage.loadSession(ID))?.accessToken).toBe(
      "fixture-access-integration_refreshed",
    );
  });

  it("still reads a session that was stored before encryption", async () => {
    await prisma.session.create({
      data: {
        id: ID,
        shop: SHOP,
        state: "state",
        isOnline: false,
        accessToken: ACCESS,
        refreshToken: REFRESH,
      },
    });

    const loaded = await storage.loadSession(ID);
    expect(loaded?.accessToken).toBe(ACCESS);
    expect(loaded?.refreshToken).toBe(REFRESH);
  });

  it("keeps tokens readable after a scope update on the row", async () => {
    await storage.storeSession(offlineSession());

    await updateOfflineSessionScope({
      shopDomain: SHOP,
      scope: "read_products",
    });

    const loaded = await storage.loadSession(ID);
    expect(loaded?.scope).toBe("read_products");
    expect(loaded?.accessToken).toBe(ACCESS);
  });

  it("encrypts sessions stored before encryption when asked to", async () => {
    await prisma.session.create({
      data: {
        id: ID,
        shop: SHOP,
        state: "state",
        isOnline: false,
        accessToken: ACCESS,
        refreshToken: REFRESH,
      },
    });

    const first = await reencryptSessionTokens();
    expect(first.rewritten).toBeGreaterThanOrEqual(1);

    const row = await prisma.session.findUniqueOrThrow({ where: { id: ID } });
    expect(row.accessToken).toMatch(/^enc:v1:/);
    expect(row.refreshToken).toMatch(/^enc:v1:/);
    const loaded = await storage.loadSession(ID);
    expect(loaded?.accessToken).toBe(ACCESS);
    expect(loaded?.refreshToken).toBe(REFRESH);

    expect((await reencryptSessionTokens()).rewritten).toBe(0);
  });

  it("moves every token to a new key so the old key can be removed", async () => {
    await storage.storeSession(offlineSession());
    const nextKey = randomBytes(32).toString("base64");

    process.env.SESSION_TOKEN_ENCRYPTION_KEY = `${nextKey},${KEY}`;
    const rotated = await reencryptSessionTokens();
    expect(rotated.rewritten).toBeGreaterThanOrEqual(1);
    expect((await reencryptSessionTokens()).rewritten).toBe(0);

    const row = await prisma.session.findUniqueOrThrow({ where: { id: ID } });
    const newKeyOnly = createSessionTokenCipher(nextKey);
    expect(newKeyOnly.open(ID, row.accessToken)).toBe(ACCESS);
    expect(newKeyOnly.open(ID, row.refreshToken!)).toBe(REFRESH);
  });

  it("does not hand out a token copied from another shop's row", async () => {
    await storage.storeSession(offlineSession());
    const victim = await prisma.session.findUniqueOrThrow({
      where: { id: ID },
    });
    const otherId = `offline_other-${SHOP}`;
    await prisma.session.create({
      data: {
        id: otherId,
        shop: SHOP,
        state: "state",
        isOnline: false,
        accessToken: victim.accessToken,
      },
    });

    expect(await storage.loadSession(otherId)).toBeUndefined();
  });
});
