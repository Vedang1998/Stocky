import type { PrismaClient } from "@prisma/client";
import { membershipChecksum } from "./checksum";
import { assertApprovedTable, BACKFILL_TABLE_ORDER, type BackfillTableName } from "./tables";

/**
 * Per-table run subject boundary (R10).
 * highWaterMark === null means the table was empty at run start — the boundary
 * stays empty even if rows are inserted later.
 */
export type TableDatasetBoundary = {
  highWaterMark: string | null;
  rowCount: number;
  membershipChecksum: string;
};

export type DatasetBoundaries = Record<string, TableDatasetBoundary>;

export async function loadDatasetBoundaries(
  prisma: PrismaClient,
): Promise<DatasetBoundaries> {
  const map: DatasetBoundaries = {};
  for (const table of BACKFILL_TABLE_ORDER) {
    map[table] = await loadTableBoundary(prisma, table);
  }
  return map;
}

export async function loadTableBoundary(
  prisma: PrismaClient,
  table: BackfillTableName,
): Promise<TableDatasetBoundary> {
  assertApprovedTable(table);
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "${table}" ORDER BY id ASC`,
  );
  const ids = rows.map((r) => r.id);
  return {
    highWaterMark: ids.length === 0 ? null : ids[ids.length - 1]!,
    rowCount: ids.length,
    membershipChecksum: membershipChecksum(ids),
  };
}

export async function recomputeMembershipChecksum(
  prisma: PrismaClient,
  table: BackfillTableName,
  highWaterMark: string | null,
): Promise<{ rowCount: number; membershipChecksum: string; ids: string[] }> {
  assertApprovedTable(table);
  if (highWaterMark === null) {
    return { rowCount: 0, membershipChecksum: membershipChecksum([]), ids: [] };
  }
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "${table}" WHERE id <= $1 ORDER BY id ASC`,
    highWaterMark,
  );
  const ids = rows.map((r) => r.id);
  return {
    rowCount: ids.length,
    membershipChecksum: membershipChecksum(ids),
    ids,
  };
}

export function assertMembershipUnchanged(
  table: string,
  expected: TableDatasetBoundary,
  actual: { rowCount: number; membershipChecksum: string },
): void {
  if (
    actual.rowCount !== expected.rowCount ||
    actual.membershipChecksum !== expected.membershipChecksum
  ) {
    throw new Error(
      `Dataset drift detected for ${table}: membership inside run boundary changed ` +
        `(expected count=${expected.rowCount} checksum=${expected.membershipChecksum}; ` +
        `actual count=${actual.rowCount} checksum=${actual.membershipChecksum}). ` +
        `Insertion, deletion, or identity replacement inside the original high-water mark fails closed.`,
    );
  }
}

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
