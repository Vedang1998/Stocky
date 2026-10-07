/**
 * External sink residual for privacy completion. Redis drain is shop-scoped
 * and never FLUSHALL. D-scratch leftovers for this shop fail residual; this
 * module does not call operator reclaim.
 */
import path from "node:path";
import {
  countOrdinaryQueueJobsForShop,
  drainOrdinaryQueueJobsForShop,
} from "../jobs/queue.server";
import {
  defaultDScratchRoot,
  inspectDScratchNamespace,
} from "../lib/order-facts/sync/source-stage";
import { ORDER_FACTS_SCRATCH_ATTEMPT_PREFIX } from "../lib/order-facts/sync/constants";

export async function countShopDScratchLeftovers(shopId: string): Promise<number> {
  const root = process.env.STOCKY_ORDER_FACTS_SCRATCH_ROOT || defaultDScratchRoot();
  const inspection = await inspectDScratchNamespace(root);
  const needle = `${ORDER_FACTS_SCRATCH_ATTEMPT_PREFIX}${shopId}-`;
  return inspection.attemptDirs.filter((row) =>
    path.basename(row.dir).startsWith(needle),
  ).length;
}

export async function assertShopExternalResidualClear(input: {
  shopId: string;
  canonicalDomain: string;
}): Promise<{ ok: boolean; detail: string }> {
  if (!process.env.REDIS_URL || process.env.REDIS_URL.trim() === "") {
    return { ok: false, detail: "redis_url_missing" };
  }
  try {
    const drain = await drainOrdinaryQueueJobsForShop(input);
    if (drain.remainingForShop > 0) {
      return {
        ok: false,
        detail: `redis_jobs_remaining:${drain.remainingForShop}`,
      };
    }
    const leftover = await countOrdinaryQueueJobsForShop(input);
    if (leftover > 0) {
      return { ok: false, detail: `redis_jobs_remaining:${leftover}` };
    }
  } catch (err) {
    return {
      ok: false,
      detail: `redis_drain_failed:${err instanceof Error ? err.message : "unknown"}`,
    };
  }
  const scratch = await countShopDScratchLeftovers(input.shopId);
  if (scratch > 0) {
    return { ok: false, detail: `d_scratch_leftover:${scratch}` };
  }
  return { ok: true, detail: "external_clear" };
}
