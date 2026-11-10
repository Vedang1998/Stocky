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
import { ensureShopSettings } from "./shop-settings.server";
import { reactivateShopAfterVerifiedReinstall } from "../sync/reinstall.server";

export type AfterAuthResult = {
  shopId: string;
  myshopifyDomain: string;
  tenant: TenantAuthority;
  reactivated: boolean;
};

function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const code = (err as { code?: unknown }).code;
  return `${err.name}${typeof code === "string" ? ` [${code}]` : ""}: ${err.message}`;
}

export async function runAfterAuthTenantBootstrap(
  session: Session,
): Promise<AfterAuthResult> {
  try {
    return await bootstrapTenant(session);
  } catch (err) {
    // The Shopify library turns any afterAuth error into an empty 500 and logs
    // nothing (issue #73). Log the error only: the session holds the token.
    console.error("afterAuth tenant bootstrap failed:", describeError(err));
    throw err;
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

  // C-01: do not silently repair nullable ownership on update (empty update).
  // Issue #73: tolerate the dashboard loader creating the row concurrently.
  await ensureShopSettings(db, tenant);

  return {
    shopId: shop.id,
    myshopifyDomain: shop.myshopifyDomain,
    tenant,
    reactivated,
  };
}
