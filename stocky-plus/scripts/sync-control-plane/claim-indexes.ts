/**
 * D-048 / P2-D047-R03 — concurrent pre-creation of DurableJob shop-claim indexes.
 *
 * Populated databases must build these indexes with CREATE INDEX CONCURRENTLY
 * before (or instead of relying on) the historical plain CREATE INDEX IF NOT EXISTS
 * migration `20260806220000_sync_control_plane_d047_fair_claim_indexes`, which
 * becomes a no-op when the exact indexes already exist.
 *
 * Production execution remains unauthorized — this tooling is for disposable /
 * approved non-production rollout rehearsal only.
 */
import type { Client } from "pg";

export type SyncClaimIndex = {
  name: string;
  table: "DurableJob";
  columns: readonly string[];
  whereSql: string;
  expectedDefNormalized: string;
};

export function normalizeIndexDef(def: string): string {
  return def.trim().replace(/\s+/g, " ").toLowerCase();
}

function expectedPartialDef(
  name: string,
  table: string,
  columns: readonly string[],
  whereSql: string,
): string {
  const columnList = columns
    .map((c) => (/^[a-z][a-z0-9_]*$/.test(c) ? c : `"${c}"`))
    .join(", ");
  return normalizeIndexDef(
    `CREATE INDEX "${name}" ON public."${table}" USING btree (${columnList}) ${whereSql}`,
  );
}

export const SYNC_CLAIM_INDEXES: readonly SyncClaimIndex[] = [
  {
    name: "DurableJob_shop_claim_pending_idx",
    table: "DurableJob",
    columns: ["shopId", "nextEligibleAt", "createdAt", "id"],
    whereSql: "WHERE (state = 'PENDING'::\"DurableJobState\")",
    expectedDefNormalized: expectedPartialDef(
      "DurableJob_shop_claim_pending_idx",
      "DurableJob",
      ["shopId", "nextEligibleAt", "createdAt", "id"],
      "WHERE (state = 'PENDING'::\"DurableJobState\")",
    ),
  },
  {
    name: "DurableJob_shop_claim_retry_wait_idx",
    table: "DurableJob",
    columns: ["shopId", "nextEligibleAt", "createdAt", "id"],
    whereSql: "WHERE (state = 'RETRY_WAIT'::\"DurableJobState\")",
    expectedDefNormalized: expectedPartialDef(
      "DurableJob_shop_claim_retry_wait_idx",
      "DurableJob",
      ["shopId", "nextEligibleAt", "createdAt", "id"],
      "WHERE (state = 'RETRY_WAIT'::\"DurableJobState\")",
    ),
  },
];

export type ClaimIndexInspected =
  | { status: "missing" }
  | {
      status: "present";
      indisvalid: boolean;
      indisready: boolean;
      table: string;
      definition: string;
      definitionNormalized: string;
    };

export async function inspectClaimIndex(
  client: Client,
  name: string,
): Promise<ClaimIndexInspected> {
  const meta = await client.query<{
    table_name: string;
    indisvalid: boolean;
    indisready: boolean;
    definition: string;
  }>(
    `
    SELECT
      t.relname AS table_name,
      i.indisvalid,
      i.indisready,
      pg_get_indexdef(i.indexrelid) AS definition
    FROM pg_class c
    JOIN pg_index i ON i.indexrelid = c.oid
    JOIN pg_class t ON i.indrelid = t.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'i'
      AND c.relname = $1
    `,
    [name],
  );
  if (meta.rowCount === 0) return { status: "missing" };
  const row = meta.rows[0]!;
  return {
    status: "present",
    indisvalid: row.indisvalid,
    indisready: row.indisready,
    table: row.table_name,
    definition: row.definition,
    definitionNormalized: normalizeIndexDef(row.definition),
  };
}

export type ClaimIndexPlanStatus =
  | "missing"
  | "valid_exact"
  | "invalid"
  | "wrong_definition"
  | "wrong_table";

export function classifyClaimIndex(
  entry: SyncClaimIndex,
  inspected: ClaimIndexInspected,
): ClaimIndexPlanStatus {
  if (inspected.status === "missing") return "missing";
  if (!inspected.indisvalid || !inspected.indisready) return "invalid";
  if (inspected.table !== entry.table) return "wrong_table";
  // Accept either quoted-cast or enum-cast forms from pg_get_indexdef.
  const normalizedExpected = entry.expectedDefNormalized;
  const actual = inspected.definitionNormalized;
  if (actual !== normalizedExpected) {
    // Tolerate ASC explicit markers that pg_get_indexdef may omit/include.
    const relaxedActual = actual.replace(/ asc/g, "");
    const relaxedExpected = normalizedExpected.replace(/ asc/g, "");
    if (relaxedActual !== relaxedExpected) return "wrong_definition";
  }
  return "valid_exact";
}

export function recoveryInstruction(indexName: string): string {
  return (
    `Index "${indexName}" exists but is invalid or mismatched. ` +
    `The tool does not silently repair or drop it. ` +
    `Recovery requires an explicitly authorized ` +
    `DROP INDEX CONCURRENTLY IF EXISTS "${indexName}"; ` +
    `then re-run npm run sync:claim-indexes:apply -- --apply`
  );
}

function buildCreateConcurrently(entry: SyncClaimIndex): string {
  const columnList = entry.columns.map((c) => `"${c}"`).join(", ");
  // Concurrent create uses the predicate shape Prisma migrations use
  // (state = 'PENDING') — pg_get_indexdef normalizes to enum cast.
  const where =
    entry.name.includes("retry_wait")
      ? "WHERE state = 'RETRY_WAIT'"
      : "WHERE state = 'PENDING'";
  return `CREATE INDEX CONCURRENTLY "${entry.name}" ON "${entry.table}" (${columnList}) ${where}`;
}

export type ClaimIndexApplyResult = {
  created: string[];
  skipped: string[];
  failed: { name: string; error: string }[];
};

export async function applyClaimIndexesConcurrently(
  client: Client,
  options: { apply: boolean },
): Promise<ClaimIndexApplyResult> {
  if (!options.apply) {
    throw new Error("applyClaimIndexesConcurrently requires options.apply === true");
  }
  const result: ClaimIndexApplyResult = { created: [], skipped: [], failed: [] };
  for (const entry of SYNC_CLAIM_INDEXES) {
    try {
      const inspected = await inspectClaimIndex(client, entry.name);
      const status = classifyClaimIndex(entry, inspected);
      if (status === "valid_exact") {
        result.skipped.push(entry.name);
        continue;
      }
      if (status !== "missing") {
        throw new Error(recoveryInstruction(entry.name));
      }
      await client.query(buildCreateConcurrently(entry));
      const after = await inspectClaimIndex(client, entry.name);
      const afterStatus = classifyClaimIndex(entry, after);
      if (afterStatus !== "valid_exact") {
        throw new Error(
          `Index "${entry.name}" failed post-create verification (${afterStatus}). ${recoveryInstruction(entry.name)}`,
        );
      }
      result.created.push(entry.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failed.push({ name: entry.name, error: message });
      throw error;
    }
  }
  return result;
}

export async function verifyClaimIndexes(client: Client): Promise<void> {
  const errors: string[] = [];
  for (const entry of SYNC_CLAIM_INDEXES) {
    const inspected = await inspectClaimIndex(client, entry.name);
    const status = classifyClaimIndex(entry, inspected);
    if (status !== "valid_exact") {
      errors.push(`${entry.name}: ${status}`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`sync claim index verify failed: ${errors.join("; ")}`);
  }
}
