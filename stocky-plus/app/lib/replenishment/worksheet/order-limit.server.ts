/**
 * The plan's monthly purchase-order allowance, checked before a worksheet
 * creates orders so a request is refused whole rather than part-way through.
 */
import { checkLimit, type ShopEntitlements } from "../../../billing/entitlements.server";
import { getPlanUsage } from "../../../billing/usage.server";
import type { TenantDb } from "../../../tenant/tenant-db.server";

export type OrderAllowance = { allowed: true } | { allowed: false; message: string };

const NO_ACTIVE_PLAN: OrderAllowance = {
  allowed: false,
  message: "Choose a plan on the Billing page to create purchase orders.",
};

export async function checkPurchaseOrderAllowance(
  db: TenantDb,
  entitlements: ShopEntitlements,
  requested: number,
  now: Date,
): Promise<OrderAllowance> {
  if (entitlements.state !== "active") return NO_ACTIVE_PLAN;
  if (entitlements.plan.limits.monthlyPurchaseOrders === null) return { allowed: true };

  const usage = await getPlanUsage(db, entitlements.subscription, now);
  // Annual subscriptions have no monthly period to count against, so the
  // allowance cannot be measured and is not enforced.
  if (usage.monthlyPurchaseOrders === null) return { allowed: true };

  const check = checkLimit(
    entitlements,
    "monthlyPurchaseOrders",
    usage.monthlyPurchaseOrders,
    requested,
  );
  if (check.allowed) return { allowed: true };
  if (check.reason === "no_active_plan") return NO_ACTIVE_PLAN;

  const left =
    check.remaining === 0
      ? "none are left"
      : check.remaining === 1
        ? "1 is left"
        : `${check.remaining} are left`;
  return {
    allowed: false,
    message: `Your plan includes ${check.limit} purchase orders per billing month and ${left}. This would create ${requested}. Create fewer now, or change your plan on the Billing page.`,
  };
}
