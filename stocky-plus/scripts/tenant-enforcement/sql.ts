/**
 * SQL builders for tenant context helpers, RLS, and immutability triggers.
 */
import {
  ENFORCEMENT_CONTEXT_VERSION,
  GUC_CONTEXT_VERSION,
  GUC_SHOP_ID,
  IMMUTABILITY_TRIGGER_FN,
  MERCHANT_SQL_TABLES,
  TENANT_CONTEXT_HELPER_FN,
  TENANT_CONTEXT_VERSION_FN,
  immutabilityTriggerName,
  rlsPolicyName,
} from "./manifest";

export function quoteIdent(ident: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ident)) {
    throw new Error(`Refusing unsafe SQL identifier: ${ident}`);
  }
  return `"${ident}"`;
}

export function helperFunctionsSql(): string {
  return `
CREATE OR REPLACE FUNCTION ${TENANT_CONTEXT_HELPER_FN}()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT NULLIF(current_setting('${GUC_SHOP_ID}', true), '');
$$;

CREATE OR REPLACE FUNCTION ${TENANT_CONTEXT_VERSION_FN}()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT NULLIF(current_setting('${GUC_CONTEXT_VERSION}', true), '');
$$;

CREATE OR REPLACE FUNCTION ${IMMUTABILITY_TRIGGER_FN}()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW."shopId" IS DISTINCT FROM OLD."shopId" THEN
    RAISE EXCEPTION 'stocky_tenant_key_immutable: shopId cannot be changed'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION stocky_shop_processing_enabled(p_shop_id text)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT s."processingEnabled" FROM public."Shop" s WHERE s."id" = p_shop_id),
    false
  );
$$;

REVOKE ALL ON FUNCTION stocky_shop_processing_enabled(text) FROM PUBLIC;

REVOKE ALL ON FUNCTION ${TENANT_CONTEXT_HELPER_FN}() FROM PUBLIC;
REVOKE ALL ON FUNCTION ${TENANT_CONTEXT_VERSION_FN}() FROM PUBLIC;
REVOKE ALL ON FUNCTION ${IMMUTABILITY_TRIGGER_FN}() FROM PUBLIC;
`.trim();
}

export function grantHelpersToRuntimeSql(runtimeRole: string): string {
  const role = quoteIdent(runtimeRole);
  return `
GRANT EXECUTE ON FUNCTION ${TENANT_CONTEXT_HELPER_FN}() TO ${role};
GRANT EXECUTE ON FUNCTION ${TENANT_CONTEXT_VERSION_FN}() TO ${role};
GRANT EXECUTE ON FUNCTION stocky_shop_processing_enabled(text) TO ${role};
`.trim();
}

export function rlsEnableSql(table: string): string {
  const t = quoteIdent(table);
  return `
ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${t} FORCE ROW LEVEL SECURITY;
`.trim();
}

export function rlsPoliciesSql(table: string, runtimeRole: string): string {
  const t = quoteIdent(table);
  const role = quoteIdent(runtimeRole);
  const pred = `${quoteIdent("shopId")} IS NOT NULL AND ${quoteIdent("shopId")} = ${TENANT_CONTEXT_HELPER_FN}() AND ${TENANT_CONTEXT_VERSION_FN}() = '${ENFORCEMENT_CONTEXT_VERSION}' AND stocky_shop_processing_enabled(${quoteIdent("shopId")})`;

  const drop = (cmd: string) =>
    `DROP POLICY IF EXISTS ${quoteIdent(rlsPolicyName(table, cmd as "select"))} ON ${t};`;

  return `
${drop("select")}
${drop("insert")}
${drop("update")}
${drop("delete")}

CREATE POLICY ${quoteIdent(rlsPolicyName(table, "select"))} ON ${t}
  FOR SELECT TO ${role}
  USING (${pred});

CREATE POLICY ${quoteIdent(rlsPolicyName(table, "insert"))} ON ${t}
  FOR INSERT TO ${role}
  WITH CHECK (${pred});

CREATE POLICY ${quoteIdent(rlsPolicyName(table, "update"))} ON ${t}
  FOR UPDATE TO ${role}
  USING (${pred})
  WITH CHECK (${pred});

CREATE POLICY ${quoteIdent(rlsPolicyName(table, "delete"))} ON ${t}
  FOR DELETE TO ${role}
  USING (${pred});
`.trim();
}

export function immutabilityTriggerSql(table: string): string {
  const t = quoteIdent(table);
  const trg = quoteIdent(immutabilityTriggerName(table));
  return `
DROP TRIGGER IF EXISTS ${trg} ON ${t};
CREATE TRIGGER ${trg}
  BEFORE UPDATE OF ${quoteIdent("shopId")} ON ${t}
  FOR EACH ROW
  EXECUTE FUNCTION ${IMMUTABILITY_TRIGGER_FN}();
`.trim();
}

export function allMerchantRlsSql(runtimeRole: string): string {
  return MERCHANT_SQL_TABLES.map(
    (table) =>
      `${rlsEnableSql(table)}\n${rlsPoliciesSql(table, runtimeRole)}\n${immutabilityTriggerSql(table)}`,
  ).join("\n\n");
}

export const CONTEXT_VERSION_LITERAL = ENFORCEMENT_CONTEXT_VERSION;
