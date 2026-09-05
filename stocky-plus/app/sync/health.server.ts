/**
 * Deterministic SyncHealth computation per architecture priority rules.
 *
 * Priority: DISABLED > FAILED > RUNNING > DEGRADED > HEALTHY > NEVER_STARTED
 */
import type { SyncHealth, SyncHealthState } from "@prisma/client";
import { getControlPlanePrisma } from "./control-plane-db.server";

const RUNNING_JOB_STATES = ["RUNNING", "DISPATCH_LEASED", "ENQUEUED"] as const;
const DEGRADED_JOB_STATES = ["RETRY_WAIT"] as const;

export type ComputeSyncHealthResult = {
  health: SyncHealth;
  state: SyncHealthState;
  detailCode: string | null;
  detailSummary: string | null;
};

export type CatalogHealthEvidence = {
  incompleteIngestionCount: number;
  unknownAuthoritativeQuantityCount: number;
  projectionPendingCount: number;
  projectionFailedCount: number;
  absenceUncertaintyCount: number;
  reconcileUncertaintyCount: number;
};

function catalogEvidenceDetail(
  evidence: CatalogHealthEvidence | undefined,
): { code: string; summary: string } | null {
  if (!evidence) return null;
  const ordered: Array<[number, string, string]> = [
    [
      evidence.incompleteIngestionCount,
      "catalog_ingestion_incomplete",
      "Catalog ingestion is incomplete",
    ],
    [
      evidence.unknownAuthoritativeQuantityCount,
      "authoritative_quantity_unknown",
      "Required Shopify authoritative quantity is unknown",
    ],
    [
      evidence.projectionFailedCount,
      "compatibility_projection_failed",
      "Compatibility projection failed",
    ],
    [
      evidence.projectionPendingCount,
      "compatibility_projection_pending",
      "Compatibility projection has not completed",
    ],
    [
      evidence.absenceUncertaintyCount,
      "absence_reconciliation_uncertain",
      "Catalog absence reconciliation is incomplete or held",
    ],
    [
      evidence.reconcileUncertaintyCount,
      "catalog_reconcile_uncertain",
      "Catalog reconciliation has unresolved diagnostic evidence",
    ],
  ];
  const match = ordered.find(([count]) => count > 0);
  return match
    ? {
        code: match[1],
        summary: `${match[2]} (${match[0]} affected facts)`,
      }
    : null;
}

function jobDomainFilter(syncDomain: string): {
  startsWith?: string;
  equals?: string;
} {
  // Domains map to jobType prefixes: webhook:orders/*, catalog, inventory, etc.
  if (syncDomain === "webhooks") {
    return { startsWith: "webhook:" };
  }
  return { equals: syncDomain };
}

/**
 * Compute and upsert SyncHealth for a shop + sync domain.
 */
export async function computeSyncHealth(
  shopId: string,
  syncDomain: string,
  options?: { catalogEvidence?: CatalogHealthEvidence },
): Promise<ComputeSyncHealthResult> {
  const prisma = getControlPlanePrisma();
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { id: true, processingEnabled: true },
  });

  let state: SyncHealthState = "NEVER_STARTED";
  let detailCode: string | null = null;
  let detailSummary: string | null = null;

  if (!shop || !shop.processingEnabled) {
    state = "DISABLED";
    detailCode = "shop_processing_disabled";
    detailSummary = "Shop processingEnabled is false";
  } else {
    const domainFilter = jobDomainFilter(syncDomain);
    const jobWhere =
      domainFilter.startsWith != null
        ? { shopId, jobType: { startsWith: domainFilter.startsWith } }
        : { shopId, jobType: domainFilter.equals! };

    const openDeadLetter = await prisma.deadLetter.findFirst({
      where: {
        shopId,
        resolutionState: "OPEN",
        durableJob: jobWhere,
      },
      orderBy: { deadLetteredAt: "desc" },
    });

    const failedSyncRun = await prisma.syncRun.findFirst({
      where: {
        shopId,
        syncDomain,
        status: "FAILED",
      },
      orderBy: { createdAt: "desc" },
    });

    const successorSuccess =
      failedSyncRun == null
        ? true
        : (await prisma.syncRun.findFirst({
            where: {
              shopId,
              syncDomain,
              status: "SUCCEEDED",
              createdAt: { gt: failedSyncRun.createdAt },
            },
          })) != null;

    if (openDeadLetter || (failedSyncRun && !successorSuccess)) {
      state = "FAILED";
      detailCode = openDeadLetter ? "open_dead_letter" : "failed_sync_run";
      detailSummary = openDeadLetter
        ? `Unresolved dead letter ${openDeadLetter.id}`
        : `Failed sync run ${failedSyncRun!.id} without successful successor`;
    } else {
      const runningJob = await prisma.durableJob.findFirst({
        where: {
          ...jobWhere,
          state: { in: [...RUNNING_JOB_STATES] },
        },
      });
      const activeAttempt = await prisma.jobAttempt.findFirst({
        where: {
          shopId,
          finishedAt: null,
          durableJob: jobWhere,
        },
      });

      if (runningJob || activeAttempt) {
        state = "RUNNING";
        detailCode = "active_work";
        detailSummary = runningJob
          ? `Job ${runningJob.id} in ${runningJob.state}`
          : `Active attempt ${activeAttempt!.id}`;
      } else {
        const retryJob = await prisma.durableJob.findFirst({
          where: {
            ...jobWhere,
            state: { in: [...DEGRADED_JOB_STATES] },
          },
        });
        const partialRun = await prisma.syncRun.findFirst({
          where: {
            shopId,
            syncDomain,
            status: "PARTIAL_FAILURE",
            completedAt: null,
          },
        });

        if (retryJob || partialRun) {
          state = "DEGRADED";
          detailCode = retryJob ? "retry_wait" : "partial_failure_sync_run";
          detailSummary = retryJob
            ? `Job ${retryJob.id} in RETRY_WAIT`
            : `Open partial-failure SyncRun ${partialRun!.id}`;
        } else {
          const evidenceDetail = catalogEvidenceDetail(
            options?.catalogEvidence,
          );
          const latestRun = await prisma.syncRun.findFirst({
            where: { shopId, syncDomain },
            orderBy: { createdAt: "desc" },
          });
          const latestJob = await prisma.durableJob.findFirst({
            where: jobWhere,
            orderBy: { createdAt: "desc" },
          });

          if (evidenceDetail) {
            state = "DEGRADED";
            detailCode = evidenceDetail.code;
            detailSummary = evidenceDetail.summary;
          } else if (
            latestRun?.status === "SUCCEEDED" ||
            latestJob?.state === "SUCCEEDED"
          ) {
            state = "HEALTHY";
            detailCode = "latest_succeeded";
            detailSummary =
              latestRun?.status === "SUCCEEDED"
                ? `SyncRun ${latestRun.id} succeeded`
                : `Job ${latestJob!.id} succeeded`;
          } else if (!latestRun && !latestJob) {
            state = "NEVER_STARTED";
            detailCode = "no_history";
            detailSummary = "No SyncRun or DurableJob for domain";
          } else {
            // History exists but not clearly healthy — treat as degraded when
            // terminal non-success without open dead letter already handled.
            state = "DEGRADED";
            detailCode = "inconclusive_history";
            detailSummary = "Latest work did not succeed";
          }
        }
      }
    }
  }

  const health = await prisma.syncHealth.upsert({
    where: {
      shopId_syncDomain: { shopId, syncDomain },
    },
    create: {
      shopId,
      syncDomain,
      state,
      detailCode,
      detailSummary: detailSummary?.slice(0, 512),
      computedAt: new Date(),
    },
    update: {
      state,
      detailCode,
      detailSummary: detailSummary?.slice(0, 512),
      computedAt: new Date(),
    },
  });

  return { health, state, detailCode, detailSummary };
}
