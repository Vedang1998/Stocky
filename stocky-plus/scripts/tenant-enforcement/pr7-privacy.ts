/**
 * PR7 privacy / admission / authz helpers applied after merchant RLS.
 * Additive. Does not change the runtime processingEnabled tenant predicate.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Client } from "pg";
import { defaultRuntimeRoleName } from "./connection";
import { MERCHANT_SQL_TABLES } from "./manifest";
import { quoteIdent } from "./sql";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const PR7_LOGIN_ROLES = [
  "stocky_privacy_reader",
  "stocky_privacy_erasure",
  "stocky_privacy_operator",
  "stocky_original_admission",
  "stocky_admin_capture",
] as const;

export const PR7_NOLOGIN_ROLES = [
  "stocky_privacy_finalizer_owner",
  "stocky_privacy_target_owner",
  "stocky_privacy_capability_owner",
  "stocky_assignment_verifier_owner",
  "stocky_lifecycle_gate_owner",
  "stocky_admission_origin_owner",
] as const;

export const PR7_ALL_ROLES = [...PR7_LOGIN_ROLES, ...PR7_NOLOGIN_ROLES] as const;

/** Roles the migration owner must belong to (NOINHERIT) to ALTER OWNER / default privileges. */
export const PR7_OWNERSHIP_ROLES = [
  ...PR7_ALL_ROLES,
  "stocky_control_plane",
] as const;

export const PR7_APPLICATION_FUNCTIONS = [
  "stocky_admin_source_contradicted",
  "stocky_apply_bound_customer_effect",
  "stocky_authz_lock",
  "stocky_authz_lock_pair",
  "stocky_bind_execution_context",
  "stocky_capture_original_admin_command",
  "stocky_commit_writer_admission",
  "stocky_customer_target_lock_exclusive",
  "stocky_customer_target_lock_key1",
  "stocky_customer_target_lock_key2",
  "stocky_customer_target_lock_shared",
  "stocky_customer_targets_for_request",
  "stocky_customer_write_guard",
  "stocky_effect_commitment",
  "stocky_establish_modeled_admin_session",
  "stocky_fact_write_guard",
  "stocky_generation_writable",
  "stocky_lifecycle_exclusive_lock",
  "stocky_lifecycle_lock_key",
  "stocky_lifecycle_shared_lock",
  "stocky_mark_uncorrelated_captures_contradicted",
  "stocky_note_queued_work",
  "stocky_participating_write_guard",
  "stocky_privacy_capability_allows",
  "stocky_privacy_claim_attempt",
  "stocky_privacy_complete_customer_redact",
  "stocky_privacy_customer_residual_count",
  "stocky_privacy_data_request_coverage",
  "stocky_privacy_enumerate_targets",
  "stocky_privacy_finalize_shop_delete",
  "stocky_privacy_install_customer_barrier",
  "stocky_privacy_live_attempt_ok",
  "stocky_privacy_publication_lock",
  "stocky_privacy_row_in_manifest",
  "stocky_record_writer_admission",
  "stocky_recover_writer_admission",
  "stocky_shop_canonical_domain",
  "stocky_source_commitment",
  "stocky_source_content_lock",
  "stocky_verify_platform_assignment",
  "stocky_writer_origin_generation",
  "stocky_audit_event_append_only",
] as const;

export const PR7_SECURITY_DEFINER_FUNCTIONS = [
  "stocky_source_content_lock",
  "stocky_mark_uncorrelated_captures_contradicted",
  "stocky_admin_source_contradicted",
  "stocky_record_writer_admission",
  "stocky_commit_writer_admission",
  "stocky_recover_writer_admission",
  "stocky_privacy_capability_allows",
  "stocky_privacy_row_in_manifest",
  "stocky_privacy_enumerate_targets",
  "stocky_privacy_finalize_shop_delete",
  "stocky_lifecycle_shared_lock",
  "stocky_lifecycle_exclusive_lock",
  "stocky_generation_writable",
  "stocky_verify_platform_assignment",
  "stocky_privacy_claim_attempt",
  "stocky_customer_targets_for_request",
  "stocky_privacy_install_customer_barrier",
  "stocky_customer_write_guard",
  "stocky_privacy_customer_residual_count",
  "stocky_privacy_complete_customer_redact",
  "stocky_privacy_data_request_coverage",
  "stocky_shop_canonical_domain",
  "stocky_writer_origin_generation",
  "stocky_establish_modeled_admin_session",
  "stocky_capture_original_admin_command",
  "stocky_note_queued_work",
  "stocky_bind_execution_context",
  "stocky_apply_bound_customer_effect",
] as const;

export const PR7_RUNTIME_EXECUTABLE_FUNCTIONS = [
  "stocky_source_commitment()",
  "stocky_lifecycle_shared_lock()",
  "stocky_generation_writable()",
  "stocky_participating_write_guard()",
  "stocky_authz_lock()",
  "stocky_authz_lock_pair()",
  "stocky_verify_platform_assignment()",
  "stocky_shop_canonical_domain()",
  "stocky_writer_origin_generation()",
  "stocky_customer_write_guard()",
  "stocky_fact_write_guard()",
  "stocky_customer_target_lock_key1()",
  "stocky_customer_target_lock_key2()",
  "stocky_customer_target_lock_shared()",
  "stocky_effect_commitment()",
  "stocky_bind_execution_context()",
  "stocky_apply_bound_customer_effect()",
] as const;

export function pr7PrivacyRolesSql(): string {
  const stmts = PR7_ALL_ROLES.map((role) => {
    const login = (PR7_LOGIN_ROLES as readonly string[]).includes(role);
    const kind = login ? "LOGIN" : "NOLOGIN";
    return `
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${quoteLiteral(role)}) THEN
  CREATE ROLE ${quoteIdent(role)} ${kind} NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
END IF;`;
  });
  const grantList = PR7_ALL_ROLES.map((role) => quoteIdent(role)).join(", ");
  const cpPassword = process.env.STOCKY_CONTROL_PLANE_ROLE_PASSWORD?.trim();
  const cpPasswordSql = cpPassword
    ? ` PASSWORD ${quoteLiteral(cpPassword)}`
    : "";
  const peer = `
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stocky_control_plane') THEN
  CREATE ROLE stocky_control_plane LOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE${cpPasswordSql};
END IF;`;
  // Membership is required to ALTER OWNER / default privileges. Skip GRANT when
  // already a member (shared-cluster roles created by another catalog). INHERIT
  // stays false so a NOINHERIT migration owner cannot acquire erasure power.
  const membership = PR7_OWNERSHIP_ROLES.map(
    (role) => `
IF NOT pg_has_role(current_user, ${quoteLiteral(role)}, 'MEMBER') THEN
  BEGIN
    EXECUTE format('GRANT %I TO CURRENT_USER WITH INHERIT FALSE', ${quoteLiteral(role)});
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'pr7_role_grant_denied:%', ${quoteLiteral(role)}
      USING ERRCODE = '42501';
  END;
END IF;`,
  ).join("\n");
  return `DO $$ BEGIN\n${stmts.join("\n")}\n${peer}\n${membership}\nEND$$;
GRANT USAGE ON SCHEMA public TO ${grantList}, stocky_control_plane;`;
}

/**
 * Bootstrap/superuser grant of existing cluster-global PR7 roles onto a
 * CREATEROLE migration owner. Does not grant ADMIN OPTION (no membership
 * escalation). INHERIT remains false.
 */
export async function grantExistingPr7RolesToMigrationOwner(
  client: Client,
  migrationOwner: string,
): Promise<void> {
  for (const role of PR7_OWNERSHIP_ROLES) {
    const exists = await client.query(
      `SELECT 1 FROM pg_roles WHERE rolname = $1`,
      [role],
    );
    if (!exists.rowCount) continue;
    await client.query(
      `GRANT ${quoteIdent(role)} TO ${quoteIdent(migrationOwner)} WITH INHERIT FALSE`,
    );
  }
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Split SQL on top-level semicolons, preserving $$ function bodies. */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let buf = "";
  let i = 0;
  while (i < sql.length) {
    if (sql[i] === "-" && sql[i + 1] === "-") {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? sql.length : nl + 1;
      continue;
    }
    if (sql[i] === "$" && sql[i + 1] === "$") {
      const end = sql.indexOf("$$", i + 2);
      if (end === -1) {
        buf += sql.slice(i);
        break;
      }
      buf += sql.slice(i, end + 2);
      i = end + 2;
      continue;
    }
    if (sql[i] === ";") {
      const stmt = buf.trim();
      if (stmt) statements.push(stmt);
      buf = "";
      i += 1;
      continue;
    }
    buf += sql[i];
    i += 1;
  }
  const tail = buf.trim();
  if (tail) statements.push(tail);
  return statements;
}

export const PR7_FUNCTION_OWNER_TRANSFER_MARKER =
  "-- Function ownership is transferred AFTER REVOKE/GRANT EXECUTE.";

/**
 * GRANT EXECUTE on PR7 runtime-callable helpers to the actual runtime role
 * (may be a fixture-local name, not hardcoded stocky_runtime). Must run while
 * the migration owner still owns the functions.
 */
export async function grantPr7RuntimeExecutableFunctions(
  client: Client,
  runtimeRole: string,
): Promise<void> {
  const role = quoteIdent(runtimeRole);
  const names = PR7_RUNTIME_EXECUTABLE_FUNCTIONS.map((entry) =>
    entry.endsWith("()") ? entry.slice(0, -2) : entry,
  );
  const found = await client.query<{
    proname: string;
    identity_args: string;
    oid: string;
  }>(
    `SELECT p.proname,
            pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_args,
            p.oid::text AS oid
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = ANY($1::text[])`,
    [names],
  );
  const foundNames = new Set(found.rows.map((row) => row.proname));
  const missing = names.filter((name) => !foundNames.has(name));
  if (missing.length > 0) {
    throw new Error(`pr7_runtime_grant_missing_function:${missing.join(",")}`);
  }
  const identity = await client.query<{ current_user: string }>(
    `SELECT current_user`,
  );
  const currentUser = identity.rows[0]?.current_user;
  for (const row of found.rows) {
    const already = await client.query<{ has: boolean }>(
      `SELECT has_function_privilege($1, $2::oid, 'EXECUTE') AS has`,
      [runtimeRole, row.oid],
    );
    if (already.rows[0]?.has) continue;
    const owner = await lookupFunctionOwner(client, row.proname);
    try {
      if (owner && owner !== currentUser) {
        await client.query(`SET ROLE ${quoteIdent(owner)}`);
      }
      await client.query(
        `GRANT EXECUTE ON FUNCTION public.${quoteIdent(row.proname)}(${row.identity_args}) TO ${role}`,
      );
    } finally {
      await client.query("RESET ROLE");
    }
  }
}

const MIGRATED_LIFECYCLE_HELPERS = [
  "stocky_lifecycle_shared_lock(text)",
  "stocky_generation_writable(text)",
  "stocky_participating_write_guard(text)",
  "stocky_shop_canonical_domain(text, text)",
] as const;

function isInsufficientPrivilege(message: string): boolean {
  return /permission denied|must be owner/i.test(message);
}

async function lookupFunctionOwner(
  client: Client,
  proname: string,
): Promise<string | null> {
  const row = await client.query<{ rolname: string }>(
    `SELECT r.rolname
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       JOIN pg_roles r ON r.oid = p.proowner
      WHERE n.nspname = 'public' AND p.proname = $1
      LIMIT 1`,
    [proname],
  );
  return row.rows[0]?.rolname ?? null;
}

async function lookupRelationOwner(
  client: Client,
  relname: string,
): Promise<string | null> {
  const row = await client.query<{ rolname: string }>(
    `SELECT r.rolname
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_roles r ON r.oid = c.relowner
      WHERE n.nspname = 'public' AND c.relname = $1
      LIMIT 1`,
    [relname],
  );
  return row.rows[0]?.rolname ?? null;
}

async function resolveStatementOwner(
  client: Client,
  sql: string,
): Promise<string | null> {
  const normalized = sql.replace(/\s+/g, " ").trim();
  const fn = normalized.match(
    /FUNCTION\s+(?:public\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?\s*\(/i,
  );
  if (fn?.[1]) {
    return lookupFunctionOwner(client, fn[1]);
  }
  const table = normalized.match(
    /(?:ALTER\s+TABLE|POLICY\s+\S+\s+ON|ON\s+TABLE|ON|FROM)\s+(?:public\.)?"([A-Za-z_][A-Za-z0-9_]*)"/i,
  );
  if (table?.[1]) {
    return lookupRelationOwner(client, table[1]);
  }
  return null;
}

async function queryAsOwnerIfNeeded(
  client: Client,
  sql: string,
): Promise<void> {
  try {
    await client.query(sql);
    return;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isInsufficientPrivilege(message)) throw err;
    const owner = await resolveStatementOwner(client, sql);
    const identity = await client.query<{ current_user: string }>(
      `SELECT current_user`,
    );
    if (!owner || owner === identity.rows[0]?.current_user) throw err;
    try {
      await client.query(`SET ROLE ${quoteIdent(owner)}`);
      await client.query(sql);
    } finally {
      await client.query("RESET ROLE");
    }
  }
}

/**
 * GRANT EXECUTE on migrate-created lifecycle helpers to the actual runtime
 * role. Skips missing functions. Uses SET ROLE when the helper was already
 * transferred to a PR7 owner (idempotent CREATEROLE apply).
 */
export async function grantMigratedLifecycleHelpersToRuntime(
  client: Client,
  runtimeRole: string,
): Promise<void> {
  const role = quoteIdent(runtimeRole);
  for (const spec of MIGRATED_LIFECYCLE_HELPERS) {
    const proname = spec.slice(0, spec.indexOf("("));
    const owner = await lookupFunctionOwner(client, proname);
    if (!owner) continue;
    const has = await client.query<{ has: boolean }>(
      `SELECT has_function_privilege($1, $2::regprocedure, 'EXECUTE') AS has`,
      [runtimeRole, `public.${spec}`],
    );
    if (has.rows[0]?.has) continue;
    const identity = await client.query<{ current_user: string }>(
      `SELECT current_user`,
    );
    try {
      if (owner !== identity.rows[0]?.current_user) {
        await client.query(`SET ROLE ${quoteIdent(owner)}`);
      }
      await client.query(
        `GRANT EXECUTE ON FUNCTION public.${spec} TO ${role}`,
      );
    } finally {
      await client.query("RESET ROLE");
    }
  }
}

export function pr7PrivacyHelpersFileSql(): string {
  return readFileSync(
    path.join(HERE, "sql/pr7-privacy-helpers.sql"),
    "utf8",
  );
}

export function pr7AuditAppendOnlySql(): string {
  return `
CREATE OR REPLACE FUNCTION stocky_audit_event_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit_event_immutable'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF TG_OP = 'DELETE' AND current_user IS DISTINCT FROM 'stocky_privacy_erasure' THEN
    RAISE EXCEPTION 'audit_event_immutable'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION stocky_audit_event_append_only() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_audit_event_append_only ON ${quoteIdent("AuditEvent")};
CREATE TRIGGER trg_audit_event_append_only
  BEFORE UPDATE OR DELETE ON ${quoteIdent("AuditEvent")}
  FOR EACH ROW
  EXECUTE FUNCTION stocky_audit_event_append_only();
`.trim();
}

export function pr7AdditionalMerchantPrivacyPoliciesSql(): string {
  const already = new Set([
    "ShopifyOrderFact",
    "ShopifyOrderLineFact",
    "AuditEvent",
  ]);
  const parts: string[] = [];
  for (const table of MERCHANT_SQL_TABLES) {
    if (already.has(table)) continue;
    const t = quoteIdent(table);
    const read = quoteIdent(`${table}_privacy_read`);
    const delCust = quoteIdent(`${table}_privacy_delete_customer`);
    const delShop = quoteIdent(`${table}_privacy_delete_shop`);
    const enumerate = quoteIdent(`${table}_privacy_enumerate`);
    parts.push(`
DROP POLICY IF EXISTS ${read} ON ${t};
DROP POLICY IF EXISTS ${delCust} ON ${t};
DROP POLICY IF EXISTS ${delShop} ON ${t};
DROP POLICY IF EXISTS ${enumerate} ON ${t};
CREATE POLICY ${read} ON ${t}
  FOR SELECT TO stocky_privacy_reader, stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('READ', "shopId") AND stocky_privacy_row_in_manifest(${quoteLiteral(table)}, id));
CREATE POLICY ${delCust} ON ${t}
  FOR DELETE TO stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('DELETE_CUSTOMER', "shopId") AND stocky_privacy_row_in_manifest(${quoteLiteral(table)}, id));
CREATE POLICY ${delShop} ON ${t}
  FOR DELETE TO stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('DELETE_SHOP', "shopId"));
CREATE POLICY ${enumerate} ON ${t}
  FOR SELECT TO stocky_privacy_target_owner
  USING ("shopId" = (SELECT r."targetShopId" FROM public."PrivacyRequest" r WHERE r.id = NULLIF(current_setting('stocky.privacy_request_id', true), '')));
GRANT SELECT ON ${t} TO stocky_privacy_reader, stocky_privacy_erasure, stocky_privacy_target_owner;
GRANT DELETE ON ${t} TO stocky_privacy_erasure;
`);
  }
  const shopInserts = MERCHANT_SQL_TABLES.map(
    (table) => `
    INSERT INTO public."PrivacyTargetKey"("requestId","shopId",surface,"rowId")
      SELECT r.id, r."targetShopId", ${quoteLiteral(table)}, f.id
      FROM public.${quoteIdent(table)} f WHERE f."shopId" = r."targetShopId";`,
  ).join("\n");
  parts.push(`
CREATE OR REPLACE FUNCTION public.stocky_privacy_shop_residual_count(p_shop_id text)
RETURNS bigint
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  r public."PrivacyRequest"%ROWTYPE;
  v_req text := NULLIF(current_setting('stocky.privacy_request_id', true), '');
  v_shop text := NULLIF(current_setting('stocky.current_shop_id', true), '');
  v_att text := NULLIF(current_setting('stocky.privacy_attempt_id', true), '');
  n bigint := 0;
  t bigint;
BEGIN
  IF v_req IS NULL OR v_req = '' THEN
    RAISE EXCEPTION 'residual_request_guc_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = v_req;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'residual_request_missing' USING ERRCODE = 'P0001';
  END IF;
  IF v_shop IS DISTINCT FROM p_shop_id OR r."targetShopId" IS DISTINCT FROM p_shop_id THEN
    RAISE EXCEPTION 'residual_tenant_mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_att IS NULL OR NOT public.stocky_privacy_live_attempt_ok(r.id, v_att) THEN
    RAISE EXCEPTION 'residual_stale_attempt' USING ERRCODE = '42501';
  END IF;
  IF NOT public.stocky_privacy_capability_allows('READ', p_shop_id) THEN
    RAISE EXCEPTION 'residual_capability_denied' USING ERRCODE = '42501';
  END IF;
${MERCHANT_SQL_TABLES.map(
  (table) => `  SELECT count(*) INTO t FROM public.${quoteIdent(table)} WHERE "shopId" = p_shop_id;
  n := n + t;`,
).join("\n")}
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.stocky_privacy_shop_residual_count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_shop_residual_count(text) TO stocky_privacy_erasure, stocky_control_plane, stocky_privacy_target_owner;
ALTER FUNCTION public.stocky_privacy_shop_residual_count(text) OWNER TO stocky_privacy_target_owner;
`);
  parts.push(`
CREATE OR REPLACE FUNCTION public.stocky_privacy_enumerate_shop_surfaces(p_request_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  r public."PrivacyRequest"%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'enumerator_request_missing' USING ERRCODE = '42501';
  END IF;
  IF r.topic IS DISTINCT FROM 'shop/redact' THEN
    RAISE EXCEPTION 'enumerator_not_shop_redact' USING ERRCODE = 'P0001';
  END IF;
${shopInserts}
END;
$$;
REVOKE ALL ON FUNCTION public.stocky_privacy_enumerate_shop_surfaces(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_enumerate_shop_surfaces(text) TO stocky_privacy_erasure, stocky_control_plane, stocky_privacy_target_owner;
ALTER FUNCTION public.stocky_privacy_enumerate_shop_surfaces(text) OWNER TO stocky_privacy_target_owner;
`);
  return parts.join("\n");
}

const PR7_IDEMPOTENT_DROP_POLICIES: ReadonlyArray<{
  table: string;
  policy: string;
}> = [
  { table: "WriterAdmissionOrigin", policy: "writer_admission_owner_all" },
  { table: "WriterAdmissionOrigin", policy: "writer_admission_gate_select" },
  {
    table: "WriterAdmissionOriginTarget",
    policy: "writer_admission_target_owner_all",
  },
  {
    table: "WriterAdmissionOriginTarget",
    policy: "writer_admission_target_gate_select",
  },
  { table: "OriginalAdminSession", policy: "original_admin_session_owner_all" },
  { table: "OriginalAdminCapture", policy: "original_admin_capture_owner_all" },
  { table: "OriginalAdminCapture", policy: "original_admin_capture_gate_select" },
  { table: "QueuedWorkSighting", policy: "queued_work_sighting_owner_all" },
  { table: "QueuedWorkSighting", policy: "queued_work_sighting_gate_select" },
  { table: "SourceEffectLink", policy: "source_effect_link_gate_all" },
  { table: "PrivacyTargetKey", policy: "target_key_definer_all" },
  { table: "PrivacyTargetKey", policy: "target_key_cp_select" },
  { table: "ShopifyOrderFact", policy: "order_enumerate" },
  { table: "ShopifyOrderFact", policy: "order_privacy_read" },
  { table: "ShopifyOrderFact", policy: "order_privacy_delete_customer" },
  { table: "ShopifyOrderFact", policy: "order_privacy_delete_shop" },
  { table: "ShopifyOrderLineFact", policy: "line_enumerate" },
  { table: "ShopifyOrderLineFact", policy: "line_privacy_read" },
  { table: "ShopifyOrderLineFact", policy: "line_privacy_delete_customer" },
  { table: "ShopifyOrderLineFact", policy: "line_privacy_delete_shop" },
  { table: "AuditEvent", policy: "audit_enumerate" },
  { table: "AuditEvent", policy: "audit_privacy_read" },
  { table: "AuditEvent", policy: "audit_privacy_delete_customer" },
  { table: "AuditEvent", policy: "audit_privacy_delete_shop" },
  { table: "AuditEvent", policy: "audit_gate_insert" },
  { table: "ShopRoleAssignment", policy: "assignment_runtime_all" },
  { table: "ShopRoleAssignment", policy: "assignment_verifier_select" },
  { table: "ShopRoleAssignment", policy: "assignment_control_plane_select" },
  { table: "ShopRoleAssignment", policy: "assignment_control_plane_delete" },
  { table: "PrivacyRequest", policy: "privacy_request_target_owner_all" },
  { table: "PrivacyRequest", policy: "privacy_request_definer_select" },
  { table: "PrivacyAttempt", policy: "privacy_attempt_target_owner_all" },
  { table: "PrivacyAttempt", policy: "privacy_attempt_definer_select" },
  {
    table: "ShopInstallGeneration",
    policy: "shop_install_generation_definer_select",
  },
  {
    table: "PrivacyCompletionReceipt",
    policy: "completion_receipt_definer_all",
  },
  { table: "DurableJob", policy: "durable_job_admission_select" },
  {
    table: "PrivacyCustomerTargetBarrier",
    policy: "customer_barrier_definer_all",
  },
  {
    table: "PrivacyCustomerTargetBarrier",
    policy: "customer_barrier_gate_select",
  },
  { table: "PrivacyCompletedTarget", policy: "completed_target_definer_all" },
  { table: "PrivacyCompletedTarget", policy: "completed_target_gate_select" },
];

export function pr7IdempotentDropPoliciesSql(): string {
  const named = PR7_IDEMPOTENT_DROP_POLICIES.map(
    ({ table, policy }) =>
      `DROP POLICY IF EXISTS ${quoteIdent(policy)} ON ${quoteIdent(table)};`,
  );
  const extras: string[] = [];
  for (const table of MERCHANT_SQL_TABLES) {
    extras.push(`DROP POLICY IF EXISTS ${quoteIdent(`${table}_privacy_read`)} ON ${quoteIdent(table)};`);
    extras.push(
      `DROP POLICY IF EXISTS ${quoteIdent(`${table}_privacy_delete_customer`)} ON ${quoteIdent(table)};`,
    );
    extras.push(
      `DROP POLICY IF EXISTS ${quoteIdent(`${table}_privacy_delete_shop`)} ON ${quoteIdent(table)};`,
    );
    extras.push(
      `DROP POLICY IF EXISTS ${quoteIdent(`${table}_privacy_enumerate`)} ON ${quoteIdent(table)};`,
    );
  }
  return [...named, ...extras].join("\n");
}

export function pr7ControlPlaneTableGrantsSql(): string {
  return `
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stocky_control_plane') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE ${quoteIdent("ShopInstallGeneration")} TO stocky_control_plane';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${quoteIdent("PrivacyDeliveryBinding")} TO stocky_control_plane';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${quoteIdent("PrivacyDeletionManifest")} TO stocky_control_plane';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${quoteIdent("PrivacyDataRequestArtifact")} TO stocky_control_plane';
    EXECUTE 'GRANT SELECT, INSERT ON TABLE ${quoteIdent("PrivacyCoordinatorEvent")} TO stocky_control_plane';
    EXECUTE 'REVOKE UPDATE, DELETE ON TABLE ${quoteIdent("PrivacyCoordinatorEvent")} FROM stocky_control_plane';
    EXECUTE 'GRANT SELECT, INSERT ON TABLE ${quoteIdent("PrivacyCompletionReceipt")} TO stocky_control_plane';
    EXECUTE 'REVOKE UPDATE, DELETE ON TABLE ${quoteIdent("PrivacyCompletionReceipt")} FROM stocky_control_plane';
    EXECUTE 'GRANT SELECT, DELETE ON TABLE ${quoteIdent("ShopRoleAssignment")} TO stocky_control_plane';
  END IF;
END$$;
`.trim();
}

export async function applyPr7PrivacyHelpers(client: Client): Promise<void> {
  await client.query(pr7PrivacyRolesSql());
  const defaultOwners = [...PR7_ALL_ROLES, "stocky_control_plane"];
  for (const owner of defaultOwners) {
    try {
      // FOR ROLE requires inheriting the target role. A NOINHERIT CREATEROLE
      // owner SET ROLEs after granting schema CREATE (revoked after).
      await client.query(
        `GRANT USAGE, CREATE ON SCHEMA public TO ${quoteIdent(owner)}`,
      );
      await client.query(`SET ROLE ${quoteIdent(owner)}`);
      await client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO ${quoteIdent(owner)}`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO ${quoteIdent(owner)}`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`pr7_default_privileges_failed:${owner}:${message}`);
    } finally {
      await client.query("RESET ROLE");
      await client.query(
        `REVOKE CREATE ON SCHEMA public FROM ${quoteIdent(owner)}`,
      );
    }
  }
  const identity = await client.query<{
    current_user: string;
    session_user: string;
  }>(`SELECT current_user, session_user`);
  if (identity.rows[0].current_user !== identity.rows[0].session_user) {
    throw new Error(
      `pr7_role_not_reset:${identity.rows[0].current_user}:${identity.rows[0].session_user}`,
    );
  }
  // ALTER TABLE/FUNCTION OWNER TO a role requires that role to have CREATE
  // on the schema. Keep it only for the ownership-transfer window.
  const ownershipRoles = [...PR7_OWNERSHIP_ROLES];
  try {
    for (const owner of ownershipRoles) {
      await client.query(
        `GRANT USAGE, CREATE ON SCHEMA public TO ${quoteIdent(owner)}`,
      );
    }
    try {
      const drops = splitSqlStatements(pr7IdempotentDropPoliciesSql());
      for (const drop of drops) {
        await queryAsOwnerIfNeeded(client, drop);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`pr7_drop_policies_failed:${message}`);
    }
    const helpersSql = pr7PrivacyHelpersFileSql();
    const markerAt = helpersSql.indexOf(PR7_FUNCTION_OWNER_TRANSFER_MARKER);
    if (markerAt < 0) {
      throw new Error("pr7_helpers_owner_marker_missing");
    }
    const beforeOwner = splitSqlStatements(helpersSql.slice(0, markerAt));
    const ownerTransfer = splitSqlStatements(helpersSql.slice(markerAt));
    const executeHelpers = async (
      statements: string[],
      indexOffset: number,
    ): Promise<void> => {
      for (let index = 0; index < statements.length; index += 1) {
        try {
          await queryAsOwnerIfNeeded(client, statements[index]!);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const preview = statements[index]!.replace(/\s+/g, " ").slice(0, 160);
          throw new Error(
            `pr7_helpers_sql_failed:${indexOffset + index}:${preview}:${message}`,
          );
        }
      }
    };
    await executeHelpers(beforeOwner, 0);
    try {
      await grantPr7RuntimeExecutableFunctions(
        client,
        defaultRuntimeRoleName(),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`pr7_runtime_execute_grant_failed:${message}`);
    }
    await executeHelpers(ownerTransfer, beforeOwner.length);
    try {
      for (const stmt of splitSqlStatements(pr7AuditAppendOnlySql())) {
        await queryAsOwnerIfNeeded(client, stmt);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`pr7_audit_append_only_failed:${message}`);
    }
    try {
      for (const stmt of splitSqlStatements(
        pr7AdditionalMerchantPrivacyPoliciesSql(),
      )) {
        await queryAsOwnerIfNeeded(client, stmt);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`pr7_additional_policies_failed:${message}`);
    }
    try {
      await client.query(pr7ControlPlaneTableGrantsSql());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`pr7_control_plane_grants_failed:${message}`);
    }
  } finally {
    for (const owner of ownershipRoles) {
      await client.query(
        `REVOKE CREATE ON SCHEMA public FROM ${quoteIdent(owner)}`,
      );
    }
  }
}
