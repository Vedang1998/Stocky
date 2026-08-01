/**
 * Shopify afterAuth sequence (Phase 1 PR 2):
 * 1. Receive Shopify-verified session
 * 2. Normalize session.shop
 * 3. Upsert/resolve canonical Shop through bootstrap
 * 4. Create branded tenant authority
 * 5. Upsert ShopSettings through tenant-bound access
 * 6. Enqueue catalog sync with validated tenant job envelope
 */

import type { Session } from "@shopify/shopify-api";
import type { TenantAuthority } from "./authority.server";
import { resolveAuthorityAfterVerifiedAuth } from "./bootstrap.server";
import { createTenantDb } from "./tenant-db.server";

export type AfterAuthResult = {
  shopId: string;
  myshopifyDomain: string;
  tenant: TenantAuthority;
};

export async function runAfterAuthTenantBootstrap(
  session: Session,
): Promise<AfterAuthResult> {
  const { shop, tenant } = await resolveAuthorityAfterVerifiedAuth({
    verifiedDomain: session.shop,
    source: "verified_scheduler",
    createIfMissing: true,
  });

  const db = createTenantDb(tenant);

  await db.shopSettings.upsert({
    where: { shop: tenant.myshopifyDomain },
    create: {
      shop: tenant.myshopifyDomain,
      shopId: tenant.shopId,
    },
    // C-01: do not silently repair nullable ownership on update.
    update: {},
  });

  return {
    shopId: shop.id,
    myshopifyDomain: shop.myshopifyDomain,
    tenant,
  };
}
