/**
 * Phase 1 shop-domain normalization — version `phase1-shop-domain-v1`.
 *
 * Conservative rules only. Invalid values must be quarantined; never repaired
 * by stripping schemes, ports, paths, or custom-domain components.
 *
 * Correction (F-PR1-08 / F-PR1-09): reject non-ASCII before lowercasing;
 * enforce DNS label ≤ 63 and hostname ≤ 253.
 *
 * Correction (F-PR2R3-03): one shared specification drives JavaScript
 * normalization and PostgreSQL candidate-discovery trim semantics.
 */

export const SHOP_DOMAIN_NORMALIZATION_VERSION = "phase1-shop-domain-v1" as const;

/**
 * Exact ECMAScript `String.prototype.trim` whitespace code points
 * (Unicode 15 / ES2024 as implemented by Node). Source of truth for both
 * JavaScript `trim()` and PostgreSQL `btrim(..., characters)`.
 *
 * Do not maintain a second independent character list.
 */
export const ECMA_SCRIPT_TRIM_CODE_POINTS = [
  0x0009, // CHARACTER TABULATION
  0x000a, // LINE FEED
  0x000b, // LINE TABULATION
  0x000c, // FORM FEED
  0x000d, // CARRIAGE RETURN
  0x0020, // SPACE
  0x00a0, // NO-BREAK SPACE
  0x1680, // OGHAM SPACE MARK
  0x2000, // EN QUAD
  0x2001, // EM QUAD
  0x2002, // EN SPACE
  0x2003, // EM SPACE
  0x2004, // THREE-PER-EM SPACE
  0x2005, // FOUR-PER-EM SPACE
  0x2006, // SIX-PER-EM SPACE
  0x2007, // FIGURE SPACE
  0x2008, // PUNCTUATION SPACE
  0x2009, // THIN SPACE
  0x200a, // HAIR SPACE
  0x2028, // LINE SEPARATOR
  0x2029, // PARAGRAPH SEPARATOR
  0x202f, // NARROW NO-BREAK SPACE
  0x205f, // MEDIUM MATHEMATICAL SPACE
  0x3000, // IDEOGRAPHIC SPACE
  0xfeff, // ZERO WIDTH NO-BREAK SPACE / BOM
] as const;

const STORE_LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const MAX_STORE_LABEL_LENGTH = 63;
const MAX_HOSTNAME_LENGTH = 253;
const MYSHOPIFY_SUFFIX = ".myshopify.com";

/**
 * Shared normalization specification (F-PR2R3-03).
 * JavaScript `normalizeShopDomain` and PostgreSQL candidate discovery must
 * implement the same trim set, case rule, suffix, length, ASCII, and
 * URL/path rejection order. SQL discovery is never final authority —
 * every returned raw value must still pass `normalizeShopDomain`.
 */
export const PHASE1_SHOP_DOMAIN_SPEC = {
  algorithmVersion: SHOP_DOMAIN_NORMALIZATION_VERSION,
  acceptedDomainSuffix: MYSHOPIFY_SUFFIX,
  caseNormalization: "lowercase" as const,
  trimCodePoints: ECMA_SCRIPT_TRIM_CODE_POINTS,
  maxStoreLabelLength: MAX_STORE_LABEL_LENGTH,
  maxHostnameLength: MAX_HOSTNAME_LENGTH,
  asciiOnly: true as const,
  urlPathRejection: [
    "scheme_present",
    "path_query_fragment_or_credentials",
    "port_or_colon",
    "control_characters",
  ] as const,
  validationOrder: [
    "blank_or_null",
    "non_string",
    "trim",
    "blank",
    "non_ascii",
    "scheme_present",
    "path_query_fragment_or_credentials",
    "port_or_colon",
    "control_characters",
    "hostname_too_long",
    "lowercase",
    "not_myshopify_com",
    "empty_store_label",
    "store_label_too_long",
    "extra_hostname_labels",
    "label_hyphen_boundary",
    "malformed_store_label",
  ] as const,
} as const;

/** Characters string for PostgreSQL `btrim(text, characters)`. */
export function shopDomainTrimCharacters(): string {
  return String.fromCodePoint(...ECMA_SCRIPT_TRIM_CODE_POINTS);
}

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
 * Uses ECMAScript `String.prototype.trim` (same code points as
 * `ECMA_SCRIPT_TRIM_CODE_POINTS` / PostgreSQL candidate discovery).
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

/**
 * Shared corpus entries for JS ↔ PostgreSQL equivalence tests (F-PR2R3-03).
 * Each entry is evaluated against an authenticated canonical domain.
 */
export type ShopDomainCorpusEntry = {
  id: string;
  /** Raw input; may include leading/trailing ECMAScript whitespace. */
  buildRaw: (canonicalDomain: string, foreignDomain: string) => string;
  /** Whether JS normalize accepts and equals the authenticated domain. */
  jsAcceptsAsCanonical: boolean;
  /** Whether SQL candidate discovery should surface this raw value. */
  sqlDiscoversAsCandidate: boolean;
};

export const SHOP_DOMAIN_NORMALIZATION_CORPUS: readonly ShopDomainCorpusEntry[] =
  [
    {
      id: "space",
      buildRaw: (d) => ` ${d}`,
      jsAcceptsAsCanonical: true,
      sqlDiscoversAsCandidate: true,
    },
    {
      id: "tab",
      buildRaw: (d) => `\t${d}`,
      jsAcceptsAsCanonical: true,
      sqlDiscoversAsCandidate: true,
    },
    {
      id: "line_feed",
      buildRaw: (d) => `\n${d}`,
      jsAcceptsAsCanonical: true,
      sqlDiscoversAsCandidate: true,
    },
    {
      id: "carriage_return",
      buildRaw: (d) => `\r${d}`,
      jsAcceptsAsCanonical: true,
      sqlDiscoversAsCandidate: true,
    },
    {
      id: "vertical_tab",
      buildRaw: (d) => `\v${d}`,
      jsAcceptsAsCanonical: true,
      sqlDiscoversAsCandidate: true,
    },
    {
      id: "form_feed",
      buildRaw: (d) => `\f${d}`,
      jsAcceptsAsCanonical: true,
      sqlDiscoversAsCandidate: true,
    },
    {
      id: "nbsp",
      buildRaw: (d) => `\u00A0${d}`,
      jsAcceptsAsCanonical: true,
      sqlDiscoversAsCandidate: true,
    },
    {
      id: "bom",
      buildRaw: (d) => `\uFEFF${d}`,
      jsAcceptsAsCanonical: true,
      sqlDiscoversAsCandidate: true,
    },
    {
      id: "mixed_leading_trailing",
      buildRaw: (d) => ` \t\n${d}\r\f `,
      jsAcceptsAsCanonical: true,
      sqlDiscoversAsCandidate: true,
    },
    {
      id: "uppercase_domain",
      buildRaw: (d) => d.toUpperCase(),
      jsAcceptsAsCanonical: true,
      sqlDiscoversAsCandidate: true,
    },
    {
      id: "canonical_domain",
      buildRaw: (d) => d,
      jsAcceptsAsCanonical: true,
      sqlDiscoversAsCandidate: true,
    },
    {
      id: "url_shaped",
      buildRaw: (d) => `https://${d}`,
      jsAcceptsAsCanonical: false,
      sqlDiscoversAsCandidate: false,
    },
    {
      id: "path_shaped",
      buildRaw: (d) => `${d}/admin`,
      jsAcceptsAsCanonical: false,
      sqlDiscoversAsCandidate: false,
    },
    {
      id: "foreign_domain",
      buildRaw: (_d, foreign) => foreign,
      jsAcceptsAsCanonical: false,
      sqlDiscoversAsCandidate: false,
    },
    {
      id: "non_ascii_confusable",
      buildRaw: (d) => `е${d}`, // Cyrillic ye prefix → non_ascii after trim
      jsAcceptsAsCanonical: false,
      sqlDiscoversAsCandidate: false,
    },
    {
      id: "overlong_label",
      buildRaw: () => `${"a".repeat(64)}.myshopify.com`,
      jsAcceptsAsCanonical: false,
      sqlDiscoversAsCandidate: false,
    },
    {
      id: "overlong_hostname",
      buildRaw: () => `${"a".repeat(240)}.myshopify.com`,
      jsAcceptsAsCanonical: false,
      sqlDiscoversAsCandidate: false,
    },
    {
      id: "embedded_whitespace",
      buildRaw: (d) => d.replace(".myshopify.", ". my shopify ."),
      jsAcceptsAsCanonical: false,
      sqlDiscoversAsCandidate: false,
    },
    {
      id: "internal_newline",
      buildRaw: (d) => {
        const i = d.indexOf(".");
        return `${d.slice(0, i)}\n${d.slice(i)}`;
      },
      jsAcceptsAsCanonical: false,
      sqlDiscoversAsCandidate: false,
    },
    {
      id: "empty_string",
      buildRaw: () => "",
      jsAcceptsAsCanonical: false,
      sqlDiscoversAsCandidate: false,
    },
    {
      id: "whitespace_only",
      buildRaw: () => " \t\n\r",
      jsAcceptsAsCanonical: false,
      sqlDiscoversAsCandidate: false,
    },
  ];
