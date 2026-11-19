/**
 * The daily stock snapshot run: for every shop whose calendar day has just
 * ended, capture the stock it closed that day with.
 */
import type { TenantAuthority } from "../../tenant/authority.server";
import { readShopReportingProfile } from "../../tenant/bootstrap.server";
import { planPerShopSchedulerJobs } from "../../tenant/scheduler.server";
import { createTenantDb } from "../../tenant/tenant-db.server";
import { readCatalogSyncStatus } from "../../sync/sync-status.server";
import { AnalyticsPrerequisiteError } from "../analytics/errors";
import {
  requireShopTimeZone,
  type LocalDate,
} from "../analytics/shop-calendar";
import {
  captureStockSnapshot,
  hasStockSnapshot,
  pruneStockSnapshots,
} from "./capture.server";
import { snapshotDayDue } from "./snapshot-day";

export type SnapshotDeps = {
  /** The shop's IANA time zone, or null while Shopify's is not known. */
  readTimeZone: (tenant: TenantAuthority) => Promise<string | null>;
  /** Whether locations, catalog and inventory levels have all been imported. */
  isCatalogReady: (tenant: TenantAuthority) => Promise<boolean>;
};

const productionDeps: SnapshotDeps = {
  readTimeZone: async (tenant) =>
    (await readShopReportingProfile(tenant)).ianaTimezone,
  isCatalogReady: async (tenant) =>
    (await readCatalogSyncStatus(tenant)).every(
      (domain) => domain.lastSucceededAt !== null,
    ),
};

export type SnapshotOutcome =
  | {
      status: "captured";
      localDate: LocalDate;
      levelCount: number;
      prunedDays: number;
    }
  | { status: "already_captured"; localDate: LocalDate }
  /** The shop's last finished day ended longer ago than the capture window. */
  | { status: "not_due" }
  | { status: "time_zone_unknown" }
  /**
   * The first import has not finished. A snapshot taken now would record a
   * partly imported catalog as the day's stock, so the day is left out.
   */
  | { status: "catalog_not_ready"; localDate: LocalDate };

function knownTimeZone(timeZone: string | null): string | null {
  try {
    return requireShopTimeZone(timeZone);
  } catch (error) {
    if (error instanceof AnalyticsPrerequisiteError) return null;
    throw error;
  }
}

/** Captures the shop's just-ended day if it is due and not captured yet. */
export async function captureDueStockSnapshot(
  tenant: TenantAuthority,
  now: Date,
  deps: SnapshotDeps = productionDeps,
): Promise<SnapshotOutcome> {
  const timeZone = knownTimeZone(await deps.readTimeZone(tenant));
  if (!timeZone) return { status: "time_zone_unknown" };
  const day = snapshotDayDue(now, timeZone);
  if (!day) return { status: "not_due" };
  const { localDate } = day;

  const db = createTenantDb(tenant);
  if (await hasStockSnapshot(db, localDate)) {
    return { status: "already_captured", localDate };
  }
  if (!(await deps.isCatalogReady(tenant))) {
    return { status: "catalog_not_ready", localDate };
  }

  const result = await captureStockSnapshot(db, {
    day,
    timeZone,
    capturedAt: now,
  });
  if (!result.captured) return { status: "already_captured", localDate };
  return {
    status: "captured",
    localDate,
    levelCount: result.levelCount,
    prunedDays: await pruneStockSnapshots(db, localDate),
  };
}

export type SnapshotRunSummary = {
  shops: number;
  captured: number;
  levels: number;
  /** Shops inside their capture window that could not be captured yet. */
  waiting: number;
  failed: number;
};

/**
 * One pass over every shop that is being processed. A shop that fails is
 * reported and does not stop the others; it is tried again on the next pass
 * for as long as its capture window is open.
 */
export async function runDailyStockSnapshots(
  input: { now?: Date; deps?: SnapshotDeps } = {},
): Promise<SnapshotRunSummary> {
  const summary: SnapshotRunSummary = {
    shops: 0,
    captured: 0,
    levels: 0,
    waiting: 0,
    failed: 0,
  };
  for (const shop of await planPerShopSchedulerJobs()) {
    summary.shops += 1;
    try {
      const outcome = await captureDueStockSnapshot(
        shop.tenant,
        input.now ?? new Date(),
        input.deps,
      );
      if (outcome.status === "captured") {
        summary.captured += 1;
        summary.levels += outcome.levelCount;
      } else if (
        outcome.status === "time_zone_unknown" ||
        outcome.status === "catalog_not_ready"
      ) {
        summary.waiting += 1;
      }
    } catch (error) {
      summary.failed += 1;
      console.error(
        `Daily stock snapshot failed for ${shop.myshopifyDomain}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  return summary;
}
