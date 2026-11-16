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

    const stored = cipher.seal(SESSION, "accessToken", TOKEN);

    expect(isSealedSessionToken(stored)).toBe(true);
    expect(stored).not.toContain(TOKEN);
    expect(stored).not.toContain(Buffer.from(TOKEN).toString("base64url"));
    expect(cipher.open(SESSION, "accessToken", stored)).toBe(TOKEN);
  });

  it("produces a different stored value each time", () => {
    const cipher = createSessionTokenCipher(KEY_A);

    expect(cipher.seal(SESSION, "accessToken", TOKEN)).not.toBe(cipher.seal(SESSION, "accessToken", TOKEN));
  });

  it("does not open a token moved to another session", () => {
    const cipher = createSessionTokenCipher(KEY_A);
    const stored = cipher.seal(SESSION, "accessToken", TOKEN);

    expect(
      codeOf(() => cipher.open("offline_other-shop.myshopify.com", "accessToken", stored)),
    ).toBe("token_corrupt");
  });

  it.each([
    ["a changed ciphertext", 2],
    ["a changed tag", 3],
    ["a changed iv", 1],
  ])("rejects %s", (_case, part) => {
    const cipher = createSessionTokenCipher(KEY_A);
    const parts = cipher.seal(SESSION, "accessToken", TOKEN).split(":");
    const index = 2 + part;
    const bytes = Buffer.from(parts[index], "base64url");
    bytes[0] ^= 0x01;
    parts[index] = bytes.toString("base64url");

    expect(codeOf(() => cipher.open(SESSION, "accessToken", parts.join(":")))).toBe(
      "token_corrupt",
    );
  });

  it("rejects a stored value with missing parts", () => {
    const cipher = createSessionTokenCipher(KEY_A);

    expect(codeOf(() => cipher.open(SESSION, "accessToken", "enc:v1:abc:def"))).toBe(
      "token_corrupt",
    );
  });

  it("does not open an access token as the refresh token or the reverse", () => {
    const cipher = createSessionTokenCipher(KEY_A);
    const access = cipher.seal(SESSION, "accessToken", TOKEN);
    const refresh = cipher.seal(SESSION, "refreshToken", TOKEN);

    expect(codeOf(() => cipher.open(SESSION, "refreshToken", access))).toBe(
      "token_corrupt",
    );
    expect(codeOf(() => cipher.open(SESSION, "accessToken", refresh))).toBe(
      "token_corrupt",
    );
    expect(cipher.open(SESSION, "refreshToken", refresh)).toBe(TOKEN);
  });

  it("passes through a token stored before encryption only when told to", () => {
    const lenient = createSessionTokenCipher(KEY_A, { acceptPlaintext: true });
    expect(lenient.open(SESSION, "accessToken", TOKEN)).toBe(TOKEN);

    const strict = createSessionTokenCipher(KEY_A);
    expect(codeOf(() => strict.open(SESSION, "accessToken", TOKEN))).toBe(
      "token_corrupt",
    );
  });

  it("writes with the first key and still reads tokens written with an older one", () => {
    const before = createSessionTokenCipher(KEY_A);
    const after = createSessionTokenCipher(`${KEY_B}, ${KEY_A}`);
    const old = before.seal(SESSION, "accessToken", TOKEN);

    expect(after.open(SESSION, "accessToken", old)).toBe(TOKEN);
    const rewritten = after.seal(SESSION, "accessToken", TOKEN);
    expect(createSessionTokenCipher(KEY_B).open(SESSION, "accessToken", rewritten)).toBe(
      TOKEN,
    );
    expect(codeOf(() => before.open(SESSION, "accessToken", rewritten))).toBe("key_unknown");
  });

  it("marks tokens that are in the clear or under an older key as stale", () => {
    const before = createSessionTokenCipher(KEY_A);
    const after = createSessionTokenCipher(`${KEY_B},${KEY_A}`);
    const old = before.seal(SESSION, "accessToken", TOKEN);

    expect(before.isStale(old)).toBe(false);
    expect(after.isStale(old)).toBe(true);
    expect(after.isStale(TOKEN)).toBe(true);
    expect(after.isStale(after.seal(SESSION, "accessToken", TOKEN))).toBe(false);
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
      expect(
        cipher?.open(SESSION, "accessToken", cipher.seal(SESSION, "accessToken", TOKEN)),
      ).toBe(TOKEN);
    }
  });

  it("accepts tokens stored in the clear outside production only", () => {
    const development = loadSessionTokenCipher({
      NODE_ENV: "development",
      SESSION_TOKEN_ENCRYPTION_KEY: KEY_A,
    });
    expect(development?.open(SESSION, "accessToken", TOKEN)).toBe(TOKEN);

    const production = loadSessionTokenCipher({
      NODE_ENV: "production",
      SESSION_TOKEN_ENCRYPTION_KEY: KEY_A,
    });
    expect(codeOf(() => production?.open(SESSION, "accessToken", TOKEN))).toBe(
      "token_corrupt",
    );
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
