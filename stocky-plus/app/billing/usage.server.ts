/**
 * Plan usage computed exactly from tenant data. Dimensions that cannot be
 * computed correctly yet (active variants, users, AI credits) are omitted
 * rather than estimated.
 */
import type { TenantDb } from "../tenant/tenant-db.server";
import {
  currentMonthlyBillingPeriod,
  type PlanUsage,
  type SubscriptionRecord,
} from "./entitlements";

export async function getPlanUsage(
  db: TenantDb,
  subscription: SubscriptionRecord,
  now: Date,
): Promise<PlanUsage> {
  const period = currentMonthlyBillingPeriod(subscription, now);

  const [activeLocations, purchaseOrders]: [number, number | null] =
    await Promise.all([
      db.shopifyLocationFact.count({
        where: { existenceState: "LIVE", isActive: true },
      }),
      period
        ? db.purchaseOrder.count({
            where: { createdAt: { gte: period.start, lt: period.end } },
          })
        : null,
    ]);

  return {
    // Every Shopify store has at least one active location, so zero means
    // the catalog has not been synced yet, not that nothing is in use.
    locations: activeLocations > 0 ? activeLocations : null,
    monthlyPurchaseOrders: purchaseOrders,
  };
}
