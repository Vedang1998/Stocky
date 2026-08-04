/**
 * Dedicated sync control-plane role provisioning (PR 4).
 * Narrow DML on platform control-plane tables + Shop lifecycle only.
 * No merchant-domain DML. No migration privileges. NOINHERIT. No BYPASSRLS.
 */
import type { Client } from "pg";
import { PLATFORM_CONTROL_PLANE_SQL_TABLES } from "../tenant-enforcement/manifest";
import { quoteIdent } from "../tenant-enforcement/sql";

export const DEFAULT_CONTROL_PLANE_ROLE = "stocky_control_plane";

export function defaultControlPlaneRoleName(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.STOCKY_CONTROL_PLANE_ROLE?.trim() || DEFAULT_CONTROL_PLANE_ROLE;
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
): Promise<{ ok: boolean; errors: string[]; role: string; grantsApplied: string[]; created: boolean }> {
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
    // Revoke any accidental merchant access first.
    for (const table of [
      "Supplier",
      "PurchaseOrder",
      "SalesDailyAggregate",
      "ShopSettings",
    ]) {
      await client.query(
        `REVOKE ALL ON TABLE ${quoteIdent(table)} FROM ${quoteIdent(role)}`,
      );
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

    // Minimal Shop lifecycle access for dispatch/uninstall checks.
    await client.query(
      `GRANT SELECT, UPDATE ON TABLE ${quoteIdent("Shop")} TO ${quoteIdent(role)}`,
    );
    grantsApplied.push("Shop:SELECT,UPDATE");

    // Runtime must not inherit control-plane membership.
    const runtime = process.env.STOCKY_RUNTIME_ROLE?.trim() || "stocky_runtime";
    await client.query(
      `REVOKE ${quoteIdent(role)} FROM ${quoteIdent(runtime)}`,
    ).catch(() => undefined);
  }

  // Verify no merchant DML
  const merchantPriv = await client.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.role_table_grants
     WHERE grantee = $1
       AND table_schema = 'public'
       AND table_name = 'Supplier'
       AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')`,
    [role],
  );
  if ((merchantPriv.rowCount ?? 0) > 0) {
    errors.push("control_plane_has_merchant_dml:Supplier");
  }

  return { ok: errors.length === 0, errors, role, grantsApplied, created };
}

export async function verifyControlPlaneRole(
  client: Client,
): Promise<{ ok: boolean; errors: string[] }> {
  const role = defaultControlPlaneRoleName();
  const errors: string[] = [];
  const attrs = await client.query<{
    rolsuper: boolean;
    rolbypassrls: boolean;
    rolcreaterole: boolean;
    rolinherit: boolean;
  }>(
    `SELECT rolsuper, rolbypassrls, rolcreaterole, rolinherit FROM pg_roles WHERE rolname = $1`,
    [role],
  );
  if ((attrs.rowCount ?? 0) === 0) {
    return { ok: false, errors: [`control_plane_role_missing:${role}`] };
  }
  const a = attrs.rows[0];
  if (a.rolsuper || a.rolbypassrls || a.rolcreaterole || a.rolinherit) {
    errors.push(`control_plane_role_unsafe_attrs:${JSON.stringify(a)}`);
  }

  for (const table of PLATFORM_CONTROL_PLANE_SQL_TABLES) {
    const exists = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    if ((exists.rowCount ?? 0) === 0) continue;
    const grants = await client.query(
      `SELECT 1 FROM information_schema.role_table_grants
       WHERE grantee = $1 AND table_name = $2 AND privilege_type = 'SELECT'`,
      [role, table],
    );
    if ((grants.rowCount ?? 0) === 0) {
      errors.push(`control_plane_missing_grant:${table}`);
    }
  }

  const supplier = await client.query(
    `SELECT 1 FROM information_schema.role_table_grants
     WHERE grantee = $1 AND table_name = 'Supplier'
       AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')`,
    [role],
  );
  if ((supplier.rowCount ?? 0) > 0) {
    errors.push("control_plane_merchant_dml_present");
  }

  return { ok: errors.length === 0, errors };
}
