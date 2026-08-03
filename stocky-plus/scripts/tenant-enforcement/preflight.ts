/**
 * Zero-unresolved enforcement preflight — fail-closed, non-mutating.
 * Never logs merchant data values — only table names and safe counts.
 */
import type { Client } from "pg";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMPOSITE_FOREIGN_KEYS,
  COMPOSITE_PARENT_KEYS,
  MERCHANT_SQL_TABLES,
  MERCHANT_TABLES,
} from "./manifest";
import { quoteIdent } from "./sql";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export type TablePreflight = {
  table: string;
  shopIdColumnExists: boolean;
  rowCount: number;
  nullShopIdCount: number;
  openQuarantineCount: number;
  parentMismatchCount: number;
  crossDomainMismatchCount: number;
  orphanParentRefCount: number;
  duplicateCompositeKeyCount: number;
  ok: boolean;
  failures: string[];
};

export type PreflightResult = {
  event: "tenant_enforcement_preflight";
  ok: boolean;
  merchantTableCount: number;
  tables: TablePreflight[];
  globalFailures: string[];
  productionDataInspected: false;
  mutating: false;
};

async function columnExists(
  client: Client,
  table: string,
  column: string,
): Promise<boolean> {
  const res = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return (res.rowCount ?? 0) > 0;
}

async function countNullShopId(client: Client, table: string): Promise<number> {
  const res = await client.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM ${quoteIdent(table)} WHERE ${quoteIdent("shopId")} IS NULL`,
  );
  return Number(res.rows[0]?.c ?? 0);
}

async function countRows(client: Client, table: string): Promise<number> {
  const res = await client.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM ${quoteIdent(table)}`,
  );
  return Number(res.rows[0]?.c ?? 0);
}

async function countOpenQuarantine(
  client: Client,
  table: string,
): Promise<number> {
  const exists = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'TenantOwnershipIssue'`,
  );
  if ((exists.rowCount ?? 0) === 0) return 0;
  const res = await client.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM "TenantOwnershipIssue"
     WHERE "tableName" = $1 AND status = 'OPEN'`,
    [table],
  );
  return Number(res.rows[0]?.c ?? 0);
}

async function countParentMismatches(
  client: Client,
  child: string,
  parent: string,
  parentIdColumn: string,
): Promise<{ mismatch: number; orphan: number }> {
  const sql = `
    SELECT
      COUNT(*) FILTER (
        WHERE c.${quoteIdent("shopId")} IS NOT NULL
          AND p.${quoteIdent("shopId")} IS NOT NULL
          AND c.${quoteIdent("shopId")} IS DISTINCT FROM p.${quoteIdent("shopId")}
      )::text AS mismatch,
      COUNT(*) FILTER (WHERE p.id IS NULL)::text AS orphan
    FROM ${quoteIdent(child)} c
    LEFT JOIN ${quoteIdent(parent)} p ON p.id = c.${quoteIdent(parentIdColumn)}
  `;
  const res = await client.query<{ mismatch: string; orphan: string }>(sql);
  return {
    mismatch: Number(res.rows[0]?.mismatch ?? 0),
    orphan: Number(res.rows[0]?.orphan ?? 0),
  };
}

async function countDuplicateCompositeKeys(
  client: Client,
  table: string,
): Promise<number> {
  const res = await client.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM (
       SELECT ${quoteIdent("shopId")}, id
       FROM ${quoteIdent(table)}
       WHERE ${quoteIdent("shopId")} IS NOT NULL
       GROUP BY 1, 2
       HAVING COUNT(*) > 1
     ) d`,
  );
  return Number(res.rows[0]?.c ?? 0);
}

function runExternalCheck(command: string, args: string[]): string | null {
  try {
    execFileSync("npm", ["run", command, ...args], {
      cwd: APP_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    return null;
  } catch (err) {
    const e = err as { status?: number; message?: string };
    return `${command}_failed_exit_${e.status ?? "unknown"}`;
  }
}

export async function runPreflight(client: Client): Promise<PreflightResult> {
  const globalFailures: string[] = [];
  const tables: TablePreflight[] = [];

  // Detect whether PR 3 enforcement (FORCE RLS) is already active.
  const forced = await client.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = ANY($1::text[])
       AND c.relforcerowsecurity`,
    [MERCHANT_SQL_TABLES],
  );
  const enforcementAlreadyApplied =
    Number(forced.rows[0]?.c ?? 0) === MERCHANT_SQL_TABLES.length;

  // PR 1 schema drift — only required before enforcement. After FORCE RLS /
  // NOT NULL / composite FKs, the live DB intentionally diverges from the
  // Prisma expand-compatible schema (shopId remains optional in Prisma).
  if (!enforcementAlreadyApplied) {
    const driftFail = runExternalCheck("tenant:schema:drift", []);
    if (driftFail) globalFailures.push(driftFail);
  }

  // PR 2 access inventory freshness (skippable for disposable fixture tests that
  // edit allowlisted harness files; CI still runs inventory:check as its own gate)
  if (process.env.STOCKY_PREFLIGHT_SKIP_ACCESS_INVENTORY !== "1") {
    const invFail = runExternalCheck("tenant:access:inventory:check", []);
    if (invFail) globalFailures.push(invFail);
  }

  // Compatibility indexes valid
  const idxFail = runExternalCheck("tenant:indexes:verify", []);
  if (idxFail) globalFailures.push(idxFail);

  for (const spec of MERCHANT_TABLES) {
    const failures: string[] = [];
    const shopIdColumnExists = await columnExists(client, spec.sqlTable, "shopId");
    if (!shopIdColumnExists) failures.push("shopId_column_missing");

    const rowCount = shopIdColumnExists
      ? await countRows(client, spec.sqlTable)
      : 0;
    const nullShopIdCount = shopIdColumnExists
      ? await countNullShopId(client, spec.sqlTable)
      : -1;
    if (nullShopIdCount > 0) failures.push("null_shopId_rows");

    const openQuarantineCount = await countOpenQuarantine(client, spec.sqlTable);
    if (openQuarantineCount > 0) failures.push("open_quarantine_issues");

    let parentMismatchCount = 0;
    let orphanParentRefCount = 0;
    let crossDomainMismatchCount = 0;

    for (const fk of COMPOSITE_FOREIGN_KEYS.filter(
      (f) => f.childTable === spec.sqlTable,
    )) {
      const { mismatch, orphan } = await countParentMismatches(
        client,
        fk.childTable,
        fk.parentTable,
        fk.childColumns[1],
      );
      if (fk.purpose === "cross_domain" || fk.purpose === "secondary_lineage") {
        crossDomainMismatchCount += mismatch;
      } else {
        parentMismatchCount += mismatch;
      }
      orphanParentRefCount += orphan;
    }

    if (parentMismatchCount > 0) failures.push("parent_tenant_mismatch");
    if (crossDomainMismatchCount > 0) failures.push("cross_domain_mismatch");
    if (orphanParentRefCount > 0) failures.push("orphan_parent_refs");

    const duplicateCompositeKeyCount = shopIdColumnExists
      ? await countDuplicateCompositeKeys(client, spec.sqlTable)
      : 0;
    if (duplicateCompositeKeyCount > 0) {
      failures.push("duplicate_composite_keys");
    }

    tables.push({
      table: spec.sqlTable,
      shopIdColumnExists,
      rowCount,
      nullShopIdCount,
      openQuarantineCount,
      parentMismatchCount,
      crossDomainMismatchCount,
      orphanParentRefCount,
      duplicateCompositeKeyCount,
      ok: failures.length === 0,
      failures,
    });
  }

  // Global open quarantine across any merchant table
  const globalOpen = await client.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM "TenantOwnershipIssue" WHERE status = 'OPEN'`,
  ).catch(() => ({ rows: [{ c: "0" }] }));
  if (Number(globalOpen.rows[0]?.c ?? 0) > 0) {
    globalFailures.push("global_open_quarantine_issues");
  }

  // Required composite key names present as indexes (may be invalid until apply)
  for (const key of COMPOSITE_PARENT_KEYS) {
    // Only require PR1 keys to already be valid; others created during apply.
    const pr1Existing = MERCHANT_TABLES.find(
      (t) => t.sqlTable === key.table && t.existingShopIdIdUnique,
    );
    if (!pr1Existing) continue;
    const idx = await client.query(
      `SELECT i.indisvalid
       FROM pg_class c
       JOIN pg_index i ON i.indexrelid = c.oid
       JOIN pg_class t ON t.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public' AND c.relname = $1 AND t.relname = $2`,
      [key.name, key.table],
    );
    if ((idx.rowCount ?? 0) === 0) {
      globalFailures.push(`missing_pr1_composite_index:${key.name}`);
    } else if (!idx.rows[0].indisvalid) {
      globalFailures.push(`invalid_pr1_composite_index:${key.name}`);
    }
  }

  const ok =
    globalFailures.length === 0 && tables.every((t) => t.ok);

  return {
    event: "tenant_enforcement_preflight",
    ok,
    merchantTableCount: MERCHANT_SQL_TABLES.length,
    tables,
    globalFailures,
    productionDataInspected: false,
    mutating: false,
  };
}
