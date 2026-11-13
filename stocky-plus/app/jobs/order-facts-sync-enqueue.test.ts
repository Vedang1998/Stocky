/**
 * Regression tests for issue #110: nothing started the order-history import
 * after install, and the producer that existed created a new job with up to
 * 125 attempts on every call.
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
  ORDER_FACTS_SYNC_MIN_ENQUEUE_INTERVAL_MS,
  enqueueOrderFactsSync,
} from "./queue.server";

const NOW = Date.parse("2026-11-13T10:00:30.000Z");

function authority(correlationId: string): TenantAuthority {
  return {
    shopId: "shop-a",
    myshopifyDomain: "shop-a.myshopify.com",
    source: "verified_admin_request",
    correlationId,
  };
}

describe("enqueueOrderFactsSync", () => {
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

  it("queues the import when none is active or recently finished", async () => {
    const result = await enqueueOrderFactsSync(authority("install-1"));

    expect(result).toEqual({ enqueued: true });
    expect(createDurableJob).toHaveBeenCalledTimes(1);
    expect(createDurableJob).toHaveBeenCalledWith(
      expect.objectContaining({
        shopId: "shop-a",
        jobType: "order-facts-sync",
        source: "order_facts_sync",
        correlationId: "install-1",
      }),
    );
    expect(dispatchPendingJobs).toHaveBeenCalledTimes(1);
  });

  it("looks only at this shop's imports that are active or finished recently", async () => {
    await enqueueOrderFactsSync(authority("install-1"));

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        shopId: "shop-a",
        jobType: "order-facts-sync",
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
            state: "SUCCEEDED",
            createdAt: {
              gte: new Date(NOW - ORDER_FACTS_SYNC_MIN_ENQUEUE_INTERVAL_MS),
            },
          },
        ],
      },
      select: { id: true },
    });
  });

  it("does not queue another import while one is active or recently finished", async () => {
    findFirst.mockResolvedValue({ id: "job-in-flight" });

    const result = await enqueueOrderFactsSync(authority("install-2"));

    expect(result).toEqual({ enqueued: false, reason: "already_requested" });
    expect(createDurableJob).not.toHaveBeenCalled();
    expect(dispatchPendingJobs).not.toHaveBeenCalled();
  });

  it("gives concurrent requests in one minute the same idempotency key", async () => {
    await enqueueOrderFactsSync(authority("install-1"));
    vi.setSystemTime(NOW + 10_000);
    await enqueueOrderFactsSync(authority("home-sync-1"));

    const keys = createDurableJob.mock.calls.map(
      ([input]) => (input as { idempotencyKey: string }).idempotencyKey,
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toMatch(/^order-facts-sync:shop-a:\d+$/);
  });

  it("uses a new idempotency key a minute later, so a failed import can be retried", async () => {
    await enqueueOrderFactsSync(authority("install-1"));
    vi.setSystemTime(NOW + CATALOG_SYNC_MIN_ENQUEUE_INTERVAL_MS);
    await enqueueOrderFactsSync(authority("home-sync-1"));

    const [first, second] = createDurableJob.mock.calls.map(
      ([input]) => (input as { idempotencyKey: string }).idempotencyKey,
    );
    expect(first).not.toBe(second);
  });
});
