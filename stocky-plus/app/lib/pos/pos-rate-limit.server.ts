import type { PosTenantContext } from "../../tenant/require-pos-tenant.server";
import {
  consumeRateLimit,
  type RateLimit,
  type RateLimitStore,
} from "../rate-limit/rate-limit.server";
import { getRedisRateLimitStore } from "../rate-limit/redis-store.server";

/**
 * A fast operator scans about once a second and each scan is one request, so
 * these leave room for sustained scanning on many devices while stopping a
 * looping client.
 */
export const POS_STAFF_LIMIT: RateLimit = { limit: 240, windowSeconds: 60 };
export const POS_SHOP_LIMIT: RateLimit = { limit: 2400, windowSeconds: 60 };

export type PosRateLimitDecision =
  | { allowed: true }
  | {
      allowed: false;
      scope: "staff" | "shop";
      retryAfterSeconds: number;
      firstDenial: boolean;
    };

export function posRateLimitKeys(shopId: string, staffId: string | null) {
  return {
    // Tokens without a staff ID share one allowance rather than escaping the
    // per-staff limit.
    staff: `pos:staff:${shopId}:${staffId ?? "unknown"}`,
    shop: `pos:shop:${shopId}`,
  };
}

const OUTAGE_LOG_INTERVAL_MS = 60_000;
let lastOutageLogAt = 0;

/**
 * Limit POS API requests per staff member and per shop. Both keys come from
 * the verified session token, so one shop cannot spend another's allowance.
 *
 * If the store is unreachable the request is allowed: the POS endpoints are
 * authenticated, and blocking every lookup during a Redis outage would stop
 * work on the shop floor.
 */
export async function checkPosRateLimit(
  context: Pick<PosTenantContext, "shop" | "actor">,
  store?: RateLimitStore,
): Promise<PosRateLimitDecision> {
  const keys = posRateLimitKeys(context.shop.id, context.actor.shopifyUserId);
  try {
    const limiter = store ?? getRedisRateLimitStore();
    // Staff first: a request refused here does not use up the shop's allowance.
    const staff = await consumeRateLimit(limiter, keys.staff, POS_STAFF_LIMIT);
    if (!staff.allowed) return { ...staff, scope: "staff" };
    const shop = await consumeRateLimit(limiter, keys.shop, POS_SHOP_LIMIT);
    if (!shop.allowed) return { ...shop, scope: "shop" };
    return { allowed: true };
  } catch (error) {
    const now = Date.now();
    if (now - lastOutageLogAt >= OUTAGE_LOG_INTERVAL_MS) {
      lastOutageLogAt = now;
      console.warn("POS rate limit unavailable; allowing requests", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return { allowed: true };
  }
}
