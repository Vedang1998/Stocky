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
import { resolveAuthorityAfterVerifiedAuth } from "./bootstrap.server";
import { createTenantJobEnvelope } from "./job-envelope.server";
import { createTenantDb } from "./tenant-db.server";

export type AfterAuthResult = {
  shopId: string;
  myshopifyDomain: string;
  envelope: ReturnType<typeof createTenantJobEnvelope>;
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
    update: {
      // Idempotent alignment of nullable ownership to the verified tenant.
      shopId: tenant.shopId,
    },
  });

  const envelope = createTenantJobEnvelope(tenant, "after_auth_catalog_sync");

  return {
    shopId: shop.id,
    myshopifyDomain: shop.myshopifyDomain,
    envelope,
  };
}
