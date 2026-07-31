/**
 * Compatibility re-export — canonical implementation lives in app/tenant/shop-domain.ts.
 * Phase 1 PR 1 normalization version remains phase1-shop-domain-v1 (behavior unchanged).
 */
export {
  SHOP_DOMAIN_NORMALIZATION_VERSION,
  normalizeShopDomain,
  type ShopDomainNormalizationResult,
} from "../tenant/shop-domain";
