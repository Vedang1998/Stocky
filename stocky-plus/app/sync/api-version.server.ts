/**
 * Shopify Admin API version pin for sync control-plane intake.
 */
import { SyncControlPlaneError } from "./errors";

/** Target Admin API version for PR 4 (ApiVersion.July26). */
export const TARGET_API_VERSION = "2026-07" as const;

export type ApiVersionValidation =
  | { ok: true; apiVersion: typeof TARGET_API_VERSION }
  | { ok: false; received: string | null; reason: "missing" | "unsupported" };

/**
 * Validate X-Shopify-API-Version (or equivalent). Accept only the target pin.
 */
export function validateReceivedApiVersion(
  received: string | null | undefined,
): ApiVersionValidation {
  if (received == null || received.trim() === "") {
    return { ok: false, received: received ?? null, reason: "missing" };
  }
  const trimmed = received.trim();
  if (trimmed !== TARGET_API_VERSION) {
    return { ok: false, received: trimmed, reason: "unsupported" };
  }
  return { ok: true, apiVersion: TARGET_API_VERSION };
}

/** Fail closed when the received header is not the target version. */
export function requireTargetApiVersion(
  received: string | null | undefined,
): typeof TARGET_API_VERSION {
  const result = validateReceivedApiVersion(received);
  if (!result.ok) {
    throw new SyncControlPlaneError(
      result.reason === "missing"
        ? "api_version_missing"
        : "api_version_unsupported",
      result.reason === "missing"
        ? "X-Shopify-API-Version header is required"
        : `Unsupported Shopify API version: ${result.received}; expected ${TARGET_API_VERSION}`,
    );
  }
  return result.apiVersion;
}
