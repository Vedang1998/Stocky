/**
 * Dedicated sync control-plane role provisioning (PR 4 + correction F-PR4-06).
 * Narrow DML on platform control-plane tables + exact Shop lifecycle columns.
 * No merchant-domain DML. No migration privileges. NOINHERIT. No BYPASSRLS.
 */
import type { Client } from "pg";
import {
  CATALOG_OBSERVATION_GEN_SEQ,
  MERCHANT_SQL_TABLES,
  PLATFORM_CONTROL_PLANE_SQL_TABLES,
} from "../tenant-enforcement/manifest";
import { quoteIdent } from "../tenant-enforcement/sql";

export const DEFAULT_CONTROL_PLANE_ROLE = "stocky_control_plane";
export const DEFAULT_RUNTIME_ROLE = "stocky_runtime";
/** Dedicated least-privilege owner for stocky_has_application_receipt (NEW-PR4-C08). */
export const DEFAULT_RECEIPT_PROBE_OWNER_ROLE = "stocky_receipt_probe_owner";

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

export function defaultReceiptProbeOwnerRoleName(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    env.STOCKY_RECEIPT_PROBE_OWNER_ROLE?.trim() ||
    DEFAULT_RECEIPT_PROBE_OWNER_ROLE
  );
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
    for (const table of [...MERCHANT_SQL_TABLES, "Session"]) {
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

    const seqExists = await client.query(
      `SELECT 1 FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'S' AND c.relname = $1`,
      [CATALOG_OBSERVATION_GEN_SEQ],
    );
    if ((seqExists.rowCount ?? 0) > 0) {
      await client.query(
        `REVOKE ALL ON SEQUENCE ${quoteIdent(CATALOG_OBSERVATION_GEN_SEQ)} FROM PUBLIC`,
      );
      await client.query(
        `GRANT USAGE ON SEQUENCE ${quoteIdent(CATALOG_OBSERVATION_GEN_SEQ)} TO ${quoteIdent(role)}`,
      );
      await client.query(
        `REVOKE SELECT, UPDATE ON SEQUENCE ${quoteIdent(CATALOG_OBSERVATION_GEN_SEQ)} FROM ${quoteIdent(role)}`,
      );
      grantsApplied.push(`${CATALOG_OBSERVATION_GEN_SEQ}:USAGE`);
    }

    // NEW-PR4-C08: provision least-privilege probe owner and transfer function ownership
    // before granting EXECUTE to stocky_control_plane.
    const probeOwner = assertSafeRoleName(defaultReceiptProbeOwnerRoleName());
    await provisionReceiptProbeOwner(client, {
      apply: true,
      controlPlaneRole: role,
      runtimeRole: assertSafeRoleName(defaultRuntimeRoleName()),
      probeOwnerRole: probeOwner,
    });
    grantsApplied.push("receipt_probe_owner");

    // Migration may run before the role exists; ensure RLS policies here.
    for (const table of PLATFORM_CONTROL_PLANE_SQL_TABLES) {
      const exists = await client.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [table],
      );
      if ((exists.rowCount ?? 0) === 0) continue;
      await client.query(
        `ALTER TABLE ${quoteIdent(table)} ENABLE ROW LEVEL SECURITY`,
      );
      await client.query(
        `ALTER TABLE ${quoteIdent(table)} FORCE ROW LEVEL SECURITY`,
      );
      await client.query(
        `DO $pol$
         BEGIN
           BEGIN
             CREATE POLICY ${quoteIdent(`${table}_control_plane_all`)}
               ON ${quoteIdent(table)}
               FOR ALL TO ${quoteIdent(role)}
               USING (true) WITH CHECK (true);
           EXCEPTION WHEN duplicate_object THEN NULL;
           END;
         END $pol$`,
      );
      grantsApplied.push(`${table}:rls_policy`);
    }

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
  for (const table of [...MERCHANT_SQL_TABLES, "Session"]) {
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

  const seq = await client.query(
    `SELECT 1 FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'S' AND c.relname = $1`,
    [CATALOG_OBSERVATION_GEN_SEQ],
  );
  if ((seq.rowCount ?? 0) > 0) {
    const owner = await client.query<{ owner: string }>(
      `SELECT r.rolname AS owner
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_roles r ON r.oid = c.relowner
       WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'S'`,
      [CATALOG_OBSERVATION_GEN_SEQ],
    );
    if (owner.rows[0]?.owner === role) {
      errors.push(`control_plane_owns_sequence:${CATALOG_OBSERVATION_GEN_SEQ}`);
    }
    const usage = await client.query<{ has: boolean }>(
      `SELECT has_sequence_privilege($1, format('%I.%I', 'public', $2::text), 'USAGE') AS has`,
      [role, CATALOG_OBSERVATION_GEN_SEQ],
    );
    if (usage.rows[0]?.has !== true) {
      errors.push(`control_plane_missing_sequence_usage:${CATALOG_OBSERVATION_GEN_SEQ}`);
    }
    for (const priv of ["SELECT", "UPDATE"] as const) {
      const has = await client.query<{ has: boolean }>(
        `SELECT has_sequence_privilege($1, format('%I.%I', 'public', $2::text), $3) AS has`,
        [role, CATALOG_OBSERVATION_GEN_SEQ, priv],
      );
      if (has.rows[0]?.has) {
        errors.push(
          `control_plane_sequence_privilege:${CATALOG_OBSERVATION_GEN_SEQ}:${priv}`,
        );
      }
    }
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

  // NEW-PR4-C08: receipt probe function ownership and EXECUTE grants.
  errors.push(...(await verifyReceiptProbeFunction(client, role, runtime)));

  return { ok: errors.length === 0, errors };
}

/**
 * Create/adjust stocky_receipt_probe_owner, transfer function ownership, and
 * grant EXECUTE only to stocky_control_plane (NEW-PR4-C08).
 */
export async function provisionReceiptProbeOwner(
  client: Client,
  options: {
    apply: boolean;
    controlPlaneRole: string;
    runtimeRole: string;
    probeOwnerRole: string;
  },
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  const owner = assertSafeRoleName(options.probeOwnerRole);
  const cp = assertSafeRoleName(options.controlPlaneRole);
  const runtime = assertSafeRoleName(options.runtimeRole);

  if (!options.apply) {
    return { ok: true, errors };
  }

  const existing = await client.query(
    `SELECT 1 FROM pg_roles WHERE rolname = $1`,
    [owner],
  );
  if ((existing.rowCount ?? 0) === 0) {
    await client.query(
      `CREATE ROLE ${quoteIdent(owner)} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
    );
  } else {
    await client.query(
      `ALTER ROLE ${quoteIdent(owner)} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
    );
  }

  // No membership bridges.
  await client
    .query(`REVOKE ${quoteIdent(owner)} FROM ${quoteIdent(cp)}`)
    .catch(() => undefined);
  await client
    .query(`REVOKE ${quoteIdent(cp)} FROM ${quoteIdent(owner)}`)
    .catch(() => undefined);
  await client
    .query(`REVOKE ${quoteIdent(owner)} FROM ${quoteIdent(runtime)}`)
    .catch(() => undefined);
  await client
    .query(`REVOKE ${quoteIdent(runtime)} FROM ${quoteIdent(owner)}`)
    .catch(() => undefined);

  // SELECT-only on SyncApplicationReceipt for the probe owner + exact RLS policy.
  const receiptExists = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'SyncApplicationReceipt'`,
  );
  if ((receiptExists.rowCount ?? 0) > 0) {
    await client.query(
      `REVOKE ALL ON TABLE "SyncApplicationReceipt" FROM ${quoteIdent(owner)}`,
    ).catch(() => undefined);
    await client.query(
      `GRANT SELECT ON TABLE "SyncApplicationReceipt" TO ${quoteIdent(owner)}`,
    );
    await client.query(
      `DO $pol$
       BEGIN
         BEGIN
           CREATE POLICY stocky_receipt_probe_select
             ON "SyncApplicationReceipt"
             FOR SELECT TO ${quoteIdent(owner)}
             USING (true);
         EXCEPTION WHEN duplicate_object THEN NULL;
         END;
       END $pol$`,
    );
  }

  // Revoke any accidental merchant-table access from probe owner.
  for (const table of [...MERCHANT_SQL_TABLES, "Session"]) {
    if (table === "SyncApplicationReceipt") continue;
    await client
      .query(`REVOKE ALL ON TABLE ${quoteIdent(table)} FROM ${quoteIdent(owner)}`)
      .catch(() => undefined);
  }

  const fnExists = await client.query(
    `SELECT 1 FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'stocky_has_application_receipt'
       AND oidvectortypes(p.proargtypes) = 'text, text'`,
  );
  if ((fnExists.rowCount ?? 0) > 0) {
    await client.query(
      `REVOKE ALL ON FUNCTION public.stocky_has_application_receipt(text, text) FROM PUBLIC`,
    );
    await client
      .query(
        `REVOKE ALL ON FUNCTION public.stocky_has_application_receipt(text, text) FROM ${quoteIdent(runtime)}`,
      )
      .catch(() => undefined);
    await client
      .query(
        `REVOKE ALL ON FUNCTION public.stocky_has_application_receipt(text, text) FROM ${quoteIdent(cp)}`,
      )
      .catch(() => undefined);

    // Transfer ownership while migration role still owns the function.
    await client.query(
      `ALTER FUNCTION public.stocky_has_application_receipt(text, text) OWNER TO ${quoteIdent(owner)}`,
    );
    await client.query(
      `ALTER FUNCTION public.stocky_has_application_receipt(text, text)
       SET search_path = pg_catalog, pg_temp`,
    );

    // Only after ownership transfer may control-plane EXECUTE.
    await client.query(
      `GRANT EXECUTE ON FUNCTION public.stocky_has_application_receipt(text, text) TO ${quoteIdent(cp)}`,
    );
  }

  return { ok: errors.length === 0, errors };
}

async function verifyReceiptProbeFunction(
  client: Client,
  controlPlaneRole: string,
  runtimeRole: string,
): Promise<string[]> {
  const errors: string[] = [];
  const ownerName = defaultReceiptProbeOwnerRoleName();

  const fn = await client.query<{
    owner: string;
    prosecdef: boolean;
    proconfig: string[] | null;
  }>(
    `SELECT r.rolname AS owner, p.prosecdef, p.proconfig
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     JOIN pg_roles r ON r.oid = p.proowner
     WHERE n.nspname = 'public'
       AND p.proname = 'stocky_has_application_receipt'
       AND oidvectortypes(p.proargtypes) = 'text, text'`,
  );
  if ((fn.rowCount ?? 0) === 0) {
    // After PR4 correction migrations the probe must exist. Missing = fail closed.
    errors.push("receipt_probe_function_missing");
    return errors;
  }

  const row = fn.rows[0];
  if (!row.prosecdef) errors.push("receipt_probe_not_security_definer");
  if (row.owner !== ownerName) {
    errors.push(`receipt_probe_owner_not_restricted:${row.owner}`);
  }
  const cfg = (row.proconfig ?? []).join(",");
  if (!cfg.includes("search_path=pg_catalog, pg_temp") && !cfg.includes("search_path=pg_catalog,pg_temp")) {
    errors.push("receipt_probe_unsafe_search_path");
  }

  const ownerAttrs = await client.query<{
    rolsuper: boolean;
    rolbypassrls: boolean;
    rolcanlogin: boolean;
    rolinherit: boolean;
    rolcreaterole: boolean;
    rolcreatedb: boolean;
  }>(
    `SELECT rolsuper, rolbypassrls, rolcanlogin, rolinherit, rolcreaterole, rolcreatedb
     FROM pg_roles WHERE rolname = $1`,
    [ownerName],
  );
  if ((ownerAttrs.rowCount ?? 0) === 0) {
    errors.push("receipt_probe_owner_role_missing");
  } else {
    const a = ownerAttrs.rows[0];
    if (a.rolsuper) errors.push("receipt_probe_owner_is_superuser");
    if (a.rolbypassrls) errors.push("receipt_probe_owner_has_bypassrls");
    if (a.rolcanlogin) errors.push("receipt_probe_owner_can_login");
    if (a.rolinherit) errors.push("receipt_probe_owner_has_inherit");
    if (a.rolcreaterole) errors.push("receipt_probe_owner_has_createrole");
    if (a.rolcreatedb) errors.push("receipt_probe_owner_has_createdb");
  }

  // Control-plane must not be a member of the probe owner.
  const mem = await client.query(
    `SELECT 1
     FROM pg_auth_members m
     JOIN pg_roles r ON r.oid = m.roleid
     JOIN pg_roles mbr ON mbr.oid = m.member
     WHERE r.rolname = $1 AND mbr.rolname = $2`,
    [ownerName, controlPlaneRole],
  );
  if ((mem.rowCount ?? 0) > 0) {
    errors.push("control_plane_member_of_receipt_probe_owner");
  }

  // EXECUTE grants.
  const execCp = await client.query(
    `SELECT has_function_privilege($1, 'stocky_has_application_receipt(text,text)', 'EXECUTE') AS ok`,
    [controlPlaneRole],
  );
  if (execCp.rows[0]?.ok !== true) {
    errors.push("control_plane_missing_receipt_probe_execute");
  }
  const execRt = await client.query(
    `SELECT has_function_privilege($1, 'stocky_has_application_receipt(text,text)', 'EXECUTE') AS ok`,
    [runtimeRole],
  );
  if (execRt.rows[0]?.ok === true) {
    errors.push("runtime_has_receipt_probe_execute");
  }
  const execPub = await client.query(
    `SELECT has_function_privilege('public', 'stocky_has_application_receipt(text,text)', 'EXECUTE') AS ok`,
  );
  if (execPub.rows[0]?.ok === true) {
    errors.push("public_has_receipt_probe_execute");
  }

  // Probe owner must not have Session access.
  const sessionPriv = await client.query(
    `SELECT privilege_type FROM information_schema.role_table_grants
     WHERE grantee = $1 AND table_schema = 'public' AND table_name = 'Session'`,
    [ownerName],
  );
  if ((sessionPriv.rowCount ?? 0) > 0) {
    errors.push("receipt_probe_owner_has_session_privilege");
  }

  return errors;
}
