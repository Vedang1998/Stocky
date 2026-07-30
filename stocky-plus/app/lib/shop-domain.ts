/**
 * Phase 1 shop-domain normalization — version `phase1-shop-domain-v1`.
 *
 * Conservative rules only. Invalid values must be quarantined; never repaired
 * by stripping schemes, ports, paths, or custom-domain components.
 */

export const SHOP_DOMAIN_NORMALIZATION_VERSION = "phase1-shop-domain-v1" as const;

const STORE_LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export type ShopDomainNormalizationResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

/**
 * Normalize a legacy Shopify shop-domain string under phase1-shop-domain-v1.
 *
 * Rules:
 * 1. trim leading/trailing whitespace
 * 2. lowercase ASCII letters
 * 3. require a plain hostname
 * 4. require exactly one store label + `.myshopify.com`
 * 5. store label: lowercase letters, numbers, internal hyphens
 * 6. reject label beginning or ending with hyphen
 * 7. reject schemes (http/https)
 * 8. reject ports, paths, query, fragment, credentials, custom domains, blanks
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

  // Reject ports (hostname:port).
  if (/:\d+$/.test(trimmed) || trimmed.includes(":")) {
    return { ok: false, reason: "port_or_colon" };
  }

  const lower = trimmed.toLowerCase();

  if (!lower.endsWith(".myshopify.com")) {
    return { ok: false, reason: "not_myshopify_com" };
  }

  const label = lower.slice(0, -".myshopify.com".length);
  if (label.length === 0) {
    return { ok: false, reason: "empty_store_label" };
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

  return { ok: true, normalized: `${label}.myshopify.com` };
}
