import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import IORedis from "ioredis";
import { requireRedisUrl } from "../../jobs/queue.server";
import { consumeRateLimit } from "../../lib/rate-limit/rate-limit.server";
import { createRedisRateLimitStore } from "../../lib/rate-limit/redis-store.server";

const PREFIX = "propo:rate-limit:";

describe("Redis rate limit store", () => {
  let redis: IORedis;
  const key = `test:${process.pid}:${Date.now()}`;

  beforeAll(() => {
    redis = new IORedis(requireRedisUrl(), { maxRetriesPerRequest: 1 });
  });

  beforeEach(async () => {
    await redis.del(PREFIX + key);
  });

  afterAll(async () => {
    await redis.del(PREFIX + key);
    await redis.quit();
  });

  it("counts requests and starts the window on the first one", async () => {
    const store = createRedisRateLimitStore(redis);
    const first = await store.hit(key, 30_000);
    expect(first.count).toBe(1);
    expect(first.resetInMs).toBe(30_000);

    const second = await store.hit(key, 30_000);
    expect(second.count).toBe(2);
    expect(second.resetInMs).toBeGreaterThan(0);
    expect(second.resetInMs).toBeLessThanOrEqual(30_000);
  });

  it("does not extend the window on later requests", async () => {
    const store = createRedisRateLimitStore(redis);
    await store.hit(key, 30_000);
    await redis.pexpire(PREFIX + key, 5_000);

    const next = await store.hit(key, 30_000);
    expect(next.resetInMs).toBeLessThanOrEqual(5_000);
    expect(await redis.pttl(PREFIX + key)).toBeLessThanOrEqual(5_000);
  });

  it("starts a new window after the old one expires", async () => {
    const store = createRedisRateLimitStore(redis);
    await store.hit(key, 40);
    await store.hit(key, 40);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect((await store.hit(key, 40)).count).toBe(1);
  });

  it("gives a counter that lost its expiry a new one", async () => {
    await redis.set(PREFIX + key, "7");
    const store = createRedisRateLimitStore(redis);

    const result = await store.hit(key, 30_000);
    expect(result).toEqual({ count: 8, resetInMs: 30_000 });
    expect(await redis.pttl(PREFIX + key)).toBeGreaterThan(0);
  });

  it("counts concurrent requests exactly once each", async () => {
    const store = createRedisRateLimitStore(redis);
    const results = await Promise.all(
      Array.from({ length: 50 }, () => store.hit(key, 30_000)),
    );
    expect(results.map((r) => r.count).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 50 }, (_, i) => i + 1),
    );
  });

  it("enforces a limit end to end", async () => {
    const store = createRedisRateLimitStore(redis);
    const rule = { limit: 2, windowSeconds: 30 };
    expect(await consumeRateLimit(store, key, rule)).toEqual({ allowed: true });
    expect(await consumeRateLimit(store, key, rule)).toEqual({ allowed: true });
    expect(await consumeRateLimit(store, key, rule)).toEqual({
      allowed: false,
      retryAfterSeconds: 30,
      firstDenial: true,
    });
  });

  it("fails fast instead of holding the request when Redis does not answer", async () => {
    const unreachable = new IORedis("redis://127.0.0.1:1", {
      maxRetriesPerRequest: null,
      retryStrategy: () => 50,
    });
    unreachable.on("error", () => {});
    try {
      const started = Date.now();
      await expect(
        createRedisRateLimitStore(unreachable).hit(key, 30_000),
      ).rejects.toThrow(/timed out/);
      expect(Date.now() - started).toBeLessThan(2_000);
    } finally {
      unreachable.disconnect();
    }
  });
});
