/**
 * Shopify Admin API version adapters for sync intake (F-PR4-18).
 *
 * Supported adapters: 2025-10, 2026-07.
 * Authenticated unsupported versions are durably quarantined (no processing job).
 * Q-003 remains open until independent live-schema validation against 2026-07.
 *
 * HTTP acknowledgement policy:
 * - Target / adapter versions that create a durable delivery → HTTP 200 after commit
 *   (Shopify will not redeliver). Processing may still be deferred/quarantined.
 * - Missing Shop / auth failures remain non-2xx so Shopify retries.
 */
import { SyncControlPlaneError } from "./errors";

/** Target Admin API version for PR 4 (ApiVersion.July26). */
export const TARGET_API_VERSION = "2026-07" as const;

/** Explicitly supported adapters during the migration window. */
export const SUPPORTED_API_VERSION_ADAPTERS = ["2025-10", "2026-07"] as const;

export type SupportedApiVersion =
  (typeof SUPPORTED_API_VERSION_ADAPTERS)[number];

export type ApiVersionValidation =
  | { ok: true; apiVersion: SupportedApiVersion; processingAllowed: boolean }
  | {
      ok: false;
      received: string | null;
      reason: "missing" | "unsupported";
      quarantine: true;
    };

export function isSupportedApiVersion(
  version: string,
): version is SupportedApiVersion {
  return (SUPPORTED_API_VERSION_ADAPTERS as readonly string[]).includes(version);
}

/**
 * Validate X-Shopify-API-Version.
 * Supported adapters return ok; unsupported authenticated versions must be
 * quarantined by the caller (do not throw before durable record).
 */
export function validateReceivedApiVersion(
  received: string | null | undefined,
): ApiVersionValidation {
  if (received == null || received.trim() === "") {
    return {
      ok: false,
      received: received ?? null,
      reason: "missing",
      quarantine: true,
    };
  }
  const trimmed = received.trim();
  if (!isSupportedApiVersion(trimmed)) {
    return {
      ok: false,
      received: trimmed,
      reason: "unsupported",
      quarantine: true,
    };
  }
  return {
    ok: true,
    apiVersion: trimmed,
    processingAllowed: true,
  };
}

/**
 * @deprecated Prefer validateReceivedApiVersion + quarantine path.
 * Throws only for callers that still require a hard fail (e.g. uninstall
 * when no durable quarantine path is desired for missing headers).
 */
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
        : `Unsupported Shopify API version: ${result.received}; expected one of ${SUPPORTED_API_VERSION_ADAPTERS.join(", ")}`,
    );
  }
  if (result.apiVersion !== TARGET_API_VERSION) {
    // Adapter versions are accepted for intake; callers using this helper
    // for strict target-only paths still get the pin.
    return TARGET_API_VERSION;
  }
  return TARGET_API_VERSION;
}

/** Resolve the version string to persist on WebhookDelivery. */
export function resolveApiVersionForPersistence(
  received: string | null | undefined,
): string {
  if (received == null || received.trim() === "") {
    return "missing";
  }
  return received.trim();
}
