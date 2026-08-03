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
  MERCHANT_SQL_TABLES,
  TENANT_CONTEXT_HELPER_FN,
  TENANT_CONTEXT_VERSION_FN,
} from "./manifest";
import { grantHelpersToRuntimeSql, helperFunctionsSql, quoteIdent } from "./sql";
import {
  defaultMigrationRoleName,
  defaultRuntimeRoleName,
} from "./connection";
import { verifyRlsOnly } from "./verify";

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

function assertSafeRoleName(name: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe role name rejected: ${name}`);
  }
  return name;
}

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
    }
  } else if (
    options.apply &&
    (phase === "prepare" ||
      phase === "full" ||
      phase === "test_harness_unrestricted")
  ) {
    const attrs = existing.rows[0];
    const dangerous: string[] = [];
    if (attrs.rolsuper) dangerous.push("runtime_is_superuser");
    if (attrs.rolbypassrls) dangerous.push("runtime_has_bypassrls");
    if (attrs.rolcreatedb) dangerous.push("runtime_can_createdb");
    if (attrs.rolcreaterole) dangerous.push("runtime_can_createrole");
    if (attrs.rolinherit) dangerous.push("runtime_has_inherit");
    if (dangerous.length > 0) {
      detectedDrift.push(...dangerous);
      if (!options.repairDangerousDrift) {
        errors.push(
          `dangerous_role_attribute_drift:${dangerous.join(",")}:repair_required`,
        );
      } else {
        await client.query(
          `ALTER ROLE ${quoteIdent(runtimeRole)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
        );
        repairedDrift.push(...dangerous.map((d) => `repaired:${d}`));
      }
    } else {
      // Re-assert NOINHERIT / safe attrs even when already correct.
      await client.query(
        `ALTER ROLE ${quoteIdent(runtimeRole)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
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

    // Revoke CREATE on schema if present
    await client.query(
      `REVOKE CREATE ON SCHEMA public FROM ${quoteIdent(runtimeRole)}`,
    );
    revokesApplied.push("CREATE ON SCHEMA public");

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

    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC`,
    );
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${quoteIdent(runtimeRole)}`,
    );
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
        : merchantDmlGranted || (await isRlsFullyForced(client)),
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
  // Recursive membership via pg_auth_members (direct + transitive).
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

  return [...new Set(failures)];
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

  // Schema CREATE must be absent
  const schemaCreate = await client.query<{ has: boolean }>(
    `SELECT has_schema_privilege($1, 'public', 'CREATE') AS has`,
    [runtimeRole],
  );
  if (schemaCreate.rows[0]?.has) {
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
  if (ownerSample.rows[0]?.rolsuper) {
    // Documented residual: CI/local owner may be superuser (F-PR3-13).
    // Fail only when STOCKY_REQUIRE_NONSUPERUSER_OWNER=1.
    if (process.env.STOCKY_REQUIRE_NONSUPERUSER_OWNER === "1") {
      failures.push(`migration_owner_is_superuser:${actualOwner}`);
    }
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
