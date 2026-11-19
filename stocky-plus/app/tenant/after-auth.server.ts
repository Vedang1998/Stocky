/**
 * Shopify afterAuth sequence (Phase 1 PR 2 + PR 4 reinstall):
 * 1. Receive Shopify-verified session
 * 2. Normalize session.shop
 * 3. Upsert/resolve canonical Shop through bootstrap
 * 4. Reactivate processing when previously UNINSTALLED (PR 4)
 * 5. Create branded tenant authority
 * 6. Create ShopSettings through tenant-bound access, tolerating a
 *    concurrent creator (issue #73)
 * 7. Enqueue catalog sync via durable job (caller)
 */

import type { Session } from "@shopify/shopify-api";
import type { TenantAuthority } from "./authority.server";
import { resolveAuthorityAfterVerifiedAuth } from "./bootstrap.server";
import { createTenantDb } from "./tenant-db.server";
import { ensureShopSettings } from "./shop-settings.server";
import { reactivateShopAfterVerifiedReinstall } from "../sync/reinstall.server";

export type AfterAuthResult = {
  shopId: string;
  myshopifyDomain: string;
  tenant: TenantAuthority;
  reactivated: boolean;
};

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return typeof error;
  const code = (error as { code?: unknown }).code;
  return `${error.name}${typeof code === "string" ? ` [${code}]` : ""}: ${error.message}`;
}

export async function runAfterAuthTenantBootstrap(
  session: Session,
): Promise<AfterAuthResult> {
  try {
    return await bootstrapTenant(session);
  } catch (error) {
    // The Shopify library turns any afterAuth error into an empty 500 and logs
    // nothing (issue #73). Log the error only, never the session: it holds the
    // access token.
    console.error("afterAuth tenant bootstrap failed:", describeError(error));
    throw error;
  }
}

async function bootstrapTenant(session: Session): Promise<AfterAuthResult> {
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

  await ensureShopSettings(db, tenant);

  return {
    shopId: shop.id,
    myshopifyDomain: shop.myshopifyDomain,
    tenant,
    reactivated,
  };
}
