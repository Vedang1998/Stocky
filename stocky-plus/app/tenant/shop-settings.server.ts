import type { TenantAuthority } from "./authority.server";
import type { TenantDb } from "./tenant-db.server";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2002"
  );
}

/**
 * Return the shop's ShopSettings row, creating it on first use.
 *
 * Safe when several requests create it at once (issue #73): on a first
 * install the afterAuth bootstrap and the dashboard loader run in parallel,
 * and on the enforced schema the losing INSERT fails with a unique violation
 * (P2002) instead of a retryable serialization failure. The row the winner
 * created is then read back through the same tenant-scoped client, so a row
 * that is not this tenant's is never returned.
 */
export async function ensureShopSettings(db: TenantDb, tenant: TenantAuthority) {
  const where = { shop: tenant.myshopifyDomain };
  try {
    return await db.shopSettings.upsert({
      where,
      create: { shop: tenant.myshopifyDomain, shopId: tenant.shopId },
      update: {},
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const existing = await db.shopSettings.findUnique({ where });
    if (!existing) throw err;
    return existing;
  }
}
