import { normalizeShopDomain } from "../../tenant/shop-domain";

/**
 * Body fields in which Shopify names the shop a delivery is about:
 * `myshopify_domain` on app/uninstalled (a Shop resource), `shop_domain` on
 * the three compliance topics.
 */
export type SignedShopField = "myshopify_domain" | "shop_domain";

/**
 * Whether a verified webhook's signed body names the same shop as its
 * `X-Shopify-Shop-Domain` header.
 *
 * Shopify's HMAC covers the request body only. The shop and topic headers are
 * not signed, so anyone who holds one signed delivery for this app can replay
 * its body under another shop's name. A route that changes or deletes a
 * shop's data on the strength of a webhook must therefore take the shop from
 * the body, which this check enforces: a missing, non-string or invalid field
 * is a mismatch.
 */
export function signedShopMatches(
  payload: unknown,
  field: SignedShopField,
  headerShop: string,
): boolean {
  if (payload === null || typeof payload !== "object") return false;
  const signed = (payload as Record<string, unknown>)[field];
  if (typeof signed !== "string") return false;

  const fromBody = normalizeShopDomain(signed);
  const fromHeader = normalizeShopDomain(headerShop);
  return (
    fromBody.ok &&
    fromHeader.ok &&
    fromBody.normalized === fromHeader.normalized
  );
}
