/**
 * Privileges for shop data erasure (privacy compliance).
 *
 * `stocky_privacy_erase_shop_batch` is SECURITY DEFINER and owned by a
 * dedicated NOLOGIN role. That role may only SELECT and DELETE rows of the
 * shop named in a transaction-local setting the function sets, and nothing
 * can assume the role: no login, no members, no memberships. EXECUTE belongs
 * to the control-plane role alone.
 *
 * Tables are discovered from the catalog (every public table with a "shopId"
 * column), matching the function itself, so a table added by a later
 * migration is covered the next time provisioning runs and is reported by
 * verification until then.
 */
import type { Client } from "pg";
import { quoteIdent } from "../tenant-enforcement/sql";

export const DEFAULT_PRIVACY_ERASURE_OWNER_ROLE = "stocky_privacy_erasure_owner";
export const PRIVACY_ERASURE_FN = "stocky_privacy_erase_shop_batch";
export const PRIVACY_ERASURE_SHOP_SETTING = "stocky.privacy_erasure_shop_id";
export const PRIVACY_ERASURE_SELECT_POLICY = "stocky_privacy_erasure_select";
export const PRIVACY_ERASURE_DELETE_POLICY = "stocky_privacy_erasure_delete";
export const PRIVACY_ERASURE_POLICY_NAMES = [
  PRIVACY_ERASURE_SELECT_POLICY,
  PRIVACY_ERASURE_DELETE_POLICY,
] as const;

/** Shop columns the erasure function reads before it deletes anything. */
const SHOP_GUARD_COLUMNS = [
  "id",
  "processingEnabled",
  "processingDisabledReason",
] as const;

const FN_SIGNATURE = `public.${PRIVACY_ERASURE_FN}(text, integer)`;

const POLICY_PREDICATE = `"shopId" = NULLIF(current_setting('${PRIVACY_ERASURE_SHOP_SETTING}', true), '')`;

/** `pg_get_expr` rendering of POLICY_PREDICATE, whitespace removed. */
const POLICY_PREDICATE_CATALOG = `("shopId"=NULLIF(current_setting('${PRIVACY_ERASURE_SHOP_SETTING}'::text,true),''::text))`;

export function defaultPrivacyErasureOwnerRoleName(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    env.STOCKY_PRIVACY_ERASURE_OWNER_ROLE?.trim() ||
    DEFAULT_PRIVACY_ERASURE_OWNER_ROLE
  );
}

function assertSafeRoleName(name: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe role name rejected: ${name}`);
  }
  return name;
}

/** Every public table with a "shopId" column, as the erasure function sees them. */
export async function listShopKeyedTables(client: Client): Promise<string[]> {
  const res = await client.query<{ table: string }>(
    `SELECT c.relname AS table
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND a.attname = 'shopId'
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY c.relname`,
  );
  return res.rows.map((r) => r.table);
}

async function erasureFunctionExists(client: Client): Promise<boolean> {
  const res = await client.query(
    `SELECT 1 FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = $1
        AND oidvectortypes(p.proargtypes) = 'text, integer'`,
    [PRIVACY_ERASURE_FN],
  );
  return (res.rowCount ?? 0) > 0;
}

async function replacePolicy(
  client: Client,
  table: string,
  policy: string,
  command: "SELECT" | "DELETE",
  owner: string,
): Promise<void> {
  await client.query(
    `DROP POLICY IF EXISTS ${quoteIdent(policy)} ON ${quoteIdent(table)}`,
  );
  await client.query(
    `CREATE POLICY ${quoteIdent(policy)} ON ${quoteIdent(table)}
       FOR ${command} TO ${quoteIdent(owner)}
       USING (${POLICY_PREDICATE})`,
  );
}

/**
 * Create or repair the erasure owner role, its grants and policies, then hand
 * it the function and let the control plane execute it. Idempotent.
 */
export async function provisionPrivacyErasureOwner(
  client: Client,
  options: {
    controlPlaneRole: string;
    runtimeRole: string;
    ownerRole?: string;
  },
): Promise<{ tables: string[] }> {
  const owner = assertSafeRoleName(
    options.ownerRole ?? defaultPrivacyErasureOwnerRoleName(),
  );
  const cp = assertSafeRoleName(options.controlPlaneRole);
  const runtime = assertSafeRoleName(options.runtimeRole);
  const attributes =
    "NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION";

  const existing = await client.query(
    `SELECT 1 FROM pg_roles WHERE rolname = $1`,
    [owner],
  );
  await client.query(
    `${(existing.rowCount ?? 0) === 0 ? "CREATE" : "ALTER"} ROLE ${quoteIdent(owner)} ${attributes}`,
  );

  for (const [granted, member] of [
    [owner, cp],
    [cp, owner],
    [owner, runtime],
    [runtime, owner],
  ]) {
    await client
      .query(`REVOKE ${quoteIdent(granted)} FROM ${quoteIdent(member)}`)
      .catch(() => undefined);
  }

  // The policies go on every shop-keyed table, including ones whose row
  // security is not on yet: tenant enforcement may be applied after this runs,
  // and the function must still reach the rows once it is.
  const tables = await listShopKeyedTables(client);
  for (const table of tables) {
    await client.query(
      `REVOKE ALL ON TABLE ${quoteIdent(table)} FROM ${quoteIdent(owner)}`,
    );
    await client.query(
      `GRANT SELECT, DELETE ON TABLE ${quoteIdent(table)} TO ${quoteIdent(owner)}`,
    );
    await replacePolicy(
      client,
      table,
      PRIVACY_ERASURE_SELECT_POLICY,
      "SELECT",
      owner,
    );
    await replacePolicy(
      client,
      table,
      PRIVACY_ERASURE_DELETE_POLICY,
      "DELETE",
      owner,
    );
  }

  await client.query(
    `REVOKE ALL ON TABLE ${quoteIdent("Shop")} FROM ${quoteIdent(owner)}`,
  );
  await client.query(
    `GRANT SELECT (${SHOP_GUARD_COLUMNS.map(quoteIdent).join(", ")}) ON TABLE ${quoteIdent("Shop")} TO ${quoteIdent(owner)}`,
  );
  await client.query(
    `GRANT DELETE ON TABLE ${quoteIdent("Shop")} TO ${quoteIdent(owner)}`,
  );
  await client.query(
    `REVOKE ALL ON TABLE ${quoteIdent("Session")} FROM ${quoteIdent(owner)}`,
  );

  if (await erasureFunctionExists(client)) {
    await client.query(`REVOKE ALL ON FUNCTION ${FN_SIGNATURE} FROM PUBLIC`);
    const granted = await client.query<{ grantee: string }>(
      `SELECT r.rolname AS grantee
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         CROSS JOIN LATERAL aclexplode(p.proacl) AS acl
         JOIN pg_roles r ON r.oid = acl.grantee
        WHERE n.nspname = 'public'
          AND p.proname = $1
          AND oidvectortypes(p.proargtypes) = 'text, integer'`,
      [PRIVACY_ERASURE_FN],
    );
    const strays = granted.rows
      .map((row) => row.grantee)
      .filter((role) => role !== owner);
    for (const role of new Set([runtime, cp, ...strays])) {
      await client.query(
        `REVOKE ALL ON FUNCTION ${FN_SIGNATURE} FROM ${quoteIdent(role)}`,
      );
    }
    await client.query(
      `ALTER FUNCTION ${FN_SIGNATURE} OWNER TO ${quoteIdent(owner)}`,
    );
    await client.query(
      `ALTER FUNCTION ${FN_SIGNATURE} SET search_path = pg_catalog, pg_temp`,
    );
    await client.query(
      `GRANT EXECUTE ON FUNCTION ${FN_SIGNATURE} TO ${quoteIdent(cp)}`,
    );
  }

  return { tables };
}

async function tablePrivileges(
  client: Client,
  role: string,
  table: string,
): Promise<string[]> {
  const res = await client.query<{ privilege_type: string }>(
    `SELECT privilege_type FROM information_schema.role_table_grants
      WHERE grantee = $1 AND table_schema = 'public' AND table_name = $2
      ORDER BY privilege_type`,
    [role, table],
  );
  return res.rows.map((r) => r.privilege_type);
}

async function verifyPolicy(
  client: Client,
  table: string,
  policy: string,
  command: "r" | "d",
  owner: string,
): Promise<string[]> {
  const res = await client.query<{
    polcmd: string;
    permissive: boolean;
    roles: string[];
    using_expr: string | null;
  }>(
    `SELECT p.polcmd::text AS polcmd,
            p.polpermissive AS permissive,
            ARRAY(
              SELECT r.rolname::text FROM pg_roles r
               WHERE r.oid = ANY (p.polroles) ORDER BY 1
            ) AS roles,
            pg_get_expr(p.polqual, p.polrelid) AS using_expr
       FROM pg_policy p
       JOIN pg_class c ON c.oid = p.polrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1 AND p.polname = $2`,
    [table, policy],
  );
  const row = res.rows[0];
  if (!row) return [`privacy_erasure_policy_missing:${table}:${policy}`];

  const errors: string[] = [];
  if (row.polcmd !== command) {
    errors.push(`privacy_erasure_policy_wrong_command:${table}:${policy}`);
  }
  if (!row.permissive) {
    errors.push(`privacy_erasure_policy_restrictive:${table}:${policy}`);
  }
  if (row.roles.length !== 1 || row.roles[0] !== owner) {
    errors.push(`privacy_erasure_policy_wrong_role:${table}:${policy}`);
  }
  if ((row.using_expr ?? "").replace(/\s+/g, "") !== POLICY_PREDICATE_CATALOG) {
    errors.push(`privacy_erasure_policy_predicate_drift:${table}:${policy}`);
  }
  return errors;
}

/** Read-only check of everything provisionPrivacyErasureOwner establishes. */
export async function verifyPrivacyErasure(
  client: Client,
  options: {
    controlPlaneRole: string;
    runtimeRole: string;
    ownerRole?: string;
  },
): Promise<string[]> {
  const owner = options.ownerRole ?? defaultPrivacyErasureOwnerRoleName();
  const errors: string[] = [];

  const attrs = await client.query<{
    rolsuper: boolean;
    rolbypassrls: boolean;
    rolcanlogin: boolean;
    rolinherit: boolean;
    rolcreaterole: boolean;
    rolcreatedb: boolean;
    rolreplication: boolean;
  }>(
    `SELECT rolsuper, rolbypassrls, rolcanlogin, rolinherit, rolcreaterole,
            rolcreatedb, rolreplication
       FROM pg_roles WHERE rolname = $1`,
    [owner],
  );
  const a = attrs.rows[0];
  if (!a) return ["privacy_erasure_owner_role_missing"];
  if (a.rolsuper) errors.push("privacy_erasure_owner_is_superuser");
  if (a.rolbypassrls) errors.push("privacy_erasure_owner_has_bypassrls");
  if (a.rolcanlogin) errors.push("privacy_erasure_owner_can_login");
  if (a.rolinherit) errors.push("privacy_erasure_owner_has_inherit");
  if (a.rolcreaterole) errors.push("privacy_erasure_owner_has_createrole");
  if (a.rolcreatedb) errors.push("privacy_erasure_owner_has_createdb");
  if (a.rolreplication) errors.push("privacy_erasure_owner_has_replication");

  const memberships = await client.query<{ granted: string; member: string }>(
    `SELECT r.rolname AS granted, m.rolname AS member
       FROM pg_auth_members am
       JOIN pg_roles r ON r.oid = am.roleid
       JOIN pg_roles m ON m.oid = am.member
      WHERE r.rolname = $1 OR m.rolname = $1`,
    [owner],
  );
  for (const row of memberships.rows) {
    errors.push(`privacy_erasure_owner_membership:${row.granted}:${row.member}`);
  }

  const shopKeyed = await listShopKeyedTables(client);
  const shopKeyedNames = new Set(shopKeyed);
  for (const table of shopKeyed) {
    const privileges = await tablePrivileges(client, owner, table);
    if (privileges.join(",") !== "DELETE,SELECT") {
      errors.push(
        `privacy_erasure_table_privileges:${table}:${privileges.join("+") || "none"}`,
      );
    }
    errors.push(
      ...(await verifyPolicy(
        client,
        table,
        PRIVACY_ERASURE_SELECT_POLICY,
        "r",
        owner,
      )),
      ...(await verifyPolicy(
        client,
        table,
        PRIVACY_ERASURE_DELETE_POLICY,
        "d",
        owner,
      )),
    );
  }

  // Nothing beyond the shop-keyed tables and the Shop row itself.
  const otherGrants = await client.query<{
    table_name: string;
    privilege_type: string;
  }>(
    `SELECT table_name, privilege_type FROM information_schema.role_table_grants
      WHERE grantee = $1 AND table_schema = 'public'
      ORDER BY table_name, privilege_type`,
    [owner],
  );
  for (const grant of otherGrants.rows) {
    if (shopKeyedNames.has(grant.table_name)) continue;
    if (grant.table_name === "Shop" && grant.privilege_type === "DELETE") {
      continue;
    }
    errors.push(
      `privacy_erasure_unexpected_grant:${grant.table_name}:${grant.privilege_type}`,
    );
  }
  const shopDelete = otherGrants.rows.some(
    (g) => g.table_name === "Shop" && g.privilege_type === "DELETE",
  );
  if (!shopDelete) errors.push("privacy_erasure_missing_shop_delete");

  const columnGrants = await client.query<{
    table_name: string;
    column_name: string;
    privilege_type: string;
  }>(
    `SELECT table_name, column_name, privilege_type
       FROM information_schema.column_privileges
      WHERE grantee = $1 AND table_schema = 'public'
        AND table_name IN ('Shop', 'Session')`,
    [owner],
  );
  const allowedShopColumns = new Set<string>(SHOP_GUARD_COLUMNS);
  for (const grant of columnGrants.rows) {
    const allowed =
      grant.table_name === "Shop" &&
      ((grant.privilege_type === "SELECT" &&
        allowedShopColumns.has(grant.column_name)) ||
        grant.privilege_type === "DELETE");
    if (!allowed) {
      errors.push(
        `privacy_erasure_unexpected_column_grant:${grant.table_name}.${grant.column_name}:${grant.privilege_type}`,
      );
    }
  }
  for (const column of SHOP_GUARD_COLUMNS) {
    const has = columnGrants.rows.some(
      (g) =>
        g.table_name === "Shop" &&
        g.column_name === column &&
        g.privilege_type === "SELECT",
    );
    if (!has) errors.push(`privacy_erasure_missing_shop_select:${column}`);
  }

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
        AND p.proname = $1
        AND oidvectortypes(p.proargtypes) = 'text, integer'`,
    [PRIVACY_ERASURE_FN],
  );
  const fnRow = fn.rows[0];
  if (!fnRow) {
    errors.push("privacy_erasure_function_missing");
    return errors;
  }
  if (!fnRow.prosecdef) errors.push("privacy_erasure_not_security_definer");
  if (fnRow.owner !== owner) {
    errors.push(`privacy_erasure_function_owner:${fnRow.owner}`);
  }
  const searchPath = (fnRow.proconfig ?? []).find((c) =>
    c.startsWith("search_path="),
  );
  if (searchPath?.replace(/\s+/g, "") !== "search_path=pg_catalog,pg_temp") {
    errors.push("privacy_erasure_unsafe_search_path");
  }

  const execute = async (role: string) => {
    const res = await client.query<{ ok: boolean }>(
      `SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok`,
      [role, `${PRIVACY_ERASURE_FN}(text,integer)`],
    );
    return res.rows[0]?.ok === true;
  };
  if (!(await execute(options.controlPlaneRole))) {
    errors.push("control_plane_missing_privacy_erasure_execute");
  }
  if (await execute(options.runtimeRole)) {
    errors.push("runtime_has_privacy_erasure_execute");
  }
  if (await execute("public")) {
    errors.push("public_has_privacy_erasure_execute");
  }

  // has_function_privilege answers for the roles asked about. The grant list
  // itself must hold the owner and the control plane and nobody else.
  const grantees = await client.query<{ grantee: string }>(
    `SELECT COALESCE(r.rolname, 'PUBLIC') AS grantee
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       CROSS JOIN LATERAL aclexplode(
         COALESCE(p.proacl, acldefault('f', p.proowner))
       ) AS acl
       LEFT JOIN pg_roles r ON r.oid = acl.grantee
      WHERE n.nspname = 'public'
        AND p.proname = $1
        AND oidvectortypes(p.proargtypes) = 'text, integer'
        AND acl.privilege_type = 'EXECUTE'`,
    [PRIVACY_ERASURE_FN],
  );
  const permitted = new Set([owner, options.controlPlaneRole]);
  for (const { grantee } of grantees.rows) {
    if (permitted.has(grantee) || grantee === "PUBLIC") continue;
    if (grantee === options.runtimeRole) continue;
    errors.push(`privacy_erasure_execute_granted:${grantee}`);
  }

  return errors;
}
