import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createSessionTokenCipher,
  isSealedSessionToken,
  loadSessionTokenCipher,
  SessionTokenError,
} from "./cipher.server";

const KEY_A = randomBytes(32).toString("base64");
const KEY_B = randomBytes(32).toString("base64");
const SESSION = "offline_cipher-test.myshopify.com";
const TOKEN = "fixture-access-0123456789abcdef0123456789abcdef";

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof SessionTokenError ? error.code : "other";
  }
  return undefined;
}

describe("session token cipher", () => {
  it("returns the token it was given and never stores it readable", () => {
    const cipher = createSessionTokenCipher(KEY_A);

    const stored = cipher.seal(SESSION, TOKEN);

    expect(isSealedSessionToken(stored)).toBe(true);
    expect(stored).not.toContain(TOKEN);
    expect(stored).not.toContain(Buffer.from(TOKEN).toString("base64url"));
    expect(cipher.open(SESSION, stored)).toBe(TOKEN);
  });

  it("produces a different stored value each time", () => {
    const cipher = createSessionTokenCipher(KEY_A);

    expect(cipher.seal(SESSION, TOKEN)).not.toBe(cipher.seal(SESSION, TOKEN));
  });

  it("does not open a token moved to another session", () => {
    const cipher = createSessionTokenCipher(KEY_A);
    const stored = cipher.seal(SESSION, TOKEN);

    expect(
      codeOf(() => cipher.open("offline_other-shop.myshopify.com", stored)),
    ).toBe("token_corrupt");
  });

  it.each([
    ["a changed ciphertext", 2],
    ["a changed tag", 3],
    ["a changed iv", 1],
  ])("rejects %s", (_case, part) => {
    const cipher = createSessionTokenCipher(KEY_A);
    const parts = cipher.seal(SESSION, TOKEN).split(":");
    const index = 2 + part;
    const bytes = Buffer.from(parts[index], "base64url");
    bytes[0] ^= 0x01;
    parts[index] = bytes.toString("base64url");

    expect(codeOf(() => cipher.open(SESSION, parts.join(":")))).toBe(
      "token_corrupt",
    );
  });

  it("rejects a stored value with missing parts", () => {
    const cipher = createSessionTokenCipher(KEY_A);

    expect(codeOf(() => cipher.open(SESSION, "enc:v1:abc:def"))).toBe(
      "token_corrupt",
    );
  });

  it("passes through a token stored before encryption was switched on", () => {
    const cipher = createSessionTokenCipher(KEY_A);

    expect(cipher.open(SESSION, TOKEN)).toBe(TOKEN);
  });

  it("writes with the first key and still reads tokens written with an older one", () => {
    const before = createSessionTokenCipher(KEY_A);
    const after = createSessionTokenCipher(`${KEY_B}, ${KEY_A}`);
    const old = before.seal(SESSION, TOKEN);

    expect(after.open(SESSION, old)).toBe(TOKEN);
    const rewritten = after.seal(SESSION, TOKEN);
    expect(createSessionTokenCipher(KEY_B).open(SESSION, rewritten)).toBe(
      TOKEN,
    );
    expect(codeOf(() => before.open(SESSION, rewritten))).toBe("key_unknown");
  });

  it("marks tokens that are in the clear or under an older key as stale", () => {
    const before = createSessionTokenCipher(KEY_A);
    const after = createSessionTokenCipher(`${KEY_B},${KEY_A}`);
    const old = before.seal(SESSION, TOKEN);

    expect(before.isStale(old)).toBe(false);
    expect(after.isStale(old)).toBe(true);
    expect(after.isStale(TOKEN)).toBe(true);
    expect(after.isStale(after.seal(SESSION, TOKEN))).toBe(false);
  });

  it.each([
    ["too short", randomBytes(16).toString("base64")],
    ["too long", randomBytes(48).toString("base64")],
    ["not base64", "not a key at all, just thirty-two chars!!"],
    ["hex", randomBytes(32).toString("hex")],
  ])("refuses a key that is %s", (_case, key) => {
    expect(codeOf(() => createSessionTokenCipher(key))).toBe("key_invalid");
  });

  it("refuses an empty key list", () => {
    expect(codeOf(() => createSessionTokenCipher(" , "))).toBe("key_missing");
  });
});

describe("loading the cipher from the environment", () => {
  it("is required in production", () => {
    expect(codeOf(() => loadSessionTokenCipher({ NODE_ENV: "production" }))).toBe(
      "key_missing",
    );
    expect(
      codeOf(() =>
        loadSessionTokenCipher({
          NODE_ENV: "production",
          SESSION_TOKEN_ENCRYPTION_KEY: "  ",
        }),
      ),
    ).toBe("key_missing");
  });

  it("is optional elsewhere", () => {
    expect(loadSessionTokenCipher({ NODE_ENV: "development" })).toBeNull();
    expect(loadSessionTokenCipher({})).toBeNull();
  });

  it("uses the key when one is set, in any environment", () => {
    for (const NODE_ENV of ["production", "development"]) {
      const cipher = loadSessionTokenCipher({
        NODE_ENV,
        SESSION_TOKEN_ENCRYPTION_KEY: KEY_A,
      });
      expect(cipher?.open(SESSION, cipher.seal(SESSION, TOKEN))).toBe(TOKEN);
    }
  });

  it("does not start with a malformed key rather than fall back to none", () => {
    expect(
      codeOf(() =>
        loadSessionTokenCipher({
          NODE_ENV: "development",
          SESSION_TOKEN_ENCRYPTION_KEY: "short",
        }),
      ),
    ).toBe("key_invalid");
  });
});
