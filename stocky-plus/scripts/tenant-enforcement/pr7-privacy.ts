/**
 * PR7 privacy / admission / authz helpers applied after merchant RLS.
 * Additive. Does not change the runtime processingEnabled tenant predicate.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Client } from "pg";
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
  const loginList = PR7_LOGIN_ROLES.map((role) => quoteIdent(role)).join(", ");
  return `DO $$ BEGIN\n${stmts.join("\n")}\nEND$$;
GRANT USAGE ON SCHEMA public TO ${grantList};
GRANT ${loginList} TO CURRENT_USER;`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
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
  IF TG_OP = 'DELETE' AND session_user IS DISTINCT FROM 'stocky_privacy_erasure' THEN
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
  n bigint := 0;
  t bigint;
BEGIN
${MERCHANT_SQL_TABLES.map(
  (table) => `  SELECT count(*) INTO t FROM public.${quoteIdent(table)} WHERE "shopId" = p_shop_id;
  n := n + t;`,
).join("\n")}
  RETURN n;
END;
$$;
ALTER FUNCTION public.stocky_privacy_shop_residual_count(text) OWNER TO stocky_privacy_target_owner;
REVOKE ALL ON FUNCTION public.stocky_privacy_shop_residual_count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_shop_residual_count(text) TO stocky_privacy_erasure, stocky_control_plane, stocky_privacy_target_owner;
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
ALTER FUNCTION public.stocky_privacy_enumerate_shop_surfaces(text) OWNER TO stocky_privacy_target_owner;
REVOKE ALL ON FUNCTION public.stocky_privacy_enumerate_shop_surfaces(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_enumerate_shop_surfaces(text) TO stocky_privacy_erasure, stocky_control_plane, stocky_privacy_target_owner;
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
  END IF;
END$$;
`.trim();
}

export async function applyPr7PrivacyHelpers(client: Client): Promise<void> {
  await client.query(pr7PrivacyRolesSql());
  await client.query(pr7IdempotentDropPoliciesSql());
  await client.query(pr7PrivacyHelpersFileSql());
  await client.query(pr7AuditAppendOnlySql());
  await client.query(pr7AdditionalMerchantPrivacyPoliciesSql());
  await client.query(pr7ControlPlaneTableGrantsSql());
}
