/**
 * Read-only sync status for merchant-facing pages.
 *
 * Reads SyncHealth, SyncRun and DurableJob for the shop named by a branded
 * TenantAuthority and nothing else. The control-plane client is not tenant
 * scoped, so every query here filters on authority.shopId. Internal detail
 * (job IDs, failure summaries) stays in the control plane; callers get a
 * state, a reason code and a timestamp.
 */
import type { SyncHealthState } from "@prisma/client";
import {
  assertTenantAuthority,
  type TenantAuthority,
} from "../tenant/authority.server";
import { getControlPlanePrisma } from "./control-plane-db.server";

/** Domains the catalog sync fills, in the order it runs them. */
export const CATALOG_SYNC_DOMAINS = [
  "locations",
  "catalog",
  "inventory_levels",
] as const;

export type CatalogSyncDomain = (typeof CATALOG_SYNC_DOMAINS)[number];

/** The one job type that fills every catalog domain (jobs/queue.server.ts). */
const CATALOG_SYNC_JOB_TYPE = "catalog-sync";

// RETRY_WAIT is included: a catalog sync waits in it between polls of
// Shopify's bulk export, so it is still working.
const UNFINISHED_JOB_STATES = [
  "PENDING",
  "DISPATCH_LEASED",
  "ENQUEUED",
  "RUNNING",
  "RETRY_WAIT",
] as const;

export type SyncDomainStatus = {
  domain: CatalogSyncDomain;
  state: SyncHealthState;
  detailCode: string | null;
  lastSucceededAt: Date | null;
  /**
   * A catalog sync is queued or running and has not finished this domain.
   * SyncHealth is recomputed only when a sync ends, so it cannot say this.
   */
  syncing: boolean;
};

export async function readCatalogSyncStatus(
  authority: TenantAuthority,
): Promise<SyncDomainStatus[]> {
  assertTenantAuthority(authority);
  const prisma = getControlPlanePrisma();
  const shopId = authority.shopId;

  const [health, unfinishedJob, lastSuccesses] = await Promise.all([
    prisma.syncHealth.findMany({
      where: { shopId, syncDomain: { in: [...CATALOG_SYNC_DOMAINS] } },
      select: { syncDomain: true, state: true, detailCode: true },
    }),
    prisma.durableJob.findFirst({
      where: {
        shopId,
        jobType: CATALOG_SYNC_JOB_TYPE,
        state: { in: [...UNFINISHED_JOB_STATES] },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    Promise.all(
      CATALOG_SYNC_DOMAINS.map((syncDomain) =>
        prisma.syncRun.findFirst({
          where: { shopId, syncDomain, status: "SUCCEEDED" },
          orderBy: { createdAt: "desc" },
          select: { completedAt: true },
        }),
      ),
    ),
  ]);

  return CATALOG_SYNC_DOMAINS.map((domain, index) => {
    const row = health.find((h) => h.syncDomain === domain);
    const lastSucceededAt = lastSuccesses[index]?.completedAt ?? null;
    return {
      domain,
      state: row?.state ?? "NEVER_STARTED",
      detailCode: row?.detailCode ?? null,
      lastSucceededAt,
      // The sync fills the domains one after another; a domain is done once
      // it has succeeded since the newest unfinished job was created.
      syncing:
        unfinishedJob !== null &&
        (lastSucceededAt === null || lastSucceededAt < unfinishedJob.createdAt),
    };
  });
}
