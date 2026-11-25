import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantAuthority } from "../../tenant/authority.server";
import type { SyncDomainStatus } from "../../sync/sync-status.server";

const mocks = vi.hoisted(() => ({
  readShopReportingProfile: vi.fn(),
  readCatalogSyncStatus: vi.fn(),
  hasStockSnapshot: vi.fn(),
  captureStockSnapshot: vi.fn(),
  pruneStockSnapshots: vi.fn(),
}));

vi.mock("../../tenant/bootstrap.server", () => ({
  readShopReportingProfile: mocks.readShopReportingProfile,
}));
vi.mock("../../tenant/scheduler.server", () => ({
  planPerShopSchedulerJobs: vi.fn(),
}));
vi.mock("../../tenant/tenant-db.server", () => ({
  createTenantDb: (authority: TenantAuthority) => ({ authority }),
}));
vi.mock("../../sync/sync-status.server", () => ({
  readCatalogSyncStatus: mocks.readCatalogSyncStatus,
}));
vi.mock("./capture.server", () => ({
  hasStockSnapshot: mocks.hasStockSnapshot,
  captureStockSnapshot: mocks.captureStockSnapshot,
  pruneStockSnapshots: mocks.pruneStockSnapshots,
}));

import { captureDueStockSnapshot } from "./daily-run.server";

const TENANT = {
  shopId: "shop_1",
  myshopifyDomain: "example.myshopify.com",
  source: "verified_scheduler",
  correlationId: "corr_1",
} as TenantAuthority;

/** 00:10 on 20 Nov in New York. */
const NOW = new Date("2026-11-20T05:10:00Z");

function domains(
  lastSucceeded: Record<SyncDomainStatus["domain"], Date | null>,
): SyncDomainStatus[] {
  return (["locations", "catalog", "inventory_levels"] as const).map(
    (domain) => ({
      domain,
      state: lastSucceeded[domain] ? "HEALTHY" : "RUNNING",
      detailCode: null,
      lastSucceededAt: lastSucceeded[domain],
      syncing: false,
    }),
  );
}

const IMPORTED = new Date("2026-11-01T00:00:00Z");

describe("captureDueStockSnapshot with the app's own readers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.readShopReportingProfile.mockResolvedValue({
      ianaTimezone: "America/New_York",
      currencyCode: "USD",
      installedAt: IMPORTED,
    });
    mocks.readCatalogSyncStatus.mockResolvedValue(
      domains({
        locations: IMPORTED,
        catalog: IMPORTED,
        inventory_levels: IMPORTED,
      }),
    );
    mocks.hasStockSnapshot.mockResolvedValue(false);
    mocks.captureStockSnapshot.mockResolvedValue({
      captured: true,
      levelCount: 12,
    });
    mocks.pruneStockSnapshots.mockResolvedValue(1);
  });

  it("captures in Shopify's time zone for the shop once every import has finished", async () => {
    expect(await captureDueStockSnapshot(TENANT, NOW)).toEqual({
      status: "captured",
      localDate: "2026-11-19",
      levelCount: 12,
      prunedDays: 1,
    });
    expect(mocks.captureStockSnapshot).toHaveBeenCalledWith(
      { authority: TENANT },
      {
        day: {
          localDate: "2026-11-19",
          dayEndedAt: new Date("2026-11-20T05:00:00Z"),
        },
        timeZone: "America/New_York",
        capturedAt: NOW,
      },
    );
    expect(mocks.pruneStockSnapshots).toHaveBeenCalledWith(
      { authority: TENANT },
      "2026-11-19",
    );
  });

  it.each(["locations", "catalog", "inventory_levels"] as const)(
    "does not capture before the first %s import has succeeded",
    async (missing) => {
      mocks.readCatalogSyncStatus.mockResolvedValue(
        domains({
          locations: IMPORTED,
          catalog: IMPORTED,
          inventory_levels: IMPORTED,
          [missing]: null,
        }),
      );

      expect(await captureDueStockSnapshot(TENANT, NOW)).toEqual({
        status: "catalog_not_ready",
        localDate: "2026-11-19",
      });
      expect(mocks.captureStockSnapshot).not.toHaveBeenCalled();
    },
  );

  it("does not capture before Shopify's time zone for the shop is known", async () => {
    mocks.readShopReportingProfile.mockResolvedValue({
      ianaTimezone: null,
      currencyCode: null,
      installedAt: IMPORTED,
    });

    expect(await captureDueStockSnapshot(TENANT, NOW)).toEqual({
      status: "time_zone_unknown",
    });
    expect(mocks.hasStockSnapshot).not.toHaveBeenCalled();
    expect(mocks.captureStockSnapshot).not.toHaveBeenCalled();
  });

  it("reads nothing more once the day is known to be captured", async () => {
    mocks.hasStockSnapshot.mockResolvedValue(true);

    expect(await captureDueStockSnapshot(TENANT, NOW)).toEqual({
      status: "already_captured",
      localDate: "2026-11-19",
    });
    expect(mocks.readCatalogSyncStatus).not.toHaveBeenCalled();
    expect(mocks.captureStockSnapshot).not.toHaveBeenCalled();
  });

  it("does not prune when another worker captured the day first", async () => {
    mocks.captureStockSnapshot.mockResolvedValue({ captured: false });

    expect(await captureDueStockSnapshot(TENANT, NOW)).toEqual({
      status: "already_captured",
      localDate: "2026-11-19",
    });
    expect(mocks.pruneStockSnapshots).not.toHaveBeenCalled();
  });

  it("lets a failed capture reach the caller", async () => {
    mocks.captureStockSnapshot.mockRejectedValue(new Error("connection lost"));

    await expect(captureDueStockSnapshot(TENANT, NOW)).rejects.toThrow(
      "connection lost",
    );
  });
});
