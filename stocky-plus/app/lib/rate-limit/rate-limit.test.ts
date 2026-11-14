import { describe, expect, it } from "vitest";
import { consumeRateLimit, type RateLimitStore } from "./rate-limit.server";

function storeReturning(count: number, resetInMs: number): RateLimitStore & {
  calls: Array<[string, number]>;
} {
  const calls: Array<[string, number]> = [];
  return {
    calls,
    async hit(key, windowMs) {
      calls.push([key, windowMs]);
      return { count, resetInMs };
    },
  };
}

const rule = { limit: 3, windowSeconds: 60 };

describe("consumeRateLimit", () => {
  it("counts the request in a window of the rule's length", async () => {
    const store = storeReturning(1, 60_000);
    await consumeRateLimit(store, "k", rule);
    expect(store.calls).toEqual([["k", 60_000]]);
  });

  it("allows requests up to and including the limit", async () => {
    expect(await consumeRateLimit(storeReturning(3, 10_000), "k", rule)).toEqual({
      allowed: true,
    });
  });

  it("refuses the first request over the limit and says when to retry", async () => {
    expect(await consumeRateLimit(storeReturning(4, 12_001), "k", rule)).toEqual({
      allowed: false,
      retryAfterSeconds: 13,
      firstDenial: true,
    });
  });

  it("keeps refusing later requests without marking them as the first", async () => {
    expect(await consumeRateLimit(storeReturning(9, 400), "k", rule)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
      firstDenial: false,
    });
  });

  it("never tells the caller to retry immediately", async () => {
    const decision = await consumeRateLimit(storeReturning(4, 0), "k", rule);
    expect(decision).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
  });
});
