/**
 * Regression tests for the attack-test finding that the afterAuth hook queued
 * a full catalog sync on every token exchange. With expiring offline tokens
 * that is about once an hour for a shop in use, and each job has up to 125
 * attempts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findShop, findFirst, createDurableJob, dispatchPendingJobs } =
  vi.hoisted(() => ({
    findShop: vi.fn(),
    findFirst: vi.fn(),
    createDurableJob: vi.fn(),
    dispatchPendingJobs: vi.fn(),
  }));

vi.mock("../sync/control-plane-db.server", () => ({
  getControlPlanePrisma: () => ({
    shop: { findUnique: findShop },
    durableJob: { findFirst },
  }),
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
  AFTER_AUTH_CATALOG_SYNC_MIN_INTERVAL_MS,
  enqueueAfterAuthCatalogSync,
} from "./queue.server";

const NOW = Date.parse("2026-11-14T10:00:30.000Z");

function authority(correlationId: string): TenantAuthority {
  return {
    shopId: "shop-a",
    myshopifyDomain: "shop-a.myshopify.com",
    source: "verified_admin_request",
    correlationId,
  };
}

describe("enqueueAfterAuthCatalogSync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    findShop.mockReset();
    findShop.mockResolvedValue({ reinstalledAt: null });
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

  it("queues a sync for a shop with none active or recently finished", async () => {
    const result = await enqueueAfterAuthCatalogSync(authority("auth-1"));

    expect(result).toEqual({ enqueued: true });
    expect(createDurableJob).toHaveBeenCalledTimes(1);
    expect(createDurableJob).toHaveBeenCalledWith(
      expect.objectContaining({
        shopId: "shop-a",
        jobType: "catalog-sync",
        source: "after_auth_catalog_sync",
        sanitizedPayload: { shopId: "shop-a", reason: "after_auth" },
        correlationId: "auth-1",
      }),
    );
    expect(dispatchPendingJobs).toHaveBeenCalledTimes(1);
  });

  it("looks only at this shop's catalog syncs that are active or finished recently", async () => {
    await enqueueAfterAuthCatalogSync(authority("auth-1"));

    expect(findShop).toHaveBeenCalledWith({
      where: { id: "shop-a" },
      select: { reinstalledAt: true },
    });
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
            state: "SUCCEEDED",
            createdAt: {
              gte: new Date(NOW - AFTER_AUTH_CATALOG_SYNC_MIN_INTERVAL_MS),
            },
          },
        ],
      },
      select: { id: true },
    });
  });

  it("does not count a sync that succeeded before the shop was reinstalled", async () => {
    const reinstalledAt = new Date(NOW - 30 * 60 * 1000);
    findShop.mockResolvedValue({ reinstalledAt });

    await enqueueAfterAuthCatalogSync(authority("auth-1"));

    const [{ where }] = findFirst.mock.calls[0] as [
      { where: { OR: unknown[] } },
    ];
    expect(where.OR[1]).toEqual({
      state: "SUCCEEDED",
      createdAt: { gte: reinstalledAt },
    });
  });

  it("keeps the interval when the reinstall is older than it", async () => {
    findShop.mockResolvedValue({
      reinstalledAt: new Date(
        NOW - 2 * AFTER_AUTH_CATALOG_SYNC_MIN_INTERVAL_MS,
      ),
    });

    await enqueueAfterAuthCatalogSync(authority("auth-1"));

    const [{ where }] = findFirst.mock.calls[0] as [
      { where: { OR: unknown[] } },
    ];
    expect(where.OR[1]).toEqual({
      state: "SUCCEEDED",
      createdAt: {
        gte: new Date(NOW - AFTER_AUTH_CATALOG_SYNC_MIN_INTERVAL_MS),
      },
    });
  });

  it("does not queue another sync while one is active or recently finished", async () => {
    findFirst.mockResolvedValue({ id: "job-in-flight" });

    const result = await enqueueAfterAuthCatalogSync(authority("auth-2"));

    expect(result).toEqual({ enqueued: false, reason: "already_requested" });
    expect(createDurableJob).not.toHaveBeenCalled();
    expect(dispatchPendingJobs).not.toHaveBeenCalled();
  });

  it("gives token exchanges in the same minute the same idempotency key", async () => {
    await enqueueAfterAuthCatalogSync(authority("auth-1"));
    vi.setSystemTime(NOW + 20_000);
    await enqueueAfterAuthCatalogSync(authority("auth-2"));

    const keys = createDurableJob.mock.calls.map(
      ([input]) => (input as { idempotencyKey: string }).idempotencyKey,
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toMatch(/^after-auth-catalog-sync:shop-a:\d+$/);
  });

  it("uses a new idempotency key a minute later, so a failed sync can be retried", async () => {
    await enqueueAfterAuthCatalogSync(authority("auth-1"));
    vi.setSystemTime(NOW + 60_000);
    await enqueueAfterAuthCatalogSync(authority("auth-2"));

    const [first, second] = createDurableJob.mock.calls.map(
      ([input]) => (input as { idempotencyKey: string }).idempotencyKey,
    );
    expect(first).not.toBe(second);
  });
});
