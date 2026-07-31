/**
 * Coherent starting-evidence capture under one REPEATABLE READ transaction.
 * Compact evidence is persisted; the RR transaction is committed before mutation.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  SHOP_DOMAIN_NORMALIZATION_VERSION,
  normalizeShopDomain,
} from "../../app/lib/shop-domain";
import { checksumRows, sha256Hex } from "./checksum";
import {
  type DatasetBoundaries,
  type SessionSubjectEvidence,
  type TableSubjectEvidence,
  loadDatasetBoundaries,
  resolveSubjectEvidenceBatchSize,
  streamDirectOwnerDistinctShops,
  streamSessionSubjectEvidence,
} from "./subject-evidence";
import { TENANT_SUBJECT_EVIDENCE_VERSION } from "./subject-manifest";
import {
  BACKFILL_TABLE_ORDER,
  DIRECT_OWNER_TABLES,
  type BackfillTableName,
} from "./tables";

export type ShopStartingSnapshot = {
  rowCount: number;
  domains: string[];
  checksum: string;
  rows: Array<{ id: string; myshopifyDomain: string }>;
};

export type DomainDiscoveryEvidence = {
  validNormalizedDomains: string[];
  invalidIssues: Array<{
    tableName: string;
    rowId: string;
    reasonCode: "INVALID_SHOP_DOMAIN";
    sourceShopValues: Prisma.InputJsonValue;
  }>;
  shopsWouldCreatePredicted: number;
  directOwnerRawShops: Record<string, string[]>;
};

export type StartingEvidenceV2 = {
  evidenceVersion: typeof TENANT_SUBJECT_EVIDENCE_VERSION;
  domainNormalizationVersion: typeof SHOP_DOMAIN_NORMALIZATION_VERSION;
  capturedAt: string;
  postgresSnapshot: string | null;
  beforeCounts: Record<string, number>;
  shopSnapshot: ShopStartingSnapshot;
  sessionEvidence: SessionSubjectEvidence;
  tables: DatasetBoundaries;
  domainDiscovery: DomainDiscoveryEvidence;
};

function redactShopEvidence(raw: string): {
  length: number;
  sha256Prefix: string;
} {
  return {
    length: raw.length,
    sha256Prefix: sha256Hex(raw).slice(0, 16),
  };
}

async function countTable(
  db: { $queryRawUnsafe: PrismaClient["$queryRawUnsafe"] },
  table: string,
): Promise<number> {
  const rows = await db.$queryRawUnsafe<Array<{ c: bigint | number }>>(
    `SELECT COUNT(*)::bigint AS c FROM "${table}"`,
  );
  return Number(rows[0]?.c ?? 0);
}

export function boundariesFromStartingEvidence(
  evidence: StartingEvidenceV2,
): DatasetBoundaries {
  return evidence.tables;
}

export function highWaterMarksFromBoundaries(
  boundaries: DatasetBoundaries,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const table of BACKFILL_TABLE_ORDER) {
    out[table] = boundaries[table]?.highWaterMark ?? null;
  }
  return out;
}

export function parseStartingEvidence(
  value: unknown,
): StartingEvidenceV2 {
  if (!value || typeof value !== "object") {
    throw new Error(
      "Resume failed closed: startingEvidence is absent or malformed (required phase1-tenant-subject-v2)",
    );
  }
  const ev = value as StartingEvidenceV2;
  if (ev.evidenceVersion !== TENANT_SUBJECT_EVIDENCE_VERSION) {
    throw new Error(
      `Resume failed closed: startingEvidence.evidenceVersion must be ${TENANT_SUBJECT_EVIDENCE_VERSION}`,
    );
  }
  if (!ev.tables || !ev.sessionEvidence || !ev.shopSnapshot || !ev.domainDiscovery) {
    throw new Error(
      "Resume failed closed: startingEvidence missing tables, sessionEvidence, shopSnapshot, or domainDiscovery",
    );
  }
  for (const table of BACKFILL_TABLE_ORDER) {
    const t = ev.tables[table] as TableSubjectEvidence | undefined;
    if (
      !t ||
      t.evidenceVersion !== TENANT_SUBJECT_EVIDENCE_VERSION ||
      typeof t.subjectDigest !== "string" ||
      typeof t.rowCount !== "number"
    ) {
      throw new Error(
        `Resume failed closed: startingEvidence.tables.${table} missing or malformed`,
      );
    }
  }
  if (
    ev.sessionEvidence.evidenceVersion !== TENANT_SUBJECT_EVIDENCE_VERSION ||
    typeof ev.sessionEvidence.subjectDigest !== "string"
  ) {
    throw new Error(
      "Resume failed closed: startingEvidence.sessionEvidence malformed",
    );
  }
  if (typeof ev.domainDiscovery.shopsWouldCreatePredicted !== "number") {
    throw new Error(
      "Resume failed closed: domainDiscovery.shopsWouldCreatePredicted missing",
    );
  }
  return ev;
}

/**
 * Capture all starting evidence inside one REPEATABLE READ transaction, then
 * commit before any mutation. Do not hold the snapshot for the full backfill.
 */
export async function captureStartingEvidence(
  prisma: PrismaClient,
  options?: { batchSize?: number },
): Promise<StartingEvidenceV2> {
  const batchSize = resolveSubjectEvidenceBatchSize(options?.batchSize);

  return prisma.$transaction(
    async (tx) => {
      const snapRows = await tx.$queryRawUnsafe<
        Array<{ snapshot: string | null }>
      >(`SELECT pg_current_snapshot()::text AS snapshot`);
      const postgresSnapshot = snapRows[0]?.snapshot ?? null;

      const beforeCounts: Record<string, number> = {};
      beforeCounts.Shop = await countTable(tx, "Shop");
      for (const table of BACKFILL_TABLE_ORDER) {
        beforeCounts[table] = await countTable(tx, table);
      }

      const shopRows = await tx.$queryRawUnsafe<
        Array<{ id: string; myshopifyDomain: string }>
      >(
        `SELECT id, "myshopifyDomain" FROM "Shop" ORDER BY id COLLATE "C" ASC`,
      );
      const shopSnapshot: ShopStartingSnapshot = {
        rowCount: shopRows.length,
        domains: shopRows
          .map((r) => r.myshopifyDomain)
          .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
        checksum: checksumRows(
          shopRows.map((r) => ({
            id: r.id,
            myshopifyDomain: r.myshopifyDomain,
          })),
          ["id", "myshopifyDomain"],
        ),
        rows: shopRows,
      };

      const sessionEvidence = await streamSessionSubjectEvidence(tx, {
        batchSize,
        normalizeShopDomain,
      });

      const tables = await loadDatasetBoundaries(tx, batchSize);

      const existingDomains = new Set(shopSnapshot.domains);
      const validNormalized = new Set<string>();
      const invalidIssues: DomainDiscoveryEvidence["invalidIssues"] = [];
      const directOwnerRawShops: Record<string, string[]> = {};

      for (const domain of sessionEvidence.normalizedDomains) {
        validNormalized.add(domain);
      }
      for (const inv of sessionEvidence.invalidCandidates) {
        invalidIssues.push({
          tableName: "Session",
          rowId: `domain:${inv.evidence.sha256Prefix}`,
          reasonCode: "INVALID_SHOP_DOMAIN",
          sourceShopValues: {
            source: "Session",
            evidence: inv.evidence,
            normalizeReason: inv.normalizeReason,
          },
        });
      }

      for (const table of DIRECT_OWNER_TABLES) {
        const hwm = tables[table]!.highWaterMark;
        const rawShops = await streamDirectOwnerDistinctShops(tx, table, hwm);
        directOwnerRawShops[table] = rawShops;
        for (const raw of rawShops) {
          const result = normalizeShopDomain(raw);
          if (!result.ok) {
            invalidIssues.push({
              tableName: table,
              rowId: `domain:${sha256Hex(raw).slice(0, 16)}`,
              reasonCode: "INVALID_SHOP_DOMAIN",
              sourceShopValues: {
                source: table,
                evidence: redactShopEvidence(raw),
                normalizeReason: result.reason,
              },
            });
            continue;
          }
          validNormalized.add(result.normalized);
        }
      }

      const validNormalizedDomains = [...validNormalized].sort((a, b) =>
        a < b ? -1 : a > b ? 1 : 0,
      );
      let shopsWouldCreatePredicted = 0;
      for (const domain of validNormalizedDomains) {
        if (!existingDomains.has(domain)) {
          shopsWouldCreatePredicted += 1;
        }
      }

      const evidence: StartingEvidenceV2 = {
        evidenceVersion: TENANT_SUBJECT_EVIDENCE_VERSION,
        domainNormalizationVersion: SHOP_DOMAIN_NORMALIZATION_VERSION,
        capturedAt: new Date().toISOString(),
        postgresSnapshot,
        beforeCounts,
        shopSnapshot,
        sessionEvidence,
        tables,
        domainDiscovery: {
          validNormalizedDomains,
          invalidIssues,
          shopsWouldCreatePredicted,
          directOwnerRawShops,
        },
      };
      return evidence;
    },
    {
      isolationLevel: "RepeatableRead",
      maxWait: 15_000,
      timeout: 180_000,
    },
  );
}

export function tableBoundaryOrEmpty(
  boundaries: DatasetBoundaries,
  table: BackfillTableName,
): TableSubjectEvidence {
  return (
    boundaries[table] ?? {
      evidenceVersion: TENANT_SUBJECT_EVIDENCE_VERSION,
      evidenceColumns: [],
      rowCount: 0,
      highWaterMark: null,
      subjectDigest: sha256Hex("empty"),
    }
  );
}
