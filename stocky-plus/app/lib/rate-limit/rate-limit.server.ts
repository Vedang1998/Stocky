export type RateLimit = {
  /** Requests allowed per window. */
  limit: number;
  windowSeconds: number;
};

export type RateLimitDecision =
  | { allowed: true }
  | {
      allowed: false;
      retryAfterSeconds: number;
      /** True for the request that first crossed the limit in this window. */
      firstDenial: boolean;
    };

export interface RateLimitStore {
  /**
   * Count one request against `key`. The window starts with the key's first
   * request and is not extended by later ones.
   */
  hit(key: string, windowMs: number): Promise<{ count: number; resetInMs: number }>;
}

/**
 * Fixed-window limit. Denied requests still count, so a caller that keeps
 * hammering stays blocked until the window ends rather than slipping one
 * request through per retry.
 */
export async function consumeRateLimit(
  store: RateLimitStore,
  key: string,
  rule: RateLimit,
): Promise<RateLimitDecision> {
  const { count, resetInMs } = await store.hit(key, rule.windowSeconds * 1000);
  if (count <= rule.limit) return { allowed: true };
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(resetInMs / 1000)),
    firstDenial: count === rule.limit + 1,
  };
}
