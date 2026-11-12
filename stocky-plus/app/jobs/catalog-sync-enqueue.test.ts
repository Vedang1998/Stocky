/**
 * Regression tests for the attack-test finding that one shop could queue an
 * unbounded number of full catalog syncs: every "Sync catalog" request
 * created its own durable job with up to 125 attempts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, createDurableJob, dispatchPendingJobs } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  createDurableJob: vi.fn(),
  dispatchPendingJobs: vi.fn(),
}));

vi.mock("../sync/control-plane-db.server", () => ({
  getControlPlanePrisma: () => ({ durableJob: { findFirst } }),
}));
vi.mock("../sync/intake.server", () => ({ createDurableJob }));
vi.mock("../sync/dispatcher.server", () => ({ dispatchPendingJobs }));
// Authorities can only be issued inside app/tenant; the producer's authority
// check is covered by app/tenant/__tests__/queue-redis.test.ts.
vi.mock("../tenant/authority.server", () => ({
  isTenantAuthority: () => true,
}));

import type { TenantAuthority } from "../tenant/authority.server";
import {
  CATALOG_SYNC_MIN_ENQUEUE_INTERVAL_MS,
  enqueueCatalogSync,
} from "./queue.server";

const NOW = Date.parse("2026-11-11T10:00:30.000Z");

function authority(correlationId: string): TenantAuthority {
  return {
    shopId: "shop-a",
    myshopifyDomain: "shop-a.myshopify.com",
    source: "verified_admin_request",
    correlationId,
  };
}

describe("enqueueCatalogSync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    findFirst.mockReset();
    findFirst.mockResolvedValue(null);
    createDurableJob.mockReset();
    createDurableJob.mockResolvedValue({ id: "job-1" });
    dispatchPendingJobs.mockReset();
    dispatchPendingJobs.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queues a sync when none is active or recent", async () => {
    const result = await enqueueCatalogSync(authority("request-1"));

    expect(result).toEqual({ enqueued: true });
    expect(createDurableJob).toHaveBeenCalledTimes(1);
    expect(createDurableJob).toHaveBeenCalledWith(
      expect.objectContaining({
        shopId: "shop-a",
        jobType: "catalog-sync",
        source: "catalog_sync",
        correlationId: "request-1",
      }),
    );
    expect(dispatchPendingJobs).toHaveBeenCalledTimes(1);
  });

  it("looks only at this shop's catalog syncs that are active or recent", async () => {
    await enqueueCatalogSync(authority("request-1"));

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        shopId: "shop-a",
        jobType: "catalog-sync",
        OR: [
          {
            state: {
              in: [
                "PENDING",
                "RETRY_WAIT",
                "DISPATCH_LEASED",
                "ENQUEUED",
                "RUNNING",
              ],
            },
          },
          {
            createdAt: {
              gte: new Date(NOW - CATALOG_SYNC_MIN_ENQUEUE_INTERVAL_MS),
            },
          },
        ],
      },
      select: { id: true },
    });
  });

  it("does not queue another sync while one is active or recent", async () => {
    findFirst.mockResolvedValue({ id: "job-in-flight" });

    const result = await enqueueCatalogSync(authority("request-2"));

    expect(result).toEqual({ enqueued: false, reason: "already_requested" });
    expect(createDurableJob).not.toHaveBeenCalled();
    expect(dispatchPendingJobs).not.toHaveBeenCalled();
  });

  it("gives concurrent requests in one interval the same idempotency key", async () => {
    await enqueueCatalogSync(authority("request-1"));
    vi.setSystemTime(NOW + 20_000);
    await enqueueCatalogSync(authority("request-2"));

    const keys = createDurableJob.mock.calls.map(
      ([input]) => (input as { idempotencyKey: string }).idempotencyKey,
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toMatch(/^catalog-sync:shop-a:\d+$/);
  });

  it("uses a new idempotency key once the interval has passed", async () => {
    await enqueueCatalogSync(authority("request-1"));
    vi.setSystemTime(NOW + CATALOG_SYNC_MIN_ENQUEUE_INTERVAL_MS);
    await enqueueCatalogSync(authority("request-2"));

    const [first, second] = createDurableJob.mock.calls.map(
      ([input]) => (input as { idempotencyKey: string }).idempotencyKey,
    );
    expect(first).not.toBe(second);
  });
});
