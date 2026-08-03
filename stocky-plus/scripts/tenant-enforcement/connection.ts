/**
 * Migration-owner vs runtime database URL resolution for PR 3 enforcement.
 *
 * DATABASE_MIGRATION_URL / TENANT_MAINTENANCE_DATABASE_URL — privileged owner
 * DATABASE_RUNTIME_URL — restricted runtime role (RLS subject)
 * DATABASE_URL — ambiguous legacy; must not silently become production runtime
 *   when a privileged migration URL is also configured.
 *
 * F-PR3-06: semantic URL comparison + post-connect identity verification.
 */
import { Client } from "pg";
import {
  formatPostgresTimeoutMs,
  resolveEnforcementLockTimeoutMs,
  resolveEnforcementStatementTimeoutMs,
} from "./timeouts";
import { databaseUrlsSemanticallyEqual } from "./catalog-expect";
import { MERCHANT_SQL_TABLES } from "./manifest";

const POOLER_PATTERN = /pooler|pgbouncer/i;

export function defaultMigrationRoleName(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.STOCKY_MIGRATION_ROLE?.trim() || "stocky_migration";
}

export function defaultRuntimeRoleName(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.STOCKY_RUNTIME_ROLE?.trim() || "stocky_runtime";
}

export function resolveMigrationDatabaseUrl(
  options: { requireExplicit?: boolean } = {},
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit =
    env.DATABASE_MIGRATION_URL?.trim() ||
    env.TENANT_MAINTENANCE_DATABASE_URL?.trim() ||
    "";
  const fallback = env.DATABASE_URL?.trim() || "";

  if (options.requireExplicit) {
    if (!explicit) {
      throw new Error(
        "DATABASE_MIGRATION_URL or TENANT_MAINTENANCE_DATABASE_URL is required for mutating enforcement operations (DATABASE_URL alone is not accepted)",
      );
    }
    if (POOLER_PATTERN.test(explicit)) {
      throw new Error(
        "Migration/maintenance URL must not use a pooler or PgBouncer endpoint",
      );
    }
    return explicit;
  }

  const url = explicit || fallback;
  if (!url) {
    throw new Error(
      "DATABASE_MIGRATION_URL, TENANT_MAINTENANCE_DATABASE_URL, or DATABASE_URL is required",
    );
  }
  if (POOLER_PATTERN.test(url)) {
    throw new Error(
      "Enforcement maintenance must not use a pooler or PgBouncer endpoint",
    );
  }
  return url;
}

/**
 * Resolve the restricted runtime connection URL.
 * Production-like environments must not fall back to a privileged URL.
 * Rejects semantically equivalent privileged URLs (trailing slash, scheme
 * alias, host alias, schema query params) — F-PR3-06.
 */
export function resolveRuntimeDatabaseUrl(
  options: { requireRuntime?: boolean } = {},
  env: NodeJS.ProcessEnv = process.env,
): string {
  const runtime = env.DATABASE_RUNTIME_URL?.trim() || "";
  const migration =
    env.DATABASE_MIGRATION_URL?.trim() ||
    env.TENANT_MAINTENANCE_DATABASE_URL?.trim() ||
    "";
  const fallback = env.DATABASE_URL?.trim() || "";
  const requireRuntime =
    options.requireRuntime === true ||
    env.STOCKY_REQUIRE_RUNTIME_DB_URL === "1" ||
    env.NODE_ENV === "production";

  if (requireRuntime) {
    if (!runtime) {
      throw new Error(
        "DATABASE_RUNTIME_URL is required for production-like runtime (refusing privileged DATABASE_URL fallback)",
      );
    }
    // Reject malformed early
    try {
      // Side-effect: throws on malformed
      void new URL(
        runtime.startsWith("postgres://")
          ? `postgresql://${runtime.slice("postgres://".length)}`
          : runtime,
      );
    } catch {
      throw new Error("malformed_database_url:DATABASE_RUNTIME_URL");
    }
    if (migration && databaseUrlsSemanticallyEqual(runtime, migration)) {
      throw new Error(
        "DATABASE_RUNTIME_URL must not equal the migration/maintenance URL (semantic identity)",
      );
    }
    if (fallback && databaseUrlsSemanticallyEqual(runtime, fallback)) {
      // When DATABASE_URL is the privileged owner URL, reject equivalence.
      if (migration && databaseUrlsSemanticallyEqual(fallback, migration)) {
        throw new Error(
          "DATABASE_RUNTIME_URL must not equal the privileged DATABASE_URL (semantic identity)",
        );
      }
    }
    return runtime;
  }

  if (runtime) {
    if (migration && databaseUrlsSemanticallyEqual(runtime, migration)) {
      throw new Error(
        "DATABASE_RUNTIME_URL must not equal the migration/maintenance URL (semantic identity)",
      );
    }
    return runtime;
  }

  if (!fallback) {
    throw new Error(
      "DATABASE_RUNTIME_URL or DATABASE_URL is required for runtime Prisma client",
    );
  }
  return fallback;
}

export type ConnectedIdentity = {
  currentDatabase: string;
  currentUser: string;
  sessionUser: string;
  serverAddr: string | null;
  serverPort: number | null;
  rolsuper: boolean;
  rolbypassrls: boolean;
  rolcreaterole: boolean;
  rolcreatedb: boolean;
  ownedMerchantTables: string[];
};

export async function readConnectedIdentity(
  client: Client,
): Promise<ConnectedIdentity> {
  const id = await client.query<{
    current_database: string;
    current_user: string;
    session_user: string;
    server_addr: string | null;
    server_port: number | null;
  }>(
    `SELECT current_database()::text AS current_database,
            current_user::text AS current_user,
            session_user::text AS session_user,
            inet_server_addr()::text AS server_addr,
            inet_server_port() AS server_port`,
  );
  const row = id.rows[0];
  const attrs = await client.query<{
    rolsuper: boolean;
    rolbypassrls: boolean;
    rolcreaterole: boolean;
    rolcreatedb: boolean;
  }>(
    `SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
     FROM pg_roles WHERE rolname = current_user`,
  );
  const owned = await client.query<{ tablename: string }>(
    `SELECT c.relname AS tablename
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_roles r ON r.oid = c.relowner
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relname = ANY($1::text[])
       AND r.rolname = current_user`,
    [MERCHANT_SQL_TABLES],
  );
  const a = attrs.rows[0];
  return {
    currentDatabase: row.current_database,
    currentUser: row.current_user,
    sessionUser: row.session_user,
    serverAddr: row.server_addr,
    serverPort: row.server_port,
    rolsuper: a?.rolsuper ?? false,
    rolbypassrls: a?.rolbypassrls ?? false,
    rolcreaterole: a?.rolcreaterole ?? false,
    rolcreatedb: a?.rolcreatedb ?? false,
    ownedMerchantTables: owned.rows.map((r) => r.tablename),
  };
}

/**
 * Fail closed if the connected role is not a safe restricted runtime role.
 */
export async function assertSafeRuntimeConnectedIdentity(
  client: Client,
  expectedRuntimeRole?: string,
): Promise<ConnectedIdentity> {
  const identity = await readConnectedIdentity(client);
  const expected = expectedRuntimeRole || defaultRuntimeRoleName();
  const failures: string[] = [];

  if (identity.currentUser !== expected) {
    failures.push(
      `runtime_user_mismatch:expected=${expected}:got=${identity.currentUser}`,
    );
  }
  if (identity.sessionUser !== expected) {
    failures.push(
      `runtime_session_user_mismatch:expected=${expected}:got=${identity.sessionUser}`,
    );
  }
  if (identity.rolsuper) failures.push("runtime_connected_superuser");
  if (identity.rolbypassrls) failures.push("runtime_connected_bypassrls");
  if (identity.rolcreaterole) failures.push("runtime_connected_createrole");
  if (identity.rolcreatedb) failures.push("runtime_connected_createdb");
  if (identity.ownedMerchantTables.length > 0) {
    failures.push(
      `runtime_owns_tables:${identity.ownedMerchantTables.join(",")}`,
    );
  }

  // Must not be able to SET ROLE into privileged roles — membership check.
  const members = await client.query<{ granted: string }>(
    `SELECT r.rolname AS granted
     FROM pg_auth_members m
     JOIN pg_roles me ON me.oid = m.member
     JOIN pg_roles r ON r.oid = m.roleid
     WHERE me.rolname = current_user`,
  );
  if ((members.rowCount ?? 0) > 0) {
    failures.push(
      `runtime_has_role_membership:${members.rows.map((r) => r.granted).join(",")}`,
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `runtime_identity_rejected:${failures.join("|")}`,
    );
  }
  return identity;
}

/**
 * Migration/maintenance connection must not be the runtime role.
 */
export async function assertMigrationConnectedIdentity(
  client: Client,
): Promise<ConnectedIdentity> {
  const identity = await readConnectedIdentity(client);
  const runtimeRole = defaultRuntimeRoleName();
  if (
    identity.currentUser === runtimeRole ||
    identity.sessionUser === runtimeRole
  ) {
    throw new Error(
      `migration_identity_is_runtime_role:${identity.currentUser}`,
    );
  }
  return identity;
}

export type MaintenanceClientOptions = {
  lockTimeoutMs?: number;
  statementTimeoutMs?: number;
  requireExplicitMigrationUrl?: boolean;
};

export async function getMigrationClient(
  options: MaintenanceClientOptions = {},
): Promise<Client> {
  const connectionString = resolveMigrationDatabaseUrl({
    requireExplicit: options.requireExplicitMigrationUrl,
  });
  const client = new Client({ connectionString });
  await client.connect();

  const lockTimeoutMs =
    options.lockTimeoutMs ?? resolveEnforcementLockTimeoutMs();
  const statementTimeoutMs =
    options.statementTimeoutMs ?? resolveEnforcementStatementTimeoutMs();

  await client.query(
    `SET lock_timeout = '${formatPostgresTimeoutMs(lockTimeoutMs)}'`,
  );
  await client.query(
    `SET statement_timeout = '${formatPostgresTimeoutMs(statementTimeoutMs)}'`,
  );

  await assertMigrationConnectedIdentity(client);

  return client;
}

export async function getRuntimeClient(
  options: { requireRuntime?: boolean; verifyIdentity?: boolean } = {},
): Promise<Client> {
  const connectionString = resolveRuntimeDatabaseUrl(options);
  const client = new Client({ connectionString });
  await client.connect();
  const verify =
    options.verifyIdentity === true ||
    process.env.STOCKY_REQUIRE_RUNTIME_DB_URL === "1" ||
    process.env.NODE_ENV === "production";
  if (verify) {
    try {
      await assertSafeRuntimeConnectedIdentity(client);
    } catch (err) {
      await client.end().catch(() => undefined);
      throw err;
    }
  }
  return client;
}

/** Classify a URL for secret-free reporting (never log credentials). */
export function classifyDatabaseUrl(url: string): {
  classification: "migration" | "runtime" | "ambiguous" | "unknown";
  hasPoolerPattern: boolean;
  hostRedacted: true;
} {
  const migration =
    process.env.DATABASE_MIGRATION_URL?.trim() ||
    process.env.TENANT_MAINTENANCE_DATABASE_URL?.trim() ||
    "";
  const runtime = process.env.DATABASE_RUNTIME_URL?.trim() || "";
  let classification: "migration" | "runtime" | "ambiguous" | "unknown" =
    "unknown";
  if (runtime && databaseUrlsSemanticallyEqual(url, runtime)) {
    classification = "runtime";
  } else if (migration && databaseUrlsSemanticallyEqual(url, migration)) {
    classification = "migration";
  } else if (
    process.env.DATABASE_URL?.trim() &&
    databaseUrlsSemanticallyEqual(url, process.env.DATABASE_URL.trim())
  ) {
    classification = "ambiguous";
  }
  return {
    classification,
    hasPoolerPattern: POOLER_PATTERN.test(url),
    hostRedacted: true,
  };
}
