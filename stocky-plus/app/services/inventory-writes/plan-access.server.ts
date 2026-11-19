import { requireActivePlanSnapshot } from "../../billing/entitlements.server";
import type { TenantDb } from "../../tenant/tenant-db.server";

/**
 * Whether the shop's plan lets it create or change records, for pages that
 * stay readable without one. Actions do not ask this: they call
 * `requireActivePlanSnapshot`, which refuses the request.
 */
export async function planAllowsChanges(db: TenantDb): Promise<boolean> {
  try {
    await requireActivePlanSnapshot(db);
    return true;
  } catch (thrown) {
    if (thrown instanceof Response && thrown.status === 403) return false;
    throw thrown;
  }
}
