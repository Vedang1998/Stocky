/**
 * Barcode normalization and GTIN equivalence for scan workflows.
 *
 * The same retail item can be stored in Shopify as UPC-A (12 digits), EAN-13
 * with a leading zero, GTIN-14 with two leading zeros, or the compressed
 * UPC-E form, while a scanner may transmit any of those. Lookups therefore
 * compare a small, deterministic set of equivalent spellings instead of one
 * string. Codes that are not valid GTINs (Code 128 / Code 39 SKUs, internal
 * labels) only ever match exactly.
 */

export const MAX_SCANNED_CODE_LENGTH = 128;

export type ScanNormalizationFailure = "empty" | "too_long";

export type NormalizedScan =
  | { ok: true; code: string }
  | { ok: false; reason: ScanNormalizationFailure };

/** AIM symbology identifier some scanners prepend, e.g. "]E0" or "]C1". */
const AIM_SYMBOLOGY_PREFIX = /^\][A-Za-z][0-9A-Za-z]/;

/** AIM identifiers whose payload is a GS1 element string. */
const GS1_SYMBOLOGY_PREFIXES = new Set(["]C1", "]e0", "]d2", "]Q3", "]J1"]);

const GS1_GTIN_ELEMENT = /^01(\d{14})/;

// eslint-disable-next-line no-control-regex -- scanner suffixes and GS1 separators are control characters
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

const DIGITS_ONLY = /^\d+$/;

/**
 * Turn raw scanner or keyboard input into the code to look up.
 *
 * Strips AIM symbology identifiers, terminators (CR/LF/TAB) and other
 * control characters, and surrounding whitespace. A GS1 element string that
 * starts with Application Identifier (01) is reduced to its GTIN, because
 * that is the only part a product catalog can match.
 */
export function normalizeScannedCode(raw: string): NormalizedScan {
  let value = raw;

  const prefix = AIM_SYMBOLOGY_PREFIX.exec(value)?.[0];
  if (prefix) {
    value = value.slice(prefix.length);
    if (GS1_SYMBOLOGY_PREFIXES.has(prefix)) {
      const gtin = GS1_GTIN_ELEMENT.exec(value)?.[1];
      if (gtin && isValidGtin(gtin)) {
        value = gtin;
      }
    }
  }

  value = value.replace(CONTROL_CHARACTERS, "").trim();

  if (value.length === 0) return { ok: false, reason: "empty" };
  if (value.length > MAX_SCANNED_CODE_LENGTH) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, code: value };
}

/** GS1 mod-10 check digit for the digits that precede it. */
export function gtinCheckDigit(body: string): number {
  if (!DIGITS_ONLY.test(body)) {
    throw new RangeError("GTIN body must contain only digits");
  }
  let sum = 0;
  // Weights alternate 3,1,3,... starting from the digit next to the check digit.
  for (let i = 0; i < body.length; i += 1) {
    const digit = body.charCodeAt(body.length - 1 - i) - 48;
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10;
}

function hasValidCheckDigit(code: string): boolean {
  const expected = gtinCheckDigit(code.slice(0, -1));
  return code.charCodeAt(code.length - 1) - 48 === expected;
}

/** True for a GTIN-8, GTIN-12 (UPC-A), GTIN-13 (EAN-13) or GTIN-14. */
export function isValidGtin(code: string): boolean {
  if (!DIGITS_ONLY.test(code)) return false;
  if (![8, 12, 13, 14].includes(code.length)) return false;
  return hasValidCheckDigit(code);
}

/**
 * Expand an 8-digit UPC-E (number system 0 or 1) to its 12-digit UPC-A.
 * Returns null when the code is not a well-formed UPC-E with a matching
 * check digit.
 */
export function expandUpcE(code: string): string | null {
  if (code.length !== 8 || !DIGITS_ONLY.test(code)) return null;
  const numberSystem = code[0];
  if (numberSystem !== "0" && numberSystem !== "1") return null;

  const [d1, d2, d3, d4, d5, d6] = code.slice(1, 7);
  let manufacturer: string;
  let product: string;
  switch (d6) {
    case "0":
    case "1":
    case "2":
      manufacturer = `${d1}${d2}${d6}00`;
      product = `00${d3}${d4}${d5}`;
      break;
    case "3":
      manufacturer = `${d1}${d2}${d3}00`;
      product = `000${d4}${d5}`;
      break;
    case "4":
      manufacturer = `${d1}${d2}${d3}${d4}0`;
      product = `0000${d5}`;
      break;
    default:
      manufacturer = `${d1}${d2}${d3}${d4}${d5}`;
      product = `0000${d6}`;
  }

  const upcA = `${numberSystem}${manufacturer}${product}${code[7]}`;
  return hasValidCheckDigit(upcA) ? upcA : null;
}

/**
 * Compress a 12-digit UPC-A to UPC-E when the number system and zero
 * pattern allow it; otherwise null. Inverse of {@link expandUpcE}.
 */
export function compressUpcA(code: string): string | null {
  if (code.length !== 12 || !isValidGtin(code)) return null;
  const numberSystem = code[0];
  if (numberSystem !== "0" && numberSystem !== "1") return null;

  const m = code.slice(1, 6);
  const p = code.slice(6, 11);
  const check = code[11];
  let body: string | null = null;

  if (m.endsWith("00") && "012".includes(m[2]) && p.startsWith("00")) {
    body = `${m[0]}${m[1]}${p[2]}${p[3]}${p[4]}${m[2]}`;
  } else if (m.endsWith("00") && p.startsWith("000")) {
    body = `${m[0]}${m[1]}${m[2]}${p[3]}${p[4]}3`;
  } else if (m.endsWith("0") && p.startsWith("0000")) {
    body = `${m[0]}${m[1]}${m[2]}${m[3]}${p[4]}4`;
  } else if (p.startsWith("0000") && Number(p[4]) >= 5) {
    body = `${m}${p[4]}`;
  }

  if (body === null) return null;
  const upcE = `${numberSystem}${body}${check}`;
  // Guard against patterns that compress but do not round-trip.
  return expandUpcE(upcE) === code ? upcE : null;
}

function gtinWidths(core: string): string[] {
  const keys: string[] = [];
  for (const width of [12, 13, 14]) {
    if (core.length <= width) keys.push(core.padStart(width, "0"));
  }
  return keys;
}

/**
 * Every stored spelling that refers to the same item as `code`, exact
 * spelling first. `code` must already be normalized.
 */
export function barcodeLookupKeys(code: string): string[] {
  const keys = new Set<string>([code]);
  if (!DIGITS_ONLY.test(code)) return [...keys];

  // An 8-digit code can be a UPC-E or an EAN-8; both readings are kept and
  // a catalog hit on each surfaces as an ambiguous match. EAN-8 never gains
  // a UPC-E spelling, because an 8-digit string starting with 0 is a
  // different item when read as EAN-8.
  const families: Array<{ gtin: string; upcESpelling: boolean }> = [];
  if (code.length === 8) {
    const expanded = expandUpcE(code);
    if (expanded) families.push({ gtin: expanded, upcESpelling: true });
    if (isValidGtin(code)) families.push({ gtin: code, upcESpelling: false });
  } else if (isValidGtin(code)) {
    families.push({ gtin: code, upcESpelling: true });
  }

  for (const { gtin, upcESpelling } of families) {
    const core = gtin.replace(/^0+/, "");
    if (core.length === 0) continue;
    for (const key of gtinWidths(core)) {
      keys.add(key);
      if (upcESpelling && key.length === 12) {
        const compressed = compressUpcA(key);
        if (compressed) keys.add(compressed);
      }
    }
  }

  return [...keys];
}
