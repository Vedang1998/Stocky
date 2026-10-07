/**
 * AES-256-GCM for owner-only data-request artifacts. The BYTEA column stays
 * ciphertext. Fail closed when the managed key is missing, all-zero, or the
 * wrong size. Fixture keys are synthetic; this is not a production
 * key-management system. AAD binds shop + domain + request so ciphertext
 * cannot be replayed across tenants.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { PrivacyBoundaryError } from "./errors.server";

const VERSION = 2;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const HEX_KEY = /^[0-9a-fA-F]{64}$/;

export type PrivacyArtifactAad = {
  shopId: string;
  canonicalDomain: string;
  requestId: string;
};

function aadBytes(binding: PrivacyArtifactAad): Buffer {
  if (!binding.shopId || !binding.canonicalDomain || !binding.requestId) {
    throw new PrivacyBoundaryError(
      "artifact_aad_missing",
      "Artifact AEAD binding is required",
    );
  }
  return Buffer.from(
    `${binding.shopId}\0${binding.canonicalDomain}\0${binding.requestId}`,
    "utf8",
  );
}

function assertNonZeroKey(key: Buffer): void {
  if (key.length !== KEY_LENGTH || key.equals(Buffer.alloc(KEY_LENGTH, 0))) {
    throw new PrivacyBoundaryError(
      "artifact_key_invalid",
      "Data-request artifact key must be 32 non-zero bytes",
    );
  }
}

export function parsePrivacyArtifactKey(
  env: NodeJS.ProcessEnv = process.env,
): Buffer {
  const raw = env.STOCKY_PRIVACY_ARTIFACT_KEY?.trim() ?? "";
  if (!raw) {
    throw new PrivacyBoundaryError(
      "artifact_key_missing",
      "Data-request artifact key is not configured",
    );
  }
  if (HEX_KEY.test(raw)) {
    const key = Buffer.from(raw, "hex");
    assertNonZeroKey(key);
    return key;
  }
  const decoded = Buffer.from(raw, "base64");
  assertNonZeroKey(decoded);
  return decoded;
}

export function encryptPrivacyArtifact(
  plaintext: string,
  binding: PrivacyArtifactAad,
): Buffer {
  const key = parsePrivacyArtifactKey();
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aadBytes(binding));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), nonce, tag, ciphertext]);
}

export function decryptPrivacyArtifact(
  stored: Buffer,
  binding: PrivacyArtifactAad,
): Buffer {
  const key = parsePrivacyArtifactKey();
  if (stored.length < 1 + NONCE_LENGTH + TAG_LENGTH + 1) {
    throw new PrivacyBoundaryError(
      "artifact_corrupt",
      "Stored artifact is not a valid AEAD blob",
    );
  }
  const version = stored[0];
  if (version !== VERSION) {
    throw new PrivacyBoundaryError(
      "artifact_corrupt",
      "Stored artifact version is unsupported",
    );
  }
  const nonce = stored.subarray(1, 1 + NONCE_LENGTH);
  const tag = stored.subarray(1 + NONCE_LENGTH, 1 + NONCE_LENGTH + TAG_LENGTH);
  const ciphertext = stored.subarray(1 + NONCE_LENGTH + TAG_LENGTH);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(aadBytes(binding));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new PrivacyBoundaryError(
      "artifact_corrupt",
      "Stored artifact failed authentication",
    );
  }
}
