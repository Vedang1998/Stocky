import type { DataIssueSeverity, PrismaClient, SyncRun } from "@prisma/client";
import { getControlPlanePrisma } from "../../../sync/control-plane-db.server";
import { computeSyncHealth } from "../../../sync/health.server";
import {
  ORDER_FACTS_CURSOR_INCREMENTAL,
  ORDER_FACTS_CURSOR_SWEEP,
  ORDER_FACTS_HEALTH_DOMAIN,
  ORDER_FACTS_SYNC_DOMAIN,
} from "./constants";
import type { CoverageRecord, OrderFactsHealthEvidence } from "./types";

export async function recordOrderFactsDataIssue(input: {
  shopId: string;
  reasonCode: string;
  severity?: DataIssueSeverity;
  externalResourceType?: string | null;
  externalResourceId?: string | null;
  redactedEvidence?: Record<string, unknown>;
  prisma?: PrismaClient;
}): Promise<{ id: string }> {
  const prisma = input.prisma ?? getControlPlanePrisma();
  const row = await prisma.dataIssue.create({
    data: {
      shopId: input.shopId,
      reasonCode: input.reasonCode.slice(0, 64),
      severity: input.severity ?? "ERROR",
      externalResourceType: input.externalResourceType ?? null,
      externalResourceId: input.externalResourceId ?? null,
      redactedEvidence: input.redactedEvidence ?? undefined,
    },
  });
  return { id: row.id };
}

export async function resolveOrderFactsDataIssue(input: {
  shopId: string;
  issueId: string;
  prisma?: PrismaClient;
}): Promise<void> {
  const prisma = input.prisma ?? getControlPlanePrisma();
  await prisma.dataIssue.updateMany({
    where: { id: input.issueId, shopId: input.shopId, status: "OPEN" },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
}

export async function countOpenOrderFactsIssues(
  shopId: string,
  prisma: PrismaClient = getControlPlanePrisma(),
): Promise<number> {
  return prisma.dataIssue.count({
    where: {
      shopId,
      status: "OPEN",
      reasonCode: { startsWith: "order_facts" },
    },
  });
}

export async function readOrderFactsCursor(input: {
  shopId: string;
  domain: typeof ORDER_FACTS_CURSOR_INCREMENTAL | typeof ORDER_FACTS_CURSOR_SWEEP;
  prisma?: PrismaClient;
}): Promise<string | null> {
  const prisma = input.prisma ?? getControlPlanePrisma();
  const row = await prisma.syncCursor.findUnique({
    where: {
      shopId_syncDomain: { shopId: input.shopId, syncDomain: input.domain },
    },
  });
  return row?.cursorValue ?? null;
}

export async function persistOrderFactsCursor(input: {
  shopId: string;
  domain: typeof ORDER_FACTS_CURSOR_INCREMENTAL | typeof ORDER_FACTS_CURSOR_SWEEP;
  cursorValue: string;
  prisma?: PrismaClient;
}): Promise<void> {
  const prisma = input.prisma ?? getControlPlanePrisma();
  await prisma.syncCursor.upsert({
    where: {
      shopId_syncDomain: { shopId: input.shopId, syncDomain: input.domain },
    },
    create: {
      shopId: input.shopId,
      syncDomain: input.domain,
      cursorValue: input.cursorValue,
    },
    update: { cursorValue: input.cursorValue },
  });
}

export async function persistOrderFactsCoverageHealth(input: {
  shopId: string;
  coverage: CoverageRecord;
  evidence: OrderFactsHealthEvidence;
  prisma?: PrismaClient;
}): Promise<void> {
  void input.coverage;
  const prisma = input.prisma ?? getControlPlanePrisma();
  await computeSyncHealth(input.shopId, ORDER_FACTS_HEALTH_DOMAIN, {
    catalogEvidence: {
      incompleteIngestionCount: input.evidence.incompletePaginationCount,
      unknownAuthoritativeQuantityCount: 0,
      projectionPendingCount: 0,
      projectionFailedCount: 0,
      absenceUncertaintyCount: 0,
      reconcileUncertaintyCount:
        input.evidence.unresolvedCoverageCount +
        input.evidence.openDiagnosticIssueCount +
        input.evidence.quarantineOpenCount,
    },
  });
  void prisma;
}

export async function createOrderFactsSyncRun(input: {
  shopId: string;
  source: string;
  correlationId: string;
  prisma?: PrismaClient;
}): Promise<SyncRun> {
  const prisma = input.prisma ?? getControlPlanePrisma();
  const latest = await prisma.syncRun.findFirst({
    where: {
      shopId: input.shopId,
      syncDomain: ORDER_FACTS_SYNC_DOMAIN,
      correlationId: input.correlationId,
    },
    orderBy: { createdAt: "desc" },
  });
  if (latest && (latest.status === "PENDING" || latest.status === "RUNNING")) {
    return latest;
  }
  return prisma.syncRun.create({
    data: {
      shopId: input.shopId,
      syncDomain: ORDER_FACTS_SYNC_DOMAIN,
      source: input.source,
      status: "PENDING",
      correlationId: input.correlationId,
      startedAt: new Date(),
    },
  });
}

export async function assertShopProcessingEnabled(
  shopId: string,
  prisma: PrismaClient = getControlPlanePrisma(),
): Promise<void> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { processingEnabled: true },
  });
  if (!shop?.processingEnabled) {
    throw new Error("shop_processing_disabled");
  }
}
