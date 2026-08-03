/**
 * Restricted runtime role provisioning and verification (D-015 / D-016).
 */
import type { Client } from "pg";
import {
  BOOTSTRAP_TABLES,
  CONTROL_TABLES,
  MERCHANT_SQL_TABLES,
  TENANT_CONTEXT_HELPER_FN,
  TENANT_CONTEXT_VERSION_FN,
} from "./manifest";
import { grantHelpersToRuntimeSql, helperFunctionsSql, quoteIdent } from "./sql";
import {
  defaultMigrationRoleName,
  defaultRuntimeRoleName,
} from "./connection";

export type RoleProvisionResult = {
  event: "tenant_roles_provision";
  ok: boolean;
  migrationRole: string;
  runtimeRole: string;
  createdRuntimeRole: boolean;
  grantsApplied: string[];
  revokesApplied: string[];
  errors: string[];
};

function assertSafeRoleName(name: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe role name rejected: ${name}`);
  }
  return name;
}

export async function provisionRoles(
  client: Client,
  options: {
    apply: boolean;
    runtimePassword?: string;
  },
): Promise<RoleProvisionResult> {
  const migrationRole = assertSafeRoleName(defaultMigrationRoleName());
  const runtimeRole = assertSafeRoleName(defaultRuntimeRoleName());
  const errors: string[] = [];
  const grantsApplied: string[] = [];
  const revokesApplied: string[] = [];
  let createdRuntimeRole = false;

  // Ensure helper functions exist (owned by current migration connection user).
  if (options.apply) {
    await client.query(helperFunctionsSql());
  }

  const existing = await client.query<{ rolname: string }>(
    `SELECT rolname FROM pg_roles WHERE rolname = $1`,
    [runtimeRole],
  );

  if (existing.rowCount === 0) {
    if (!options.apply) {
      errors.push(`runtime role ${runtimeRole} missing (plan-only)`);
    } else {
      const password =
        options.runtimePassword ||
        process.env.STOCKY_RUNTIME_ROLE_PASSWORD ||
        "stocky_runtime_ci_only"; // pragma: allowlist secret
      // Password is never logged. CI/disposable only.
      await client.query(
        `CREATE ROLE ${quoteIdent(runtimeRole)} LOGIN PASSWORD '${password.replace(/'/g, "''")}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
      );
      createdRuntimeRole = true;
    }
  } else if (options.apply) {
    await client.query(
      `ALTER ROLE ${quoteIdent(runtimeRole)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`,
    );
  }

  if (options.apply) {
    await client.query(
      `GRANT USAGE ON SCHEMA public TO ${quoteIdent(runtimeRole)}`,
    );
    grantsApplied.push("USAGE ON SCHEMA public");

    await client.query(grantHelpersToRuntimeSql(runtimeRole));
    grantsApplied.push(`EXECUTE ON ${TENANT_CONTEXT_HELPER_FN}`);
    grantsApplied.push(`EXECUTE ON ${TENANT_CONTEXT_VERSION_FN}`);

    for (const table of MERCHANT_SQL_TABLES) {
      await client.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${quoteIdent(table)} TO ${quoteIdent(runtimeRole)}`,
      );
      grantsApplied.push(`${table}:DML`);
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

    // Prevent future tables owned by migration role from granting to PUBLIC broadly;
    // alter default privileges for current user.
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC`,
    );
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${quoteIdent(runtimeRole)}`,
    );
    // New merchant tables must be granted explicitly — do not auto-grant to runtime.
  }

  const verify = await verifyRoles(client);
  if (!verify.ok) {
    errors.push(...verify.failures);
  }

  return {
    event: "tenant_roles_provision",
    ok: errors.length === 0 && verify.ok,
    migrationRole,
    runtimeRole,
    createdRuntimeRole,
    grantsApplied,
    revokesApplied,
    errors,
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

export async function verifyRoles(client: Client): Promise<RoleVerifyResult> {
  const migrationRole = assertSafeRoleName(defaultMigrationRoleName());
  const runtimeRole = assertSafeRoleName(defaultRuntimeRoleName());
  const failures: string[] = [];

  const roleRes = await client.query<{
    rolname: string;
    rolsuper: boolean;
    rolcreatedb: boolean;
    rolcreaterole: boolean;
    rolbypassrls: boolean;
    rolcanlogin: boolean;
  }>(
    `SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolcanlogin
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
  if (!attrs.rolcanlogin) failures.push("runtime_cannot_login");

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

  // Control tables must have no privileges for runtime.
  for (const t of CONTROL_TABLES) {
    const priv = await client.query<{ has: boolean }>(
      `SELECT has_table_privilege($1, format('%I.%I', 'public', $2::text), 'SELECT') AS has`,
      [runtimeRole, t.sqlTable],
    );
    if (priv.rows[0]?.has) {
      failures.push(`runtime_can_select_control:${t.sqlTable}`);
    }
  }

  // Merchant DML expected.
  for (const table of MERCHANT_SQL_TABLES) {
    for (const priv of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      const res = await client.query<{ has: boolean }>(
        `SELECT has_table_privilege($1, format('%I.%I', 'public', $2::text), $3) AS has`,
        [runtimeRole, table, priv],
      );
      if (!res.rows[0]?.has) {
        failures.push(`missing_priv:${table}:${priv}`);
      }
    }
  }

  // Runtime must not be able to create policy (no ownership / no BYPASS).
  // Attribute checks above cover BYPASSRLS and ownership.

  // Migration role name must not equal runtime.
  if (migrationRole === runtimeRole) {
    failures.push("migration_role_equals_runtime");
  }

  // Ensure helper execute grant.
  const fnPriv = await client.query<{ has: boolean }>(
    `SELECT has_function_privilege($1, $2, 'EXECUTE') AS has`,
    [runtimeRole, `${TENANT_CONTEXT_HELPER_FN}()`],
  );
  if (!fnPriv.rows[0]?.has) {
    failures.push("missing_execute_tenant_helper");
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
    },
  };
}
