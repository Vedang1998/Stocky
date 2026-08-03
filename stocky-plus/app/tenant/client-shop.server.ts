/**
 * Client shop-hint conflict detection (F-PR2R2-07 / F-PR2R2-08).
 *
 * Direct inspection for query/headers/params/form field names.
 * JSON/multipart bodies use actual body-byte + node/depth budgets sized for
 * ordinary inventory payloads (bulk PO / stocktake / transfer lines).
 *
 * Limits (product rationale):
 * - MAX_BODY_BYTES = 1_048_576 (1 MiB UTF-8 / encoded body bytes): aligned with
 *   typical Shopify app request body ceilings for admin embedded POSTs; larger
 *   bodies fail closed. Measured via ArrayBuffer.byteLength, not JS string length.
 * - MAX_NODES = 20_000: above a 5_000-line stocktake-style payload of small
 *   objects (~3 scalars each) while still bounding pathological graphs.
 * - MAX_DEPTH = 12: nested form/JSON shapes beyond ordinary business depth.
 * - MAX_STRING_LENGTH = 512: shop-hint string bound (unchanged).
 *
 * Content types inspected for body hints:
 * - application/json (and +json): full body byte ceiling, then UTF-8 decode + JSON parse
 * - application/x-www-form-urlencoded: full body byte ceiling before form parse
 * - multipart/form-data: full body byte ceiling (includes file parts) before form parse
 * - other / missing content-types: body is not inspected for hints
 *
 * Key-specific hint semantics (F-PR2R2-08):
 * - Explicit identity keys (shopId, shop_id, myshopifyDomain, …): string and
 *   string-array values may be inspected.
 * - Ambiguous `shop`: a direct scalar is a hint only when it is a plausible
 *   Shopify shop identity under phase1-shop-domain-v1. Objects/arrays under
 *   `shop` are walked only for explicitly named identity keys; ordinary
 *   business strings such as "Downtown" are not treated as tenant domains.
 *   Valid foreign *.myshopify.com strings remain detectable.
 *
 * Matching hints never establish authority — they can only deny.
 */

import type { CanonicalShopIdentity } from "./bootstrap.server";
import { TenantAuthorityError } from "./errors";
import { normalizeShopDomain } from "./shop-domain";

/** Explicit tenant-identity keys (case-insensitive). */
const EXPLICIT_IDENTITY_KEYS = new Set([
  "shopid",
  "shop_id",
  "myshopifydomain",
  "myshopify_domain",
  "shopdomain",
  "shop_domain",
]);

/** Ambiguous business key that may or may not be a shop identity. */
const AMBIGUOUS_SHOP_KEY = "shop";

/** Documented body-byte ceiling for hint inspection (UTF-8 / encoded bytes). */
export const CLIENT_HINT_MAX_BODY_BYTES = 1_048_576;
/** Documented node budget — above largest ordinary accepted payload. */
export const CLIENT_HINT_MAX_NODES = 20_000;
export const CLIENT_HINT_MAX_DEPTH = 12;
export const CLIENT_HINT_MAX_STRING_LENGTH = 512;

const MAX_DEPTH = CLIENT_HINT_MAX_DEPTH;
const MAX_NODES = CLIENT_HINT_MAX_NODES;
const MAX_STRING_LENGTH = CLIENT_HINT_MAX_STRING_LENGTH;
const MAX_BODY_BYTES = CLIENT_HINT_MAX_BODY_BYTES;

export type ClientShopHint = {
  key: string;
  value: string;
  source: "query" | "header" | "json" | "form" | "params";
};

function normalizeHintKey(key: string): string {
  return key.trim().toLowerCase();
}

function isExplicitIdentityKey(key: string): boolean {
  return EXPLICIT_IDENTITY_KEYS.has(normalizeHintKey(key));
}

function isAmbiguousShopKey(key: string): boolean {
  return normalizeHintKey(key) === AMBIGUOUS_SHOP_KEY;
}

function isShopHintKey(key: string): boolean {
  return isExplicitIdentityKey(key) || isAmbiguousShopKey(key);
}

/** True when a string is a plausible Shopify shop identity under the normalizer. */
function isPlausibleShopIdentity(value: string): boolean {
  return normalizeShopDomain(value).ok;
}

function pushHint(
  hints: ClientShopHint[],
  key: string,
  value: unknown,
  source: ClientShopHint["source"],
): void {
  if (typeof value !== "string") return;
  if (value.length === 0) return;
  if (value.length > MAX_STRING_LENGTH) {
    throw new TenantAuthorityError(
      "client_shop_hint_limit",
      `Client shop hint ${key} exceeds maximum inspected string length`,
    );
  }
  hints.push({ key, value, source });
}

/**
 * Push a string under a shop-related key using key-specific rules.
 * Explicit identity keys always push; ambiguous `shop` only when plausible.
 */
function pushShopRelatedString(
  hints: ClientShopHint[],
  key: string,
  value: string,
  source: ClientShopHint["source"],
): void {
  if (isExplicitIdentityKey(key)) {
    pushHint(hints, key, value, source);
    return;
  }
  if (isAmbiguousShopKey(key) && isPlausibleShopIdentity(value)) {
    pushHint(hints, key, value, source);
  }
}

type WalkState = { nodes: number };

function walkJson(
  value: unknown,
  hints: ClientShopHint[],
  depth: number,
  state: WalkState,
  source: "json" | "form",
  parentKey?: string,
  /** When true, parent was an ambiguous `shop` object/array — only identity keys count. */
  underAmbiguousShop = false,
): void {
  state.nodes += 1;
  if (state.nodes > MAX_NODES) {
    throw new TenantAuthorityError(
      "client_shop_hint_limit",
      "Client shop-hint inspection exceeded maximum node count",
    );
  }
  if (depth > MAX_DEPTH) {
    throw new TenantAuthorityError(
      "client_shop_hint_limit",
      "Client shop-hint inspection exceeded maximum nesting depth",
    );
  }

  if (typeof value === "string") {
    if (parentKey) {
      if (underAmbiguousShop) {
        // Only explicit identity keys under ambiguous shop objects/arrays.
        if (isExplicitIdentityKey(parentKey)) {
          pushHint(hints, parentKey, value, source);
        } else if (
          isAmbiguousShopKey(parentKey) &&
          isPlausibleShopIdentity(value)
        ) {
          // Array element under shop: ["Downtown"] ignored; ["x.myshopify.com"] detected.
          pushHint(hints, parentKey, value, source);
        }
      } else if (isShopHintKey(parentKey)) {
        pushShopRelatedString(hints, parentKey, value, source);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      walkJson(
        item,
        hints,
        depth + 1,
        state,
        source,
        parentKey,
        underAmbiguousShop || (parentKey ? isAmbiguousShopKey(parentKey) : false),
      );
    }
    return;
  }

  if (typeof value === "object" && value !== null) {
    const parentIsAmbiguous =
      underAmbiguousShop || (parentKey ? isAmbiguousShopKey(parentKey) : false);

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (parentIsAmbiguous) {
        // Under ambiguous shop object: only recurse into / collect identity keys.
        if (isExplicitIdentityKey(key)) {
          if (typeof child === "string") {
            pushHint(hints, key, child, source);
          } else {
            walkJson(child, hints, depth + 1, state, source, key, false);
          }
        } else if (isAmbiguousShopKey(key)) {
          walkJson(child, hints, depth + 1, state, source, key, true);
        } else {
          // Ordinary business fields under shop (name, address, …) — ignore leaves,
          // but still walk for nested explicit identity keys.
          walkJson(child, hints, depth + 1, state, source, key, true);
        }
        continue;
      }

      if (isExplicitIdentityKey(key)) {
        if (typeof child === "string") {
          pushHint(hints, key, child, source);
        } else if (Array.isArray(child)) {
          for (const item of child) {
            if (typeof item === "string") pushHint(hints, key, item, source);
            else walkJson(item, hints, depth + 1, state, source, key, false);
          }
        } else if (child != null && typeof child === "object") {
          walkJson(child, hints, depth + 1, state, source, key, false);
        }
      } else if (isAmbiguousShopKey(key)) {
        if (typeof child === "string") {
          pushShopRelatedString(hints, key, child, source);
        } else {
          walkJson(child, hints, depth + 1, state, source, key, true);
        }
      } else {
        walkJson(child, hints, depth + 1, state, source, key, false);
      }
    }
  }
}

async function readBodyBytes(request: Request): Promise<ArrayBuffer> {
  return request.clone().arrayBuffer();
}

function decodeUtf8(buffer: ArrayBuffer): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
}

/**
 * Extract untrusted shop hints from query, headers, params, and body.
 * Does not consume the original request body.
 */
export async function extractClientShopHints(
  request: Request,
  params?: Record<string, string | undefined>,
): Promise<ClientShopHint[]> {
  const hints: ClientShopHint[] = [];
  const url = new URL(request.url);

  for (const key of url.searchParams.keys()) {
    if (!isShopHintKey(key)) continue;
    for (const value of url.searchParams.getAll(key)) {
      pushShopRelatedString(hints, key, value, "query");
    }
  }

  const headerMap: Array<[string, string]> = [
    ["shop", "shop"],
    ["x-shop", "shop"],
    ["x-shop-id", "shopId"],
    ["x-shopify-shop-domain", "shop"],
    ["x-myshopify-domain", "myshopifyDomain"],
  ];
  for (const [header, key] of headerMap) {
    const value = request.headers.get(header);
    if (value) pushShopRelatedString(hints, key, value, "header");
  }

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (isShopHintKey(key) && typeof value === "string") {
        pushShopRelatedString(hints, key, value, "params");
      }
    }
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (
    contentType.includes("application/json") ||
    contentType.includes("+json")
  ) {
    const buffer = await readBodyBytes(request);
    if (buffer.byteLength > MAX_BODY_BYTES) {
      throw new TenantAuthorityError(
        "client_shop_hint_limit",
        "Client shop-hint inspection exceeded maximum body byte size",
      );
    }
    if (buffer.byteLength === 0) return hints;
    let raw: string;
    try {
      raw = decodeUtf8(buffer);
    } catch {
      throw new TenantAuthorityError(
        "client_shop_hint_malformed_json",
        "Declared JSON body is not valid UTF-8",
      );
    }
    try {
      const body = JSON.parse(raw) as unknown;
      walkJson(body, hints, 0, { nodes: 0 }, "json");
    } catch (err) {
      if (err instanceof TenantAuthorityError) throw err;
      throw new TenantAuthorityError(
        "client_shop_hint_malformed_json",
        "Declared JSON body could not be parsed",
      );
    }
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    // Measure the complete encoded request body (includes multipart file parts)
    // before parsing. Do not sum fields independently as a substitute.
    const buffer = await readBodyBytes(request);
    if (buffer.byteLength > MAX_BODY_BYTES) {
      throw new TenantAuthorityError(
        "client_shop_hint_limit",
        "Client shop-hint inspection exceeded maximum body byte size",
      );
    }
    try {
      const form = await request.clone().formData();
      for (const [key, value] of form.entries()) {
        // File parts count toward the body byte ceiling (already enforced) but
        // are not inspected as tenant identity.
        if (typeof value !== "string") continue;
        if (isShopHintKey(key)) {
          pushShopRelatedString(hints, key, value, "form");
          continue;
        }
        if (key.includes("[") && key.endsWith("]")) {
          const parts = key.replace(/\]/g, "").split("[");
          for (const part of parts) {
            if (isShopHintKey(part)) {
              pushShopRelatedString(hints, part, value, "form");
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof TenantAuthorityError) throw err;
      // ignore unreadable body after byte check
    }
  }

  return hints;
}

function hintMatchesShop(
  hint: ClientShopHint,
  shop: CanonicalShopIdentity,
): boolean {
  const key = normalizeHintKey(hint.key);
  if (key === "shopid" || key === "shop_id") {
    return hint.value === shop.id;
  }

  const normalized = normalizeShopDomain(hint.value);
  if (normalized.ok) {
    return normalized.normalized === shop.myshopifyDomain;
  }

  return hint.value.trim().toLowerCase() === shop.myshopifyDomain;
}

/**
 * Deny when any client-supplied shop hint refers to a different tenant than
 * the verified authenticated shop. Matching hints do not establish authority.
 */
export async function denyConflictingClientShop(
  request: Request,
  shop: CanonicalShopIdentity,
  params?: Record<string, string | undefined>,
): Promise<void> {
  const hints = await extractClientShopHints(request, params);
  for (const hint of hints) {
    if (!hintMatchesShop(hint, shop)) {
      throw new TenantAuthorityError(
        "client_shop_conflict",
        `Client-supplied ${hint.key} from ${hint.source} conflicts with verified authenticated shop`,
      );
    }
  }
}
