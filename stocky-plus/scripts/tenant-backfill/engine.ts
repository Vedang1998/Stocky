import { createHash, randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  SHOP_DOMAIN_NORMALIZATION_VERSION,
  normalizeShopDomain,
} from "../../app/lib/shop-domain";
import { acquireApplyLock, type ApplyLockHandle } from "./apply-lock";
import {
  assertMembershipUnchanged,
  loadDatasetBoundaries,
  recomputeMembershipChecksum,
  type DatasetBoundaries,
  type TableDatasetBoundary,
} from "./boundaries";
import { checksumRows, issueFingerprint, membershipChecksum, sha256Hex } from "./checksum";
import type { OwnershipReasonCode } from "./reason-codes";
import {
  assertApprovedParentRelation,
  assertApprovedTable,
  BACKFILL_TABLE_ORDER,
  CHILD_OWNER_TABLES,
  CHILD_PARENT,
  DIAGNOSTIC_PHASES,
  DIRECT_OWNER_TABLES,
  type BackfillTableName,
  type DiagnosticPhaseName,
} from "./tables";

export type BackfillMode = "dry-run" | "apply";

export type CountMap = Record<string, number>;

export type BeforeShopIdUpdateHook = (info: {
  table: string;
  rowId: string;
  expectedShopId: string;
}) => void | Promise<void>;

export type BackfillOptions = {
  prisma: PrismaClient;
  mode: BackfillMode;
  batchSize: number;
  sourceMainSha?: string;
  schemaVersion?: string;
  resumeRunId?: string;
  onBatchCommitted?: (info: {
    tableName: string;
    lastProcessedId: string;
    examinedInBatch: number;
  }) => void | Promise<void>;
  stopAfterBatches?: number;
  /** Fault injection: throw after a successful batch commit (tests). */
  throwAfterBatchCommit?: boolean;
  /** Fault injection: throw after a named diagnostic checkpoint commits (tests). */
  throwAfterDiagnosticPhase?: DiagnosticPhaseName;
  /**
   * Test-only hook immediately before the guarded shopId UPDATE (R11).
   * Production default is absent/no-op.
   */
  onBeforeShopIdUpdate?: BeforeShopIdUpdateHook;
};

export type BackfillResult = {
  runId: string;
  mode: BackfillMode;
  status:
    | "COMPLETED"
    | "COMPLETED_WITH_ISSUES"
    | "FAILED"
    | "INTERRUPTED";
  blockingIssueCount: number;
  currentRunDetectedIssueCount: number;
  currentRunOpenIssueCount: number;
  globalOpenIssueCount: number;
  shopsWouldCreate: number;
  beforeCounts: CountMap;
  examinedCounts: CountMap;
  updatedCounts: CountMap;
  unchangedCounts: CountMap;
  unresolvedCounts: CountMap;
  checksums: Record<string, string>;
  failureSummary?: string;
};

type IssueDraft = {
  tableName: string;
  rowId: string;
  reasonCode: OwnershipReasonCode;
  currentOwnershipEvidence?: Prisma.InputJsonValue;
  conflictingOwnershipEvidence?: Prisma.InputJsonValue;
  parentLineage?: Prisma.InputJsonValue;
  sourceShopValues?: Prisma.InputJsonValue;
  proposedCanonicalShop?: string | null;
};

type RowClassificationKind =
  | "updated"
  | "unchanged"
  | "concurrently_resolved"
  | "unresolved";

export type ApplyShopIdUpdateResult =
  | { kind: "updated" }
  | { kind: "unchanged" }
  | { kind: "concurrently_resolved" }
  | { kind: "unresolved"; issue: IssueDraft };

type ProposedOwnership = {
  proposedShopId: string;
  normalizedDomain?: string;
  kind: RowClassificationKind;
};

type HighWaterMarkMap = Record<string, string | null>;

const PARENT_TABLES_WITH_LEGACY_SHOP = new Set([
  "Supplier",
  "PurchaseOrder",
  "TransferOrder",
  "Stocktake",
]);

function cuidLike(): string {
  return `c${randomBytes(12).toString("hex")}`;
}

function emptyCounts(): CountMap {
  const map: CountMap = { Shop: 0 };
  for (const t of BACKFILL_TABLE_ORDER) map[t] = 0;
  for (const phase of DIAGNOSTIC_PHASES) map[phase] = 0;
  return map;
}

function ownershipKey(table: string, rowId: string): string {
  return `${table}:${rowId}`;
}

function redactShopEvidence(raw: string): { length: number; sha256: string } {
  return { length: raw.length, sha256: sha256Hex(raw) };
}

async function countTable(prisma: PrismaClient, table: string): Promise<number> {
  assertApprovedTable(table);
  const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT COUNT(*)::bigint AS c FROM "${table}"`,
  );
  return Number(rows[0]?.c ?? 0);
}

function highWaterMarksFromBoundaries(
  boundaries: DatasetBoundaries,
): HighWaterMarkMap {
  const map: HighWaterMarkMap = {};
  for (const table of BACKFILL_TABLE_ORDER) {
    map[table] = boundaries[table]?.highWaterMark ?? null;
  }
  return map;
}

async function persistIssues(
  tx: Prisma.TransactionClient,
  runId: string,
  issues: IssueDraft[],
): Promise<{ detected: number; reopened: number }> {
  const now = new Date();
  let detected = 0;
  let reopened = 0;

  for (const issue of issues) {
    detected += 1;
    const fingerprint = issueFingerprint({
      tableName: issue.tableName,
      rowId: issue.rowId,
      reasonCode: issue.reasonCode,
    });

    const existing = await tx.tenantOwnershipIssue.findUnique({
      where: { fingerprint },
    });

    let ownershipIssueId: string;
    let reopenedIssue = false;
    let wasOpenAfterDetection = true;

    if (existing) {
      const reopen =
        existing.status === "RESOLVED"
          ? {
              status: "OPEN" as const,
              reopenedAt: now,
              reopenCount: { increment: 1 },
            }
          : { status: existing.status };

      if (existing.status === "RESOLVED") {
        reopened += 1;
        reopenedIssue = true;
      }

      const updated = await tx.tenantOwnershipIssue.update({
        where: { fingerprint },
        data: {
          lastDetectedRunId: runId,
          lastDetectedAt: now,
          currentOwnershipEvidence: issue.currentOwnershipEvidence ?? undefined,
          conflictingOwnershipEvidence:
            issue.conflictingOwnershipEvidence ?? undefined,
          parentLineage: issue.parentLineage ?? undefined,
          sourceShopValues: issue.sourceShopValues ?? undefined,
          proposedCanonicalShop: issue.proposedCanonicalShop ?? undefined,
          ...reopen,
        },
      });
      ownershipIssueId = updated.id;
      wasOpenAfterDetection = updated.status === "OPEN";
    } else {
      const created = await tx.tenantOwnershipIssue.create({
        data: {
          id: cuidLike(),
          fingerprint,
          firstDetectedRunId: runId,
          lastDetectedRunId: runId,
          tableName: issue.tableName,
          rowId: issue.rowId,
          reasonCode: issue.reasonCode,
          currentOwnershipEvidence: issue.currentOwnershipEvidence ?? undefined,
          conflictingOwnershipEvidence:
            issue.conflictingOwnershipEvidence ?? undefined,
          parentLineage: issue.parentLineage ?? undefined,
          sourceShopValues: issue.sourceShopValues ?? undefined,
          proposedCanonicalShop: issue.proposedCanonicalShop ?? undefined,
          status: "OPEN",
          firstDetectedAt: now,
          lastDetectedAt: now,
        },
      });
      ownershipIssueId = created.id;
      wasOpenAfterDetection = true;
    }

    // Durable per-run detection; unique(runId, fingerprint) prevents resume duplicates.
    const priorDetection = await tx.tenantOwnershipIssueDetection.findUnique({
      where: { runId_fingerprint: { runId, fingerprint } },
    });
    if (!priorDetection) {
      await tx.tenantOwnershipIssueDetection.create({
        data: {
          id: cuidLike(),
          runId,
          ownershipIssueId,
          fingerprint,
          detectedStatus: wasOpenAfterDetection ? "OPEN" : "RESOLVED",
          tableName: issue.tableName,
          rowId: issue.rowId,
          reasonCode: issue.reasonCode,
          detectedAt: now,
          wasOpenAfterDetection,
          reopenedIssue,
        },
      });
    }
  }

  return { detected, reopened };
}

/**
 * currentRun* counts are derived from TenantOwnershipIssueDetection (immutable per run).
 * blockingIssueCount is explicitly the current global OPEN issue count (not historical).
 * firstDetectedRunId / lastDetectedRunId remain current-state pointers on the issue row.
 */
async function countRunIssueMetrics(
  prisma: PrismaClient,
  runId: string,
): Promise<{
  blockingIssueCount: number;
  currentRunDetectedIssueCount: number;
  currentRunOpenIssueCount: number;
  globalOpenIssueCount: number;
}> {
  const [
    globalOpenIssueCount,
    currentRunDetectedIssueCount,
    currentRunOpenIssueCount,
  ] = await Promise.all([
    prisma.tenantOwnershipIssue.count({ where: { status: "OPEN" } }),
    prisma.tenantOwnershipIssueDetection.count({ where: { runId } }),
    prisma.tenantOwnershipIssueDetection.count({
      where: { runId, wasOpenAfterDetection: true },
    }),
  ]);

  return {
    blockingIssueCount: globalOpenIssueCount,
    currentRunDetectedIssueCount,
    currentRunOpenIssueCount,
    globalOpenIssueCount,
  };
}

function incrementUnresolvedForIssues(
  unresolvedCounts: CountMap,
  issues: IssueDraft[],
): void {
  for (const issue of issues) {
    unresolvedCounts[issue.tableName] =
      (unresolvedCounts[issue.tableName] ?? 0) + 1;
  }
}

function allCheckpointsComplete(
  prisma: PrismaClient,
  runId: string,
): Promise<boolean> {
  const expected = [...BACKFILL_TABLE_ORDER, ...DIAGNOSTIC_PHASES];
  return prisma.tenantBackfillCheckpoint
    .findMany({ where: { runId } })
    .then((rows) => {
      const completed = new Set(
        rows.filter((r) => r.status === "COMPLETED").map((r) => r.tableName),
      );
      return expected.every((name) => completed.has(name));
    });
}

function runFinishedClean(args: {
  blockingIssueCount: number;
  unresolvedCounts: CountMap;
  checkpointsComplete: boolean;
}): "COMPLETED" | "COMPLETED_WITH_ISSUES" {
  const unresolvedZero = Object.values(args.unresolvedCounts).every((n) => n === 0);
  if (
    args.blockingIssueCount === 0 &&
    unresolvedZero &&
    args.checkpointsComplete
  ) {
    return "COMPLETED";
  }
  return "COMPLETED_WITH_ISSUES";
}

export async function runTenantBackfill(
  options: BackfillOptions,
): Promise<BackfillResult> {
  const {
    prisma,
    mode,
    batchSize,
    sourceMainSha,
    schemaVersion,
    resumeRunId,
    onBatchCommitted,
    stopAfterBatches,
    throwAfterBatchCommit,
    throwAfterDiagnosticPhase,
    onBeforeShopIdUpdate,
  } = options;

  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
    throw new Error(`Invalid batch size ${batchSize}; expected 1..5000`);
  }

  const apply = mode === "apply";
  let applyLock: ApplyLockHandle | undefined;

  if (apply) {
    applyLock = await acquireApplyLock();
  }

  const proposedOwnership = new Map<string, ProposedOwnership>();
  const examinedCounts = emptyCounts();
  const updatedCounts = emptyCounts();
  const unchangedCounts = emptyCounts();
  const unresolvedCounts = emptyCounts();
  const checksums: Record<string, string> = {};
  let beforeCounts = emptyCounts();
  let datasetBoundaries: DatasetBoundaries = {};
  let highWaterMarks: HighWaterMarkMap = {};
  let shopsWouldCreate = 0;
  let batchesCommitted = 0;
  let runBatchSize = batchSize;

  const runId = resumeRunId ?? cuidLike();

  const baseFailureResult = (): BackfillResult => ({
    runId,
    mode,
    status: "FAILED",
    blockingIssueCount: 0,
    currentRunDetectedIssueCount: 0,
    currentRunOpenIssueCount: 0,
    globalOpenIssueCount: 0,
    shopsWouldCreate,
    beforeCounts,
    examinedCounts,
    updatedCounts,
    unchangedCounts,
    unresolvedCounts,
    checksums,
  });

  try {
    if (resumeRunId) {
      const existing = await prisma.tenantBackfillRun.findUnique({
        where: { id: resumeRunId },
      });
      if (!existing) {
        throw new Error(`Resume run not found: ${resumeRunId}`);
      }
      if (
        (existing.mode === "DRY_RUN" && mode !== "dry-run") ||
        (existing.mode === "APPLY" && mode !== "apply")
      ) {
        throw new Error("Resume run mode mismatch");
      }
      // Compatible-resume rule (F-PR1-10 / C8): original batchSize, sourceMainSha,
      // schemaVersion, and beforeCounts remain on the run record for audit.
      // Resume may use a different caller batchSize because progress is keyed by
      // lastProcessedId, not batch index.
      beforeCounts = (existing.beforeCounts as CountMap | null) ?? emptyCounts();
      runBatchSize = batchSize;

      const meta = (existing.resumeMetadata as Record<string, unknown> | null) ?? {};
      datasetBoundaries =
        (meta.datasetBoundaries as DatasetBoundaries | undefined) ??
        (await loadDatasetBoundaries(prisma));
      highWaterMarks =
        (meta.highWaterMarks as HighWaterMarkMap | undefined) ??
        highWaterMarksFromBoundaries(datasetBoundaries);

      const resumeAttempts =
        typeof meta.resumeAttempts === "number" ? meta.resumeAttempts + 1 : 1;

      // Rebuild unresolved from table checkpoints; diagnostics rehydrate separately (R10).
      for (const table of BACKFILL_TABLE_ORDER) {
        const cp = await prisma.tenantBackfillCheckpoint.findUnique({
          where: { runId_tableName: { runId, tableName: table } },
        });
        if (cp) {
          unresolvedCounts[table] = cp.unresolvedCount;
          examinedCounts[table] = cp.examinedCount;
          updatedCounts[table] = cp.updatedCount;
          unchangedCounts[table] = cp.unchangedCount;
          if (cp.checksum) checksums[table] = cp.checksum;
        }
      }

      await prisma.tenantBackfillRun.update({
        where: { id: runId },
        data: {
          status: "RUNNING",
          failureSummary: null,
          failedAt: null,
          resumeMetadata: {
            ...meta,
            highWaterMarks,
            datasetBoundaries,
            resumeAttempts,
          },
          updatedAt: new Date(),
        },
      });
    } else {
      beforeCounts.Shop = await countTable(prisma, "Shop");
      for (const table of BACKFILL_TABLE_ORDER) {
        beforeCounts[table] = await countTable(prisma, table);
      }
      datasetBoundaries = await loadDatasetBoundaries(prisma);
      highWaterMarks = highWaterMarksFromBoundaries(datasetBoundaries);

      await prisma.tenantBackfillRun.create({
        data: {
          id: runId,
          normalizationVersion: SHOP_DOMAIN_NORMALIZATION_VERSION,
          mode: apply ? "APPLY" : "DRY_RUN",
          status: "RUNNING",
          batchSize,
          startedAt: new Date(),
          sourceMainSha: sourceMainSha ?? null,
          schemaVersion: schemaVersion ?? null,
          beforeCounts,
          examinedCounts: emptyCounts(),
          updatedCounts: emptyCounts(),
          unchangedCounts: emptyCounts(),
          unresolvedCounts: emptyCounts(),
          checksums: {},
          resumeMetadata: {
            highWaterMarks,
            datasetBoundaries,
            resumeAttempts: 0,
          },
          updatedAt: new Date(),
        },
      });
    }

    const domainToShopId = new Map<string, string>();
    const discoveryIssues: IssueDraft[] = [];

    const existingShops = await prisma.shop.findMany({
      select: { id: true, myshopifyDomain: true },
    });
    for (const shop of existingShops) {
      domainToShopId.set(shop.myshopifyDomain, shop.id);
    }

    type DomainCandidate = { source: string; raw: string };
    const candidates: DomainCandidate[] = [];

    const sessions = await prisma.$queryRawUnsafe<Array<{ shop: string }>>(
      `SELECT DISTINCT shop FROM "Session" ORDER BY shop`,
    );
    for (const row of sessions) {
      candidates.push({ source: "Session", raw: row.shop });
    }

    for (const table of DIRECT_OWNER_TABLES) {
      assertApprovedTable(table);
      const rows = await prisma.$queryRawUnsafe<Array<{ shop: string }>>(
        `SELECT DISTINCT shop FROM "${table}" ORDER BY shop`,
      );
      for (const row of rows) {
        candidates.push({ source: table, raw: row.shop });
      }
    }

    for (const candidate of candidates) {
      const result = normalizeShopDomain(candidate.raw);
      if (!result.ok) {
        discoveryIssues.push({
          tableName: candidate.source,
          rowId: `domain:${createHash("sha256").update(candidate.raw).digest("hex").slice(0, 16)}`,
          reasonCode: "INVALID_SHOP_DOMAIN",
          sourceShopValues: {
            source: candidate.source,
            evidence: redactShopEvidence(candidate.raw),
            normalizeReason: result.reason,
          },
        });
        continue;
      }

      let shopId = domainToShopId.get(result.normalized);
      if (!shopId) {
        shopId = cuidLike();
        shopsWouldCreate += 1;
        if (apply) {
          await prisma.shop.upsert({
            where: { myshopifyDomain: result.normalized },
            create: {
              id: shopId,
              myshopifyDomain: result.normalized,
              updatedAt: new Date(),
            },
            update: {},
          });
          const persisted = await prisma.shop.findUniqueOrThrow({
            where: { myshopifyDomain: result.normalized },
          });
          shopId = persisted.id;
          updatedCounts.Shop += 1;
        }
        domainToShopId.set(result.normalized, shopId);
      } else {
        unchangedCounts.Shop += 1;
      }
    }

    if (discoveryIssues.length > 0) {
      await prisma.$transaction(async (tx) => {
        await persistIssues(tx, runId, discoveryIssues);
      });
    }

    for (const table of BACKFILL_TABLE_ORDER) {
      const checkpoint = await prisma.tenantBackfillCheckpoint.findUnique({
        where: { runId_tableName: { runId, tableName: table } },
      });

      if (checkpoint?.status === "COMPLETED") {
        examinedCounts[table] = checkpoint.examinedCount;
        updatedCounts[table] = checkpoint.updatedCount;
        unchangedCounts[table] = checkpoint.unchangedCount;
        unresolvedCounts[table] = checkpoint.unresolvedCount;
        if (checkpoint.checksum) checksums[table] = checkpoint.checksum;
        continue;
      }

      let lastId = checkpoint?.lastProcessedId ?? "";
      let examined = checkpoint?.examinedCount ?? 0;
      let updated = checkpoint?.updatedCount ?? 0;
      let unchanged = checkpoint?.unchangedCount ?? 0;
      let unresolved = checkpoint?.unresolvedCount ?? 0;
      const boundary = datasetBoundaries[table] ?? {
        highWaterMark: null,
        rowCount: 0,
        membershipChecksum: membershipChecksum([]),
      };
      const hwm = boundary.highWaterMark;

      await prisma.tenantBackfillCheckpoint.upsert({
        where: { runId_tableName: { runId, tableName: table } },
        create: {
          id: cuidLike(),
          runId,
          tableName: table,
          lastProcessedId: lastId || null,
          examinedCount: examined,
          updatedCount: updated,
          unchangedCount: unchanged,
          unresolvedCount: unresolved,
          status: "IN_PROGRESS",
          updatedAt: new Date(),
        },
        update: { status: "IN_PROGRESS", updatedAt: new Date() },
      });

      for (;;) {
        const batch = await fetchBatch(
          prisma,
          table,
          lastId,
          hwm,
          runBatchSize,
        );
        if (batch.length === 0) break;

        const batchResult = await prisma.$transaction(async (tx) => {
          let bUpdated = 0;
          let bUnchanged = 0;
          let bUnresolved = 0;
          const batchIssues: IssueDraft[] = [];

          for (const row of batch) {
            const outcome = await processRow({
              tx: tx as unknown as PrismaClient,
              table,
              row,
              domainToShopId,
              proposedOwnership,
              apply,
              onBeforeShopIdUpdate,
            });
            if (outcome.issue) batchIssues.push(outcome.issue);
            if (outcome.kind === "updated") bUpdated += 1;
            else if (
              outcome.kind === "unchanged" ||
              outcome.kind === "concurrently_resolved"
            ) {
              bUnchanged += 1;
            } else bUnresolved += 1;
          }

          await persistIssues(tx, runId, batchIssues);

          const newLast = String(batch[batch.length - 1]!.id);
          const nextExamined = examined + batch.length;
          const nextUpdated = updated + bUpdated;
          const nextUnchanged = unchanged + bUnchanged;
          const nextUnresolved = unresolved + bUnresolved;

          await tx.tenantBackfillCheckpoint.update({
            where: { runId_tableName: { runId, tableName: table } },
            data: {
              lastProcessedId: newLast,
              examinedCount: nextExamined,
              updatedCount: nextUpdated,
              unchangedCount: nextUnchanged,
              unresolvedCount: nextUnresolved,
              status: "IN_PROGRESS",
              updatedAt: new Date(),
            },
          });

          return {
            newLast,
            batchLen: batch.length,
            bUpdated,
            bUnchanged,
            bUnresolved,
          };
        });

        lastId = batchResult.newLast;
        examined += batchResult.batchLen;
        updated += batchResult.bUpdated;
        unchanged += batchResult.bUnchanged;
        unresolved += batchResult.bUnresolved;
        batchesCommitted += 1;

        await onBatchCommitted?.({
          tableName: table,
          lastProcessedId: lastId,
          examinedInBatch: batchResult.batchLen,
        });

        if (throwAfterBatchCommit) {
          throw new Error("Fault injection: throwAfterBatchCommit");
        }

        if (
          stopAfterBatches !== undefined &&
          batchesCommitted >= stopAfterBatches
        ) {
          examinedCounts[table] = examined;
          updatedCounts[table] = updated;
          unchangedCounts[table] = unchanged;
          unresolvedCounts[table] = unresolved;

          const metrics = await countRunIssueMetrics(prisma, runId);
          await prisma.tenantBackfillRun.update({
            where: { id: runId },
            data: {
              status: "RUNNING",
              examinedCounts,
              updatedCounts,
              unchangedCounts,
              unresolvedCounts,
              resumeMetadata: {
                highWaterMarks,
                datasetBoundaries,
                interrupted: true,
                lastTable: table,
                lastProcessedId: lastId,
                batchesCommitted,
              },
              updatedAt: new Date(),
            },
          });

          return {
            runId,
            mode,
            status: "INTERRUPTED",
            shopsWouldCreate,
            beforeCounts,
            examinedCounts,
            updatedCounts,
            unchangedCounts,
            unresolvedCounts,
            checksums,
            ...metrics,
          };
        }
      }

      const membership = await recomputeMembershipChecksum(prisma, table, hwm);
      assertMembershipUnchanged(table, boundary, membership);

      const checksum = await tableOwnershipChecksum(prisma, table, hwm);
      checksums[table] = checksum;

      examinedCounts[table] = examined;
      updatedCounts[table] = updated;
      unchangedCounts[table] = unchanged;
      unresolvedCounts[table] = unresolved;

      await prisma.tenantBackfillCheckpoint.update({
        where: { runId_tableName: { runId, tableName: table } },
        data: {
          status: "COMPLETED",
          checksum,
          examinedCount: examined,
          updatedCount: updated,
          unchangedCount: unchanged,
          unresolvedCount: unresolved,
          updatedAt: new Date(),
        },
      });
    }

    for (const phase of DIAGNOSTIC_PHASES) {
      const checkpoint = await prisma.tenantBackfillCheckpoint.findUnique({
        where: { runId_tableName: { runId, tableName: phase } },
      });

      const diagnosticIssues = await runDiagnosticPhase(
        prisma,
        phase,
        datasetBoundaries,
      );

      if (checkpoint?.status === "COMPLETED") {
        // Rehydrate unresolved contribution without skipping (R10).
        incrementUnresolvedForIssues(unresolvedCounts, diagnosticIssues);
        await prisma.$transaction(async (tx) => {
          await persistIssues(tx, runId, diagnosticIssues);
        });
        continue;
      }

      incrementUnresolvedForIssues(unresolvedCounts, diagnosticIssues);

      await prisma.$transaction(async (tx) => {
        await persistIssues(tx, runId, diagnosticIssues);
        await tx.tenantBackfillCheckpoint.upsert({
          where: { runId_tableName: { runId, tableName: phase } },
          create: {
            id: cuidLike(),
            runId,
            tableName: phase,
            examinedCount: diagnosticIssues.length,
            updatedCount: 0,
            unchangedCount: 0,
            unresolvedCount: diagnosticIssues.length,
            status: "COMPLETED",
            updatedAt: new Date(),
          },
          update: {
            examinedCount: diagnosticIssues.length,
            unresolvedCount: diagnosticIssues.length,
            status: "COMPLETED",
            updatedAt: new Date(),
          },
        });
      });

      if (throwAfterDiagnosticPhase === phase) {
        throw new Error(
          `Fault injection: throwAfterDiagnosticPhase=${phase}`,
        );
      }
    }

    // Final membership verification for every merchant table before success.
    for (const table of BACKFILL_TABLE_ORDER) {
      const boundary = datasetBoundaries[table]!;
      const membership = await recomputeMembershipChecksum(
        prisma,
        table,
        boundary.highWaterMark,
      );
      assertMembershipUnchanged(table, boundary, membership);
      checksums[table] = await tableOwnershipChecksum(
        prisma,
        table,
        boundary.highWaterMark,
      );
    }

    const shops = await prisma.shop.findMany({
      select: { id: true, myshopifyDomain: true },
      orderBy: { id: "asc" },
    });
    checksums.Shop = checksumRows(
      shops.map((s) => ({ id: s.id, myshopifyDomain: s.myshopifyDomain })),
      ["id", "myshopifyDomain"],
    );
    examinedCounts.Shop = shops.length;

    const metrics = await countRunIssueMetrics(prisma, runId);
    const checkpointsComplete = await allCheckpointsComplete(prisma, runId);
    const finalStatus = runFinishedClean({
      blockingIssueCount: metrics.blockingIssueCount,
      unresolvedCounts,
      checkpointsComplete,
    });

    await prisma.tenantBackfillRun.update({
      where: { id: runId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        examinedCounts,
        updatedCounts,
        unchangedCounts,
        unresolvedCounts,
        checksums,
        resumeMetadata: {
          highWaterMarks,
          datasetBoundaries,
          batchesCommitted,
          shopsWouldCreate,
        },
        updatedAt: new Date(),
      },
    });

    return {
      runId,
      mode,
      status: finalStatus,
      shopsWouldCreate,
      beforeCounts,
      examinedCounts,
      updatedCounts,
      unchangedCounts,
      unresolvedCounts,
      checksums,
      ...metrics,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      const metrics = await countRunIssueMetrics(prisma, runId);
      await prisma.tenantBackfillRun.update({
        where: { id: runId },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          failureSummary: message.slice(0, 2000),
          examinedCounts,
          updatedCounts,
          unchangedCounts,
          unresolvedCounts,
          checksums,
          updatedAt: new Date(),
        },
      });
      return {
        ...baseFailureResult(),
        ...metrics,
        failureSummary: message,
      };
    } catch {
      return { ...baseFailureResult(), failureSummary: message };
    }
  } finally {
    if (applyLock) {
      await applyLock.release();
    }
  }
}

async function runDiagnosticPhase(
  prisma: PrismaClient,
  phase: DiagnosticPhaseName,
  boundaries: DatasetBoundaries,
): Promise<IssueDraft[]> {
  const issues: IssueDraft[] = [];
  if (phase === "diagnostic:po_supplier") {
    await diagnosePurchaseOrderSupplierMismatch(
      prisma,
      issues,
      boundaries.PurchaseOrder ?? {
        highWaterMark: null,
        rowCount: 0,
        membershipChecksum: membershipChecksum([]),
      },
    );
  } else if (phase === "diagnostic:lead_time") {
    await diagnoseLeadTimeSnapshots(
      prisma,
      issues,
      boundaries.LeadTimeSnapshot ?? {
        highWaterMark: null,
        rowCount: 0,
        membershipChecksum: membershipChecksum([]),
      },
    );
  } else if (phase === "diagnostic:duplicate_shop_settings") {
    await detectDuplicateShopSettings(
      prisma,
      issues,
      boundaries.ShopSettings ?? {
        highWaterMark: null,
        rowCount: 0,
        membershipChecksum: membershipChecksum([]),
      },
    );
  }
  return issues;
}

type Row = Record<string, unknown> & { id: string };

async function fetchBatch(
  prisma: PrismaClient,
  table: BackfillTableName,
  afterId: string,
  highWaterMark: string | null,
  batchSize: number,
): Promise<Row[]> {
  assertApprovedTable(table);

  // Empty run boundary: process nothing even if rows appear later (R10).
  if (highWaterMark === null) {
    return [];
  }

  if ((DIRECT_OWNER_TABLES as readonly string[]).includes(table)) {
    return prisma.$queryRawUnsafe<Row[]>(
      `SELECT id, shop, "shopId" FROM "${table}"
       WHERE id > $1 AND id <= $3
       ORDER BY id ASC
       LIMIT $2`,
      afterId,
      batchSize,
      highWaterMark,
    );
  }

  const parent = CHILD_PARENT[table as (typeof CHILD_OWNER_TABLES)[number]];
  assertApprovedParentRelation(parent.parentTable, parent.parentIdColumn);

  return prisma.$queryRawUnsafe<Row[]>(
    `SELECT c.id, c."shopId", c."${parent.parentIdColumn}" AS "parentId"
     FROM "${table}" c
     WHERE c.id > $1 AND c.id <= $3
     ORDER BY c.id ASC
     LIMIT $2`,
    afterId,
    batchSize,
    highWaterMark,
  );
}

async function processRow(args: {
  tx: PrismaClient;
  table: BackfillTableName;
  row: Row;
  domainToShopId: Map<string, string>;
  proposedOwnership: Map<string, ProposedOwnership>;
  apply: boolean;
  onBeforeShopIdUpdate?: BeforeShopIdUpdateHook;
}): Promise<{ kind: RowClassificationKind; issue?: IssueDraft }> {
  const {
    tx,
    table,
    row,
    domainToShopId,
    proposedOwnership,
    apply,
    onBeforeShopIdUpdate,
  } = args;

  if ((DIRECT_OWNER_TABLES as readonly string[]).includes(table)) {
    return processDirectRow({
      tx,
      table,
      row,
      domainToShopId,
      proposedOwnership,
      apply,
      onBeforeShopIdUpdate,
    });
  }
  return processChildRow({
    tx,
    table,
    row,
    proposedOwnership,
    apply,
    onBeforeShopIdUpdate,
  });
}

async function processDirectRow(args: {
  tx: PrismaClient;
  table: BackfillTableName;
  row: Row;
  domainToShopId: Map<string, string>;
  proposedOwnership: Map<string, ProposedOwnership>;
  apply: boolean;
  onBeforeShopIdUpdate?: BeforeShopIdUpdateHook;
}): Promise<{ kind: RowClassificationKind; issue?: IssueDraft }> {
  const {
    tx,
    table,
    row,
    domainToShopId,
    proposedOwnership,
    apply,
    onBeforeShopIdUpdate,
  } = args;
  const rawShop = String(row.shop ?? "");
  const existingShopId = (row.shopId as string | null) ?? null;
  const normalized = normalizeShopDomain(rawShop);
  const key = ownershipKey(table, row.id);

  if (!normalized.ok) {
    const kind: RowClassificationKind = "unresolved";
    proposedOwnership.set(key, {
      proposedShopId: "",
      kind,
    });
    return {
      kind,
      issue: {
        tableName: table,
        rowId: row.id,
        reasonCode: "INVALID_SHOP_DOMAIN",
        sourceShopValues: {
          evidence: redactShopEvidence(rawShop),
          normalizeReason: normalized.reason,
        },
        currentOwnershipEvidence: { shopId: existingShopId },
      },
    };
  }

  const expectedShopId = domainToShopId.get(normalized.normalized);
  if (!expectedShopId) {
    const kind: RowClassificationKind = "unresolved";
    proposedOwnership.set(key, {
      proposedShopId: "",
      normalizedDomain: normalized.normalized,
      kind,
    });
    return {
      kind,
      issue: {
        tableName: table,
        rowId: row.id,
        reasonCode: "INVALID_SHOP_DOMAIN",
        sourceShopValues: {
          evidence: redactShopEvidence(rawShop),
          normalizeReason: "shop_not_materialized",
        },
        proposedCanonicalShop: normalized.normalized,
      },
    };
  }

  if (existingShopId && existingShopId !== expectedShopId) {
    const existingShop = await tx.shop.findUnique({
      where: { id: existingShopId },
      select: { id: true, myshopifyDomain: true },
    });
    const reasonCode: OwnershipReasonCode =
      existingShop && existingShop.myshopifyDomain !== normalized.normalized
        ? "CONFLICTING_NORMALIZED_DOMAIN"
        : "EXISTING_SHOP_ID_MISMATCH";
    const kind: RowClassificationKind = "unresolved";
    proposedOwnership.set(key, {
      proposedShopId: expectedShopId,
      normalizedDomain: normalized.normalized,
      kind,
    });
    return {
      kind,
      issue: {
        tableName: table,
        rowId: row.id,
        reasonCode,
        currentOwnershipEvidence: {
          shopId: existingShopId,
          existingShopDomain: existingShop?.myshopifyDomain ?? null,
        },
        conflictingOwnershipEvidence: {
          expectedShopId,
          normalizedDomain: normalized.normalized,
        },
        sourceShopValues: { evidence: redactShopEvidence(rawShop) },
        proposedCanonicalShop: normalized.normalized,
      },
    };
  }

  if (existingShopId === expectedShopId) {
    proposedOwnership.set(key, {
      proposedShopId: expectedShopId,
      normalizedDomain: normalized.normalized,
      kind: "unchanged",
    });
    return { kind: "unchanged" };
  }

  proposedOwnership.set(key, {
    proposedShopId: expectedShopId,
    normalizedDomain: normalized.normalized,
    kind: "updated",
  });

  if (!apply) {
    return { kind: "updated" };
  }

  if (onBeforeShopIdUpdate) {
    await onBeforeShopIdUpdate({
      table,
      rowId: row.id,
      expectedShopId,
    });
  }

  const affected = await applyShopIdUpdate(
    tx,
    table,
    row.id,
    expectedShopId,
  );
  if (affected.kind === "unresolved") {
    proposedOwnership.set(key, {
      proposedShopId: expectedShopId,
      normalizedDomain: normalized.normalized,
      kind: "unresolved",
    });
    return { kind: "unresolved", issue: affected.issue };
  }
  proposedOwnership.set(key, {
    proposedShopId: expectedShopId,
    normalizedDomain: normalized.normalized,
    kind: affected.kind,
  });
  return { kind: affected.kind };
}

async function processChildRow(args: {
  tx: PrismaClient;
  table: BackfillTableName;
  row: Row;
  proposedOwnership: Map<string, ProposedOwnership>;
  apply: boolean;
  onBeforeShopIdUpdate?: BeforeShopIdUpdateHook;
}): Promise<{ kind: RowClassificationKind; issue?: IssueDraft }> {
  const { tx, table, row, proposedOwnership, apply, onBeforeShopIdUpdate } =
    args;
  const parentMeta = CHILD_PARENT[table as (typeof CHILD_OWNER_TABLES)[number]];
  assertApprovedParentRelation(parentMeta.parentTable, parentMeta.parentIdColumn);
  const parentId = String(row.parentId ?? "");
  const existingShopId = (row.shopId as string | null) ?? null;

  const shopSelect = PARENT_TABLES_WITH_LEGACY_SHOP.has(parentMeta.parentTable)
    ? `, shop`
    : "";
  assertApprovedTable(parentMeta.parentTable);
  const parents = await tx.$queryRawUnsafe<
    Array<{ id: string; shopId: string | null; shop?: string }>
  >(
    `SELECT id, "shopId"${shopSelect}
     FROM "${parentMeta.parentTable}" WHERE id = $1`,
    parentId,
  );

  const parent = parents[0];
  if (!parent) {
    return {
      kind: "unresolved",
      issue: {
        tableName: table,
        rowId: row.id,
        reasonCode: "MISSING_PARENT",
        parentLineage: {
          parentTable: parentMeta.parentTable,
          parentId,
        },
        currentOwnershipEvidence: { shopId: existingShopId },
      },
    };
  }

  const parentKey = ownershipKey(parentMeta.parentTable, parent.id);
  const proposedParent = proposedOwnership.get(parentKey);
  let expectedParentShopId: string | null = parent.shopId;

  if (expectedParentShopId && proposedParent?.proposedShopId) {
    if (proposedParent.proposedShopId !== expectedParentShopId) {
      return {
        kind: "unresolved",
        issue: {
          tableName: table,
          rowId: row.id,
          reasonCode: "PARENT_CHILD_SHOP_MISMATCH",
          currentOwnershipEvidence: { shopId: existingShopId },
          conflictingOwnershipEvidence: {
            parentShopId: expectedParentShopId,
            proposedParentShopId: proposedParent.proposedShopId,
          },
          parentLineage: {
            parentTable: parentMeta.parentTable,
            parentId: parent.id,
          },
        },
      };
    }
  }

  if (!expectedParentShopId) {
    if (
      proposedParent &&
      proposedParent.kind !== "unresolved" &&
      proposedParent.proposedShopId
    ) {
      expectedParentShopId = proposedParent.proposedShopId;
    }
  }

  if (!expectedParentShopId) {
    return {
      kind: "unresolved",
      issue: {
        tableName: table,
        rowId: row.id,
        reasonCode: "PARENT_SHOP_UNRESOLVED",
        parentLineage: {
          parentTable: parentMeta.parentTable,
          parentId: parent.id,
          parentShopId: parent.shopId,
        },
        currentOwnershipEvidence: { shopId: existingShopId },
      },
    };
  }

  if (existingShopId && existingShopId !== expectedParentShopId) {
    return {
      kind: "unresolved",
      issue: {
        tableName: table,
        rowId: row.id,
        reasonCode: "PARENT_CHILD_SHOP_MISMATCH",
        currentOwnershipEvidence: { shopId: existingShopId },
        conflictingOwnershipEvidence: { parentShopId: expectedParentShopId },
        parentLineage: {
          parentTable: parentMeta.parentTable,
          parentId: parent.id,
        },
      },
    };
  }

  if (existingShopId === expectedParentShopId) {
    return { kind: "unchanged" };
  }

  if (!apply) {
    return { kind: "updated" };
  }

  if (onBeforeShopIdUpdate) {
    await onBeforeShopIdUpdate({
      table,
      rowId: row.id,
      expectedShopId: expectedParentShopId,
    });
  }

  const affected = await applyShopIdUpdate(
    tx,
    table,
    row.id,
    expectedParentShopId,
  );
  if (affected.kind === "unresolved") {
    return { kind: "unresolved", issue: affected.issue };
  }
  return { kind: affected.kind };
}

/**
 * Apply nullable→expected shopId update. On zero affected rows, re-read current
 * shopId inside the same transaction and classify (R5). Never returns unresolved
 * without a durable issue draft.
 */
export async function applyShopIdUpdate(
  tx: PrismaClient,
  table: string,
  rowId: string,
  expectedShopId: string,
): Promise<ApplyShopIdUpdateResult> {
  assertApprovedTable(table);
  const updated = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE "${table}" SET "shopId" = $1 WHERE id = $2 AND "shopId" IS NULL RETURNING id`,
    expectedShopId,
    rowId,
  );
  if (updated.length > 1) {
    throw new Error(
      `Unexpected multi-row UPDATE for ${table} id=${rowId}: affected=${updated.length}`,
    );
  }
  if (updated.length === 1) {
    const verifyRows = await tx.$queryRawUnsafe<
      Array<{ shopId: string | null }>
    >(`SELECT "shopId" FROM "${table}" WHERE id = $1`, rowId);
    if (verifyRows.length !== 1 || verifyRows[0]!.shopId !== expectedShopId) {
      throw new Error(
        `Unexpected UPDATE outcome for ${table} id=${rowId}: shopId after update is ${JSON.stringify(verifyRows[0]?.shopId)} (expected ${expectedShopId})`,
      );
    }
    return { kind: "updated" };
  }

  const currentRows = await tx.$queryRawUnsafe<
    Array<{ shopId: string | null }>
  >(`SELECT "shopId" FROM "${table}" WHERE id = $1`, rowId);

  if (currentRows.length === 0) {
    throw new Error(
      `Missing row during shopId apply for ${table} id=${rowId}: row no longer exists`,
    );
  }
  if (currentRows.length > 1) {
    throw new Error(
      `Unexpected multi-row SELECT for ${table} id=${rowId}: rows=${currentRows.length}`,
    );
  }

  const currentShopId = currentRows[0]!.shopId;
  if (currentShopId === expectedShopId) {
    return { kind: "concurrently_resolved" };
  }
  if (currentShopId == null) {
    throw new Error(
      `Unexpected UPDATE outcome for ${table} id=${rowId}: shopId remains null after zero-row update toward ${expectedShopId}`,
    );
  }
  return {
    kind: "unresolved",
    issue: {
      tableName: table,
      rowId,
      reasonCode: "CONCURRENT_SHOP_ID_CONFLICT",
      currentOwnershipEvidence: { shopId: currentShopId },
      conflictingOwnershipEvidence: { expectedShopId },
    },
  };
}

async function detectDuplicateShopSettings(
  prisma: PrismaClient,
  issues: IssueDraft[],
  boundary: TableDatasetBoundary,
): Promise<void> {
  assertApprovedTable("ShopSettings");
  if (boundary.highWaterMark === null) return;

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; shop: string }>>(
    `SELECT id, shop FROM "ShopSettings" WHERE id <= $1 ORDER BY id`,
    boundary.highWaterMark,
  );

  const byNormalized = new Map<string, Array<{ id: string; shop: string }>>();
  for (const row of rows) {
    const n = normalizeShopDomain(row.shop);
    if (!n.ok) continue;
    const list = byNormalized.get(n.normalized) ?? [];
    list.push(row);
    byNormalized.set(n.normalized, list);
  }

  for (const [normalized, group] of byNormalized) {
    if (group.length < 2) continue;
    for (const row of group) {
      issues.push({
        tableName: "ShopSettings",
        rowId: row.id,
        reasonCode: "DUPLICATE_SHOP_SETTINGS_TENANT",
        sourceShopValues: { evidence: redactShopEvidence(row.shop) },
        conflictingOwnershipEvidence: {
          normalizedDomain: normalized,
          duplicateRowIds: group.map((g) => g.id),
        },
        proposedCanonicalShop: normalized,
      });
    }
  }
}

async function diagnosePurchaseOrderSupplierMismatch(
  prisma: PrismaClient,
  issues: IssueDraft[],
  boundary: TableDatasetBoundary,
): Promise<void> {
  assertApprovedTable("PurchaseOrder");
  assertApprovedTable("Supplier");
  if (boundary.highWaterMark === null) return;

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      shop: string;
      supplierId: string;
      supplierShop: string | null;
    }>
  >(
    `SELECT po.id, po.shop, po."supplierId", s.shop AS "supplierShop"
     FROM "PurchaseOrder" po
     LEFT JOIN "Supplier" s ON s.id = po."supplierId"
     WHERE po.id <= $1
     ORDER BY po.id`,
    boundary.highWaterMark,
  );

  for (const row of rows) {
    if (!row.supplierShop) continue;
    const poNorm = normalizeShopDomain(row.shop);
    const sNorm = normalizeShopDomain(row.supplierShop);
    if (!poNorm.ok || !sNorm.ok) continue;
    if (poNorm.normalized !== sNorm.normalized) {
      issues.push({
        tableName: "PurchaseOrder",
        rowId: row.id,
        reasonCode: "PURCHASE_ORDER_SUPPLIER_SHOP_MISMATCH",
        sourceShopValues: {
          purchaseOrder: redactShopEvidence(row.shop),
          supplier: redactShopEvidence(row.supplierShop),
        },
        parentLineage: { supplierId: row.supplierId },
        conflictingOwnershipEvidence: {
          purchaseOrderNormalized: poNorm.normalized,
          supplierNormalized: sNorm.normalized,
        },
      });
    }
  }
}

async function diagnoseLeadTimeSnapshots(
  prisma: PrismaClient,
  issues: IssueDraft[],
  boundary: TableDatasetBoundary,
): Promise<void> {
  assertApprovedTable("LeadTimeSnapshot");
  assertApprovedTable("Supplier");
  assertApprovedTable("PurchaseOrder");
  if (boundary.highWaterMark === null) return;

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      supplierId: string;
      purchaseOrderId: string;
      supplierShop: string | null;
      supplierShopId: string | null;
      poShop: string | null;
      poShopId: string | null;
      poSupplierId: string | null;
    }>
  >(
    `SELECT lt.id, lt."supplierId", lt."purchaseOrderId",
            s.shop AS "supplierShop", s."shopId" AS "supplierShopId",
            po.shop AS "poShop", po."shopId" AS "poShopId",
            po."supplierId" AS "poSupplierId"
     FROM "LeadTimeSnapshot" lt
     LEFT JOIN "Supplier" s ON s.id = lt."supplierId"
     LEFT JOIN "PurchaseOrder" po ON po.id = lt."purchaseOrderId"
     WHERE lt.id <= $1
     ORDER BY lt.id`,
    boundary.highWaterMark,
  );

  for (const row of rows) {
    if (!row.poShop && row.purchaseOrderId) {
      issues.push({
        tableName: "LeadTimeSnapshot",
        rowId: row.id,
        reasonCode: "LEAD_TIME_PURCHASE_ORDER_MISSING",
        parentLineage: {
          supplierId: row.supplierId,
          purchaseOrderId: row.purchaseOrderId,
        },
      });
      continue;
    }

    if (row.supplierShop && row.poShop) {
      const sNorm = normalizeShopDomain(row.supplierShop);
      const pNorm = normalizeShopDomain(row.poShop);
      if (sNorm.ok && pNorm.ok && sNorm.normalized !== pNorm.normalized) {
        issues.push({
          tableName: "LeadTimeSnapshot",
          rowId: row.id,
          reasonCode: "LEAD_TIME_PURCHASE_ORDER_SHOP_MISMATCH",
          parentLineage: {
            supplierId: row.supplierId,
            purchaseOrderId: row.purchaseOrderId,
          },
          sourceShopValues: {
            supplier: redactShopEvidence(row.supplierShop),
            purchaseOrder: redactShopEvidence(row.poShop),
          },
          conflictingOwnershipEvidence: {
            supplierNormalized: sNorm.normalized,
            purchaseOrderNormalized: pNorm.normalized,
          },
        });
      }
    }

    if (
      row.supplierShopId &&
      row.poShopId &&
      row.supplierShopId !== row.poShopId
    ) {
      issues.push({
        tableName: "LeadTimeSnapshot",
        rowId: row.id,
        reasonCode: "LEAD_TIME_PURCHASE_ORDER_SHOP_MISMATCH",
        parentLineage: {
          supplierId: row.supplierId,
          purchaseOrderId: row.purchaseOrderId,
        },
        conflictingOwnershipEvidence: {
          supplierShopId: row.supplierShopId,
          purchaseOrderShopId: row.poShopId,
        },
      });
    }
  }
}

async function tableOwnershipChecksum(
  prisma: PrismaClient,
  table: BackfillTableName,
  highWaterMark: string | null,
): Promise<string> {
  assertApprovedTable(table);
  if (highWaterMark === null) {
    return checksumRows([], ["id", "shopId"]);
  }
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; shopId: string | null }>
  >(
    `SELECT id, "shopId" FROM "${table}" WHERE id <= $1 ORDER BY id`,
    highWaterMark,
  );
  return checksumRows(
    rows.map((r) => ({ id: r.id, shopId: r.shopId })),
    ["id", "shopId"],
  );
}

export async function getBackfillStatus(
  prisma: PrismaClient,
  runId: string,
): Promise<{
  run: Awaited<ReturnType<PrismaClient["tenantBackfillRun"]["findUnique"]>>;
  checkpoints: Awaited<
    ReturnType<PrismaClient["tenantBackfillCheckpoint"]["findMany"]>
  >;
  blockingIssueCount: number;
  globalOpenIssueCount: number;
  currentRunOpenIssueCount: number;
  currentRunDetectedIssueCount: number;
}> {
  const run = await prisma.tenantBackfillRun.findUnique({ where: { id: runId } });
  const checkpoints = await prisma.tenantBackfillCheckpoint.findMany({
    where: { runId },
    orderBy: { tableName: "asc" },
  });
  const metrics = await countRunIssueMetrics(prisma, runId);
  return { run, checkpoints, ...metrics };
}
