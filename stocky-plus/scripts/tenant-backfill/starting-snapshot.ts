/**
 * Coherent starting-evidence capture under one database-enforced
 * REPEATABLE READ + READ ONLY transaction (F-F01).
 *
 * `SET TRANSACTION READ ONLY` is the first SQL statement inside the
 * interactive transaction, before any snapshot/count/evidence query, and the
 * observed `transaction_isolation` / `transaction_read_only` settings are
 * verified fail-closed and persisted as evidence. Compact evidence is
 * persisted; the snapshot transaction is committed before mutation.
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
  /** Observed via current_setting inside the capture transaction (F-F01). */
  transactionIsolation: string;
  /** Observed via current_setting inside the capture transaction (F-F01). */
  transactionReadOnly: string;
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
  // F-F01: resume must preserve the original database-enforced read-only
  // snapshot identity; recapture or missing enforcement evidence fails closed.
  if (ev.transactionIsolation !== "repeatable read") {
    throw new Error(
      "Resume failed closed: startingEvidence.transactionIsolation must be 'repeatable read'",
    );
  }
  if (ev.transactionReadOnly !== "on") {
    throw new Error(
      "Resume failed closed: startingEvidence.transactionReadOnly must be 'on'",
    );
  }
  if (typeof ev.postgresSnapshot !== "string" || ev.postgresSnapshot.length === 0) {
    throw new Error(
      "Resume failed closed: startingEvidence.postgresSnapshot missing",
    );
  }
  return ev;
}

export type CaptureStartingEvidenceOptions = {
  batchSize?: number;
  /**
   * Test-only hook invoked immediately after `SET TRANSACTION READ ONLY` is
   * executed and verified (F-F01 negative-write test). Absent/no-op in every
   * operational entry point; the engine and CLI never pass it.
   */
  onSnapshotEstablished?: (tx: Prisma.TransactionClient) => Promise<void>;
};

/**
 * Capture all starting evidence inside one REPEATABLE READ, database-enforced
 * READ ONLY transaction, then commit before any mutation. Do not hold the
 * snapshot for the full backfill.
 */
export async function captureStartingEvidence(
  prisma: PrismaClient,
  options?: CaptureStartingEvidenceOptions,
): Promise<StartingEvidenceV2> {
  const batchSize = resolveSubjectEvidenceBatchSize(options?.batchSize);

  return prisma.$transaction(
    async (tx) => {
      // F-F01: database-enforced read-only — first SQL statement in the
      // transaction, before pg_current_snapshot(), counts, Shop reads,
      // Session evidence, table subject capture, and domain discovery.
      await tx.$executeRawUnsafe(`SET TRANSACTION READ ONLY`);

      const settingsRows = await tx.$queryRawUnsafe<
        Array<{
          isolation_level: string;
          transaction_read_only: string;
          snapshot: string | null;
        }>
      >(
        `SELECT
           current_setting('transaction_isolation') AS isolation_level,
           current_setting('transaction_read_only') AS transaction_read_only,
           pg_current_snapshot()::text AS snapshot`,
      );
      const observed = settingsRows[0];
      if (
        !observed ||
        observed.isolation_level !== "repeatable read" ||
        observed.transaction_read_only !== "on"
      ) {
        throw new Error(
          `Starting snapshot failed closed: expected transaction_isolation='repeatable read' ` +
            `and transaction_read_only='on'; observed isolation='${observed?.isolation_level}' ` +
            `read_only='${observed?.transaction_read_only}'`,
        );
      }
      const postgresSnapshot = observed.snapshot ?? null;

      if (options?.onSnapshotEstablished) {
        await options.onSnapshotEstablished(tx);
      }

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
        transactionIsolation: observed.isolation_level,
        transactionReadOnly: observed.transaction_read_only,
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
