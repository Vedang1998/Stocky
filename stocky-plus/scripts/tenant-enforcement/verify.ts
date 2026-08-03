/**
 * Post-enforcement verification and drift detection.
 */
import type { Client } from "pg";
import {
  COMPOSITE_FOREIGN_KEYS,
  COMPOSITE_PARENT_KEYS,
  ENFORCEMENT_CONTEXT_VERSION,
  IMMUTABILITY_TRIGGER_FN,
  MERCHANT_SQL_TABLES,
  TENANT_CONTEXT_HELPER_FN,
  immutabilityTriggerName,
  rlsPolicyName,
  shopIdFkToShopName,
  shopIdNotNullCheckName,
} from "./manifest";
import { defaultRuntimeRoleName } from "./connection";

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
  const res = await client.query<{
    polname: string;
    polcmd: string;
    roles: string[];
    permissive: string;
  }>(
    `SELECT p.polname,
            p.polcmd::text AS polcmd,
            ARRAY(SELECT attrol.rolname FROM pg_roles attrol WHERE attrol.oid = ANY(p.polroles)) AS roles,
            CASE WHEN p.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END AS permissive
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
    const cmdMap: Record<string, string> = {
      select: "r",
      insert: "a",
      update: "w",
      delete: "d",
    };
    if (row.polcmd !== cmdMap[cmd]) {
      issues.push({
        code: "policy_wrong_command",
        table,
        detail: `${name}:${row.polcmd}`,
      });
    }
    if (!row.roles.includes(runtimeRole)) {
      issues.push({
        code: "policy_wrong_role",
        table,
        detail: `${name}:roles=${row.roles.join(",")}`,
      });
    }
  }

  // No unexpected policies
  for (const row of res.rows) {
    const allowed = expected.map((c) => rlsPolicyName(table, c));
    if (!allowed.includes(row.polname)) {
      issues.push({
        code: "unexpected_policy",
        table,
        detail: row.polname,
      });
    }
  }

  // PUBLIC role should not be targeted via empty polroles meaning PUBLIC
  // In PG, polroles empty array means PUBLIC.
  for (const row of res.rows) {
    if (row.roles.length === 0) {
      issues.push({
        code: "public_policy",
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
  const res = await client.query<{ tgname: string; proname: string }>(
    `SELECT t.tgname, p.proname
     FROM pg_trigger t
     JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_proc p ON p.oid = t.tgfoid
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
  const check = await client.query(
    `SELECT 1 FROM pg_constraint WHERE conname = $1 AND convalidated`,
    [shopIdNotNullCheckName(table)],
  );
  // Helper check may remain; if absent after SET NOT NULL that's ok if column is NOT NULL
  void check;
}

async function checkCompositeKey(
  client: Client,
  name: string,
  table: string,
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
}

async function checkFk(
  client: Client,
  name: string,
  issues: VerifyIssue[],
): Promise<void> {
  const res = await client.query<{ convalidated: boolean }>(
    `SELECT convalidated FROM pg_constraint WHERE conname = $1 AND contype = 'f'`,
    [name],
  );
  if ((res.rowCount ?? 0) === 0) {
    issues.push({ code: "fk_missing", detail: name });
    return;
  }
  if (!res.rows[0].convalidated) {
    issues.push({ code: "fk_not_validated", detail: name });
  }
}

export async function verifyEnforcement(
  client: Client,
): Promise<EnforcementVerifyResult> {
  const issues: VerifyIssue[] = [];
  const runtimeRole = defaultRuntimeRoleName();

  // Helper functions
  const fn = await client.query(
    `SELECT 1 FROM pg_proc WHERE proname = $1`,
    [TENANT_CONTEXT_HELPER_FN],
  );
  if ((fn.rowCount ?? 0) === 0) {
    issues.push({
      code: "helper_missing",
      detail: TENANT_CONTEXT_HELPER_FN,
    });
  }

  for (const table of MERCHANT_SQL_TABLES) {
    await checkNotNull(client, table, issues);
    await checkRls(client, table, issues);
    await checkPolicies(client, table, runtimeRole, issues);
    await checkTrigger(client, table, issues);
    await checkFk(client, shopIdFkToShopName(table), issues);
  }

  for (const key of COMPOSITE_PARENT_KEYS) {
    await checkCompositeKey(client, key.name, key.table, issues);
  }

  for (const fk of COMPOSITE_FOREIGN_KEYS) {
    await checkFk(client, fk.name, issues);
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
  const fn = await client.query(
    `SELECT 1 FROM pg_proc WHERE proname = $1`,
    [IMMUTABILITY_TRIGGER_FN],
  );
  if ((fn.rowCount ?? 0) === 0) {
    issues.push({
      code: "immutability_fn_missing",
      detail: IMMUTABILITY_TRIGGER_FN,
    });
  }
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
