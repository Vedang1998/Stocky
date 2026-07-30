import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient, Prisma } from "@prisma/client";
import {
  SHOP_DOMAIN_NORMALIZATION_VERSION,
  normalizeShopDomain,
} from "../../app/lib/shop-domain";
import { checksumRows, issueFingerprint, sha256Hex } from "./checksum";
import type { OwnershipReasonCode } from "./reason-codes";
import {
  BACKFILL_TABLE_ORDER,
  CHILD_OWNER_TABLES,
  CHILD_PARENT,
  DIRECT_OWNER_TABLES,
  TENANT_BACKFILL_ADVISORY_LOCK_KEY,
  type BackfillTableName,
} from "./tables";

export type BackfillMode = "dry-run" | "apply";

export type CountMap = Record<string, number>;

export type BackfillOptions = {
  prisma: PrismaClient;
  mode: BackfillMode;
  batchSize: number;
  sourceMainSha?: string;
  schemaVersion?: string;
  /** Resume an existing run (same mode). */
  resumeRunId?: string;
  /** Injected for interrupted-apply tests. */
  onBatchCommitted?: (info: {
    tableName: string;
    lastProcessedId: string;
    examinedInBatch: number;
  }) => void | Promise<void>;
  /** Stop after N apply batches across all tables (test interrupt). */
  stopAfterBatches?: number;
};

export type BackfillResult = {
  runId: string;
  mode: BackfillMode;
  status: "COMPLETED" | "FAILED" | "INTERRUPTED";
  beforeCounts: CountMap;
  examinedCounts: CountMap;
  updatedCounts: CountMap;
  unchangedCounts: CountMap;
  unresolvedCounts: CountMap;
  checksums: Record<string, string>;
  issueCount: number;
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

type DomainCandidate = {
  source: string;
  raw: string;
};

function cuidLike(): string {
  return `c${randomBytes(12).toString("hex")}`;
}

function emptyCounts(): CountMap {
  const map: CountMap = { Shop: 0 };
  for (const t of BACKFILL_TABLE_ORDER) map[t] = 0;
  return map;
}

async function countTable(
  prisma: PrismaClient,
  table: string,
): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT COUNT(*)::bigint AS c FROM "${table}"`,
  );
  return Number(rows[0]?.c ?? 0);
}

async function tryAdvisoryLock(prisma: PrismaClient): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ locked: boolean }>>(
    `SELECT pg_try_advisory_lock(${TENANT_BACKFILL_ADVISORY_LOCK_KEY}) AS locked`,
  );
  return Boolean(rows[0]?.locked);
}

async function releaseAdvisoryLock(prisma: PrismaClient): Promise<void> {
  await prisma.$queryRawUnsafe<Array<{ unlocked: boolean }>>(
    `SELECT pg_advisory_unlock(${TENANT_BACKFILL_ADVISORY_LOCK_KEY}) AS unlocked`,
  );
}

function redactShopEvidence(raw: string): { length: number; sha256: string } {
  return {
    length: raw.length,
    sha256: sha256Hex(raw),
  };
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
  } = options;

  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
    throw new Error(`Invalid batch size ${batchSize}; expected 1..5000`);
  }

  const apply = mode === "apply";
  let lockHeld = false;

  if (apply) {
    lockHeld = await tryAdvisoryLock(prisma);
    if (!lockHeld) {
      throw new Error(
        "Concurrent tenant backfill apply is denied (advisory lock held)",
      );
    }
  }

  const issues: IssueDraft[] = [];
  const beforeCounts = emptyCounts();
  const examinedCounts = emptyCounts();
  const updatedCounts = emptyCounts();
  const unchangedCounts = emptyCounts();
  const unresolvedCounts = emptyCounts();
  const checksums: Record<string, string> = {};
  let batchesCommitted = 0;

  const runId = resumeRunId ?? cuidLike();

  try {
    beforeCounts.Shop = await countTable(prisma, "Shop");
    for (const table of BACKFILL_TABLE_ORDER) {
      beforeCounts[table] = await countTable(prisma, table);
    }

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
      await prisma.tenantBackfillRun.update({
        where: { id: runId },
        data: {
          status: "RUNNING",
          failureSummary: null,
          failedAt: null,
        },
      });
    } else {
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
          resumeMetadata: {},
          updatedAt: new Date(),
        },
      });
    }

    // ── Discover / upsert shops from Session + direct-owner legacy shop ──
    const candidates: DomainCandidate[] = [];

    const sessions = await prisma.$queryRawUnsafe<Array<{ shop: string }>>(
      `SELECT DISTINCT shop FROM "Session" ORDER BY shop`,
    );
    for (const row of sessions) {
      candidates.push({ source: "Session", raw: row.shop });
    }

    for (const table of DIRECT_OWNER_TABLES) {
      const rows = await prisma.$queryRawUnsafe<Array<{ shop: string }>>(
        `SELECT DISTINCT shop FROM "${table}" ORDER BY shop`,
      );
      for (const row of rows) {
        candidates.push({ source: table, raw: row.shop });
      }
    }

    const domainToShopId = new Map<string, string>();
    const invalidByRaw = new Map<string, string>();

    // Load existing shops
    const existingShops = await prisma.shop.findMany({
      select: { id: true, myshopifyDomain: true },
    });
    for (const shop of existingShops) {
      domainToShopId.set(shop.myshopifyDomain, shop.id);
    }

    for (const candidate of candidates) {
      const result = normalizeShopDomain(candidate.raw);
      if (!result.ok) {
        invalidByRaw.set(candidate.raw, result.reason);
        issues.push({
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
        }
        domainToShopId.set(result.normalized, shopId);
        if (apply) updatedCounts.Shop += 1;
      } else {
        unchangedCounts.Shop += 1;
      }
    }

    // Detect ShopSettings that collide after normalization
    await detectDuplicateShopSettings(prisma, issues);

    // ── Process tables ──
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
        update: {
          status: "IN_PROGRESS",
          updatedAt: new Date(),
        },
      });

      for (;;) {
        const batch = await fetchBatch(prisma, table, lastId, batchSize);
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
              apply,
            });
            if (outcome.issue) batchIssues.push(outcome.issue);
            if (outcome.kind === "updated") bUpdated += 1;
            else if (outcome.kind === "unchanged") bUnchanged += 1;
            else bUnresolved += 1;
          }

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
            batchIssues,
          };
        });

        lastId = batchResult.newLast;
        examined += batchResult.batchLen;
        updated += batchResult.bUpdated;
        unchanged += batchResult.bUnchanged;
        unresolved += batchResult.bUnresolved;
        issues.push(...batchResult.batchIssues);
        batchesCommitted += 1;

        await onBatchCommitted?.({
          tableName: table,
          lastProcessedId: lastId,
          examinedInBatch: batchResult.batchLen,
        });

        if (stopAfterBatches !== undefined && batchesCommitted >= stopAfterBatches) {
          examinedCounts[table] = examined;
          updatedCounts[table] = updated;
          unchangedCounts[table] = unchanged;
          unresolvedCounts[table] = unresolved;

          await persistIssues(prisma, runId, issues);
          await prisma.tenantBackfillRun.update({
            where: { id: runId },
            data: {
              status: "RUNNING",
              examinedCounts,
              updatedCounts,
              unchangedCounts,
              unresolvedCounts,
              resumeMetadata: {
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
            beforeCounts,
            examinedCounts,
            updatedCounts,
            unchangedCounts,
            unresolvedCounts,
            checksums,
            issueCount: issues.length,
          };
        }
      }

      // Cross-domain diagnostics for specific tables
      if (table === "PurchaseOrder") {
        await diagnosePurchaseOrderSupplierMismatch(prisma, issues);
      }
      if (table === "LeadTimeSnapshot") {
        await diagnoseLeadTimeSnapshots(prisma, issues);
      }

      const checksum = await tableOwnershipChecksum(prisma, table);
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

    // Final shop checksum
    const shops = await prisma.shop.findMany({
      select: { id: true, myshopifyDomain: true },
      orderBy: { id: "asc" },
    });
    checksums.Shop = checksumRows(
      shops.map((s) => ({ id: s.id, myshopifyDomain: s.myshopifyDomain })),
      ["id", "myshopifyDomain"],
    );
    examinedCounts.Shop = shops.length;

    await persistIssues(prisma, runId, issues);

    const openIssues = await prisma.tenantOwnershipIssue.count({
      where: { status: "OPEN" },
    });

    await prisma.tenantBackfillRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        beforeCounts,
        examinedCounts,
        updatedCounts,
        unchangedCounts,
        unresolvedCounts,
        checksums,
        resumeMetadata: { batchesCommitted },
        updatedAt: new Date(),
      },
    });

    return {
      runId,
      mode,
      status: "COMPLETED",
      beforeCounts,
      examinedCounts,
      updatedCounts,
      unchangedCounts,
      unresolvedCounts,
      checksums,
      issueCount: openIssues,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
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
    } catch {
      // ignore secondary failure
    }
    return {
      runId,
      mode,
      status: "FAILED",
      beforeCounts,
      examinedCounts,
      updatedCounts,
      unchangedCounts,
      unresolvedCounts,
      checksums,
      issueCount: issues.length,
      failureSummary: message,
    };
  } finally {
    if (lockHeld) {
      await releaseAdvisoryLock(prisma);
    }
  }
}

async function persistIssues(
  prisma: PrismaClient,
  runId: string,
  issues: IssueDraft[],
): Promise<void> {
  const now = new Date();
  for (const issue of issues) {
    const fingerprint = issueFingerprint({
      tableName: issue.tableName,
      rowId: issue.rowId,
      reasonCode: issue.reasonCode,
    });

    const existing = await prisma.tenantOwnershipIssue.findUnique({
      where: { fingerprint },
    });

    if (existing) {
      await prisma.tenantOwnershipIssue.update({
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
          // Never silently delete; keep OPEN unless previously resolved.
          status: existing.status === "RESOLVED" ? "RESOLVED" : "OPEN",
        },
      });
    } else {
      await prisma.tenantOwnershipIssue.create({
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
    }
  }
}

type Row = Record<string, unknown> & { id: string };

async function fetchBatch(
  prisma: PrismaClient,
  table: BackfillTableName,
  afterId: string,
  batchSize: number,
): Promise<Row[]> {
  if (
    (DIRECT_OWNER_TABLES as readonly string[]).includes(table)
  ) {
    return prisma.$queryRawUnsafe<Row[]>(
      `SELECT id, shop, "shopId" FROM "${table}"
       WHERE id > $1
       ORDER BY id ASC
       LIMIT $2`,
      afterId,
      batchSize,
    );
  }

  const parent = CHILD_PARENT[table as (typeof CHILD_OWNER_TABLES)[number]];
  return prisma.$queryRawUnsafe<Row[]>(
    `SELECT c.id, c."shopId", c."${parent.parentIdColumn}" AS "parentId"
     FROM "${table}" c
     WHERE c.id > $1
     ORDER BY c.id ASC
     LIMIT $2`,
    afterId,
    batchSize,
  );
}

async function processRow(args: {
  tx: PrismaClient;
  table: BackfillTableName;
  row: Row;
  domainToShopId: Map<string, string>;
  apply: boolean;
}): Promise<{
  kind: "updated" | "unchanged" | "unresolved";
  issue?: IssueDraft;
}> {
  const { tx, table, row, domainToShopId, apply } = args;

  if ((DIRECT_OWNER_TABLES as readonly string[]).includes(table)) {
    return processDirectRow({ tx, table, row, domainToShopId, apply });
  }
  return processChildRow({ tx, table, row, apply });
}

async function processDirectRow(args: {
  tx: PrismaClient;
  table: BackfillTableName;
  row: Row;
  domainToShopId: Map<string, string>;
  apply: boolean;
}): Promise<{
  kind: "updated" | "unchanged" | "unresolved";
  issue?: IssueDraft;
}> {
  const { tx, table, row, domainToShopId, apply } = args;
  const rawShop = String(row.shop ?? "");
  const existingShopId = (row.shopId as string | null) ?? null;
  const normalized = normalizeShopDomain(rawShop);

  if (!normalized.ok) {
    return {
      kind: "unresolved",
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
    // Should not happen after discovery; treat as unresolved.
    return {
      kind: "unresolved",
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
    return {
      kind: "unresolved",
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
    return { kind: "unchanged" };
  }

  // existingShopId is null — set it
  if (apply) {
    await tx.$executeRawUnsafe(
      `UPDATE "${table}" SET "shopId" = $1 WHERE id = $2 AND "shopId" IS NULL`,
      expectedShopId,
      row.id,
    );
  }
  return { kind: "updated" };
}

async function processChildRow(args: {
  tx: PrismaClient;
  table: BackfillTableName;
  row: Row;
  apply: boolean;
}): Promise<{
  kind: "updated" | "unchanged" | "unresolved";
  issue?: IssueDraft;
}> {
  const { tx, table, row, apply } = args;
  const parentMeta = CHILD_PARENT[table as (typeof CHILD_OWNER_TABLES)[number]];
  const parentId = String(row.parentId ?? "");
  const existingShopId = (row.shopId as string | null) ?? null;

  const parents = await tx.$queryRawUnsafe<
    Array<{ id: string; shopId: string | null; shop?: string }>
  >(
    `SELECT id, "shopId"${parentMeta.parentTable === "Supplier" || parentMeta.parentTable === "PurchaseOrder" || parentMeta.parentTable === "TransferOrder" || parentMeta.parentTable === "Stocktake" ? `, shop` : ``}
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

  if (!parent.shopId) {
    return {
      kind: "unresolved",
      issue: {
        tableName: table,
        rowId: row.id,
        reasonCode: "PARENT_SHOP_UNRESOLVED",
        parentLineage: {
          parentTable: parentMeta.parentTable,
          parentId: parent.id,
          parentShopId: null,
        },
        currentOwnershipEvidence: { shopId: existingShopId },
      },
    };
  }

  if (existingShopId && existingShopId !== parent.shopId) {
    return {
      kind: "unresolved",
      issue: {
        tableName: table,
        rowId: row.id,
        reasonCode: "PARENT_CHILD_SHOP_MISMATCH",
        currentOwnershipEvidence: { shopId: existingShopId },
        conflictingOwnershipEvidence: { parentShopId: parent.shopId },
        parentLineage: {
          parentTable: parentMeta.parentTable,
          parentId: parent.id,
        },
      },
    };
  }

  if (existingShopId === parent.shopId) {
    return { kind: "unchanged" };
  }

  if (apply) {
    await tx.$executeRawUnsafe(
      `UPDATE "${table}" SET "shopId" = $1 WHERE id = $2 AND "shopId" IS NULL`,
      parent.shopId,
      row.id,
    );
  }
  return { kind: "updated" };
}

async function detectDuplicateShopSettings(
  prisma: PrismaClient,
  issues: IssueDraft[],
): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; shop: string }>
  >(`SELECT id, shop FROM "ShopSettings" ORDER BY id`);

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
): Promise<void> {
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
     ORDER BY po.id`,
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
): Promise<void> {
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
     ORDER BY lt.id`,
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
      if (
        sNorm.ok &&
        pNorm.ok &&
        sNorm.normalized !== pNorm.normalized
      ) {
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
): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; shopId: string | null }>
  >(`SELECT id, "shopId" FROM "${table}" ORDER BY id`);
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
  openIssueCount: number;
}> {
  const run = await prisma.tenantBackfillRun.findUnique({ where: { id: runId } });
  const checkpoints = await prisma.tenantBackfillCheckpoint.findMany({
    where: { runId },
    orderBy: { tableName: "asc" },
  });
  const openIssueCount = await prisma.tenantOwnershipIssue.count({
    where: { status: "OPEN" },
  });
  return { run, checkpoints, openIssueCount };
}
