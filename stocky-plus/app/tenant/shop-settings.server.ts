/**
 * ShopSettings bootstrap that tolerates concurrent creators (issue #73).
 * Ported from #82.
 */
import { Prisma } from "@prisma/client";
import type { TenantDb } from "./tenant-db.server";

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * Create the shop's ShopSettings row if it does not exist.
 *
 * On a first install the afterAuth hook can run while another request (the
 * Billing page storing an entitlement snapshot, for example) creates the same
 * row. On the enforced schema the losing INSERT fails with a unique violation
 * (P2002) rather than a retryable serialization failure, and afterAuth then
 * failed, which the Shopify library turns into an empty 500 and no first
 * sync. A losing creator now reads the winner's row back through the same
 * tenant-scoped client, so a row that is not this tenant's is never used.
 *
 * C-01: an existing row's ownership is never repaired here (empty update).
 *
 * Pass a root tenant client, not one inside an open transaction: a unique
 * violation aborts the transaction and the read-back would then fail.
 */
export async function ensureShopSettings(db: TenantDb): Promise<void> {
  const { shopId, myshopifyDomain } = db.authority;
  const where = { shop: myshopifyDomain };
  try {
    await db.shopSettings.upsert({
      where,
      create: { shop: myshopifyDomain, shopId },
      update: {},
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await db.shopSettings.findUnique({
      where,
      select: { id: true },
    });
    if (!existing) throw error;
  }
}
