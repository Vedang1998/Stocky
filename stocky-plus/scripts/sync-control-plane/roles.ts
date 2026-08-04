/**
 * Dedicated sync control-plane role provisioning (PR 4 + correction F-PR4-06).
 * Narrow DML on platform control-plane tables + exact Shop lifecycle columns.
 * No merchant-domain DML. No migration privileges. NOINHERIT. No BYPASSRLS.
 */
import type { Client } from "pg";
import { PLATFORM_CONTROL_PLANE_SQL_TABLES } from "../tenant-enforcement/manifest";
import { quoteIdent } from "../tenant-enforcement/sql";

export const DEFAULT_CONTROL_PLANE_ROLE = "stocky_control_plane";
export const DEFAULT_RUNTIME_ROLE = "stocky_runtime";

/**
 * Shop columns the control-plane role may SELECT/UPDATE for lifecycle only.
 * Session/token tables remain fully revoked. No broad Shop.* grant.
 */
export const CONTROL_PLANE_SHOP_COLUMNS = [
  "id",
  "myshopifyDomain",
  "processingEnabled",
  "processingDisabledReason",
  "processingDisabledAt",
  "uninstalledAt",
  "reinstalledAt",
  "createdAt",
  "updatedAt",
] as const;

export function defaultControlPlaneRoleName(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.STOCKY_CONTROL_PLANE_ROLE?.trim() || DEFAULT_CONTROL_PLANE_ROLE;
}

export function defaultRuntimeRoleName(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.STOCKY_RUNTIME_ROLE?.trim() || DEFAULT_RUNTIME_ROLE;
}

function assertSafeRoleName(name: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe role name rejected: ${name}`);
  }
  return name;
}

export async function provisionControlPlaneRole(
  client: Client,
  options: { apply: boolean; password?: string },
): Promise<{
  ok: boolean;
  errors: string[];
  role: string;
  grantsApplied: string[];
  created: boolean;
}> {
  const role = assertSafeRoleName(defaultControlPlaneRoleName());
  const errors: string[] = [];
  const grantsApplied: string[] = [];
  let created = false;

  const existing = await client.query(
    `SELECT rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolinherit
     FROM pg_roles WHERE rolname = $1`,
    [role],
  );

  if ((existing.rowCount ?? 0) === 0) {
    if (!options.apply) {
      errors.push(`control_plane_role_missing:${role}`);
      return { ok: false, errors, role, grantsApplied, created };
    }
    const password =
      options.password || process.env.STOCKY_CONTROL_PLANE_ROLE_PASSWORD;
    if (!password) {
      throw new Error(
        "STOCKY_CONTROL_PLANE_ROLE_PASSWORD is required to create control-plane role",
      );
    }
    await client.query(
      `CREATE ROLE ${quoteIdent(role)} LOGIN PASSWORD '${password.replace(/'/g, "''")}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
    );
    created = true;
  }

  if (options.apply) {
    for (const table of [
      "Supplier",
      "PurchaseOrder",
      "SalesDailyAggregate",
      "ShopSettings",
      "SyncApplicationReceipt",
      "Session",
    ]) {
      await client.query(
        `REVOKE ALL ON TABLE ${quoteIdent(table)} FROM ${quoteIdent(role)}`,
      ).catch(() => undefined);
    }

    for (const table of PLATFORM_CONTROL_PLANE_SQL_TABLES) {
      const exists = await client.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [table],
      );
      if ((exists.rowCount ?? 0) === 0) continue;
      await client.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${quoteIdent(table)} TO ${quoteIdent(role)}`,
      );
      grantsApplied.push(`${table}:DML`);
    }

    // Exact column-level Shop lifecycle access (F-PR4-06) — revoke table then grant columns.
    await client.query(
      `REVOKE ALL ON TABLE ${quoteIdent("Shop")} FROM ${quoteIdent(role)}`,
    ).catch(() => undefined);
    const cols = CONTROL_PLANE_SHOP_COLUMNS.map((c) => quoteIdent(c)).join(", ");
    await client.query(
      `GRANT SELECT (${cols}) ON TABLE ${quoteIdent("Shop")} TO ${quoteIdent(role)}`,
    );
    await client.query(
      `GRANT UPDATE (${cols}) ON TABLE ${quoteIdent("Shop")} TO ${quoteIdent(role)}`,
    );
    grantsApplied.push("Shop:column-lifecycle");

    await client.query(
      `GRANT EXECUTE ON FUNCTION stocky_has_application_receipt(text, text) TO ${quoteIdent(role)}`,
    ).catch(() => undefined);

    const runtime = assertSafeRoleName(defaultRuntimeRoleName());
    await client
      .query(`REVOKE ${quoteIdent(role)} FROM ${quoteIdent(runtime)}`)
      .catch(() => undefined);
  }

  const verified = await verifyControlPlaneRole(client);
  errors.push(...verified.errors);

  return {
    ok: errors.length === 0,
    errors,
    role,
    grantsApplied,
    created,
  };
}

export async function verifyControlPlaneRole(
  client: Client,
): Promise<{ ok: boolean; errors: string[] }> {
  const role = defaultControlPlaneRoleName();
  const runtime = defaultRuntimeRoleName();
  const errors: string[] = [];

  const attrs = await client.query<{
    rolsuper: boolean;
    rolbypassrls: boolean;
    rolcreaterole: boolean;
    rolcreatedb: boolean;
    rolinherit: boolean;
  }>(
    `SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolinherit
     FROM pg_roles WHERE rolname = $1`,
    [role],
  );
  if ((attrs.rowCount ?? 0) === 0) {
    return { ok: false, errors: [`control_plane_role_missing:${role}`] };
  }
  const a = attrs.rows[0];
  if (a.rolsuper) errors.push("control_plane_is_superuser");
  if (a.rolbypassrls) errors.push("control_plane_has_bypassrls");
  if (a.rolcreaterole) errors.push("control_plane_has_createrole");
  if (a.rolcreatedb) errors.push("control_plane_has_createdb");
  if (a.rolinherit) errors.push("control_plane_has_inherit");

  // Ownership: control-plane role must not own platform tables.
  const owned = await client.query<{ relname: string }>(
    `SELECT c.relname
     FROM pg_class c
     JOIN pg_roles r ON r.oid = c.relowner
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND r.rolname = $1
       AND c.relkind = 'r'`,
    [role],
  );
  for (const row of owned.rows) {
    errors.push(`control_plane_owns_table:${row.relname}`);
  }

  for (const table of PLATFORM_CONTROL_PLANE_SQL_TABLES) {
    const exists = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    if ((exists.rowCount ?? 0) === 0) continue;

    for (const priv of ["SELECT", "INSERT", "UPDATE", "DELETE"] as const) {
      const grants = await client.query(
        `SELECT 1 FROM information_schema.role_table_grants
         WHERE grantee = $1 AND table_schema = 'public'
           AND table_name = $2 AND privilege_type = $3`,
        [role, table, priv],
      );
      if ((grants.rowCount ?? 0) === 0) {
        errors.push(`control_plane_missing_grant:${table}:${priv}`);
      }
    }

    // RLS enabled + forced
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
    if ((rls.rowCount ?? 0) === 0 || !rls.rows[0].relrowsecurity) {
      errors.push(`control_plane_rls_disabled:${table}`);
    }
    if ((rls.rowCount ?? 0) === 0 || !rls.rows[0].relforcerowsecurity) {
      errors.push(`control_plane_force_rls_disabled:${table}`);
    }

    // Policy must exist for control-plane; none for runtime.
    const policies = await client.query<{
      polname: string;
      polroles: unknown;
    }>(
      `SELECT p.polname, p.polroles::text AS polroles
       FROM pg_policy p
       JOIN pg_class c ON c.oid = p.polrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = $1`,
      [table],
    );
    if ((policies.rowCount ?? 0) === 0) {
      errors.push(`control_plane_missing_policy:${table}`);
    }

    const runtimeHasPolicy = await client.query(
      `SELECT 1
       FROM pg_policy p
       JOIN pg_class c ON c.oid = p.polrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_roles r ON r.oid = ANY (p.polroles)
       WHERE n.nspname = 'public' AND c.relname = $1 AND r.rolname = $2`,
      [table, runtime],
    );
    if ((runtimeHasPolicy.rowCount ?? 0) > 0) {
      errors.push(`runtime_has_control_plane_policy:${table}`);
    }

    // Runtime must have no table DML on control-plane tables.
    for (const priv of ["SELECT", "INSERT", "UPDATE", "DELETE"] as const) {
      const rt = await client.query(
        `SELECT 1 FROM information_schema.role_table_grants
         WHERE grantee = $1 AND table_schema = 'public'
           AND table_name = $2 AND privilege_type = $3`,
        [runtime, table, priv],
      );
      if ((rt.rowCount ?? 0) > 0) {
        errors.push(`runtime_control_plane_privilege:${table}:${priv}`);
      }
    }

    // PUBLIC must have no privileges.
    const pub = await client.query(
      `SELECT privilege_type FROM information_schema.role_table_grants
       WHERE grantee = 'PUBLIC' AND table_schema = 'public' AND table_name = $1`,
      [table],
    );
    if ((pub.rowCount ?? 0) > 0) {
      errors.push(`public_control_plane_privilege:${table}`);
    }
  }

  // Merchant-domain tables: no DML for control-plane.
  for (const table of [
    "Supplier",
    "PurchaseOrder",
    "SalesDailyAggregate",
    "ShopSettings",
    "SyncApplicationReceipt",
    "Session",
  ]) {
    const exists = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    if ((exists.rowCount ?? 0) === 0) continue;
    for (const priv of ["SELECT", "INSERT", "UPDATE", "DELETE"] as const) {
      const g = await client.query(
        `SELECT 1 FROM information_schema.role_table_grants
         WHERE grantee = $1 AND table_schema = 'public'
           AND table_name = $2 AND privilege_type = $3`,
        [role, table, priv],
      );
      if ((g.rowCount ?? 0) > 0) {
        errors.push(`control_plane_merchant_privilege:${table}:${priv}`);
      }
    }
  }

  // Runtime must not be a member of control-plane (transitive escalation).
  const membership = await client.query(
    `SELECT 1
     FROM pg_auth_members m
     JOIN pg_roles r ON r.oid = m.roleid
     JOIN pg_roles mbr ON mbr.oid = m.member
     WHERE r.rolname = $1 AND mbr.rolname = $2`,
    [role, runtime],
  );
  if ((membership.rowCount ?? 0) > 0) {
    errors.push("runtime_is_member_of_control_plane");
  }

  // Schema CREATE
  const schemaCreate = await client.query(
    `SELECT has_schema_privilege($1, 'public', 'CREATE') AS can_create`,
    [role],
  );
  if (schemaCreate.rows[0]?.can_create === true) {
    errors.push("control_plane_schema_create");
  }

  // Future default privileges must not grant PUBLIC or runtime control-plane access.
  const defaults = await client.query<{
    defaclrole: string;
    defaclobjtype: string;
    defaclacl: string;
  }>(
    `SELECT r.rolname AS defaclrole, d.defaclobjtype::text AS defaclobjtype,
            d.defaclacl::text AS defaclacl
     FROM pg_default_acl d
     JOIN pg_roles r ON r.oid = d.defaclrole
     WHERE d.defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')`,
  );
  for (const row of defaults.rows) {
    if (
      row.defaclacl.includes("=arwdDxt/") ||
      row.defaclacl.includes(`${runtime}=`) ||
      (row.defaclacl.includes("=r/") && row.defaclobjtype === "r")
    ) {
      // Flag overly broad PUBLIC defaults that include write bits.
      if (row.defaclacl.includes("=arwd") || row.defaclacl.includes(`${runtime}=arwd`)) {
        errors.push(
          `dangerous_default_acl:${row.defaclrole}:${row.defaclobjtype}`,
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
