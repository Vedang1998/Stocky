import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Encrypts Shopify access and refresh tokens before they are stored (R-191).
 *
 * Stored form: `enc:v1:<key id>:<iv>:<ciphertext>:<tag>`, parts in base64url,
 * AES-256-GCM. The session id is bound in as associated data, so a token
 * copied onto another session's row does not decrypt.
 *
 * SESSION_TOKEN_ENCRYPTION_KEY holds 32 random bytes in base64. To rotate,
 * put the new key first and the old one after a comma, run
 * `npm run session-tokens:reencrypt`, then remove the old key. A value without
 * the `enc:v1:` prefix is a token stored before encryption was switched on
 * and is returned as it is; the same command encrypts those.
 */

const PREFIX = "enc:v1:";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type SessionTokenErrorCode =
  | "key_missing"
  | "key_invalid"
  | "key_unknown"
  | "token_corrupt";

export class SessionTokenError extends Error {
  constructor(
    readonly code: SessionTokenErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SessionTokenError";
  }
}

export type SessionTokenCipher = {
  seal(sessionId: string, token: string): string;
  open(sessionId: string, stored: string): string;
  /** True for a token stored in the clear or under a key that is not the first. */
  isStale(stored: string): boolean;
};

type Key = { id: string; material: Buffer };

function parseKey(encoded: string, position: number): Key {
  const material = Buffer.from(encoded, "base64");
  if (
    material.length !== KEY_BYTES ||
    material.toString("base64").replace(/=+$/, "") !==
      encoded.replace(/=+$/, "")
  ) {
    throw new SessionTokenError(
      "key_invalid",
      `SESSION_TOKEN_ENCRYPTION_KEY entry ${position + 1} must be ${KEY_BYTES} bytes in base64`,
    );
  }
  const id = createHash("sha256")
    .update(material)
    .digest("base64url")
    .slice(0, 8);
  return { id, material };
}

export function isSealedSessionToken(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

export function createSessionTokenCipher(keyList: string): SessionTokenCipher {
  const keys = keyList
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map(parseKey);
  if (keys.length === 0) {
    throw new SessionTokenError(
      "key_missing",
      "SESSION_TOKEN_ENCRYPTION_KEY is empty",
    );
  }
  const [current] = keys;

  return {
    seal(sessionId, token) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", current.material, iv);
      cipher.setAAD(Buffer.from(sessionId, "utf8"));
      const ciphertext = Buffer.concat([
        cipher.update(token, "utf8"),
        cipher.final(),
      ]);
      return (
        PREFIX +
        [current.id, iv, ciphertext, cipher.getAuthTag()]
          .map((part) =>
            typeof part === "string" ? part : part.toString("base64url"),
          )
          .join(":")
      );
    },

    isStale(stored) {
      return !stored.startsWith(`${PREFIX}${current.id}:`);
    },

    open(sessionId, stored) {
      if (!isSealedSessionToken(stored)) return stored;

      const parts = stored.slice(PREFIX.length).split(":");
      if (parts.length !== 4) {
        throw new SessionTokenError(
          "token_corrupt",
          "Stored session token is malformed",
        );
      }
      const [keyId, iv, ciphertext, tag] = parts;
      const key = keys.find((candidate) => candidate.id === keyId);
      if (!key) {
        throw new SessionTokenError(
          "key_unknown",
          `Stored session token was written with key ${keyId}, which is not in SESSION_TOKEN_ENCRYPTION_KEY`,
        );
      }
      const ivBytes = Buffer.from(iv, "base64url");
      const tagBytes = Buffer.from(tag, "base64url");
      if (ivBytes.length !== IV_BYTES || tagBytes.length !== TAG_BYTES) {
        throw new SessionTokenError(
          "token_corrupt",
          "Stored session token is malformed",
        );
      }
      try {
        const decipher = createDecipheriv("aes-256-gcm", key.material, ivBytes);
        decipher.setAAD(Buffer.from(sessionId, "utf8"));
        decipher.setAuthTag(tagBytes);
        return Buffer.concat([
          decipher.update(Buffer.from(ciphertext, "base64url")),
          decipher.final(),
        ]).toString("utf8");
      } catch {
        throw new SessionTokenError(
          "token_corrupt",
          "Stored session token failed authentication",
        );
      }
    },
  };
}

/**
 * The cipher for this process, or null when no key is set outside
 * production, where tokens are then stored as Shopify issued them. In
 * production a missing key is an error: tokens are never written in the
 * clear there.
 */
export function loadSessionTokenCipher(
  env: NodeJS.ProcessEnv = process.env,
): SessionTokenCipher | null {
  const keyList = env.SESSION_TOKEN_ENCRYPTION_KEY;
  if (typeof keyList === "string" && keyList.trim().length > 0) {
    return createSessionTokenCipher(keyList);
  }
  if (env.NODE_ENV === "production") {
    throw new SessionTokenError(
      "key_missing",
      "SESSION_TOKEN_ENCRYPTION_KEY is required in production",
    );
  }
  return null;
}
