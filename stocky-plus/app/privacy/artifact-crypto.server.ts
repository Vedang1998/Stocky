/**
 * AES-256-GCM for owner-only data-request artifacts. The BYTEA column stays
 * ciphertext. Fail closed when the managed key is missing or the wrong size.
 * Fixture keys are synthetic; this is not a production key-management system.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { PrivacyBoundaryError } from "./errors.server";

const VERSION = 1;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const HEX_KEY = /^[0-9a-fA-F]{64}$/;

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
    return Buffer.from(raw, "hex");
  }
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== KEY_LENGTH) {
    throw new PrivacyBoundaryError(
      "artifact_key_invalid",
      "Data-request artifact key must be 32 bytes",
    );
  }
  return decoded;
}

export function encryptPrivacyArtifact(plaintext: string): Buffer {
  const key = parsePrivacyArtifactKey();
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), nonce, tag, ciphertext]);
}

export function decryptPrivacyArtifact(stored: Buffer): Buffer {
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
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new PrivacyBoundaryError(
      "artifact_corrupt",
      "Stored artifact failed authentication",
    );
  }
}
