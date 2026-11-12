import { randomBytes } from "node:crypto";
import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptedSessionStorage } from "./encrypted-session-storage.server";
import { createSessionTokenCipher } from "./cipher.server";

const SHOP = "encrypted-storage.myshopify.com";
const ID = `offline_${SHOP}`;
const ACCESS = "fixture-access-0123456789abcdef";
const REFRESH = "fixture-refresh-0123456789abcdef";

/** Keeps what it is given, the way the database table would. */
function tableStorage() {
  const rows = new Map<string, ReturnType<Session["toObject"]>>();
  const storage: SessionStorage = {
    storeSession: async (session) => {
      rows.set(session.id, session.toObject());
      return true;
    },
    loadSession: async (id) => {
      const row = rows.get(id);
      return row ? new Session(row) : undefined;
    },
    findSessionsByShop: async (shop) =>
      [...rows.values()]
        .filter((row) => row.shop === shop)
        .map((row) => new Session(row)),
    deleteSession: async (id) => rows.delete(id),
    deleteSessions: async (ids) => {
      ids.forEach((id) => rows.delete(id));
      return true;
    },
  };
  return { rows, storage };
}

function offlineSession(): Session {
  return new Session({
    id: ID,
    shop: SHOP,
    state: "state",
    isOnline: false,
    scope: "read_products",
    accessToken: ACCESS,
    refreshToken: REFRESH,
    expires: new Date("2026-12-01T00:00:00Z"),
    refreshTokenExpires: new Date("2027-01-01T00:00:00Z"),
  });
}

describe("encrypted session storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores no readable token and gives the tokens back on load", async () => {
    const { rows, storage } = tableStorage();
    const encrypted = encryptedSessionStorage(
      storage,
      createSessionTokenCipher(randomBytes(32).toString("base64")),
    );
    const session = offlineSession();

    await encrypted.storeSession(session);

    const row = rows.get(ID)!;
    expect(JSON.stringify(row)).not.toContain(ACCESS);
    expect(JSON.stringify(row)).not.toContain(REFRESH);
    expect(row.accessToken).toMatch(/^enc:v1:/);
    expect(row.refreshToken).toMatch(/^enc:v1:/);
    // The caller's session keeps the tokens Shopify issued.
    expect(session.accessToken).toBe(ACCESS);
    expect(session.refreshToken).toBe(REFRESH);

    const loaded = await encrypted.loadSession(ID);
    expect(loaded?.toObject()).toEqual(session.toObject());
    const found = await encrypted.findSessionsByShop(SHOP);
    expect(found.map((s) => s.toObject())).toEqual([session.toObject()]);
  });

  it("reads a session stored before encryption and encrypts it on the next store", async () => {
    const { rows, storage } = tableStorage();
    await storage.storeSession(offlineSession());
    const encrypted = encryptedSessionStorage(
      storage,
      createSessionTokenCipher(randomBytes(32).toString("base64")),
    );

    const loaded = await encrypted.loadSession(ID);
    expect(loaded?.accessToken).toBe(ACCESS);

    await encrypted.storeSession(loaded!);
    expect(rows.get(ID)!.accessToken).toMatch(/^enc:v1:/);
  });

  it("treats a session whose token was tampered with as missing", async () => {
    const { rows, storage } = tableStorage();
    const encrypted = encryptedSessionStorage(
      storage,
      createSessionTokenCipher(randomBytes(32).toString("base64")),
    );
    await encrypted.storeSession(offlineSession());
    const row = rows.get(ID)!;
    row.accessToken = `${row.accessToken!.slice(0, -4)}AAAA`;
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await encrypted.loadSession(ID)).toBeUndefined();
    expect(await encrypted.findSessionsByShop(SHOP)).toEqual([]);
    expect(logged).toHaveBeenCalled();
    expect(JSON.stringify(logged.mock.calls)).not.toContain(REFRESH);
  });

  it("fails loudly when tokens were written with a key it does not have", async () => {
    const { storage } = tableStorage();
    await encryptedSessionStorage(
      storage,
      createSessionTokenCipher(randomBytes(32).toString("base64")),
    ).storeSession(offlineSession());
    const otherKey = encryptedSessionStorage(
      storage,
      createSessionTokenCipher(randomBytes(32).toString("base64")),
    );

    await expect(otherKey.loadSession(ID)).rejects.toMatchObject({
      code: "key_unknown",
    });
    await expect(otherKey.findSessionsByShop(SHOP)).rejects.toMatchObject({
      code: "key_unknown",
    });
  });

  it("deletes through to the table", async () => {
    const { rows, storage } = tableStorage();
    const encrypted = encryptedSessionStorage(
      storage,
      createSessionTokenCipher(randomBytes(32).toString("base64")),
    );
    await encrypted.storeSession(offlineSession());

    await encrypted.deleteSessions([ID]);

    expect(rows.size).toBe(0);
  });

  it("is the wrapped storage itself when no key is configured", () => {
    const { storage } = tableStorage();

    expect(encryptedSessionStorage(storage, null)).toBe(storage);
  });
});
