import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RateLimitStore } from "../rate-limit/rate-limit.server";
import {
  PAPER_SHOP_LIMIT,
  paperRateLimitKey,
  refusePaperOverLimit,
} from "./paper-rate-limit.server";

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

const shop = (shopId: string) => ({
  shopId,
  correlationId: `request-${shopId}`,
});

const asked = (path = "/app/transfers/t-1/document?part=2") =>
  new Request(`https://app.example${path}`);

async function spend(store: RateLimitStore, shopId: string, requests: number) {
  for (let i = 0; i < requests; i += 1) {
    expect(await refusePaperOverLimit(shop(shopId), asked(), store)).toBeNull();
  }
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  // The outage log is spaced by the clock; start each test past any earlier one.
  vi.setSystemTime(Date.now() + 10 * 60_000);
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("How often a shop may ask for a printed document", () => {
  it("lets a shop print twelve documents in a minute", async () => {
    expect(PAPER_SHOP_LIMIT).toEqual({ limit: 12, windowSeconds: 60 });

    const store = memoryStore();
    await spend(store, "shop-a", 12);

    expect(store.counts.get(paperRateLimitKey("shop-a"))).toBe(12);
    expect(warn).not.toHaveBeenCalled();
  });

  it("refuses the thirteenth and says when to try again", async () => {
    const store = memoryStore();
    await spend(store, "shop-a", PAPER_SHOP_LIMIT.limit);

    const refusal = await refusePaperOverLimit(shop("shop-a"), asked(), store);

    expect(refusal?.status).toBe(429);
    expect(refusal?.headers.get("Retry-After")).toBe("60");
    expect(refusal?.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(refusal?.headers.get("Cache-Control")).toBe("private, no-store");
    expect(refusal?.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await refusal?.text()).toBe(
      "Too many documents were asked for in a short time. Try again in 60 seconds.",
    );
  });

  it("counts down to the end of the minute, to a single second", async () => {
    const store: RateLimitStore = {
      hit: async () => ({ count: 20, resetInMs: 400 }),
    };

    const refusal = await refusePaperOverLimit(shop("shop-a"), asked(), store);

    expect(refusal?.headers.get("Retry-After")).toBe("1");
    expect(await refusal?.text()).toBe(
      "Too many documents were asked for in a short time. Try again in 1 second.",
    );
  });

  it("keeps one shop's printing from using up another's", async () => {
    const store = memoryStore();
    await spend(store, "shop-a", PAPER_SHOP_LIMIT.limit);
    expect(
      (await refusePaperOverLimit(shop("shop-a"), asked(), store))?.status,
    ).toBe(429);

    expect(
      await refusePaperOverLimit(shop("shop-b"), asked(), store),
    ).toBeNull();
    expect(store.counts.get(paperRateLimitKey("shop-b"))).toBe(1);
  });

  it("counts every kind of paper against the same allowance", async () => {
    const store = memoryStore();
    const paths = [
      "/app/transfers/t-1/document",
      "/app/transfers/t-1/pick-list",
      "/app/purchase-orders/po-1/pdf",
      "/app/purchase-orders/po-1/receiver",
      "/app/stocktakes/st-1/count-sheet",
    ];
    for (const path of paths) {
      await refusePaperOverLimit(shop("shop-a"), asked(path), store);
    }

    expect([...store.counts.entries()]).toEqual([
      [paperRateLimitKey("shop-a"), paths.length],
    ]);
  });

  it("logs the first refusal of a minute, by path and request, and not the ones after", async () => {
    const store = memoryStore();
    await spend(store, "shop-a", PAPER_SHOP_LIMIT.limit);

    await refusePaperOverLimit(shop("shop-a"), asked(), store);
    await refusePaperOverLimit(shop("shop-a"), asked(), store);
    await refusePaperOverLimit(shop("shop-a"), asked(), store);

    expect(warn).toHaveBeenCalledTimes(1);
    // The path without its query, and nothing that names the shop.
    expect(warn).toHaveBeenCalledWith("Document rate limit reached", {
      path: "/app/transfers/t-1/document",
      correlationId: "request-shop-a",
    });
  });

  it("lets a shop print when the counter cannot be reached, and says so once a minute", async () => {
    const store: RateLimitStore = {
      hit: vi.fn(async () => {
        throw new Error("rate limit store timed out after 250ms");
      }),
    };

    expect(
      await refusePaperOverLimit(shop("shop-a"), asked(), store),
    ).toBeNull();
    expect(
      await refusePaperOverLimit(shop("shop-b"), asked(), store),
    ).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "Document rate limit unavailable; allowing requests",
      { error: "rate limit store timed out after 250ms" },
    );

    vi.advanceTimersByTime(60_000);
    expect(
      await refusePaperOverLimit(shop("shop-a"), asked(), store),
    ).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
