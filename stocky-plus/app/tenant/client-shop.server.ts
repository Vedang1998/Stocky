/**
 * Client shop-hint conflict detection (F-PR2C-08).
 *
 * Direct inspection for query/headers/params/form field names.
 * JSON/multipart bodies use byte + node/depth budgets sized for ordinary
 * inventory payloads (bulk PO / stocktake / transfer lines), not a 200-node cliff.
 *
 * Limits (product rationale):
 * - MAX_BODY_BYTES = 1_048_576 (1 MiB): aligned with typical Shopify app request
 *   body ceilings for admin embedded POSTs; larger bodies fail closed.
 * - MAX_NODES = 20_000: above a 5_000-line stocktake-style payload of small
 *   objects (~3 scalars each) while still bounding pathological graphs.
 * - MAX_DEPTH = 12: nested form/JSON shapes beyond ordinary business depth.
 * - MAX_STRING_LENGTH = 512: shop-hint string bound (unchanged).
 *
 * A recognized shop-hint key with a nested object is walked for string leaves;
 * it is not denied merely for nesting. Denial requires an observed conflicting
 * string hint, malformed structure only when traversal limits are exceeded, or
 * body-byte overflow.
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

/** Documented body-byte ceiling for hint inspection. */
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
          // Walk nested object under a hint key for string leaves; do not deny
          // ordinary business objects named "shop" unless a conflicting string
          // is observed (or traversal limits are exceeded).
          walkJson(child, hints, depth + 1, state, source, key);
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
      const raw = await request.clone().text();
      if (raw.length > MAX_BODY_BYTES) {
        throw new TenantAuthorityError(
          "client_shop_hint_limit",
          "Client shop-hint inspection exceeded maximum body byte size",
        );
      }
      if (raw.length === 0) return hints;
      const body = JSON.parse(raw) as unknown;
      walkJson(body, hints, 0, { nodes: 0 }, "json");
    } catch (err) {
      if (err instanceof TenantAuthorityError) throw err;
      // ignore unreadable / malformed JSON body
    }
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    try {
      const form = await request.clone().formData();
      // Inspect field names and bracket-path segments directly — do not build
      // a giant unrelated object graph for ordinary form payloads.
      for (const [key, value] of form.entries()) {
        if (typeof value !== "string") continue;
        if (key.length + value.length > MAX_BODY_BYTES) {
          throw new TenantAuthorityError(
            "client_shop_hint_limit",
            "Client shop-hint inspection exceeded maximum body byte size",
          );
        }
        if (isShopHintKey(key)) {
          pushHint(hints, key, value, "form");
          continue;
        }
        if (key.includes("[") && key.endsWith("]")) {
          const parts = key.replace(/\]/g, "").split("[");
          for (const part of parts) {
            if (isShopHintKey(part)) {
              pushHint(hints, part, value, "form");
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof TenantAuthorityError) throw err;
      // ignore unreadable body
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
