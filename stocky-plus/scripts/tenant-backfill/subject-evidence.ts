/**
 * Streaming subject-evidence capture and verification (phase1-tenant-subject-v2).
 *
 * Bounded keyset scans + incremental SHA-256. Does not materialize full ID arrays.
 * Database ORDER BY id COLLATE "C" is authoritative — never JS localeCompare.
 */
import { createHash, type Hash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { canonicalJson, sha256Hex } from "./checksum";
import {
  SESSION_SUBJECT_EVIDENCE_COLUMNS,
  TENANT_SUBJECT_EVIDENCE_VERSION,
  subjectEvidenceColumnsFor,
} from "./subject-manifest";
import {
  assertApprovedTable,
  BACKFILL_TABLE_ORDER,
  type BackfillTableName,
} from "./tables";

/** Prisma interactive transaction client (subset used for raw SQL). */
export type EvidenceDb = {
  $queryRawUnsafe: PrismaClient["$queryRawUnsafe"];
};

export const DEFAULT_SUBJECT_EVIDENCE_BATCH_SIZE = 500;

export type TableSubjectEvidence = {
  evidenceVersion: typeof TENANT_SUBJECT_EVIDENCE_VERSION;
  evidenceColumns: string[];
  rowCount: number;
  highWaterMark: string | null;
  subjectDigest: string;
};

export type DatasetBoundaries = Record<string, TableSubjectEvidence>;

/** @deprecated alias — historical name; fields are subject evidence digests. */
export type TableDatasetBoundary = TableSubjectEvidence;

export function resolveSubjectEvidenceBatchSize(
  explicit?: number,
): number {
  if (explicit !== undefined) {
    if (!Number.isInteger(explicit) || explicit < 1 || explicit > 10_000) {
      throw new Error(
        `Invalid subject evidence batch size ${explicit}; expected 1..10000`,
      );
    }
    return explicit;
  }
  const fromEnv = process.env.TENANT_SUBJECT_EVIDENCE_BATCH_SIZE?.trim();
  if (fromEnv) {
    const n = Number(fromEnv);
    if (!Number.isInteger(n) || n < 1 || n > 10_000) {
      throw new Error(
        `Invalid TENANT_SUBJECT_EVIDENCE_BATCH_SIZE=${fromEnv}; expected 1..10000`,
      );
    }
    return n;
  }
  return DEFAULT_SUBJECT_EVIDENCE_BATCH_SIZE;
}

function quoteIdent(column: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(column)) {
    throw new Error(`Refusing to quote unsafe SQL identifier: ${column}`);
  }
  return `"${column}"`;
}

function selectList(columns: readonly string[]): string {
  return columns.map(quoteIdent).join(", ");
}

function initSubjectHash(columns: readonly string[]): Hash {
  const hash = createHash("sha256");
  hash.update(TENANT_SUBJECT_EVIDENCE_VERSION, "utf8");
  hash.update("\n", "utf8");
  hash.update(columns.join(","), "utf8");
  hash.update("\n", "utf8");
  return hash;
}

function feedRow(
  hash: Hash,
  columns: readonly string[],
  row: Record<string, unknown>,
): void {
  const picked: Record<string, unknown> = {};
  for (const field of columns) {
    const value = row[field] ?? null;
    if (value instanceof Date) {
      picked[field] = value.toISOString();
    } else if (typeof value === "bigint") {
      picked[field] = value.toString();
    } else {
      picked[field] = value;
    }
  }
  hash.update(canonicalJson(picked), "utf8");
  hash.update("\n", "utf8");
}

/**
 * Stream subject evidence for one merchant table.
 * When highWaterMarkBound is undefined, scan the full table (starting capture).
 * When highWaterMarkBound is null, the subject is empty (verify empty).
 * When highWaterMarkBound is a string, restrict to id <= bound (COLLATE "C").
 */
export async function streamTableSubjectEvidence(
  db: EvidenceDb,
  table: BackfillTableName,
  options: {
    batchSize: number;
    highWaterMarkBound?: string | null;
  },
): Promise<TableSubjectEvidence> {
  assertApprovedTable(table);
  const columns = subjectEvidenceColumnsFor(table);
  const batchSize = options.batchSize;
  const bound = options.highWaterMarkBound;

  if (bound === null) {
    return {
      evidenceVersion: TENANT_SUBJECT_EVIDENCE_VERSION,
      evidenceColumns: [...columns],
      rowCount: 0,
      highWaterMark: null,
      subjectDigest: initSubjectHash(columns).digest("hex"),
    };
  }

  const hash = initSubjectHash(columns);
  let rowCount = 0;
  let lastId: string | null = null;
  let afterId = "";

  for (;;) {
    const colsSql = selectList(columns);
    let rows: Array<Record<string, unknown>>;
    if (bound === undefined) {
      rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT ${colsSql} FROM "${table}"
         WHERE id > $1
         ORDER BY id COLLATE "C" ASC
         LIMIT $2`,
        afterId,
        batchSize,
      );
    } else {
      rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT ${colsSql} FROM "${table}"
         WHERE id > $1 AND id <= $2
         ORDER BY id COLLATE "C" ASC
         LIMIT $3`,
        afterId,
        bound,
        batchSize,
      );
    }

    if (rows.length === 0) break;

    for (const row of rows) {
      feedRow(hash, columns, row);
      rowCount += 1;
      lastId = String(row.id);
    }
    afterId = lastId!;
    if (rows.length < batchSize) break;
  }

  return {
    evidenceVersion: TENANT_SUBJECT_EVIDENCE_VERSION,
    evidenceColumns: [...columns],
    rowCount,
    highWaterMark: lastId,
    subjectDigest: hash.digest("hex"),
  };
}

export async function loadDatasetBoundaries(
  db: EvidenceDb,
  batchSize?: number,
): Promise<DatasetBoundaries> {
  const size = resolveSubjectEvidenceBatchSize(batchSize);
  const map: DatasetBoundaries = {};
  for (const table of BACKFILL_TABLE_ORDER) {
    map[table] = await streamTableSubjectEvidence(db, table, {
      batchSize: size,
    });
  }
  return map;
}

export async function recomputeSubjectEvidence(
  db: EvidenceDb,
  table: BackfillTableName,
  highWaterMark: string | null,
  batchSize?: number,
): Promise<TableSubjectEvidence> {
  return streamTableSubjectEvidence(db, table, {
    batchSize: resolveSubjectEvidenceBatchSize(batchSize),
    highWaterMarkBound: highWaterMark,
  });
}

/** @deprecated name retained for call sites — recomputes subject digest. */
export async function recomputeMembershipChecksum(
  db: EvidenceDb,
  table: BackfillTableName,
  highWaterMark: string | null,
  batchSize?: number,
): Promise<TableSubjectEvidence> {
  return recomputeSubjectEvidence(db, table, highWaterMark, batchSize);
}

export function assertSubjectEvidenceUnchanged(
  table: string,
  expected: TableSubjectEvidence,
  actual: TableSubjectEvidence,
): void {
  if (
    actual.rowCount !== expected.rowCount ||
    actual.subjectDigest !== expected.subjectDigest ||
    actual.highWaterMark !== expected.highWaterMark ||
    actual.evidenceVersion !== expected.evidenceVersion
  ) {
    throw new Error(
      `Dataset drift detected for ${table}: subject evidence inside the original ` +
        `run boundary changed (expected count=${expected.rowCount} digest=${expected.subjectDigest}; ` +
        `actual count=${actual.rowCount} digest=${actual.subjectDigest}). ` +
        `Insertion, deletion, or same-ID replacement that changes subject-evidence ` +
        `fields (${expected.evidenceColumns.join(", ")}) inside the original high-water mark fails closed.`,
    );
  }
}

/** @deprecated alias */
export const assertMembershipUnchanged = assertSubjectEvidenceUnchanged;

/** SQL fragment + params for id <= boundary (empty boundary → WHERE false). */
export function boundaryPredicate(
  highWaterMark: string | null,
  idColumnSql: string,
  nextParamIndex: number,
): { sql: string; params: string[] } {
  if (highWaterMark === null) {
    return { sql: "FALSE", params: [] };
  }
  return {
    sql: `${idColumnSql} <= $${nextParamIndex}`,
    params: [highWaterMark],
  };
}

export type SessionSubjectEvidence = {
  evidenceVersion: typeof TENANT_SUBJECT_EVIDENCE_VERSION;
  evidenceColumns: string[];
  rowCount: number;
  highWaterMark: string | null;
  subjectDigest: string;
  normalizedDomains: string[];
  invalidCandidates: Array<{
    evidence: ReturnType<typeof redactSessionShop>;
    normalizeReason: string;
  }>;
};

function redactSessionShop(raw: string): {
  length: number;
  sha256Prefix: string;
} {
  return {
    length: raw.length,
    sha256Prefix: sha256Hex(raw).slice(0, 16),
  };
}

export async function streamSessionSubjectEvidence(
  db: EvidenceDb,
  options: {
    batchSize: number;
    highWaterMarkBound?: string | null;
    normalizeShopDomain: (raw: string) =>
      | { ok: true; normalized: string }
      | { ok: false; reason: string };
  },
): Promise<SessionSubjectEvidence> {
  const columns = SESSION_SUBJECT_EVIDENCE_COLUMNS;
  const batchSize = options.batchSize;
  const bound = options.highWaterMarkBound;
  const normalized = new Set<string>();
  const invalidCandidates: SessionSubjectEvidence["invalidCandidates"] = [];

  if (bound === null) {
    return {
      evidenceVersion: TENANT_SUBJECT_EVIDENCE_VERSION,
      evidenceColumns: [...columns],
      rowCount: 0,
      highWaterMark: null,
      subjectDigest: initSubjectHash(columns).digest("hex"),
      normalizedDomains: [],
      invalidCandidates: [],
    };
  }

  const hash = initSubjectHash(columns);
  let rowCount = 0;
  let lastId: string | null = null;
  let afterId = "";

  for (;;) {
    let rows: Array<Record<string, unknown>>;
    if (bound === undefined) {
      rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT ${selectList(columns)} FROM "Session"
         WHERE id > $1
         ORDER BY id COLLATE "C" ASC
         LIMIT $2`,
        afterId,
        batchSize,
      );
    } else {
      rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT ${selectList(columns)} FROM "Session"
         WHERE id > $1 AND id <= $2
         ORDER BY id COLLATE "C" ASC
         LIMIT $3`,
        afterId,
        bound,
        batchSize,
      );
    }
    if (rows.length === 0) break;
    for (const row of rows) {
      feedRow(hash, columns, row);
      rowCount += 1;
      lastId = String(row.id);
      const raw = String(row.shop ?? "");
      const result = options.normalizeShopDomain(raw);
      if (result.ok) {
        normalized.add(result.normalized);
      } else {
        invalidCandidates.push({
          evidence: redactSessionShop(raw),
          normalizeReason: result.reason,
        });
      }
    }
    afterId = lastId!;
    if (rows.length < batchSize) break;
  }

  return {
    evidenceVersion: TENANT_SUBJECT_EVIDENCE_VERSION,
    evidenceColumns: [...columns],
    rowCount,
    highWaterMark: lastId,
    subjectDigest: hash.digest("hex"),
    normalizedDomains: [...normalized].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    invalidCandidates,
  };
}

export async function streamDirectOwnerDistinctShops(
  db: EvidenceDb,
  table: BackfillTableName,
  highWaterMark: string | null,
): Promise<string[]> {
  assertApprovedTable(table);
  if (highWaterMark === null) return [];
  const rows = await db.$queryRawUnsafe<Array<{ shop: string }>>(
    `SELECT DISTINCT shop COLLATE "C" AS shop FROM "${table}"
     WHERE id <= $1
     ORDER BY shop COLLATE "C" ASC`,
    highWaterMark,
  );
  return rows.map((r) => r.shop);
}
