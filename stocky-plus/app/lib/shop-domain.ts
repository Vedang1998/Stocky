/**
 * Phase 1 shop-domain normalization — version `phase1-shop-domain-v1`.
 *
 * Conservative rules only. Invalid values must be quarantined; never repaired
 * by stripping schemes, ports, paths, or custom-domain components.
 *
 * Correction (F-PR1-08 / F-PR1-09): reject non-ASCII before lowercasing;
 * enforce DNS label ≤ 63 and hostname ≤ 253.
 */

export const SHOP_DOMAIN_NORMALIZATION_VERSION = "phase1-shop-domain-v1" as const;

const STORE_LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const MAX_STORE_LABEL_LENGTH = 63;
const MAX_HOSTNAME_LENGTH = 253;
const MYSHOPIFY_SUFFIX = ".myshopify.com";

export type ShopDomainNormalizationResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

function hasNonAscii(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 0x7f) return true;
  }
  return false;
}

/**
 * Normalize a legacy Shopify shop-domain string under phase1-shop-domain-v1.
 */
export function normalizeShopDomain(
  raw: string | null | undefined,
): ShopDomainNormalizationResult {
  if (raw === null || raw === undefined) {
    return { ok: false, reason: "blank_or_null" };
  }

  if (typeof raw !== "string") {
    return { ok: false, reason: "non_string" };
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "blank" };
  }

  // Reject non-ASCII on the raw trimmed input BEFORE lowercasing.
  if (hasNonAscii(trimmed)) {
    return { ok: false, reason: "non_ascii" };
  }

  // Reject schemes explicitly — do not strip them.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    return { ok: false, reason: "scheme_present" };
  }

  // Reject credentials, paths, query, fragment before lowercasing host checks.
  if (
    trimmed.includes("@") ||
    trimmed.includes("/") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    trimmed.includes("\\")
  ) {
    return { ok: false, reason: "path_query_fragment_or_credentials" };
  }

  // Reject ports (hostname:port) and other colons.
  if (/:\d+$/.test(trimmed) || trimmed.includes(":")) {
    return { ok: false, reason: "port_or_colon" };
  }

  // Reject embedded ASCII control characters without a control-character regex.
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return { ok: false, reason: "control_characters" };
    }
  }

  if (trimmed.length > MAX_HOSTNAME_LENGTH) {
    return { ok: false, reason: "hostname_too_long" };
  }

  const lower = trimmed.toLowerCase();

  if (!lower.endsWith(MYSHOPIFY_SUFFIX)) {
    return { ok: false, reason: "not_myshopify_com" };
  }

  const label = lower.slice(0, -MYSHOPIFY_SUFFIX.length);
  if (label.length === 0) {
    return { ok: false, reason: "empty_store_label" };
  }

  if (label.length > MAX_STORE_LABEL_LENGTH) {
    return { ok: false, reason: "store_label_too_long" };
  }

  // Exactly one label — no extra dots (subdomains / nested hosts).
  if (label.includes(".")) {
    return { ok: false, reason: "extra_hostname_labels" };
  }

  if (label.startsWith("-") || label.endsWith("-")) {
    return { ok: false, reason: "label_hyphen_boundary" };
  }

  if (!STORE_LABEL.test(label)) {
    return { ok: false, reason: "malformed_store_label" };
  }

  const normalized = `${label}${MYSHOPIFY_SUFFIX}`;
  if (normalized.length > MAX_HOSTNAME_LENGTH) {
    return { ok: false, reason: "hostname_too_long" };
  }

  return { ok: true, normalized };
}
