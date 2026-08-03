/**
 * Post-enforcement verification and drift detection.
 *
 * Compares live PostgreSQL catalog definitions (policy predicates, FK columns
 * and actions, trigger enabled state / function body, composite key columns)
 * against a deterministic expected manifest. Name/count-only checks are
 * insufficient (F-PR3-03 / F-PR3-04 / F-PR3-08).
 */
import type { Client } from "pg";
import {
  COMPOSITE_FOREIGN_KEYS,
  COMPOSITE_PARENT_KEYS,
  ENFORCEMENT_CONTEXT_VERSION,
  IMMUTABILITY_TRIGGER_FN,
  MERCHANT_SQL_TABLES,
  TENANT_CONTEXT_HELPER_FN,
  TENANT_CONTEXT_VERSION_FN,
  immutabilityTriggerName,
  rlsPolicyName,
  shopIdFkToShopName,
  shopIdNotNullCheckName,
} from "./manifest";
import { defaultRuntimeRoleName } from "./connection";
import {
  expectedNormalizedTenantPredicate,
  fkActionCode,
  normalizeCatalogExpr,
} from "./catalog-expect";

export type VerifyIssue = {
  code: string;
  table?: string;
  detail: string;
};

export type EnforcementVerifyResult = {
  event: "tenant_enforcement_verify";
  ok: boolean;
  issues: VerifyIssue[];
};

const CMD_MAP: Record<string, string> = {
  select: "r",
  insert: "a",
  update: "w",
  delete: "d",
};

async function checkRls(
  client: Client,
  table: string,
  issues: VerifyIssue[],
): Promise<void> {
  const res = await client.query<{
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
  }>(
    `SELECT c.relrowsecurity, c.relforcerowsecurity
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1`,
    [table],
  );
  if ((res.rowCount ?? 0) === 0) {
    issues.push({ code: "table_missing", table, detail: "missing" });
    return;
  }
  if (!res.rows[0].relrowsecurity) {
    issues.push({ code: "rls_not_enabled", table, detail: "ENABLE missing" });
  }
  if (!res.rows[0].relforcerowsecurity) {
    issues.push({ code: "rls_not_forced", table, detail: "FORCE missing" });
  }
}

async function checkPolicies(
  client: Client,
  table: string,
  runtimeRole: string,
  issues: VerifyIssue[],
): Promise<void> {
  const expected = ["select", "insert", "update", "delete"] as const;
  const expectedPred = expectedNormalizedTenantPredicate();

  const res = await client.query<{
    polname: string;
    polcmd: string;
    roles: string[];
    permissive: boolean;
    using_expr: string | null;
    with_check_expr: string | null;
  }>(
    `SELECT p.polname,
            p.polcmd::text AS polcmd,
            COALESCE(
              ARRAY(
                SELECT attrol.rolname
                FROM pg_roles attrol
                WHERE attrol.oid = ANY(p.polroles)
                ORDER BY 1
              ),
              ARRAY[]::name[]
            ) AS roles,
            p.polpermissive AS permissive,
            pg_get_expr(p.polqual, p.polrelid) AS using_expr,
            pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expr
     FROM pg_policy p
     JOIN pg_class c ON c.oid = p.polrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1`,
    [table],
  );

  for (const cmd of expected) {
    const name = rlsPolicyName(table, cmd);
    const row = res.rows.find((r) => r.polname === name);
    if (!row) {
      issues.push({ code: "policy_missing", table, detail: name });
      continue;
    }
    if (row.polcmd !== CMD_MAP[cmd]) {
      issues.push({
        code: "policy_wrong_command",
        table,
        detail: `${name}:${row.polcmd}`,
      });
    }
    if (!row.permissive) {
      issues.push({
        code: "policy_restrictive_mismatch",
        table,
        detail: name,
      });
    }
    // Empty polroles = PUBLIC
    if (row.roles.length === 0) {
      issues.push({
        code: "public_policy",
        table,
        detail: name,
      });
    } else {
      if (!row.roles.includes(runtimeRole)) {
        issues.push({
          code: "policy_wrong_role",
          table,
          detail: `${name}:roles=${row.roles.join(",")}`,
        });
      }
      if (row.roles.some((r) => r !== runtimeRole)) {
        issues.push({
          code: "policy_extra_role",
          table,
          detail: `${name}:roles=${row.roles.join(",")}`,
        });
      }
    }

    const usingNorm = normalizeCatalogExpr(row.using_expr);
    const checkNorm = normalizeCatalogExpr(row.with_check_expr);

    if (cmd === "select" || cmd === "delete") {
      if (usingNorm == null) {
        issues.push({
          code: "policy_missing_using",
          table,
          detail: name,
        });
      } else if (usingNorm !== expectedPred) {
        issues.push({
          code: "policy_using_drift",
          table,
          detail: `${name}:got=${usingNorm}`,
        });
      }
      if (usingNorm === "true" || usingNorm === "(true)") {
        issues.push({
          code: "policy_using_true",
          table,
          detail: name,
        });
      }
      if (
        usingNorm &&
        !usingNorm.includes(TENANT_CONTEXT_HELPER_FN.toLowerCase())
      ) {
        issues.push({
          code: "policy_wrong_helper",
          table,
          detail: name,
        });
      }
      if (
        usingNorm &&
        !usingNorm.includes(ENFORCEMENT_CONTEXT_VERSION.toLowerCase())
      ) {
        issues.push({
          code: "policy_wrong_context_key",
          table,
          detail: name,
        });
      }
    }

    if (cmd === "insert") {
      if (checkNorm == null) {
        issues.push({
          code: "policy_missing_with_check",
          table,
          detail: name,
        });
      } else if (checkNorm !== expectedPred) {
        issues.push({
          code: "policy_with_check_drift",
          table,
          detail: `${name}:got=${checkNorm}`,
        });
      }
    }

    if (cmd === "update") {
      if (usingNorm == null) {
        issues.push({
          code: "policy_missing_using",
          table,
          detail: name,
        });
      } else if (usingNorm !== expectedPred) {
        issues.push({
          code: "policy_using_drift",
          table,
          detail: `${name}:got=${usingNorm}`,
        });
      }
      if (checkNorm == null) {
        issues.push({
          code: "policy_missing_with_check",
          table,
          detail: name,
        });
      } else if (checkNorm !== expectedPred) {
        issues.push({
          code: "policy_with_check_drift",
          table,
          detail: `${name}:got=${checkNorm}`,
        });
      }
    }
  }

  for (const row of res.rows) {
    const allowed = expected.map((c) => rlsPolicyName(table, c));
    if (!allowed.includes(row.polname)) {
      issues.push({
        code: row.permissive
          ? "unexpected_permissive_policy"
          : "unexpected_policy",
        table,
        detail: row.polname,
      });
    }
  }
}

async function checkTrigger(
  client: Client,
  table: string,
  issues: VerifyIssue[],
): Promise<void> {
  const name = immutabilityTriggerName(table);
  const res = await client.query<{
    tgname: string;
    proname: string;
    tgenabled: string;
    tgtype: number;
    tgattr: string;
    prosecdef: boolean;
    proconfig: string[] | null;
    owner: string;
    prosrc: string;
  }>(
    `SELECT t.tgname,
            p.proname,
            t.tgenabled::text AS tgenabled,
            t.tgtype,
            (
              SELECT string_agg(a.attname, ',' ORDER BY a.attnum)
              FROM unnest(t.tgattr) WITH ORDINALITY AS u(attnum, ord)
              JOIN pg_attribute a
                ON a.attrelid = t.tgrelid AND a.attnum = u.attnum
            ) AS tgattr,
            p.prosecdef,
            p.proconfig,
            r.rolname AS owner,
            p.prosrc
     FROM pg_trigger t
     JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_proc p ON p.oid = t.tgfoid
     JOIN pg_roles r ON r.oid = p.proowner
     WHERE n.nspname = 'public' AND c.relname = $1 AND NOT t.tgisinternal`,
    [table],
  );
  const row = res.rows.find((r) => r.tgname === name);
  if (!row) {
    issues.push({ code: "trigger_missing", table, detail: name });
    return;
  }
  if (row.proname !== IMMUTABILITY_TRIGGER_FN) {
    issues.push({
      code: "trigger_wrong_function",
      table,
      detail: row.proname,
    });
  }
  // 'O' = origin (enabled for normal sessions); 'D' disabled; 'R' replica; 'A' always
  if (row.tgenabled === "D") {
    issues.push({ code: "trigger_disabled", table, detail: name });
  } else if (row.tgenabled === "R") {
    issues.push({ code: "trigger_replica_only", table, detail: name });
  } else if (row.tgenabled !== "O" && row.tgenabled !== "A") {
    issues.push({
      code: "trigger_wrong_enabled_state",
      table,
      detail: `${name}:${row.tgenabled}`,
    });
  }
  // tgtype 19 = ROW (1) + BEFORE (2) + UPDATE (16)
  if ((row.tgtype & 19) !== 19) {
    issues.push({
      code: "trigger_wrong_event",
      table,
      detail: `${name}:tgtype=${row.tgtype}`,
    });
  }
  if (row.tgattr !== "shopId") {
    issues.push({
      code: "trigger_wrong_columns",
      table,
      detail: `${name}:cols=${row.tgattr ?? ""}`,
    });
  }
  if (row.prosecdef) {
    issues.push({
      code: "trigger_function_security_definer",
      table,
      detail: row.proname,
    });
  }
  const searchPath = (row.proconfig ?? []).find((c) =>
    c.toLowerCase().startsWith("search_path="),
  );
  if (
    !searchPath ||
    !/search_path\s*=\s*pg_catalog\s*,\s*pg_temp/i.test(searchPath)
  ) {
    issues.push({
      code: "trigger_function_insecure_search_path",
      table,
      detail: searchPath ?? "missing",
    });
  }
  if (!/IS DISTINCT FROM/i.test(row.prosrc)) {
    issues.push({
      code: "trigger_function_body_drift",
      table,
      detail: "missing IS DISTINCT FROM guard",
    });
  }
  if (!/stocky_tenant_key_immutable/i.test(row.prosrc)) {
    issues.push({
      code: "trigger_function_body_drift",
      table,
      detail: "missing immutability error marker",
    });
  }
}

async function checkNotNull(
  client: Client,
  table: string,
  issues: VerifyIssue[],
): Promise<void> {
  const res = await client.query<{ is_nullable: string }>(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'shopId'`,
    [table],
  );
  if (res.rows[0]?.is_nullable !== "NO") {
    issues.push({ code: "shopId_nullable", table, detail: "NOT NULL missing" });
  }
  // Helper CHECK may remain after SET NOT NULL; if present it must be validated.
  const check = await client.query<{ convalidated: boolean }>(
    `SELECT convalidated FROM pg_constraint WHERE conname = $1`,
    [shopIdNotNullCheckName(table)],
  );
  if ((check.rowCount ?? 0) > 0 && !check.rows[0].convalidated) {
    issues.push({
      code: "not_null_check_unvalidated",
      table,
      detail: shopIdNotNullCheckName(table),
    });
  }
}

async function checkCompositeKey(
  client: Client,
  name: string,
  table: string,
  expectedColumns: readonly string[],
  issues: VerifyIssue[],
): Promise<void> {
  const res = await client.query<{
    indisunique: boolean;
    indisvalid: boolean;
    relname: string;
  }>(
    `SELECT i.indisunique, i.indisvalid, t.relname
     FROM pg_class c
     JOIN pg_index i ON i.indexrelid = c.oid
     JOIN pg_class t ON t.oid = i.indrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1`,
    [name],
  );
  if ((res.rowCount ?? 0) === 0) {
    issues.push({
      code: "composite_key_missing",
      table,
      detail: name,
    });
    return;
  }
  if (res.rows[0].relname !== table) {
    issues.push({
      code: "composite_key_wrong_table",
      table,
      detail: `${name}->${res.rows[0].relname}`,
    });
  }
  if (!res.rows[0].indisunique) {
    issues.push({
      code: "composite_key_not_unique",
      table,
      detail: name,
    });
  }
  if (!res.rows[0].indisvalid) {
    issues.push({
      code: "composite_key_invalid",
      table,
      detail: name,
    });
  }

  const cols = await client.query<{ attname: string }>(
    `SELECT a.attname
     FROM pg_index i
     JOIN pg_class c ON c.oid = i.indexrelid
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     WHERE c.relname = $1
     ORDER BY array_position(i.indkey, a.attnum)`,
    [name],
  );
  const gotCols = cols.rows.map((r) => r.attname);
  if (
    gotCols.length !== expectedColumns.length ||
    gotCols.some((c, i) => c !== expectedColumns[i])
  ) {
    issues.push({
      code: "composite_key_wrong_columns",
      table,
      detail: `${name}:expected:${expectedColumns.join(",")}:got:${gotCols.join(",")}`,
    });
  }
}

async function checkFkDefinition(
  client: Client,
  spec: {
    name: string;
    childTable: string;
    childColumns: readonly string[];
    parentTable: string;
    parentColumns: readonly string[];
    onDelete: string;
    onUpdate: string;
  },
  issues: VerifyIssue[],
): Promise<void> {
  const res = await client.query<{
    convalidated: boolean;
    condeferrable: boolean;
    condeferred: boolean;
    confupdtype: string;
    confdeltype: string;
    confmatchtype: string;
    child_table: string;
    parent_table: string;
    child_cols: string[];
    parent_cols: string[];
  }>(
    `SELECT c.convalidated,
            c.condeferrable,
            c.condeferred,
            c.confupdtype::text AS confupdtype,
            c.confdeltype::text AS confdeltype,
            c.confmatchtype::text AS confmatchtype,
            child.relname AS child_table,
            parent.relname AS parent_table,
            (
              SELECT array_agg(a.attname ORDER BY u.ord)
              FROM unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
            ) AS child_cols,
            (
              SELECT array_agg(a.attname ORDER BY u.ord)
              FROM unnest(c.confkey) WITH ORDINALITY AS u(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = u.attnum
            ) AS parent_cols
     FROM pg_constraint c
     JOIN pg_class child ON child.oid = c.conrelid
     JOIN pg_class parent ON parent.oid = c.confrelid
     WHERE c.conname = $1 AND c.contype = 'f'`,
    [spec.name],
  );

  if ((res.rowCount ?? 0) === 0) {
    issues.push({ code: "fk_missing", detail: spec.name });
    return;
  }
  const row = res.rows[0];
  if (!row.convalidated) {
    issues.push({ code: "fk_not_validated", detail: spec.name });
  }
  if (row.child_table !== spec.childTable) {
    issues.push({
      code: "fk_wrong_child_table",
      detail: `${spec.name}:got=${row.child_table}`,
    });
  }
  if (row.parent_table !== spec.parentTable) {
    issues.push({
      code: "fk_wrong_parent_table",
      detail: `${spec.name}:got=${row.parent_table}`,
    });
  }
  const childCols = row.child_cols ?? [];
  const parentCols = row.parent_cols ?? [];
  if (
    childCols.length !== spec.childColumns.length ||
    childCols.some((c, i) => c !== spec.childColumns[i])
  ) {
    issues.push({
      code: "fk_wrong_local_columns",
      detail: `${spec.name}:expected:${spec.childColumns.join(",")}:got:${childCols.join(",")}`,
    });
  }
  if (
    parentCols.length !== spec.parentColumns.length ||
    parentCols.some((c, i) => c !== spec.parentColumns[i])
  ) {
    issues.push({
      code: "fk_wrong_referenced_columns",
      detail: `${spec.name}:expected:${spec.parentColumns.join(",")}:got:${parentCols.join(",")}`,
    });
  }
  const expectedDel = fkActionCode(spec.onDelete);
  const expectedUpd = fkActionCode(spec.onUpdate);
  if (row.confdeltype !== expectedDel) {
    issues.push({
      code: "fk_wrong_delete_action",
      detail: `${spec.name}:expected=${expectedDel}:got=${row.confdeltype}`,
    });
  }
  if (row.confupdtype !== expectedUpd) {
    issues.push({
      code: "fk_wrong_update_action",
      detail: `${spec.name}:expected=${expectedUpd}:got=${row.confupdtype}`,
    });
  }
  // Match SIMPLE ('s') is default; reject FULL if unexpected.
  if (row.confmatchtype !== "s") {
    issues.push({
      code: "fk_wrong_match_type",
      detail: `${spec.name}:got=${row.confmatchtype}`,
    });
  }
  if (row.condeferrable) {
    issues.push({
      code: "fk_unexpected_deferrable",
      detail: spec.name,
    });
  }
  if (row.condeferred) {
    issues.push({
      code: "fk_unexpected_deferred",
      detail: spec.name,
    });
  }
}

async function checkHelperFunction(
  client: Client,
  proname: string,
  issues: VerifyIssue[],
): Promise<void> {
  const res = await client.query<{
    prosecdef: boolean;
    proconfig: string[] | null;
    owner: string;
    public_execute: boolean;
  }>(
    `SELECT p.prosecdef,
            p.proconfig,
            r.rolname AS owner,
            has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     JOIN pg_roles r ON r.oid = p.proowner
     WHERE n.nspname = 'public' AND p.proname = $1`,
    [proname],
  );
  if ((res.rowCount ?? 0) === 0) {
    issues.push({ code: "helper_missing", detail: proname });
    return;
  }
  const row = res.rows[0];
  if (row.prosecdef) {
    issues.push({ code: "helper_security_definer", detail: proname });
  }
  const searchPath = (row.proconfig ?? []).find((c) =>
    c.toLowerCase().startsWith("search_path="),
  );
  if (
    !searchPath ||
    !/search_path\s*=\s*pg_catalog\s*,\s*pg_temp/i.test(searchPath)
  ) {
    issues.push({
      code: "helper_insecure_search_path",
      detail: `${proname}:${searchPath ?? "missing"}`,
    });
  }
  if (row.public_execute) {
    issues.push({ code: "helper_public_execute", detail: proname });
  }
}

export async function verifyEnforcement(
  client: Client,
): Promise<EnforcementVerifyResult> {
  const issues: VerifyIssue[] = [];
  const runtimeRole = defaultRuntimeRoleName();

  await checkHelperFunction(client, TENANT_CONTEXT_HELPER_FN, issues);
  await checkHelperFunction(client, TENANT_CONTEXT_VERSION_FN, issues);
  await checkHelperFunction(client, IMMUTABILITY_TRIGGER_FN, issues);

  for (const table of MERCHANT_SQL_TABLES) {
    await checkNotNull(client, table, issues);
    await checkRls(client, table, issues);
    await checkPolicies(client, table, runtimeRole, issues);
    await checkTrigger(client, table, issues);
    await checkFkDefinition(
      client,
      {
        name: shopIdFkToShopName(table),
        childTable: table,
        childColumns: ["shopId"],
        parentTable: "Shop",
        parentColumns: ["id"],
        onDelete: "RESTRICT",
        onUpdate: "NO ACTION",
      },
      issues,
    );
  }

  for (const key of COMPOSITE_PARENT_KEYS) {
    await checkCompositeKey(
      client,
      key.name,
      key.table,
      key.columns,
      issues,
    );
  }

  for (const fk of COMPOSITE_FOREIGN_KEYS) {
    await checkFkDefinition(
      client,
      {
        name: fk.name,
        childTable: fk.childTable,
        childColumns: fk.childColumns,
        parentTable: fk.parentTable,
        parentColumns: fk.parentColumns,
        onDelete: fk.onDelete,
        onUpdate: fk.onUpdate,
      },
      issues,
    );
  }

  void ENFORCEMENT_CONTEXT_VERSION;

  return {
    event: "tenant_enforcement_verify",
    ok: issues.length === 0,
    issues,
  };
}

export async function verifyRlsOnly(
  client: Client,
): Promise<EnforcementVerifyResult> {
  const issues: VerifyIssue[] = [];
  const runtimeRole = defaultRuntimeRoleName();
  for (const table of MERCHANT_SQL_TABLES) {
    await checkRls(client, table, issues);
    await checkPolicies(client, table, runtimeRole, issues);
  }
  return { event: "tenant_enforcement_verify", ok: issues.length === 0, issues };
}

export async function verifyImmutabilityOnly(
  client: Client,
): Promise<EnforcementVerifyResult> {
  const issues: VerifyIssue[] = [];
  await checkHelperFunction(client, IMMUTABILITY_TRIGGER_FN, issues);
  for (const table of MERCHANT_SQL_TABLES) {
    await checkTrigger(client, table, issues);
  }
  return { event: "tenant_enforcement_verify", ok: issues.length === 0, issues };
}

export async function detectEnforcementDrift(
  client: Client,
): Promise<EnforcementVerifyResult> {
  const result = await verifyEnforcement(client);
  return {
    event: "tenant_enforcement_verify",
    ok: result.ok,
    issues: result.issues.map((i) => ({
      ...i,
      code: `drift:${i.code}`,
    })),
  };
}

/**
 * Read exact FK definition from catalog for apply short-circuit decisions.
 * Returns null when missing.
 */
export async function readFkCatalogDefinition(
  client: Client,
  name: string,
): Promise<{
  childTable: string;
  parentTable: string;
  childColumns: string[];
  parentColumns: string[];
  onDelete: string;
  onUpdate: string;
  validated: boolean;
} | null> {
  const res = await client.query<{
    convalidated: boolean;
    confupdtype: string;
    confdeltype: string;
    child_table: string;
    parent_table: string;
    child_cols: string[];
    parent_cols: string[];
  }>(
    `SELECT c.convalidated,
            c.confupdtype::text AS confupdtype,
            c.confdeltype::text AS confdeltype,
            child.relname AS child_table,
            parent.relname AS parent_table,
            (
              SELECT array_agg(a.attname ORDER BY u.ord)
              FROM unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
            ) AS child_cols,
            (
              SELECT array_agg(a.attname ORDER BY u.ord)
              FROM unnest(c.confkey) WITH ORDINALITY AS u(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = u.attnum
            ) AS parent_cols
     FROM pg_constraint c
     JOIN pg_class child ON child.oid = c.conrelid
     JOIN pg_class parent ON parent.oid = c.confrelid
     WHERE c.conname = $1 AND c.contype = 'f'`,
    [name],
  );
  if ((res.rowCount ?? 0) === 0) return null;
  const row = res.rows[0];
  return {
    childTable: row.child_table,
    parentTable: row.parent_table,
    childColumns: row.child_cols ?? [],
    parentColumns: row.parent_cols ?? [],
    onDelete: row.confdeltype,
    onUpdate: row.confupdtype,
    validated: row.convalidated,
  };
}
