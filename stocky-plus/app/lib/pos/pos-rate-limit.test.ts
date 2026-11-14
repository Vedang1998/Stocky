import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RateLimitStore } from "../rate-limit/rate-limit.server";
import {
  POS_SHOP_LIMIT,
  POS_STAFF_LIMIT,
  checkPosRateLimit,
} from "./pos-rate-limit.server";

function memoryStore(): RateLimitStore & { counts: Map<string, number> } {
  const counts = new Map<string, number>();
  return {
    counts,
    async hit(key, windowMs) {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return { count, resetInMs: windowMs };
    },
  };
}

function caller(shopId: string, shopifyUserId: string | null) {
  return {
    shop: { id: shopId, myshopifyDomain: `${shopId}.myshopify.com` },
    actor: { shopifyUserId, displayName: null, channel: "POS" as const },
  };
}

async function spend(
  store: RateLimitStore,
  who: ReturnType<typeof caller>,
  requests: number,
) {
  for (let i = 0; i < requests; i += 1) await checkPosRateLimit(who, store);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("checkPosRateLimit", () => {
  it("refuses a staff member who exceeds their allowance", async () => {
    const store = memoryStore();
    const staff = caller("shop-a", "1");
    await spend(store, staff, POS_STAFF_LIMIT.limit);

    expect(await checkPosRateLimit(staff, store)).toEqual({
      allowed: false,
      scope: "staff",
      retryAfterSeconds: POS_STAFF_LIMIT.windowSeconds,
      firstDenial: true,
    });
    expect(await checkPosRateLimit(staff, store)).toMatchObject({
      allowed: false,
      firstDenial: false,
    });
  });

  it("leaves other staff and other shops unaffected", async () => {
    const store = memoryStore();
    await spend(store, caller("shop-a", "1"), POS_STAFF_LIMIT.limit + 5);

    expect(await checkPosRateLimit(caller("shop-a", "2"), store)).toEqual({ allowed: true });
    expect(await checkPosRateLimit(caller("shop-b", "1"), store)).toEqual({ allowed: true });
  });

  it("does not charge refused staff requests to the shop's allowance", async () => {
    const store = memoryStore();
    await spend(store, caller("shop-a", "1"), POS_STAFF_LIMIT.limit + 50);
    expect(store.counts.get("pos:shop:shop-a")).toBe(POS_STAFF_LIMIT.limit);
  });

  it("refuses the whole shop once its allowance is spent", async () => {
    const store = memoryStore();
    store.counts.set("pos:shop:shop-a", POS_SHOP_LIMIT.limit);

    expect(await checkPosRateLimit(caller("shop-a", "7"), store)).toEqual({
      allowed: false,
      scope: "shop",
      retryAfterSeconds: POS_SHOP_LIMIT.windowSeconds,
      firstDenial: true,
    });
    expect(await checkPosRateLimit(caller("shop-b", "7"), store)).toEqual({ allowed: true });
  });

  it("gives tokens without a staff ID one shared allowance per shop", async () => {
    const store = memoryStore();
    await spend(store, caller("shop-a", null), POS_STAFF_LIMIT.limit);

    expect(await checkPosRateLimit(caller("shop-a", null), store)).toMatchObject({
      allowed: false,
      scope: "staff",
    });
    expect(await checkPosRateLimit(caller("shop-b", null), store)).toEqual({ allowed: true });
    expect(await checkPosRateLimit(caller("shop-a", "1"), store)).toEqual({ allowed: true });
  });

  it("allows requests while the store is down and logs the outage once a minute", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const down: RateLimitStore = {
      hit: () => Promise.reject(new Error("connect ECONNREFUSED")),
    };
    vi.setSystemTime(new Date("2026-11-11T10:00:00Z"));

    expect(await checkPosRateLimit(caller("shop-a", "1"), down)).toEqual({ allowed: true });
    expect(await checkPosRateLimit(caller("shop-a", "1"), down)).toEqual({ allowed: true });
    expect(warn).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-11-11T10:01:01Z"));
    await checkPosRateLimit(caller("shop-a", "1"), down);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
