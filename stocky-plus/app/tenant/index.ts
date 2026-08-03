export {
  SHOP_DOMAIN_NORMALIZATION_VERSION,
  normalizeShopDomain,
  type ShopDomainNormalizationResult,
} from "./shop-domain";

export {
  issueTenantAuthority,
  isTenantAuthority,
  assertTenantAuthority,
  rejectRawAuthorityConstruction,
  type TenantAuthority,
  type TenantAuthoritySource,
} from "./authority.server";

export {
  shopifySessionStorage,
  normalizeVerifiedShopifyDomain,
  upsertCanonicalShop,
  resolveCanonicalShopByDomain,
  resolveCanonicalShopById,
  requireCanonicalShopMatch,
  resolveAuthorityAfterVerifiedAuth,
  enumerateCanonicalShopsForScheduler,
  deleteSessionsForShop,
  updateSessionScope,
  getMerchantDelegate,
  type CanonicalShopIdentity,
} from "./bootstrap.server";

export { requireAdminTenant, type AdminTenantContext } from "./require-admin-tenant.server";
export {
  createTenantDb,
  tenantDbExposesRawClient,
  type TenantDb,
} from "./tenant-db.server";
export {
  TENANT_JOB_ENVELOPE_VERSION,
  createTenantJobEnvelope,
  parseTenantJobEnvelope,
  resolveTenantJobContext,
  type TenantJobEnvelopeV1,
  type TenantJobContext,
} from "./job-envelope.server";
export { resolveWebhookTenant } from "./webhook-tenant.server";
export { planPerShopSchedulerJobs } from "./scheduler.server";
export { runAfterAuthTenantBootstrap } from "./after-auth.server";
export {
  TENANT_DB_CONTEXT_VERSION,
  setTransactionLocalTenantContext,
  assertTransactionLocalTenantContext,
  withTenantBoundTransaction,
} from "./db-context.server";
export {
  MERCHANT_OWNED_MODELS,
  DIRECT_MERCHANT_MODELS,
  CHILD_MERCHANT_MODELS,
  BOOTSTRAP_MODELS,
} from "./models";
export { TenantAccessError, TenantAuthorityError } from "./errors";
