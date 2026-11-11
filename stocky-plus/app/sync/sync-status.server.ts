/**
 * Read-only sync status for merchant-facing pages.
 *
 * Reads SyncHealth and SyncRun for the shop named by a branded
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

export type SyncDomainStatus = {
  domain: CatalogSyncDomain;
  state: SyncHealthState;
  detailCode: string | null;
  lastSucceededAt: Date | null;
};

export async function readCatalogSyncStatus(
  authority: TenantAuthority,
): Promise<SyncDomainStatus[]> {
  assertTenantAuthority(authority);
  const prisma = getControlPlanePrisma();
  const shopId = authority.shopId;

  const [health, lastSuccesses] = await Promise.all([
    prisma.syncHealth.findMany({
      where: { shopId, syncDomain: { in: [...CATALOG_SYNC_DOMAINS] } },
      select: { syncDomain: true, state: true, detailCode: true },
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
    return {
      domain,
      state: row?.state ?? "NEVER_STARTED",
      detailCode: row?.detailCode ?? null,
      lastSucceededAt: lastSuccesses[index]?.completedAt ?? null,
    };
  });
}
