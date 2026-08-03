/**
 * Coherent starting-evidence capture under one database-enforced
 * REPEATABLE READ + READ ONLY transaction (F-F01).
 *
 * `SET TRANSACTION READ ONLY` is the first SQL statement inside the
 * interactive transaction, before any snapshot/count/evidence query, and the
 * observed `transaction_isolation` / `transaction_read_only` settings are
 * verified fail-closed and persisted as evidence. Compact, bounded evidence
 * is persisted (F-F02); the snapshot transaction is committed before mutation.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  SHOP_DOMAIN_NORMALIZATION_VERSION,
  normalizeShopDomain,
} from "../../app/tenant/shop-domain";
import { checksumRows, sha256Hex } from "./checksum";
import {
  EvidenceCapacityError,
  assertEvidenceBudgetCompatible,
  assertSerializedWithinBudget,
  resolveEvidenceBudget,
  type TenantEvidenceBudget,
} from "./evidence-budget";
import type { OwnershipReasonCode } from "./reason-codes";
import {
  SourceDomainEvidenceCollector,
  loadDatasetBoundaries,
  resolveSubjectEvidenceBatchSize,
  streamDistinctShopValues,
  streamSessionSubjectEvidence,
  type DatasetBoundaries,
  type SessionSubjectEvidence,
  type SourceDomainEvidence,
  type TableSubjectEvidence,
} from "./subject-evidence";
import { TENANT_SUBJECT_EVIDENCE_VERSION } from "./subject-manifest";
import {
  BACKFILL_TABLE_ORDER,
  DIRECT_OWNER_TABLES,
  type BackfillTableName,
} from "./tables";

/**
 * Bounded Shop starting snapshot (F-F02): row count, digest over ordered
 * (id, myshopifyDomain), and the domain-to-ID map required by the backfill —
 * only within the explicit supported ceiling. No redundant full arrays.
 */
export type ShopStartingSnapshot = {
  rowCount: number;
  checksum: string;
  domainToShopId: Record<string, string>;
  supportedCeiling: number;
  serializedBytes: number;
};

export type ValidDomainEvidence = {
  /** Deterministic count of the complete valid normalized-domain set. */
  count: number;
  /** Deterministic SHA-256 digest over the ordered normalized-domain set. */
  digest: string;
  /**
   * Complete canonical normalized-domain set required by the backfill,
   * bounded by evidenceBudget.maxNormalizedDomains (fail closed if exceeded —
   * never silently truncated).
   */
  domains: string[];
  sampleTruncated: boolean;
  omittedCount: number;
};

export type InvalidDomainEvidence = {
  /** Total invalid distinct values detected across all sources. */
  totalDetected: number;
  /** SHA-256 over ordered per-source redacted evidence digests. */
  digest: string;
  issueCeiling: number;
  /** Always false on a successful capture — overflow fails closed. */
  overflowed: boolean;
};

export type DomainDiscoveryEvidence = {
  validDomains: ValidDomainEvidence;
  invalidDomains: InvalidDomainEvidence;
  /** Keyed by "Session" and each direct-owner table. */
  perSource: Record<string, SourceDomainEvidence>;
  shopsWouldCreatePredicted: number;
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
  /** Versioned evidence budget active at capture (resume-compatibility input). */
  evidenceBudget: TenantEvidenceBudget;
  /** Configured capture timeout active for this run (F-F04). */
  captureTimeoutMs: number;
  /** Per-phase capture telemetry in milliseconds (F-F04). */
  phaseTimingsMs: Record<string, number>;
  beforeCounts: Record<string, number>;
  shopSnapshot: ShopStartingSnapshot;
  sessionEvidence: SessionSubjectEvidence;
  tables: DatasetBoundaries;
  domainDiscovery: DomainDiscoveryEvidence;
};

// ─── Starting-snapshot capture timeout (F-F04) ──────────────────────────────

export const DEFAULT_STARTING_SNAPSHOT_TIMEOUT_MS = 180_000;
export const MIN_STARTING_SNAPSHOT_TIMEOUT_MS = 10_000;
export const MAX_STARTING_SNAPSHOT_TIMEOUT_MS = 1_800_000;

/**
 * Resolve TENANT_STARTING_SNAPSHOT_TIMEOUT_MS with strict integer parsing and
 * documented bounds. Invalid values fail BEFORE the snapshot transaction opens.
 * The timeout remains finite — the bound cannot be disabled.
 */
export function resolveStartingSnapshotTimeoutMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.TENANT_STARTING_SNAPSHOT_TIMEOUT_MS?.trim();
  if (raw === undefined || raw === "") {
    return DEFAULT_STARTING_SNAPSHOT_TIMEOUT_MS;
  }
  if (!/^\d+$/.test(raw)) {
    throw new Error(
      `TENANT_STARTING_SNAPSHOT_TIMEOUT_MS must be a strict integer milliseconds value (got ${JSON.stringify(raw)})`,
    );
  }
  const value = Number(raw);
  if (
    !Number.isSafeInteger(value) ||
    value < MIN_STARTING_SNAPSHOT_TIMEOUT_MS ||
    value > MAX_STARTING_SNAPSHOT_TIMEOUT_MS
  ) {
    throw new Error(
      `TENANT_STARTING_SNAPSHOT_TIMEOUT_MS=${raw} outside accepted bounds [${MIN_STARTING_SNAPSHOT_TIMEOUT_MS}..${MAX_STARTING_SNAPSHOT_TIMEOUT_MS}]`,
    );
  }
  return value;
}

export type DiscoveryIssueDraft = {
  tableName: string;
  rowId: string;
  reasonCode: OwnershipReasonCode;
  sourceShopValues: Prisma.InputJsonValue;
};

export type CapturedStartingEvidence = {
  evidence: StartingEvidenceV2;
  /**
   * Transient, bounded (evidenceBudget.maxDiscoveryIssues) invalid-domain
   * issue drafts. Persisted as durable TenantOwnershipIssue records by the
   * engine AFTER the read-only snapshot commits — never stored inside
   * resumeMetadata.
   */
  discoveryIssueDrafts: DiscoveryIssueDraft[];
};

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
  // F-F02: bounded evidence structures are required for resume.
  if (
    !ev.shopSnapshot.domainToShopId ||
    typeof ev.shopSnapshot.domainToShopId !== "object" ||
    typeof ev.shopSnapshot.rowCount !== "number" ||
    typeof ev.shopSnapshot.checksum !== "string"
  ) {
    throw new Error(
      "Resume failed closed: startingEvidence.shopSnapshot.domainToShopId missing or malformed",
    );
  }
  const valid = ev.domainDiscovery.validDomains;
  if (
    !valid ||
    !Array.isArray(valid.domains) ||
    typeof valid.count !== "number" ||
    typeof valid.digest !== "string" ||
    valid.count !== valid.domains.length
  ) {
    throw new Error(
      "Resume failed closed: domainDiscovery.validDomains missing or inconsistent",
    );
  }
  if (!ev.domainDiscovery.invalidDomains || !ev.domainDiscovery.perSource) {
    throw new Error(
      "Resume failed closed: domainDiscovery.invalidDomains/perSource missing",
    );
  }
  for (const source of ["Session", ...DIRECT_OWNER_TABLES]) {
    const s = ev.domainDiscovery.perSource[source];
    if (
      !s ||
      typeof s.redactedEvidenceDigest !== "string" ||
      typeof s.distinctRawShopCount !== "number"
    ) {
      throw new Error(
        `Resume failed closed: domainDiscovery.perSource.${source} missing or malformed`,
      );
    }
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
  // F-F02: configured budget must be compatible with the original run.
  assertEvidenceBudgetCompatible(ev.evidenceBudget, resolveEvidenceBudget());
  // F-F04: recorded capture timeout must exist within documented bounds.
  // Resume never recaptures, so compatibility means the original recorded
  // configuration is present and valid.
  if (
    typeof ev.captureTimeoutMs !== "number" ||
    !Number.isSafeInteger(ev.captureTimeoutMs) ||
    ev.captureTimeoutMs < MIN_STARTING_SNAPSHOT_TIMEOUT_MS ||
    ev.captureTimeoutMs > MAX_STARTING_SNAPSHOT_TIMEOUT_MS
  ) {
    throw new Error(
      "Resume failed closed: startingEvidence.captureTimeoutMs missing or outside documented bounds",
    );
  }
  if (!ev.phaseTimingsMs || typeof ev.phaseTimingsMs !== "object") {
    throw new Error(
      "Resume failed closed: startingEvidence.phaseTimingsMs missing",
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
): Promise<CapturedStartingEvidence> {
  const batchSize = resolveSubjectEvidenceBatchSize(options?.batchSize);
  // Budget and timeout resolve (and fail on invalid configuration) BEFORE the
  // transaction opens (F-F02 / F-F04).
  const budget = resolveEvidenceBudget();
  const captureTimeoutMs = resolveStartingSnapshotTimeoutMs();

  // Phase telemetry (F-F04): per-phase elapsed time, safe failure diagnostics.
  const captureStartNs = process.hrtime.bigint();
  const phaseTimingsMs: Record<string, number> = {};
  let currentPhase = "transaction_init";
  let phaseStartNs = captureStartNs;
  const enterPhase = (name: string): void => {
    const now = process.hrtime.bigint();
    phaseTimingsMs[currentPhase] =
      (phaseTimingsMs[currentPhase] ?? 0) + Number(now - phaseStartNs) / 1e6;
    currentPhase = name;
    phaseStartNs = now;
  };

  try {
    return await captureStartingEvidenceInTransaction(prisma, {
      batchSize,
      budget,
      captureTimeoutMs,
      phaseTimingsMs,
      enterPhase,
      onSnapshotEstablished: options?.onSnapshotEstablished,
    });
  } catch (error) {
    // Safe diagnostic only: phase, elapsed, configured timeout, evidence
    // version, table where applicable. Never raw merchant domains, database
    // URLs, or credentials.
    const elapsedMs = Number(process.hrtime.bigint() - captureStartNs) / 1e6;
    const tableName = currentPhase.includes(":")
      ? currentPhase.split(":")[1]
      : null;
    const prismaCode = (error as { code?: string }).code;
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        event: "tenant_starting_snapshot_failure",
        phase: currentPhase,
        elapsedMs,
        configuredTimeoutMs: captureTimeoutMs,
        evidenceVersion: TENANT_SUBJECT_EVIDENCE_VERSION,
        tableName,
        errorName: error instanceof Error ? error.name : "unknown",
        prismaErrorCode:
          typeof prismaCode === "string" && /^P\d{4}$/.test(prismaCode)
            ? prismaCode
            : null,
      }),
    );
    throw error;
  }
}

type CaptureInternalOptions = {
  batchSize: number;
  budget: TenantEvidenceBudget;
  captureTimeoutMs: number;
  phaseTimingsMs: Record<string, number>;
  enterPhase: (name: string) => void;
  onSnapshotEstablished?: (tx: Prisma.TransactionClient) => Promise<void>;
};

async function captureStartingEvidenceInTransaction(
  prisma: PrismaClient,
  opts: CaptureInternalOptions,
): Promise<CapturedStartingEvidence> {
  const {
    batchSize,
    budget,
    captureTimeoutMs,
    phaseTimingsMs,
    enterPhase,
  } = opts;

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

      if (opts.onSnapshotEstablished) {
        await opts.onSnapshotEstablished(tx);
      }

      enterPhase("before_counts");
      const beforeCounts: Record<string, number> = {};
      beforeCounts.Shop = await countTable(tx, "Shop");
      for (const table of BACKFILL_TABLE_ORDER) {
        beforeCounts[table] = await countTable(tx, table);
      }

      enterPhase("shop_evidence");
      // F-F02: enforce the supported Shop ceiling BEFORE loading rows.
      if (beforeCounts.Shop > budget.maxShops) {
        throw new EvidenceCapacityError({
          kind: "shops",
          ceiling: budget.maxShops,
          detectedCount: beforeCounts.Shop,
          detail: `canonical Shop table has ${beforeCounts.Shop} rows`,
        });
      }
      const shopRows = await tx.$queryRawUnsafe<
        Array<{ id: string; myshopifyDomain: string }>
      >(
        `SELECT id, "myshopifyDomain" FROM "Shop" ORDER BY id COLLATE "C" ASC`,
      );
      const domainToShopId: Record<string, string> = {};
      for (const row of shopRows) {
        domainToShopId[row.myshopifyDomain] = row.id;
      }
      const shopSnapshot: ShopStartingSnapshot = {
        rowCount: shopRows.length,
        checksum: checksumRows(
          shopRows.map((r) => ({
            id: r.id,
            myshopifyDomain: r.myshopifyDomain,
          })),
          ["id", "myshopifyDomain"],
        ),
        domainToShopId,
        supportedCeiling: budget.maxShops,
        serializedBytes: Buffer.byteLength(
          JSON.stringify(domainToShopId),
          "utf8",
        ),
      };

      enterPhase("session_evidence");
      const sessionEvidence = await streamSessionSubjectEvidence(tx, {
        batchSize,
      });

      enterPhase("table_subject_evidence");
      const tables = await loadDatasetBoundaries(tx, batchSize);

      // Bounded streaming domain discovery (F-F02): counters, incremental
      // digests, bounded samples; never a complete raw-domain array.
      enterPhase("domain_discovery");
      const validNormalized = new Set<string>();
      let validOverflowCount = 0;
      let invalidTotalDetected = 0;
      const discoveryIssueDrafts: DiscoveryIssueDraft[] = [];
      const perSource: Record<string, SourceDomainEvidence> = {};

      const observeValue = (source: string) => {
        const collector = new SourceDomainEvidenceCollector(
          budget.maxSamplesPerSource,
          budget.maxNormalizedDomains,
        );
        const observe = (raw: string) => {
          const result = normalizeShopDomain(raw);
          collector.observe(raw, result);
          if (result.ok) {
            if (validNormalized.size < budget.maxNormalizedDomains) {
              validNormalized.add(result.normalized);
            } else if (!validNormalized.has(result.normalized)) {
              validOverflowCount += 1;
            }
          } else {
            invalidTotalDetected += 1;
            if (discoveryIssueDrafts.length < budget.maxDiscoveryIssues) {
              discoveryIssueDrafts.push({
                tableName: source,
                rowId: `domain:${sha256Hex(raw).slice(0, 16)}`,
                reasonCode: "INVALID_SHOP_DOMAIN",
                sourceShopValues: {
                  source,
                  evidence: {
                    length: raw.length,
                    sha256Prefix: sha256Hex(raw).slice(0, 16),
                  },
                  normalizeReason: result.reason,
                },
              });
            }
          }
        };
        return { collector, observe };
      };

      {
        const { collector, observe } = observeValue("Session");
        await streamDistinctShopValues(
          tx,
          "Session",
          sessionEvidence.highWaterMark,
          batchSize,
          observe,
        );
        perSource.Session = collector.finish(sessionEvidence.rowCount);
      }
      for (const table of DIRECT_OWNER_TABLES) {
        const { collector, observe } = observeValue(table);
        await streamDistinctShopValues(
          tx,
          table,
          tables[table]!.highWaterMark,
          batchSize,
          observe,
        );
        perSource[table] = collector.finish(tables[table]!.rowCount);
      }

      // Fail closed on capacity overflow — never silently truncate the
      // operational subject and never allow a clean run with omitted issues.
      if (validOverflowCount > 0) {
        throw new EvidenceCapacityError({
          kind: "normalized_domains",
          ceiling: budget.maxNormalizedDomains,
          detectedCount: validNormalized.size + validOverflowCount,
          detail:
            "complete valid normalized-domain set required by the backfill exceeds the configured ceiling " +
            "(at least the reported count; overflow values counted without storage)",
        });
      }
      if (invalidTotalDetected > budget.maxDiscoveryIssues) {
        throw new EvidenceCapacityError({
          kind: "discovery_issues",
          ceiling: budget.maxDiscoveryIssues,
          detectedCount: invalidTotalDetected,
          detail: "invalid shop-domain values exceed the discovery-issue ceiling",
        });
      }

      const validNormalizedDomains = [...validNormalized].sort((a, b) =>
        a < b ? -1 : a > b ? 1 : 0,
      );
      let shopsWouldCreatePredicted = 0;
      for (const domain of validNormalizedDomains) {
        if (!(domain in domainToShopId)) {
          shopsWouldCreatePredicted += 1;
        }
      }

      const invalidDigestHash = sha256Hex(
        ["Session", ...DIRECT_OWNER_TABLES]
          .map((source) => `${source}:${perSource[source]!.redactedEvidenceDigest}`)
          .join("\n"),
      );

      enterPhase("final_serialization");
      const evidence: StartingEvidenceV2 = {
        evidenceVersion: TENANT_SUBJECT_EVIDENCE_VERSION,
        domainNormalizationVersion: SHOP_DOMAIN_NORMALIZATION_VERSION,
        capturedAt: new Date().toISOString(),
        transactionIsolation: observed.isolation_level,
        transactionReadOnly: observed.transaction_read_only,
        postgresSnapshot,
        evidenceBudget: budget,
        captureTimeoutMs,
        phaseTimingsMs: { ...phaseTimingsMs },
        beforeCounts,
        shopSnapshot,
        sessionEvidence,
        tables,
        domainDiscovery: {
          validDomains: {
            count: validNormalizedDomains.length,
            digest: sha256Hex(validNormalizedDomains.join("\n")),
            domains: validNormalizedDomains,
            sampleTruncated: false,
            omittedCount: 0,
          },
          invalidDomains: {
            totalDetected: invalidTotalDetected,
            digest: invalidDigestHash,
            issueCeiling: budget.maxDiscoveryIssues,
            overflowed: false,
          },
          perSource,
          shopsWouldCreatePredicted,
        },
      };

      // F-F02: serialized byte budget enforced before any run-record persist.
      assertSerializedWithinBudget("startingEvidence", evidence, budget);

      // Close final_serialization phase timing before returning.
      enterPhase("done");
      evidence.phaseTimingsMs = { ...phaseTimingsMs };
      delete evidence.phaseTimingsMs.done;

      return { evidence, discoveryIssueDrafts };
    },
    {
      isolationLevel: "RepeatableRead",
      maxWait: 15_000,
      timeout: captureTimeoutMs,
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
