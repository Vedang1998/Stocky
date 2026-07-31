/**
 * Detect client-supplied shop identifiers. They never establish authority.
 * A conflicting value is denied; a matching value is ignored for authority.
 */

import type { CanonicalShopIdentity } from "./bootstrap.server";
import { TenantAuthorityError } from "./errors";
import { normalizeShopDomain } from "./shop-domain";

const SHOP_HINT_KEYS = ["shop", "shopId", "shop_id", "myshopifyDomain"] as const;

export type ClientShopHint = {
  key: string;
  value: string;
  source: "query" | "header" | "json" | "form";
};

/**
 * Extract untrusted shop hints from query, headers, and (via clone) body.
 * Does not consume the original request body.
 */
export async function extractClientShopHints(
  request: Request,
): Promise<ClientShopHint[]> {
  const hints: ClientShopHint[] = [];
  const url = new URL(request.url);

  for (const key of SHOP_HINT_KEYS) {
    const value = url.searchParams.get(key);
    if (value) hints.push({ key, value, source: "query" });
  }

  const headerMap: Array<[string, string]> = [
    ["shop", "shop"],
    ["x-shop", "shop"],
    ["x-shop-id", "shopId"],
    ["x-shopify-shop-domain", "shop"],
  ];
  for (const [header, key] of headerMap) {
    const value = request.headers.get(header);
    if (value) hints.push({ key, value, source: "header" });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await request.clone().json()) as Record<string, unknown>;
      for (const key of SHOP_HINT_KEYS) {
        const value = body[key];
        if (typeof value === "string" && value.length > 0) {
          hints.push({ key, value, source: "json" });
        }
      }
    } catch {
      // ignore unreadable body
    }
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    try {
      const form = await request.clone().formData();
      for (const key of SHOP_HINT_KEYS) {
        const value = form.get(key);
        if (typeof value === "string" && value.length > 0) {
          hints.push({ key, value, source: "form" });
        }
      }
    } catch {
      // ignore unreadable body
    }
  }

  return hints;
}

function hintMatchesShop(
  hint: ClientShopHint,
  shop: CanonicalShopIdentity,
): boolean {
  if (hint.key === "shopId" || hint.key === "shop_id") {
    return hint.value === shop.id;
  }

  const normalized = normalizeShopDomain(hint.value);
  if (normalized.ok) {
    return normalized.normalized === shop.myshopifyDomain;
  }

  // Non-normalizable domain-like values match only on exact case-insensitive equality.
  return hint.value.trim().toLowerCase() === shop.myshopifyDomain;
}

/**
 * Deny when any client-supplied shop hint refers to a different tenant than
 * the verified authenticated shop. Matching hints do not establish authority.
 */
export async function denyConflictingClientShop(
  request: Request,
  shop: CanonicalShopIdentity,
): Promise<void> {
  const hints = await extractClientShopHints(request);
  for (const hint of hints) {
    if (!hintMatchesShop(hint, shop)) {
      throw new TenantAuthorityError(
        "client_shop_conflict",
        `Client-supplied ${hint.key} from ${hint.source} conflicts with verified authenticated shop`,
      );
    }
  }
}
