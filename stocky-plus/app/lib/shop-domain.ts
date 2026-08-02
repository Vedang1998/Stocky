/**
 * Compatibility re-export — canonical implementation lives in app/tenant/shop-domain.ts.
 * Phase 1 PR 1 normalization version remains phase1-shop-domain-v1 (behavior unchanged).
 */
export {
  SHOP_DOMAIN_NORMALIZATION_VERSION,
  PHASE1_SHOP_DOMAIN_SPEC,
  ECMA_SCRIPT_TRIM_CODE_POINTS,
  shopDomainTrimCharacters,
  normalizeShopDomain,
  SHOP_DOMAIN_NORMALIZATION_CORPUS,
  type ShopDomainNormalizationResult,
  type ShopDomainCorpusEntry,
} from "../tenant/shop-domain";
