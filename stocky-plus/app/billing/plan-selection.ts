/**
 * Shopify App Pricing hosted plan selection page:
 * https://admin.shopify.com/store/:store_handle/charges/:app_handle/pricing_plans
 */
import { normalizeShopDomain } from "../tenant/shop-domain";

const MYSHOPIFY_SUFFIX = ".myshopify.com";

/** Characters Shopify permits in an app handle; all are URL-safe. */
const APP_HANDLE = /^[A-Za-z0-9_-]{1,256}$/;

export type PlanSelectionUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: "invalid_shop_domain" | "invalid_app_handle" };

/**
 * The shop domain must already be the canonical `<store>.myshopify.com` form.
 * Anything normalization would change (case, whitespace) or reject (scheme,
 * path, port, other hosts) is refused, never repaired.
 */
export function buildPlanSelectionUrl(
  shopDomain: string,
  appHandle: string,
): PlanSelectionUrlResult {
  const normalized = normalizeShopDomain(shopDomain);
  if (!normalized.ok || normalized.normalized !== shopDomain) {
    return { ok: false, reason: "invalid_shop_domain" };
  }
  if (!APP_HANDLE.test(appHandle)) {
    return { ok: false, reason: "invalid_app_handle" };
  }

  const storeHandle = shopDomain.slice(0, -MYSHOPIFY_SUFFIX.length);
  return {
    ok: true,
    url:
      "https://admin.shopify.com/store/" +
      `${encodeURIComponent(storeHandle)}/charges/` +
      `${encodeURIComponent(appHandle)}/pricing_plans`,
  };
}
