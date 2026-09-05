import type { TenantAuthority } from "../../../tenant/authority.server";
import { createTenantDb } from "../../../tenant/tenant-db.server";
import { featureFlags } from "../../../lib/feature-flags.server";
import {
  computeSyncHealth,
  type CatalogHealthEvidence,
} from "../../../sync/health.server";
import { getControlPlanePrisma } from "../../../sync/control-plane-db.server";
import type { PresenceAuthorityDomain } from "./absence";

const DOMAIN_DELEGATES = {
  catalog: [
    "shopifyProductFact",
    "shopifyVariantFact",
    "shopifyInventoryItemFact",
  ],
  locations: ["shopifyLocationFact"],
  inventory_levels: ["shopifyInventoryLevelFact"],
} as const;

async function sumCounts(
  delegates: readonly string[],
  db: ReturnType<typeof createTenantDb>,
  where: Record<string, unknown>,
): Promise<number> {
  let count = 0;
  for (const name of delegates) {
    count += await (
      db as unknown as Record<string, { count(args: unknown): Promise<number> }>
    )[name]!.count({ where });
  }
  return count;
}

export async function readCatalogHealthEvidence(
  authority: TenantAuthority,
  domain: PresenceAuthorityDomain,
): Promise<CatalogHealthEvidence> {
  const db = createTenantDb(authority);
  const delegates = DOMAIN_DELEGATES[domain];
  const [
    projectionPendingCount,
    projectionFailedCount,
    absenceCandidateCount,
    freshnessDegradedCount,
    diagnosticCount,
  ] = await Promise.all([
    sumCounts(delegates, db, {
      compatibilityProjectionState: "PROJECTION_PENDING",
    }),
    sumCounts(delegates, db, {
      compatibilityProjectionState: "DEGRADED",
    }),
    sumCounts(delegates, db, {
      absenceNominationState: { not: "NONE" },
    }),
    sumCounts(delegates, db, {
      attributeFreshnessState: "DEGRADED",
    }),
    sumCounts(delegates, db, {
      existenceDiagnosticState: { not: null },
    }),
  ]);
  const unknownAuthoritativeQuantityCount =
    domain === "inventory_levels"
      ? await db.shopifyInventoryLevelFact.count({
          where: {
            existenceState: "LIVE",
            availableQuantity: null,
          },
        })
      : 0;

  const control = getControlPlanePrisma();
  const latest = await control.syncRun.findFirst({
    where: { shopId: authority.shopId, syncDomain: domain },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });
  const incompleteIngestionCount =
    latest?.status === "PARTIAL_FAILURE" ||
    latest?.status === "FAILED" ||
    latest?.status === "CANCELLED"
      ? 1
      : 0;
  const flagHeld =
    latest?.status === "SUCCEEDED" && !featureFlags.pr5AbsenceTombstone()
      ? 1
      : 0;

  return {
    incompleteIngestionCount,
    unknownAuthoritativeQuantityCount,
    projectionPendingCount,
    projectionFailedCount,
    absenceUncertaintyCount: absenceCandidateCount + flagHeld,
    reconcileUncertaintyCount: freshnessDegradedCount + diagnosticCount,
  };
}

const ISSUE_MAP: Array<{
  key: keyof CatalogHealthEvidence;
  reasonCode: string;
}> = [
  {
    key: "incompleteIngestionCount",
    reasonCode: "CATALOG_INGESTION_INCOMPLETE",
  },
  {
    key: "unknownAuthoritativeQuantityCount",
    reasonCode: "CATALOG_AUTHORITATIVE_QUANTITY_UNKNOWN",
  },
  {
    key: "projectionPendingCount",
    reasonCode: "COMPATIBILITY_PROJECTION_PENDING",
  },
  {
    key: "projectionFailedCount",
    reasonCode: "COMPATIBILITY_PROJECTION_FAILED",
  },
  {
    key: "absenceUncertaintyCount",
    reasonCode: "CATALOG_ABSENCE_RECONCILIATION_UNCERTAIN",
  },
  {
    key: "reconcileUncertaintyCount",
    reasonCode: "CATALOG_RECONCILE_UNCERTAIN",
  },
];

export async function reconcileCatalogDiagnostics(
  authority: TenantAuthority,
  domain: PresenceAuthorityDomain,
): Promise<{
  evidence: CatalogHealthEvidence;
  healthState: string;
}> {
  const evidence = await readCatalogHealthEvidence(authority, domain);
  const prisma = getControlPlanePrisma();
  for (const issue of ISSUE_MAP) {
    const count = evidence[issue.key];
    const open = await prisma.dataIssue.findFirst({
      where: {
        shopId: authority.shopId,
        reasonCode: issue.reasonCode,
        externalResourceType: domain,
        status: "OPEN",
      },
      orderBy: { detectedAt: "asc" },
    });
    if (count > 0 && !open) {
      await prisma.dataIssue.create({
        data: {
          shopId: authority.shopId,
          status: "OPEN",
          severity: "ERROR",
          reasonCode: issue.reasonCode,
          externalResourceType: domain,
          redactedEvidence: { affectedFactCount: count },
        },
      });
    } else if (count > 0 && open) {
      await prisma.dataIssue.update({
        where: { id: open.id },
        data: { redactedEvidence: { affectedFactCount: count } },
      });
    } else if (count === 0) {
      await prisma.dataIssue.updateMany({
        where: {
          shopId: authority.shopId,
          reasonCode: issue.reasonCode,
          externalResourceType: domain,
          status: "OPEN",
        },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      });
    }
  }
  const health = await computeSyncHealth(authority.shopId, domain, {
    catalogEvidence: evidence,
  });
  return { evidence, healthState: health.state };
}
