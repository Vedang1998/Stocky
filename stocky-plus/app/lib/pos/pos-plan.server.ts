import { requireActivePlanSnapshot } from "../../billing/entitlements.server";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { PosApiError } from "./pos-api.server";

export const POS_NO_PLAN_MESSAGE =
  "ProPo needs an active plan before it can be used here. Ask the store owner to check Billing in the ProPo app.";

/**
 * POS counterpart of the admin plan gate: receiving and counting run only
 * while the shop's last billing snapshot shows an active plan. The shared
 * gate throws a plain-text 403 Response meant for the admin error boundary,
 * which a POS screen cannot show, so it becomes a POS API error here.
 */
export async function requirePosPlan(db: TenantDb): Promise<void> {
  try {
    await requireActivePlanSnapshot(db);
  } catch (error) {
    if (error instanceof Response && error.status === 403) {
      throw new PosApiError(403, "forbidden", POS_NO_PLAN_MESSAGE);
    }
    throw error;
  }
}
