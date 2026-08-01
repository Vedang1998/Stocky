/**
 * Detect client-supplied shop identifiers. They never establish authority.
 * A conflicting value is denied; a matching value is ignored for authority.
 *
 * C-06: bounded recursive inspection across query (incl. duplicates), headers,
 * JSON (nested/arrays), form/multipart, and route parameters.
 */

import type { CanonicalShopIdentity } from "./bootstrap.server";
import { TenantAuthorityError } from "./errors";
import { normalizeShopDomain } from "./shop-domain";

const SHOP_HINT_KEYS = new Set([
  "shop",
  "shopid",
  "shop_id",
  "myshopifydomain",
  "myshopify_domain",
  "shopdomain",
  "shop_domain",
]);

const MAX_DEPTH = 6;
const MAX_NODES = 200;
const MAX_STRING_LENGTH = 512;

export type ClientShopHint = {
  key: string;
  value: string;
  source: "query" | "header" | "json" | "form" | "params";
};

function normalizeHintKey(key: string): string {
  return key.trim().toLowerCase();
}

function isShopHintKey(key: string): boolean {
  return SHOP_HINT_KEYS.has(normalizeHintKey(key));
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

type WalkState = { nodes: number };

function walkJson(
  value: unknown,
  hints: ClientShopHint[],
  depth: number,
  state: WalkState,
  source: "json" | "form",
  parentKey?: string,
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
    if (parentKey && isShopHintKey(parentKey)) {
      pushHint(hints, parentKey, value, source);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      walkJson(item, hints, depth + 1, state, source, parentKey);
    }
    return;
  }

  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (isShopHintKey(key)) {
        if (typeof child === "string") {
          pushHint(hints, key, child, source);
        } else if (Array.isArray(child)) {
          for (const item of child) {
            if (typeof item === "string") pushHint(hints, key, item, source);
            else walkJson(item, hints, depth + 1, state, source, key);
          }
        } else if (child != null && typeof child === "object") {
          // Recognized shop-hint key with nested object — fail closed.
          throw new TenantAuthorityError(
            "client_shop_hint_limit",
            `Recognized shop-hint key ${key} has a nested structure that exceeds safe inspection`,
          );
        }
      } else {
        walkJson(child, hints, depth + 1, state, source, key);
      }
    }
  }
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
      pushHint(hints, key, value, "query");
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
    if (value) pushHint(hints, key, value, "header");
  }

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (isShopHintKey(key) && typeof value === "string") {
        pushHint(hints, key, value, "params");
      }
    }
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = await request.clone().json();
      walkJson(body, hints, 0, { nodes: 0 }, "json");
    } catch (err) {
      if (err instanceof TenantAuthorityError) throw err;
      // ignore unreadable body
    }
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    try {
      const form = await request.clone().formData();
      const asObject: Record<string, unknown> = {};
      for (const [key, value] of form.entries()) {
        if (typeof value !== "string") continue;
        // Nested form-style keys: shop[id], nested[shop], etc.
        if (key.includes("[") && key.endsWith("]")) {
          const parts = key.replace(/\]/g, "").split("[");
          let cursor: Record<string, unknown> = asObject;
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i]!;
            if (!isPlainRecord(cursor[part])) cursor[part] = {};
            cursor = cursor[part] as Record<string, unknown>;
          }
          cursor[parts[parts.length - 1]!] = value;
        } else if (key in asObject) {
          const existing = asObject[key];
          if (Array.isArray(existing)) existing.push(value);
          else asObject[key] = [existing, value];
        } else {
          asObject[key] = value;
        }
      }
      walkJson(asObject, hints, 0, { nodes: 0 }, "form");
    } catch (err) {
      if (err instanceof TenantAuthorityError) throw err;
      // ignore unreadable body
    }
  }

  return hints;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
