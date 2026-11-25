/**
 * How often one shop may ask for a printed document.
 *
 * A PDF is laid out on the thread that answers every shop's requests, and one
 * part of 250 rows holds it for two to three seconds. Without a limit a
 * client that asks in a loop would keep every other shop waiting.
 */
import type { TenantAuthority } from "../../tenant/authority.server";
import {
  consumeRateLimit,
  type RateLimit,
  type RateLimitStore,
} from "../rate-limit/rate-limit.server";
import { getRedisRateLimitStore } from "../rate-limit/redis-store.server";

/**
 * Twelve documents a minute for a shop. A person printing by hand stays well
 * under it, a long document's parts can be opened one after another, and at
 * the worst (every request a full part) one shop takes about half of one
 * server process's time.
 */
export const PAPER_SHOP_LIMIT: RateLimit = { limit: 12, windowSeconds: 60 };

/** The key comes from the verified session, so one shop cannot spend another's allowance. */
export const paperRateLimitKey = (shopId: string) => `papers:shop:${shopId}`;

const OUTAGE_LOG_INTERVAL_MS = 60_000;
let lastOutageLogAt = 0;

/**
 * Counts one request for a printed document against the shop. Null when the
 * request may go on; otherwise the 429 to answer with, which says when to
 * try again. Call it before anything is read or laid out.
 *
 * If the store is unreachable the request is allowed: the routes are
 * authenticated, and a Redis outage should not stop a shop printing.
 */
export async function refusePaperOverLimit(
  tenant: Pick<TenantAuthority, "shopId" | "correlationId">,
  request: Request,
  store?: RateLimitStore,
): Promise<Response | null> {
  let decision;
  try {
    decision = await consumeRateLimit(
      store ?? getRedisRateLimitStore(),
      paperRateLimitKey(tenant.shopId),
      PAPER_SHOP_LIMIT,
    );
  } catch (error) {
    const now = Date.now();
    if (now - lastOutageLogAt >= OUTAGE_LOG_INTERVAL_MS) {
      lastOutageLogAt = now;
      console.warn("Document rate limit unavailable; allowing requests", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }
  if (decision.allowed) return null;

  if (decision.firstDenial) {
    console.warn("Document rate limit reached", {
      path: new URL(request.url).pathname,
      correlationId: tenant.correlationId,
    });
  }
  const seconds = decision.retryAfterSeconds;
  return new Response(
    `Too many documents were asked for in a short time. Try again in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`,
    {
      status: 429,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Retry-After": String(seconds),
      },
    },
  );
}
