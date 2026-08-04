/**
 * Shopify afterAuth sequence (Phase 1 PR 2 + PR 4 reinstall):
 * 1. Receive Shopify-verified session
 * 2. Normalize session.shop
 * 3. Upsert/resolve canonical Shop through bootstrap
 * 4. Reactivate processing when previously UNINSTALLED (PR 4)
 * 5. Create branded tenant authority
 * 6. Upsert ShopSettings through tenant-bound access
 * 7. Enqueue catalog sync via durable job (caller)
 */

import type { Session } from "@shopify/shopify-api";
import type { TenantAuthority } from "./authority.server";
import { resolveAuthorityAfterVerifiedAuth } from "./bootstrap.server";
import { createTenantDb } from "./tenant-db.server";
import { reactivateShopAfterVerifiedReinstall } from "../sync/reinstall.server";

export type AfterAuthResult = {
  shopId: string;
  myshopifyDomain: string;
  tenant: TenantAuthority;
  reactivated: boolean;
};

export async function runAfterAuthTenantBootstrap(
  session: Session,
): Promise<AfterAuthResult> {
  const { shop, tenant } = await resolveAuthorityAfterVerifiedAuth({
    verifiedDomain: session.shop,
    source: "verified_scheduler",
    createIfMissing: true,
  });

  let reactivated = false;
  try {
    const result = await reactivateShopAfterVerifiedReinstall({
      verifiedDomain: session.shop,
    });
    reactivated = result.reactivated;
  } catch {
    // REDACTED/MANUAL denial is fail-closed for reactivation; continue bootstrap.
  }

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
    reactivated,
  };
}
