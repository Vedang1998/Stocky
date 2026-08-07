/**
 * Restricted runtime role provisioning and verification (D-015 / D-016).
 *
 * Exact privilege allowlist + recursive membership checks (F-PR3-05/09/10/11).
 * Merchant DML grants are withheld until RLS is verified (F-PR3-02).
 */
import type { Client } from "pg";
import {
  BOOTSTRAP_TABLES,
  CONTROL_TABLES,
  IMMUTABILITY_TRIGGER_FN,
  MERCHANT_SQL_TABLES,
  PLATFORM_CONTROL_PLANE_SQL_TABLES,
  TENANT_CONTEXT_HELPER_FN,
  TENANT_CONTEXT_VERSION_FN,
} from "./manifest";
import { grantHelpersToRuntimeSql, helperFunctionsSql, quoteIdent } from "./sql";
import {
  defaultMigrationRoleName,
  defaultRuntimeRoleName,
} from "./connection";
import { verifyRlsOnly } from "./verify";
import {
  defaultControlPlaneRoleName,
  provisionControlPlaneRole,
} from "../sync-control-plane/roles";
export { defaultControlPlaneRoleName, provisionControlPlaneRole };

const ALLOWED_TABLE_PRIVS = new Set([
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
]);

const FORBIDDEN_TABLE_PRIVS = [
  "TRUNCATE",
  "REFERENCES",
  "TRIGGER",
] as const;

const SEQUENCE_PRIVS = ["USAGE", "SELECT", "UPDATE"] as const;

function assertSafeRoleName(name: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe role name rejected: ${name}`);
  }
  return name;
}

const APPROVED_RUNTIME_EXECUTABLE_FUNCTIONS = new Set([
  `${TENANT_CONTEXT_HELPER_FN}()`,
  `${TENANT_CONTEXT_VERSION_FN}()`,
  // Checked via proname() form in collectFunctionPrivilegeFailures.
  "stocky_shop_processing_enabled()",
]);

const APPROVED_APPLICATION_FUNCTIONS = new Set([
  TENANT_CONTEXT_HELPER_FN,
  TENANT_CONTEXT_VERSION_FN,
  IMMUTABILITY_TRIGGER_FN,
  "stocky_shop_processing_enabled",
  "stocky_durable_job_transition_guard",
  "stocky_has_application_receipt",
  "stocky_dispatch_ready_shop_maintain",
  "stocky_dispatch_ready_shop_sync_enabled",
]);

/** Narrow SECURITY DEFINER allowlist — locked search_path required (F-PR4-04). */
const APPROVED_SECURITY_DEFINER_FUNCTIONS = new Set([
  "stocky_has_application_receipt",
]);

type DefaultAclObjType = "r" | "S" | "f";

function defaultAclObjLabel(objtype: DefaultAclObjType): string {
  return objtype === "r" ? "table" : objtype === "S" ? "sequence" : "function";
}

/**
 * Roles that may create objects in public and therefore need default-ACL review.
 */
export async function collectObjectCreatorRoles(
  client: Client,
): Promise<string[]> {
  const migrationRole = defaultMigrationRoleName();
  const rows = await client.query<{ owner: string }>(
    `SELECT DISTINCT owner FROM (
       SELECT r.rolname AS owner
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_roles r ON r.oid = c.relowner
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'S', 'v', 'm')
       UNION ALL
       SELECT r.rolname AS owner
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       JOIN pg_roles r ON r.oid = p.proowner
       WHERE n.nspname = 'public'
       UNION ALL
       SELECT current_user::text AS owner
       UNION ALL
       SELECT rolname AS owner FROM pg_roles WHERE rolname = $1
     ) s
     WHERE owner IS NOT NULL AND owner <> ''
     ORDER BY owner`,
    [migrationRole],
  );
  return rows.rows.map((r) => r.owner);
}

/**
 * Effective default ACL for a role/schema/objtype.
 *
 * Mirrors PostgreSQL lookup order: schema-specific defacl, then global defacl,
 * else built-in acldefault(). For functions, an absent row is NOT safe —
 * acldefault('f') includes PUBLIC EXECUTE (F-NEW-02).
 */
export async function readEffectiveDefaultAcl(
  client: Client,
  owner: string,
  objtype: DefaultAclObjType,
): Promise<{
  owner: string;
  schema: string;
  objtype: DefaultAclObjType;
  absent: boolean;
  source: "schema" | "global" | "acldefault";
  effectiveAcl: string;
  grants: Array<{ grantee: string; privilege_type: string }>;
}> {
  const res = await client.query<{
    absent: boolean;
    source: "schema" | "global" | "acldefault";
    grantee: string;
    privilege_type: string;
  }>(
    `WITH role_row AS (
       SELECT oid, rolname FROM pg_roles WHERE rolname = $1
     ),
     public_ns AS (
       SELECT oid FROM pg_namespace WHERE nspname = 'public'
     ),
     schema_def AS (
       SELECT d.defaclacl
       FROM pg_default_acl d, role_row r, public_ns n
       WHERE d.defaclrole = r.oid
         AND d.defaclnamespace = n.oid
         AND d.defaclobjtype = $2
     ),
     global_def AS (
       SELECT d.defaclacl
       FROM pg_default_acl d, role_row r
       WHERE d.defaclrole = r.oid
         AND d.defaclnamespace = 0
         AND d.defaclobjtype = $2
     ),
     effective AS (
       SELECT
         (SELECT defaclacl FROM schema_def) IS NULL
           AND (SELECT defaclacl FROM global_def) IS NULL AS absent,
         CASE
           WHEN (SELECT defaclacl FROM schema_def) IS NOT NULL THEN 'schema'
           WHEN (SELECT defaclacl FROM global_def) IS NOT NULL THEN 'global'
           ELSE 'acldefault'
         END AS source,
         COALESCE(
           (SELECT defaclacl FROM schema_def),
           (SELECT defaclacl FROM global_def),
           acldefault($2::"char", (SELECT oid FROM role_row))
         ) AS effective_acl
       FROM role_row
     )
     SELECT
       e.absent,
       e.source,
       CASE WHEN acl.grantee = 0 THEN 'public' ELSE COALESCE(g.rolname, acl.grantee::text) END AS grantee,
       acl.privilege_type
     FROM effective e
     CROSS JOIN LATERAL aclexplode(e.effective_acl) acl
     LEFT JOIN pg_roles g ON g.oid = acl.grantee`,
    [owner, objtype],
  );
  if ((res.rowCount ?? 0) === 0) {
    // Role exists but effective ACL exploded to zero grants (empty ACL).
    const exists = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [
      owner,
    ]);
    if ((exists.rowCount ?? 0) === 0) {
      throw new Error(`default_acl_owner_missing:${owner}`);
    }
  }
  const first = res.rows[0];
  const grants = res.rows
    .filter((r) => r.grantee && r.privilege_type)
    .map((r) => ({ grantee: r.grantee, privilege_type: r.privilege_type }));
  const meta = await client.query<{
    absent: boolean;
    source: "schema" | "global" | "acldefault";
    effective_acl: string;
  }>(
    `WITH role_row AS (
       SELECT oid FROM pg_roles WHERE rolname = $1
     ),
     public_ns AS (
       SELECT oid FROM pg_namespace WHERE nspname = 'public'
     ),
     schema_def AS (
       SELECT d.defaclacl
       FROM pg_default_acl d, role_row r, public_ns n
       WHERE d.defaclrole = r.oid
         AND d.defaclnamespace = n.oid
         AND d.defaclobjtype = $2
     ),
     global_def AS (
       SELECT d.defaclacl
       FROM pg_default_acl d, role_row r
       WHERE d.defaclrole = r.oid
         AND d.defaclnamespace = 0
         AND d.defaclobjtype = $2
     )
     SELECT
       (SELECT defaclacl FROM schema_def) IS NULL
         AND (SELECT defaclacl FROM global_def) IS NULL AS absent,
       CASE
         WHEN (SELECT defaclacl FROM schema_def) IS NOT NULL THEN 'schema'
         WHEN (SELECT defaclacl FROM global_def) IS NOT NULL THEN 'global'
         ELSE 'acldefault'
       END AS source,
       COALESCE(
         (SELECT defaclacl FROM schema_def),
         (SELECT defaclacl FROM global_def),
         acldefault($2::"char", (SELECT oid FROM role_row))
       )::text AS effective_acl
     FROM role_row`,
    [owner, objtype],
  );
  return {
    owner,
    schema: "public",
    objtype,
    absent: meta.rows[0]?.absent ?? first?.absent ?? true,
    source: meta.rows[0]?.source ?? first?.source ?? "acldefault",
    effectiveAcl: meta.rows[0]?.effective_acl ?? "",
    grants,
  };
}

/**
 * Inspect effective default privileges for unsafe grants to runtime or PUBLIC
 * (F-PR3C-02 / F-NEW-02). Returns stable issue codes — does not mutate.
 *
 * For functions, absent pg_default_acl uses acldefault() which includes
 * PUBLIC EXECUTE and is therefore unsafe.
 */
export async function collectDefaultAclFailures(
  client: Client,
  runtimeRole: string,
): Promise<string[]> {
  const failures: string[] = [];
  const creators = await collectObjectCreatorRoles(client);
  const objtypes: DefaultAclObjType[] = ["r", "S", "f"];

  for (const owner of creators) {
    for (const objtype of objtypes) {
      const effective = await readEffectiveDefaultAcl(client, owner, objtype);
      const obj = defaultAclObjLabel(objtype);
      if (objtype === "f" && effective.absent) {
        // Built-in acldefault includes PUBLIC EXECUTE — report the absent-row
        // hole once; do not also emit per-privilege noise for the same state.
        failures.push(
          `unsafe_default_function_absent_acldefault:${owner}:public`,
        );
        continue;
      }
      for (const grant of effective.grants) {
        const isRuntime = grant.grantee === runtimeRole;
        const isPublic = grant.grantee === "public";
        if (!isRuntime && !isPublic) continue;
        const granteeKey = isPublic ? "public" : "runtime";
        failures.push(
          `unsafe_default_${obj}_priv:${granteeKey}:${owner}:public:${grant.privilege_type}`,
        );
      }
    }
  }
  return [...new Set(failures)];
}

/**
 * Inspect every public-schema function against the approved allowlist (F-NEW-02).
 */
export async function collectFunctionPrivilegeFailures(
  client: Client,
  runtimeRole: string,
): Promise<string[]> {
  const failures: string[] = [];
  const fns = await client.query<{
    oid: string;
    proname: string;
    signature: string;
    owner: string;
    prosecdef: boolean;
    proconfig: string[] | null;
  }>(
    `SELECT
       p.oid::text AS oid,
       p.proname,
       format('%s(%s)', p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid)) AS signature,
       r.rolname AS owner,
       p.prosecdef,
       p.proconfig
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     JOIN pg_roles r ON r.oid = p.proowner
     WHERE n.nspname = 'public'
     ORDER BY p.proname, 3`,
  );

  const byName = new Map<string, number>();
  for (const fn of fns.rows) {
    byName.set(fn.proname, (byName.get(fn.proname) ?? 0) + 1);
    if (!APPROVED_APPLICATION_FUNCTIONS.has(fn.proname)) {
      failures.push(`unexpected_function:${fn.signature}:owner:${fn.owner}`);
      continue;
    }
    if (fn.prosecdef && !APPROVED_SECURITY_DEFINER_FUNCTIONS.has(fn.proname)) {
      failures.push(`unapproved_security_definer:${fn.signature}`);
    }
    const searchPath = (fn.proconfig ?? []).find((c) =>
      c.startsWith("search_path="),
    );
    if (!searchPath || !searchPath.includes("pg_catalog")) {
      failures.push(`unsafe_function_search_path:${fn.signature}`);
    }

    const publicExec = await client.query<{ has: boolean }>(
      `SELECT has_function_privilege('public', $1::oid, 'EXECUTE') AS has`,
      [fn.oid],
    );
    if (publicExec.rows[0]?.has) {
      failures.push(`public_function_execute:${fn.signature}`);
    }

    const runtimeExec = await client.query<{ has: boolean }>(
      `SELECT has_function_privilege($1, $2::oid, 'EXECUTE') AS has`,
      [runtimeRole, fn.oid],
    );
    const runtimeAllowed = APPROVED_RUNTIME_EXECUTABLE_FUNCTIONS.has(
      `${fn.proname}()`,
    );
    if (runtimeExec.rows[0]?.has && !runtimeAllowed) {
      failures.push(`runtime_function_execute:${fn.signature}`);
    }
    if (!runtimeExec.rows[0]?.has && runtimeAllowed) {
      failures.push(`missing_runtime_function_execute:${fn.signature}`);
    }
  }

  for (const [name, count] of byName) {
    if (count > 1) {
      failures.push(`ambiguous_function_overload:${name}:count:${count}`);
    }
  }

  return [...new Set(failures)];
}

/**
 * Establish persistent safe function defaults for an object-creating role.
 * Proven on PostgreSQL 16: GRANT EXECUTE TO creator + REVOKE EXECUTE FROM PUBLIC
 * stores a non-acldefault pg_default_acl row that removes PUBLIC EXECUTE.
 */
export async function establishSafeFunctionDefaultPrivileges(
  client: Client,
  creatorRole: string,
): Promise<string[]> {
  assertSafeRoleName(creatorRole);
  const actions: string[] = [];
  const statements = [
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(creatorRole)} IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO ${quoteIdent(creatorRole)}`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(creatorRole)} IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(creatorRole)} GRANT EXECUTE ON FUNCTIONS TO ${quoteIdent(creatorRole)}`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(creatorRole)} REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`,
  ];
  for (const sql of statements) {
    await client.query(sql);
    actions.push(sql);
  }
  return actions;
}

/**
 * Verify a newly created probe function is not executable by PUBLIC or runtime.
 */
export async function verifyFutureFunctionDefaultsWithProbe(
  client: Client,
  runtimeRole: string,
): Promise<{ ok: boolean; detail: string[] }> {
  const detail: string[] = [];
  const probe = `stocky_future_fn_probe_${Date.now()}`;
  try {
    await client.query(
      `CREATE FUNCTION ${quoteIdent(probe)}() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$`,
    );
    const pub = await client.query<{ has: boolean }>(
      `SELECT has_function_privilege('public', $1::regprocedure, 'EXECUTE') AS has`,
      [`${probe}()`],
    );
    const rt = await client.query<{ has: boolean }>(
      `SELECT has_function_privilege($1, $2::regprocedure, 'EXECUTE') AS has`,
      [runtimeRole, `${probe}()`],
    );
    if (pub.rows[0]?.has) detail.push("probe_public_execute");
    if (rt.rows[0]?.has) detail.push("probe_runtime_execute");
    const acl = await client.query<{ proacl: string | null }>(
      `SELECT proacl::text AS proacl FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = $1`,
      [probe],
    );
    detail.push(`probe_proacl:${acl.rows[0]?.proacl ?? "NULL"}`);
  } finally {
    await client
      .query(`DROP FUNCTION IF EXISTS ${quoteIdent(probe)}()`)
      .catch(() => undefined);
  }
  return { ok: detail.every((d) => !d.startsWith("probe_public") && !d.startsWith("probe_runtime")), detail };
}

/**
 * Inspect all public-schema sequences for runtime/PUBLIC privileges (F-PR3C-05).
 */
export async function collectSequencePrivilegeFailures(
  client: Client,
  runtimeRole: string,
): Promise<string[]> {
  const failures: string[] = [];
  const seqs = await client.query<{
    seqname: string;
    owner: string;
  }>(
    `SELECT c.relname AS seqname, r.rolname AS owner
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_roles r ON r.oid = c.relowner
     WHERE n.nspname = 'public' AND c.relkind = 'S'`,
  );

  for (const seq of seqs.rows) {
    if (seq.owner === runtimeRole) {
      failures.push(
        `excess_sequence_ownership:${seq.seqname}:owner:${seq.owner}:public`,
      );
    }
    for (const priv of SEQUENCE_PRIVS) {
      const runtimeHas = await client.query<{ has: boolean }>(
        `SELECT has_sequence_privilege($1, format('%I.%I', 'public', $2::text), $3) AS has`,
        [runtimeRole, seq.seqname, priv],
      );
      if (runtimeHas.rows[0]?.has) {
        failures.push(
          `excess_sequence_priv:${seq.seqname}:${runtimeRole}:${priv}:${seq.owner}:public`,
        );
      }
      const publicHas = await client.query<{ has: boolean }>(
        `SELECT has_sequence_privilege('public', format('%I.%I', 'public', $1::text), $2) AS has`,
        [seq.seqname, priv],
      );
      if (publicHas.rows[0]?.has) {
        failures.push(
          `excess_sequence_priv:${seq.seqname}:public:${priv}:${seq.owner}:public`,
        );
      }
    }
  }
  return [...new Set(failures)];
}

/**
 * Digest of public-schema ACL-related catalog state for read-only verifier tests.
 */
export async function catalogPrivilegeDigest(client: Client): Promise<string> {
  const res = await client.query<{ digest: string }>(
    `SELECT md5(string_agg(part, '|' ORDER BY part)) AS digest
     FROM (
       SELECT 'nsp:' || n.nspname || ':' || COALESCE(n.nspacl::text, '') AS part
       FROM pg_namespace n WHERE n.nspname = 'public'
       UNION ALL
       SELECT 'rel:' || c.relname || ':' || c.relkind::text || ':' ||
              COALESCE(c.relacl::text, '') || ':owner=' || r.rolname
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_roles r ON r.oid = c.relowner
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'S', 'v', 'm')
       UNION ALL
       SELECT 'defacl:' || r.rolname || ':' || n.nspname || ':' ||
              d.defaclobjtype::text || ':' || COALESCE(d.defaclacl::text, '')
       FROM pg_default_acl d
       JOIN pg_namespace n ON n.oid = d.defaclnamespace
       JOIN pg_roles r ON r.oid = d.defaclrole
       WHERE n.nspname = 'public'
     ) s`,
  );
  return res.rows[0]?.digest ?? "";
}

/**
 * Run a verifier callback inside a READ ONLY transaction when possible.
 */
export async function withReadOnlyVerifyTransaction<T>(
  client: Client,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query("BEGIN");
  try {
    await client.query("SET TRANSACTION READ ONLY");
    const result = await fn();
    await client.query("ROLLBACK");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  }
}

export type RoleProvisionResult = {
  event: "tenant_roles_provision";
  ok: boolean;
  migrationRole: string;
  runtimeRole: string;
  createdRuntimeRole: boolean;
  phase: "prepare" | "grants" | "full" | "test_harness_unrestricted";
  grantsApplied: string[];
  revokesApplied: string[];
  detectedDrift: string[];
  repairedDrift: string[];
  errors: string[];
  merchantDmlGranted: boolean;
};

export async function revokeMerchantDml(
  client: Client,
  runtimeRole: string,
): Promise<string[]> {
  const revokes: string[] = [];
  for (const table of MERCHANT_SQL_TABLES) {
    await client.query(
      `REVOKE ALL ON TABLE ${quoteIdent(table)} FROM ${quoteIdent(runtimeRole)}`,
    );
    revokes.push(`${table}:ALL`);
  }
  return revokes;
}

export async function grantMerchantDml(
  client: Client,
  runtimeRole: string,
): Promise<string[]> {
  const grants: string[] = [];
  for (const table of MERCHANT_SQL_TABLES) {
    await client.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${quoteIdent(table)} TO ${quoteIdent(runtimeRole)}`,
    );
    grants.push(`${table}:DML`);
  }
  return grants;
}

/**
 * True when every merchant table has FORCE RLS enabled.
 */
export async function isRlsFullyForced(client: Client): Promise<boolean> {
  const forced = await client.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = ANY($1::text[])
       AND c.relforcerowsecurity
       AND c.relrowsecurity`,
    [MERCHANT_SQL_TABLES],
  );
  return Number(forced.rows[0]?.c ?? 0) === MERCHANT_SQL_TABLES.length;
}

/**
 * Runtime has unrestricted merchant access when it can SELECT a merchant table
 * while FORCE RLS is missing on that table (or globally incomplete).
 */
export async function assertSafeRuntimeAccess(
  client: Client,
): Promise<{ ok: boolean; unsafe_runtime_access: boolean; detail: string[] }> {
  const detail: string[] = [];
  const runtimeRole = defaultRuntimeRoleName();
  const roleExists = await client.query(
    `SELECT 1 FROM pg_roles WHERE rolname = $1`,
    [runtimeRole],
  );
  if ((roleExists.rowCount ?? 0) === 0) {
    return { ok: true, unsafe_runtime_access: false, detail: [] };
  }

  for (const table of MERCHANT_SQL_TABLES) {
    const rls = await client.query<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `SELECT c.relrowsecurity, c.relforcerowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = $1`,
      [table],
    );
    const forced =
      rls.rows[0]?.relrowsecurity === true &&
      rls.rows[0]?.relforcerowsecurity === true;

    const hasSelect = await client.query<{ has: boolean }>(
      `SELECT has_table_privilege($1, format('%I.%I', 'public', $2::text), 'SELECT') AS has`,
      [runtimeRole, table],
    );
    if (hasSelect.rows[0]?.has && !forced) {
      detail.push(`unrestricted_select:${table}`);
    }
  }

  return {
    ok: detail.length === 0,
    unsafe_runtime_access: detail.length > 0,
    detail,
  };
}

export async function provisionRoles(
  client: Client,
  options: {
    apply: boolean;
    runtimePassword?: string;
    /**
     * prepare = no merchant DML
     * grants = merchant DML only after RLS verified
     * full = prepare then grants if RLS verified
     * test_harness_unrestricted = PR2 disposable harness only (requires
     *   STOCKY_ALLOW_UNRESTRICTED_RUNTIME_GRANTS=1); grants DML without RLS
     */
    phase?: "prepare" | "grants" | "full" | "test_harness_unrestricted";
    /** Explicitly authorized repair of dangerous attribute/membership drift */
    repairDangerousDrift?: boolean;
    /** Explicitly authorized repair of dangerous default privileges (F-PR3C-02) */
    repairDangerousDefaultPrivileges?: boolean;
  },
): Promise<RoleProvisionResult> {
  const migrationRole = assertSafeRoleName(defaultMigrationRoleName());
  const runtimeRole = assertSafeRoleName(defaultRuntimeRoleName());
  const phase = options.phase ?? "full";
  const errors: string[] = [];
  const grantsApplied: string[] = [];
  const revokesApplied: string[] = [];
  const detectedDrift: string[] = [];
  const repairedDrift: string[] = [];
  let createdRuntimeRole = false;
  let merchantDmlGranted = false;

  if (phase === "test_harness_unrestricted") {
    if (process.env.STOCKY_ALLOW_UNRESTRICTED_RUNTIME_GRANTS !== "1") {
      throw new Error(
        "test_harness_unrestricted requires STOCKY_ALLOW_UNRESTRICTED_RUNTIME_GRANTS=1",
      );
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "test_harness_unrestricted is forbidden when NODE_ENV=production",
      );
    }
  }

  if (options.apply) {
    await client.query(helperFunctionsSql());
  }

  const existing = await client.query<{
    rolname: string;
    rolsuper: boolean;
    rolcreatedb: boolean;
    rolcreaterole: boolean;
    rolbypassrls: boolean;
    rolinherit: boolean;
  }>(
    `SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolinherit
     FROM pg_roles WHERE rolname = $1`,
    [runtimeRole],
  );

  if (existing.rowCount === 0) {
    if (!options.apply) {
      errors.push(`runtime role ${runtimeRole} missing (plan-only)`);
    } else {
      const password =
        options.runtimePassword || process.env.STOCKY_RUNTIME_ROLE_PASSWORD;
      if (!password) {
        throw new Error(
          "STOCKY_RUNTIME_ROLE_PASSWORD is required to create the runtime role (refusing hardcoded fallback)",
        );
      }
      await client.query(
        `CREATE ROLE ${quoteIdent(runtimeRole)} LOGIN PASSWORD '${password.replace(/'/g, "''")}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
      );
      createdRuntimeRole = true;
      const created = await client.query<{
        rolsuper: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        rolbypassrls: boolean;
        rolinherit: boolean;
      }>(
        `SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolinherit
         FROM pg_roles WHERE rolname = $1`,
        [runtimeRole],
      );
      const attrs = created.rows[0];
      if (
        !attrs ||
        attrs.rolsuper ||
        attrs.rolbypassrls ||
        attrs.rolcreatedb ||
        attrs.rolcreaterole ||
        attrs.rolinherit
      ) {
        errors.push(
          `runtime_role_create_attribute_verification_failed:${JSON.stringify(attrs ?? null)}`,
        );
      }
    }
  } else if (
    options.apply &&
    (phase === "prepare" ||
      phase === "full" ||
      phase === "test_harness_unrestricted")
  ) {
    const attrs = existing.rows[0];
    // Privileged attributes that a non-superuser CREATEROLE owner cannot alter
    // (F-NEW-01). Fail closed — require separately authorized bootstrap repair.
    if (attrs.rolsuper) {
      detectedDrift.push("runtime_is_superuser");
      errors.push("runtime_role_superuser_requires_bootstrap_repair");
    }
    if (attrs.rolbypassrls) {
      detectedDrift.push("runtime_has_bypassrls");
      errors.push("runtime_role_bypassrls_requires_bootstrap_repair");
    }
    if (attrs.rolcreatedb) {
      // CREATEDB may only be changed by a role that itself has CREATEDB/superuser.
      detectedDrift.push("runtime_can_createdb");
      errors.push("runtime_role_createdb_requires_bootstrap_repair");
    }

    // Alterable by a non-superuser CREATEROLE owner: CREATEROLE and INHERIT.
    const alterableClauses: string[] = [];
    if (attrs.rolcreaterole) {
      detectedDrift.push("runtime_can_createrole");
      if (options.repairDangerousDrift) {
        alterableClauses.push("NOCREATEROLE");
        repairedDrift.push("repaired:runtime_can_createrole");
      } else {
        errors.push(
          "dangerous_role_attribute_drift:runtime_can_createrole:repair_required",
        );
      }
    }
    if (attrs.rolinherit) {
      detectedDrift.push("runtime_has_inherit");
      if (options.repairDangerousDrift) {
        alterableClauses.push("NOINHERIT");
        repairedDrift.push("repaired:runtime_has_inherit");
      } else {
        errors.push(
          "dangerous_role_attribute_drift:runtime_has_inherit:repair_required",
        );
      }
    }
    // Execute ALTER ROLE only when an alterable attribute actually differs.
    // Never include NOSUPERUSER / NOBYPASSRLS / NOCREATEDB (semantic no-ops
    // still fail under a non-superuser CREATEROLE migration owner).
    if (alterableClauses.length > 0) {
      await client.query(
        `ALTER ROLE ${quoteIdent(runtimeRole)} ${alterableClauses.join(" ")}`,
      );
    }
  }

  if (
    options.apply &&
    (phase === "prepare" ||
      phase === "full" ||
      phase === "test_harness_unrestricted")
  ) {
    // Membership drift — detect before granting anything.
    const membershipIssues = await collectMembershipFailures(
      client,
      runtimeRole,
    );
    if (membershipIssues.length > 0) {
      detectedDrift.push(...membershipIssues);
      if (!options.repairDangerousDrift) {
        errors.push(
          `dangerous_role_membership_drift:${membershipIssues.join(",")}:repair_required`,
        );
      } else {
        for (const issue of membershipIssues) {
          const m = /^member_of:(.+)$/.exec(issue);
          if (m) {
            await client.query(
              `REVOKE ${quoteIdent(m[1])} FROM ${quoteIdent(runtimeRole)}`,
            );
            repairedDrift.push(`revoked_membership:${m[1]}`);
          }
        }
      }
    }

    await client.query(
      `GRANT USAGE ON SCHEMA public TO ${quoteIdent(runtimeRole)}`,
    );
    grantsApplied.push("USAGE ON SCHEMA public");

    // Revoke CREATE on schema from runtime and from PUBLIC (PUBLIC CREATE
    // would make has_schema_privilege true for every role).
    await client.query(
      `REVOKE CREATE ON SCHEMA public FROM ${quoteIdent(runtimeRole)}`,
    );
    revokesApplied.push("CREATE ON SCHEMA public");
    await client.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`);
    revokesApplied.push("CREATE ON SCHEMA public FROM PUBLIC");

    await client.query(grantHelpersToRuntimeSql(runtimeRole));
    grantsApplied.push(`EXECUTE ON ${TENANT_CONTEXT_HELPER_FN}`);
    grantsApplied.push(`EXECUTE ON ${TENANT_CONTEXT_VERSION_FN}`);

    if (phase !== "test_harness_unrestricted") {
      // Always revoke merchant DML first — safe intermediate state.
      revokesApplied.push(...(await revokeMerchantDml(client, runtimeRole)));
    }

    for (const t of BOOTSTRAP_TABLES) {
      const privs = t.expectedRuntimePrivileges.join(", ");
      if (privs) {
        await client.query(
          `GRANT ${privs} ON TABLE ${quoteIdent(t.sqlTable)} TO ${quoteIdent(runtimeRole)}`,
        );
        grantsApplied.push(`${t.sqlTable}:${privs}`);
      }
    }

    for (const t of CONTROL_TABLES) {
      await client.query(
        `REVOKE ALL ON TABLE ${quoteIdent(t.sqlTable)} FROM ${quoteIdent(runtimeRole)}`,
      );
      revokesApplied.push(t.sqlTable);
    }

    // Platform control-plane tables: runtime must have no DML (dispatcher uses control-plane role).
    for (const table of PLATFORM_CONTROL_PLANE_SQL_TABLES) {
      const exists = await client.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [table],
      );
      if ((exists.rowCount ?? 0) === 0) continue;
      await client.query(
        `REVOKE ALL ON TABLE ${quoteIdent(table)} FROM ${quoteIdent(runtimeRole)}`,
      );
      revokesApplied.push(`control_plane:${table}`);
    }

    // Provision stocky_control_plane role when password available.
    try {
      const cp = await provisionControlPlaneRole(client, {
        apply: true,
        password: process.env.STOCKY_CONTROL_PLANE_ROLE_PASSWORD,
      });
      if (cp.ok) {
        grantsApplied.push(...cp.grantsApplied);
      } else {
        // Soft: control-plane role optional until tables exist / password set.
        detectedDrift.push(...cp.errors);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      detectedDrift.push(`control_plane_role:${message.split("\n")[0]}`);
    }

    // _prisma_migrations — revoke if present
    const prismaMig = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = '_prisma_migrations'`,
    );
    if ((prismaMig.rowCount ?? 0) > 0) {
      await client.query(
        `REVOKE ALL ON TABLE ${quoteIdent("_prisma_migrations")} FROM ${quoteIdent(runtimeRole)}`,
      );
      revokesApplied.push("_prisma_migrations");
    }

    // F-PR3C-02 / F-NEW-02: inspect effective default ACLs.
    // Absent function defaults (acldefault PUBLIC EXECUTE) are a baseline hole
    // and are established automatically. Explicit unsafe grants require repair.
    const defaultAclBefore = await collectDefaultAclFailures(
      client,
      runtimeRole,
    );
    const baselineHoles = defaultAclBefore.filter((code) =>
      code.startsWith("unsafe_default_function_absent_acldefault:"),
    );
    const explicitDefaultDrift = defaultAclBefore.filter(
      (code) =>
        !code.startsWith("unsafe_default_function_absent_acldefault:"),
    );

    const creators = new Set(await collectObjectCreatorRoles(client));
    const session = await client.query<{ u: string }>(
      `SELECT current_user::text AS u`,
    );
    if (session.rows[0]?.u) creators.add(session.rows[0].u);
    // Only include configured migration role name when it actually exists.
    const migExists = await client.query(
      `SELECT 1 FROM pg_roles WHERE rolname = $1`,
      [migrationRole],
    );
    if ((migExists.rowCount ?? 0) > 0) creators.add(migrationRole);

    if (baselineHoles.length > 0 && explicitDefaultDrift.length === 0) {
      for (const owner of creators) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(owner)) continue;
        try {
          await establishSafeFunctionDefaultPrivileges(client, owner);
          await client.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC`,
          );
          await client.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} IN SCHEMA public REVOKE ALL ON TABLES FROM ${quoteIdent(runtimeRole)}`,
          );
          await client.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC`,
          );
          await client.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${quoteIdent(runtimeRole)}`,
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(
            `default_privilege_establish_failed:${owner}:${message.split("\n")[0]}`,
          );
        }
      }
      const afterBaseline = await collectDefaultAclFailures(client, runtimeRole);
      if (afterBaseline.length > 0) {
        errors.push(
          `default_function_baseline_incomplete:${afterBaseline.join(",")}`,
        );
      }
    }

    if (explicitDefaultDrift.length > 0) {
      detectedDrift.push(...explicitDefaultDrift);
      if (!options.repairDangerousDefaultPrivileges) {
        errors.push(
          `dangerous_default_acl_drift:${explicitDefaultDrift.join(",")}:repair_required`,
        );
      } else {
        for (const owner of creators) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(owner)) continue;
          await client.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC`,
          );
          await client.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} IN SCHEMA public REVOKE ALL ON TABLES FROM ${quoteIdent(runtimeRole)}`,
          );
          await client.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC`,
          );
          await client.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${quoteIdent(runtimeRole)}`,
          );
          await client.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC`,
          );
          await client.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM ${quoteIdent(runtimeRole)}`,
          );
          await establishSafeFunctionDefaultPrivileges(client, owner);
        }
        const after = await collectDefaultAclFailures(client, runtimeRole);
        const probe = await verifyFutureFunctionDefaultsWithProbe(
          client,
          runtimeRole,
        );
        repairedDrift.push(
          `repaired_default_acl:before=${explicitDefaultDrift.length}:after=${after.length}:codes=${explicitDefaultDrift.join(",")}:probe=${probe.ok ? "ok" : probe.detail.join(",")}`,
        );
        if (after.length > 0) {
          errors.push(`default_acl_repair_incomplete:${after.join(",")}`);
        }
        if (!probe.ok) {
          errors.push(
            `default_acl_repair_probe_failed:${probe.detail.join(",")}`,
          );
        }
      }
    } else if (baselineHoles.length === 0) {
      // Already have non-absent function defaults; still re-assert table/sequence
      // preventive revokes and keep function defaults intact.
      for (const owner of creators) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(owner)) continue;
        try {
          await client.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC`,
          );
          await client.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} IN SCHEMA public REVOKE ALL ON TABLES FROM ${quoteIdent(runtimeRole)}`,
          );
          await client.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC`,
          );
          await client.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${quoteIdent(runtimeRole)}`,
          );
          await establishSafeFunctionDefaultPrivileges(client, owner);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(
            `default_privilege_establish_failed:${owner}:${message.split("\n")[0]}`,
          );
        }
      }
    }
  }

  if (options.apply && phase === "test_harness_unrestricted") {
    grantsApplied.push(...(await grantMerchantDml(client, runtimeRole)));
    merchantDmlGranted = true;
  } else if (options.apply && (phase === "grants" || phase === "full")) {
    const rlsOk = await isRlsFullyForced(client);
    if (!rlsOk) {
      if (phase === "grants") {
        errors.push("merchant_dml_refused_rls_not_forced");
      }
      // full phase: leave merchant DML revoked (safe)
    } else {
      const rlsVerify = await verifyRlsOnly(client);
      if (!rlsVerify.ok) {
        errors.push(
          `merchant_dml_refused_rls_verify_failed:${rlsVerify.issues.map((i) => i.code).join(",")}`,
        );
      } else {
        grantsApplied.push(...(await grantMerchantDml(client, runtimeRole)));
        merchantDmlGranted = true;
      }
    }
  }

  const verify = await verifyRoles(client, {
    requireMerchantDml:
      phase === "test_harness_unrestricted"
        ? true
        : phase === "prepare"
          ? false
          : merchantDmlGranted,
    allowUnrestrictedMerchantDml: phase === "test_harness_unrestricted",
  });
  if (!verify.ok) {
    errors.push(...verify.failures);
  }

  return {
    event: "tenant_roles_provision",
    ok: errors.length === 0 && verify.ok,
    migrationRole,
    runtimeRole,
    createdRuntimeRole,
    phase,
    grantsApplied,
    revokesApplied,
    detectedDrift,
    repairedDrift,
    errors,
    merchantDmlGranted,
  };
}

export type RoleVerifyResult = {
  event: "tenant_roles_verify";
  ok: boolean;
  runtimeRole: string;
  migrationRole: string;
  failures: string[];
  attributes: Record<string, boolean | string | null>;
};

async function collectMembershipFailures(
  client: Client,
  runtimeRole: string,
): Promise<string[]> {
  const failures: string[] = [];
  const migrationRole = defaultMigrationRoleName();
  // Recursive membership via pg_auth_members (direct + transitive).
  // Direction: roles that the RUNTIME role is a member of (escalation path).
  const members = await client.query<{
    granted: string;
    admin_option: boolean;
  }>(
    `WITH RECURSIVE memb AS (
       SELECT m.roleid, m.member, m.admin_option, 1 AS depth
       FROM pg_auth_members m
       JOIN pg_roles r ON r.oid = m.member
       WHERE r.rolname = $1
       UNION ALL
       SELECT m.roleid, m.member, m.admin_option, memb.depth + 1
       FROM pg_auth_members m
       JOIN memb ON m.member = memb.roleid
       WHERE memb.depth < 32
     )
     SELECT DISTINCT grantee.rolname AS granted, memb.admin_option
     FROM memb
     JOIN pg_roles grantee ON grantee.oid = memb.roleid`,
    [runtimeRole],
  );

  for (const row of members.rows) {
    failures.push(`member_of:${row.granted}`);
    if (row.admin_option) {
      failures.push(`admin_option_on:${row.granted}`);
    }
  }

  // Also flag if any granted role is privileged.
  for (const row of members.rows) {
    const attrs = await client.query<{
      rolsuper: boolean;
      rolbypassrls: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
    }>(
      `SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
       FROM pg_roles WHERE rolname = $1`,
      [row.granted],
    );
    const a = attrs.rows[0];
    if (!a) continue;
    if (a.rolsuper) failures.push(`member_of_superuser:${row.granted}`);
    if (a.rolbypassrls) failures.push(`member_of_bypassrls:${row.granted}`);
    if (a.rolcreaterole) failures.push(`member_of_createrole:${row.granted}`);
    if (a.rolcreatedb) failures.push(`member_of_createdb:${row.granted}`);
  }

  // P3-d: PostgreSQL 16 CREATEROLE creator membership is owner→runtime
  // (migration owner is a member of runtime with ADMIN, without INHERIT/SET).
  // That direction is required for administration and is NOT runtime escalation.
  // Reject unexpected members of runtime and reject runtime→owner.
  const tableOwner = await client.query<{ owner: string }>(
    `SELECT r.rolname AS owner
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_roles r ON r.oid = c.relowner
     WHERE n.nspname = 'public' AND c.relname = 'Supplier'
     LIMIT 1`,
  );
  const actualOwner = tableOwner.rows[0]?.owner;

  const creatorsOfRuntime = await client.query<{
    member: string;
    admin_option: boolean;
    inherit_option: boolean;
    set_option: boolean;
  }>(
    `SELECT
       r.rolname AS member,
       m.admin_option,
       m.inherit_option,
       m.set_option
     FROM pg_auth_members m
     JOIN pg_roles r ON r.oid = m.member
     JOIN pg_roles granted ON granted.oid = m.roleid
     WHERE granted.rolname = $1`,
    [runtimeRole],
  );

  for (const row of creatorsOfRuntime.rows) {
    const approvedOwnerAdmin =
      (row.member === migrationRole || row.member === actualOwner) &&
      row.admin_option === true &&
      row.inherit_option === false &&
      row.set_option === false;

    if (approvedOwnerAdmin) {
      continue;
    }
    failures.push(
      `unexpected_runtime_role_member:${row.member}:admin=${row.admin_option}:inherit=${row.inherit_option}:set=${row.set_option}`,
    );
  }

  return [...new Set(failures)];
}

/**
 * Read PostgreSQL 16 creator-membership edges for the runtime role (P3-d).
 */
export async function readRuntimeCreatorMembership(
  client: Client,
  runtimeRole: string,
): Promise<
  Array<{
    member: string;
    admin_option: boolean;
    inherit_option: boolean;
    set_option: boolean;
  }>
> {
  const res = await client.query<{
    member: string;
    admin_option: boolean;
    inherit_option: boolean;
    set_option: boolean;
  }>(
    `SELECT
       r.rolname AS member,
       m.admin_option,
       m.inherit_option,
       m.set_option
     FROM pg_auth_members m
     JOIN pg_roles r ON r.oid = m.member
     JOIN pg_roles granted ON granted.oid = m.roleid
     WHERE granted.rolname = $1
     ORDER BY r.rolname`,
    [runtimeRole],
  );
  return res.rows;
}

async function tableAclPrivileges(
  client: Client,
  table: string,
  grantee: string,
): Promise<string[]> {
  // Only explode an explicit ACL. NULL relacl means default owner-only grants.
  const res = await client.query<{ privilege_type: string }>(
    `SELECT privilege_type
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     CROSS JOIN LATERAL aclexplode(c.relacl) acl
     JOIN pg_roles r ON r.oid = acl.grantee
     WHERE n.nspname = 'public'
       AND c.relname = $1
       AND c.relacl IS NOT NULL
       AND r.rolname = $2`,
    [table, grantee],
  );
  return res.rows.map((r) => r.privilege_type);
}

async function publicTablePrivileges(
  client: Client,
  table: string,
): Promise<string[]> {
  const res = await client.query<{ privilege_type: string }>(
    `SELECT privilege_type
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     CROSS JOIN LATERAL aclexplode(c.relacl) acl
     WHERE n.nspname = 'public'
       AND c.relname = $1
       AND c.relacl IS NOT NULL
       AND acl.grantee = 0`,
    [table],
  );
  return res.rows.map((r) => r.privilege_type);
}

export async function verifyRoles(
  client: Client,
  options: {
    requireMerchantDml?: boolean;
    /** PR2 harness only — merchant DML without FORCE RLS is expected */
    allowUnrestrictedMerchantDml?: boolean;
  } = {},
): Promise<RoleVerifyResult> {
  const migrationRole = assertSafeRoleName(defaultMigrationRoleName());
  const runtimeRole = assertSafeRoleName(defaultRuntimeRoleName());
  const failures: string[] = [];
  const requireMerchantDml =
    options.requireMerchantDml ?? (await isRlsFullyForced(client));
  const allowUnrestricted =
    options.allowUnrestrictedMerchantDml === true &&
    process.env.STOCKY_ALLOW_UNRESTRICTED_RUNTIME_GRANTS === "1";

  const roleRes = await client.query<{
    rolname: string;
    rolsuper: boolean;
    rolcreatedb: boolean;
    rolcreaterole: boolean;
    rolbypassrls: boolean;
    rolcanlogin: boolean;
    rolinherit: boolean;
  }>(
    `SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolcanlogin, rolinherit
     FROM pg_roles WHERE rolname = $1`,
    [runtimeRole],
  );

  if (roleRes.rowCount === 0) {
    failures.push("runtime_role_missing");
    return {
      event: "tenant_roles_verify",
      ok: false,
      runtimeRole,
      migrationRole,
      failures,
      attributes: {},
    };
  }

  const attrs = roleRes.rows[0];
  if (attrs.rolsuper) failures.push("runtime_is_superuser");
  if (attrs.rolbypassrls) failures.push("runtime_has_bypassrls");
  if (attrs.rolcreatedb) failures.push("runtime_can_createdb");
  if (attrs.rolcreaterole) failures.push("runtime_can_createrole");
  if (attrs.rolinherit) failures.push("runtime_has_inherit");
  if (!attrs.rolcanlogin) failures.push("runtime_cannot_login");

  failures.push(...(await collectMembershipFailures(client, runtimeRole)));

  // Runtime must not own merchant tables.
  const ownership = await client.query<{ tablename: string }>(
    `SELECT c.relname AS tablename
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_roles r ON r.oid = c.relowner
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relname = ANY($1::text[])
       AND r.rolname = $2`,
    [MERCHANT_SQL_TABLES, runtimeRole],
  );
  if ((ownership.rowCount ?? 0) > 0) {
    failures.push(
      `runtime_owns_tables:${ownership.rows.map((r) => r.tablename).join(",")}`,
    );
  }

  // Control tables + _prisma_migrations must have no privileges for runtime.
  for (const t of CONTROL_TABLES) {
    const priv = await client.query<{ has: boolean }>(
      `SELECT has_table_privilege($1, format('%I.%I', 'public', $2::text), 'SELECT') AS has`,
      [runtimeRole, t.sqlTable],
    );
    if (priv.rows[0]?.has) {
      failures.push(`runtime_can_select_control:${t.sqlTable}`);
    }
  }

  for (const table of PLATFORM_CONTROL_PLANE_SQL_TABLES) {
    const exists = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    if ((exists.rowCount ?? 0) === 0) continue;
    const priv = await client.query<{ has: boolean }>(
      `SELECT has_table_privilege($1, format('%I.%I', 'public', $2::text), 'SELECT') AS has`,
      [runtimeRole, table],
    );
    if (priv.rows[0]?.has) {
      failures.push(`runtime_can_select_control_plane:${table}`);
    }
  }
  const prismaMig = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = '_prisma_migrations'`,
  );
  if ((prismaMig.rowCount ?? 0) > 0) {
    const priv = await client.query<{ has: boolean }>(
      `SELECT has_table_privilege($1, 'public._prisma_migrations', 'SELECT') AS has`,
      [runtimeRole],
    );
    if (priv.rows[0]?.has) {
      failures.push("runtime_can_select_prisma_migrations");
    }
  }

  // PUBLIC grants on merchant tables
  for (const table of MERCHANT_SQL_TABLES) {
    const pub = await publicTablePrivileges(client, table);
    if (pub.length > 0) {
      failures.push(`public_grant:${table}:${pub.join(",")}`);
    }
  }

  // Exact allowlist for runtime merchant privileges
  for (const table of MERCHANT_SQL_TABLES) {
    for (const priv of ["SELECT", "INSERT", "UPDATE", "DELETE"] as const) {
      const res = await client.query<{ has: boolean }>(
        `SELECT has_table_privilege($1, format('%I.%I', 'public', $2::text), $3) AS has`,
        [runtimeRole, table, priv],
      );
      if (requireMerchantDml && !res.rows[0]?.has) {
        failures.push(`missing_priv:${table}:${priv}`);
      }
      if (
        !requireMerchantDml &&
        !allowUnrestricted &&
        res.rows[0]?.has
      ) {
        failures.push(`unexpected_merchant_priv_before_rls:${table}:${priv}`);
      }
    }
    for (const priv of FORBIDDEN_TABLE_PRIVS) {
      const res = await client.query<{ has: boolean }>(
        `SELECT has_table_privilege($1, format('%I.%I', 'public', $2::text), $3) AS has`,
        [runtimeRole, table, priv],
      );
      if (res.rows[0]?.has) {
        failures.push(`excess_priv:${table}:${priv}`);
      }
    }
    // Catch any ACL grant beyond the allowlist via aclexplode
    const acl = await tableAclPrivileges(client, table, runtimeRole);
    for (const p of acl) {
      if (!ALLOWED_TABLE_PRIVS.has(p)) {
        failures.push(`excess_acl:${table}:${p}`);
      }
    }
  }

  // Schema CREATE must be absent for runtime (direct or via PUBLIC).
  // F-PR3C-03: do NOT revoke — verifiers are strictly read-only.
  const schemaCreateDirect = await client.query<{ privilege_type: string }>(
    `SELECT privilege_type
     FROM pg_namespace n
     CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) acl
     JOIN pg_roles r ON r.oid = acl.grantee
     WHERE n.nspname = 'public'
       AND r.rolname = $1
       AND privilege_type = 'CREATE'`,
    [runtimeRole],
  );
  const schemaCreatePublic = await client.query<{ privilege_type: string }>(
    `SELECT privilege_type
     FROM pg_namespace n
     CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) acl
     WHERE n.nspname = 'public'
       AND acl.grantee = 0
       AND privilege_type = 'CREATE'`,
  );
  if ((schemaCreateDirect.rowCount ?? 0) > 0) {
    failures.push("excess_schema_create");
  }
  if ((schemaCreatePublic.rowCount ?? 0) > 0) {
    failures.push("public_schema_create");
  }

  // Also catch via has_schema_privilege when PUBLIC CREATE grants it.
  const schemaCreate = await client.query<{ has: boolean }>(
    `SELECT has_schema_privilege($1, 'public', 'CREATE') AS has`,
    [runtimeRole],
  );
  if (
    schemaCreate.rows[0]?.has &&
    (schemaCreateDirect.rowCount ?? 0) === 0 &&
    (schemaCreatePublic.rowCount ?? 0) === 0
  ) {
    failures.push("excess_schema_create");
  }

  if (migrationRole === runtimeRole) {
    failures.push("migration_role_equals_runtime");
  }

  // Inspect actual table owner (migration owner) — may differ from STOCKY_MIGRATION_ROLE.
  const ownerSample = await client.query<{ owner: string; rolsuper: boolean }>(
    `SELECT r.rolname AS owner, r.rolsuper
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_roles r ON r.oid = c.relowner
     WHERE n.nspname = 'public' AND c.relname = 'Supplier'`,
  );
  const actualOwner = ownerSample.rows[0]?.owner ?? null;
  if (actualOwner && actualOwner === runtimeRole) {
    failures.push("runtime_is_table_owner");
  }
  // F-PR3C-16: require non-superuser owner when explicitly demanded
  // (staging/production verification paths set STOCKY_REQUIRE_NONSUPERUSER_OWNER=1).
  if (
    ownerSample.rows[0]?.rolsuper &&
    process.env.STOCKY_REQUIRE_NONSUPERUSER_OWNER === "1"
  ) {
    failures.push(`migration_owner_is_superuser:${actualOwner}`);
  }

  const fnPriv = await client.query<{ has: boolean }>(
    `SELECT has_function_privilege($1, $2, 'EXECUTE') AS has`,
    [runtimeRole, `${TENANT_CONTEXT_HELPER_FN}()`],
  );
  if (!fnPriv.rows[0]?.has) {
    failures.push("missing_execute_tenant_helper");
  }

  // Immutability trigger function must NOT be executable by runtime.
  const immPriv = await client.query<{ has: boolean }>(
    `SELECT has_function_privilege($1, 'stocky_prevent_shop_id_mutation()', 'EXECUTE') AS has`,
    [runtimeRole],
  );
  if (immPriv.rows[0]?.has) {
    failures.push("runtime_can_execute_immutability_fn");
  }

  // F-PR3C-02 / F-NEW-02: future-object default privileges (effective ACL)
  failures.push(...(await collectDefaultAclFailures(client, runtimeRole)));

  // F-PR3C-05: sequence privileges
  failures.push(...(await collectSequencePrivilegeFailures(client, runtimeRole)));

  // F-NEW-02: every public function against allowlist + EXECUTE rights
  failures.push(
    ...(await collectFunctionPrivilegeFailures(client, runtimeRole)),
  );

  // PUBLIC EXECUTE on immutability function is forbidden.
  const immPublic = await client.query<{ has: boolean }>(
    `SELECT has_function_privilege('public', 'stocky_prevent_shop_id_mutation()', 'EXECUTE') AS has`,
  );
  if (immPublic.rows[0]?.has) {
    failures.push(
      `unsafe_default_function_priv:public:EXECUTE:${IMMUTABILITY_TRIGGER_FN}`,
    );
  }

  return {
    event: "tenant_roles_verify",
    ok: failures.length === 0,
    runtimeRole,
    migrationRole,
    failures,
    attributes: {
      rolsuper: attrs.rolsuper,
      rolbypassrls: attrs.rolbypassrls,
      rolcreatedb: attrs.rolcreatedb,
      rolcreaterole: attrs.rolcreaterole,
      rolcanlogin: attrs.rolcanlogin,
      rolinherit: attrs.rolinherit,
      actualTableOwner: actualOwner,
    },
  };
}
