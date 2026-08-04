/**
 * Shared runtime database identity contract (F-PR3C-01 / D-038).
 *
 * Used by web runtime, workers, TenantDb (via db.server), test harnesses,
 * and enforcement connection tooling. URL comparison is an early defence only;
 * the connected PostgreSQL identity is authoritative.
 *
 * Do not invent passwords. Do not treat URL text as proof of role safety.
 */
import { PrismaClient } from "@prisma/client";
import { MERCHANT_OWNED_MODELS } from "../tenant/models";

const POOLER_PATTERN = /pooler|pgbouncer/i;

export const DEFAULT_RUNTIME_ROLE = "stocky_runtime";
export const DEFAULT_MIGRATION_ROLE = "stocky_migration";

/** Merchant SQL table names match Prisma model names in this schema. */
export const RUNTIME_MERCHANT_TABLES: readonly string[] = [
  ...MERCHANT_OWNED_MODELS,
];

export const RUNTIME_CONTROL_TABLES: readonly string[] = [
  "TenantBackfillRun",
  "TenantBackfillCheckpoint",
  "TenantOwnershipIssue",
  "TenantOwnershipIssueDetection",
];

export type SqlRow = Record<string, unknown>;

/**
 * Minimal query surface shared by `pg.Client` and Prisma `$queryRawUnsafe`.
 */
export type IdentitySqlClient = {
  queryRows<T extends SqlRow = SqlRow>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
};

export function defaultRuntimeRoleName(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.STOCKY_RUNTIME_ROLE?.trim() || DEFAULT_RUNTIME_ROLE;
}

export function defaultMigrationRoleName(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.STOCKY_MIGRATION_ROLE?.trim() || DEFAULT_MIGRATION_ROLE;
}

/**
 * Normalize a database URL for early semantic comparison.
 * Does not replace post-connect identity verification.
 */
export function normalizeDatabaseUrlIdentity(raw: string): {
  scheme: string;
  user: string;
  host: string;
  port: number;
  database: string;
} {
  let input = raw.trim();
  if (!input) {
    throw new Error("empty_database_url");
  }
  if (input.startsWith("postgres://")) {
    input = `postgresql://${input.slice("postgres://".length)}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("malformed_database_url");
  }
  if (parsed.protocol !== "postgresql:") {
    throw new Error(`unsupported_database_url_scheme:${parsed.protocol}`);
  }
  const hostRaw = parsed.hostname.toLowerCase();
  const host =
    hostRaw === "127.0.0.1" || hostRaw === "::1" ? "localhost" : hostRaw;
  const port = parsed.port ? Number(parsed.port) : 5432;
  let database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  database = database.replace(/\/+$/, "");
  if (!database) {
    throw new Error("database_url_missing_database");
  }
  const user = decodeURIComponent(parsed.username || "");
  if (!user) {
    throw new Error("database_url_missing_user");
  }
  return { scheme: "postgresql", user, host, port, database };
}

export function databaseUrlsSemanticallyEqual(a: string, b: string): boolean {
  try {
    const left = normalizeDatabaseUrlIdentity(a);
    const right = normalizeDatabaseUrlIdentity(b);
    return (
      left.user === right.user &&
      left.host === right.host &&
      left.port === right.port &&
      left.database === right.database
    );
  } catch {
    return false;
  }
}

/**
 * Resolve the restricted runtime connection URL.
 * Production-like environments must not fall back to a privileged URL.
 * Rejects semantically equivalent privileged URLs — early defence only.
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
    try {
      normalizeDatabaseUrlIdentity(runtime);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        msg.startsWith("malformed") || msg.startsWith("unsupported")
          ? `malformed_database_url:DATABASE_RUNTIME_URL`
          : `malformed_database_url:DATABASE_RUNTIME_URL:${msg}`,
      );
    }
    if (migration && databaseUrlsSemanticallyEqual(runtime, migration)) {
      throw new Error(
        "DATABASE_RUNTIME_URL must not equal the migration/maintenance URL (semantic identity)",
      );
    }
    if (
      fallback &&
      migration &&
      databaseUrlsSemanticallyEqual(runtime, fallback) &&
      databaseUrlsSemanticallyEqual(fallback, migration)
    ) {
      throw new Error(
        "DATABASE_RUNTIME_URL must not equal the privileged DATABASE_URL (semantic identity)",
      );
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
  rolinherit: boolean;
  ownedMerchantTables: string[];
  roleMemberships: string[];
  adminOptionMemberships: string[];
};

export async function readConnectedIdentity(
  client: IdentitySqlClient,
  merchantTables: readonly string[] = RUNTIME_MERCHANT_TABLES,
): Promise<ConnectedIdentity> {
  const idRows = await client.queryRows<{
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
  const row = idRows[0];
  if (!row) {
    throw new Error("runtime_identity_unreadable");
  }

  const attrs = await client.queryRows<{
    rolsuper: boolean;
    rolbypassrls: boolean;
    rolcreaterole: boolean;
    rolcreatedb: boolean;
    rolinherit: boolean;
  }>(
    `SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolinherit
     FROM pg_roles WHERE rolname = current_user`,
  );
  const a = attrs[0];

  // Inline allowlisted identifiers — avoids driver-specific array binding
  // differences between `pg` and Prisma `$queryRawUnsafe`.
  const tableLiterals = merchantTables
    .map((t) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) {
        throw new Error(`unsafe_merchant_table_ident:${t}`);
      }
      return `'${t}'`;
    })
    .join(", ");
  const owned = await client.queryRows<{ tablename: string }>(
    `SELECT c.relname AS tablename
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_roles r ON r.oid = c.relowner
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relname = ANY(ARRAY[${tableLiterals}]::text[])
       AND r.rolname = current_user`,
  );

  const members = await client.queryRows<{
    granted: string;
    admin_option: boolean;
  }>(
    `WITH RECURSIVE memb AS (
       SELECT m.roleid, m.member, m.admin_option, 1 AS depth
       FROM pg_auth_members m
       JOIN pg_roles r ON r.oid = m.member
       WHERE r.rolname = current_user
       UNION ALL
       SELECT m.roleid, m.member, m.admin_option, memb.depth + 1
       FROM pg_auth_members m
       JOIN memb ON m.member = memb.roleid
       WHERE memb.depth < 32
     )
     SELECT DISTINCT grantee.rolname AS granted, memb.admin_option
     FROM memb
     JOIN pg_roles grantee ON grantee.oid = memb.roleid`,
  );

  return {
    currentDatabase: String(row.current_database),
    currentUser: String(row.current_user),
    sessionUser: String(row.session_user),
    serverAddr: row.server_addr == null ? null : String(row.server_addr),
    serverPort:
      row.server_port == null ? null : Number(row.server_port),
    rolsuper: Boolean(a?.rolsuper),
    rolbypassrls: Boolean(a?.rolbypassrls),
    rolcreaterole: Boolean(a?.rolcreaterole),
    rolcreatedb: Boolean(a?.rolcreatedb),
    rolinherit: Boolean(a?.rolinherit),
    ownedMerchantTables: owned.map((r) => String(r.tablename)),
    roleMemberships: members.map((r) => String(r.granted)),
    adminOptionMemberships: members
      .filter((r) => Boolean(r.admin_option))
      .map((r) => String(r.granted)),
  };
}

export type RuntimeIdentityAssertOptions = {
  expectedRuntimeRole?: string;
  expectedDatabase?: string;
  merchantTables?: readonly string[];
  controlTables?: readonly string[];
  /** When true, require SELECT on at least one merchant table (post-enforcement). */
  requireMerchantSelect?: boolean;
  /** Skip grant checks when enforcement may not yet have applied (tests only). */
  skipGrantChecks?: boolean;
};

/**
 * Fail closed if the connected role is not a safe restricted runtime role.
 * Both current_user and session_user must satisfy the contract.
 */
export async function assertSafeRuntimeConnectedIdentity(
  client: IdentitySqlClient,
  options: RuntimeIdentityAssertOptions | string = {},
): Promise<ConnectedIdentity> {
  const opts: RuntimeIdentityAssertOptions =
    typeof options === "string"
      ? { expectedRuntimeRole: options }
      : options;
  const expected = opts.expectedRuntimeRole || defaultRuntimeRoleName();
  const merchantTables = opts.merchantTables ?? RUNTIME_MERCHANT_TABLES;
  const controlTables = opts.controlTables ?? RUNTIME_CONTROL_TABLES;
  const identity = await readConnectedIdentity(client, merchantTables);
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
  if (opts.expectedDatabase && identity.currentDatabase !== opts.expectedDatabase) {
    failures.push(
      `runtime_database_mismatch:expected=${opts.expectedDatabase}:got=${identity.currentDatabase}`,
    );
  }
  if (identity.rolsuper) failures.push("runtime_connected_superuser");
  if (identity.rolbypassrls) failures.push("runtime_connected_bypassrls");
  if (identity.rolcreaterole) failures.push("runtime_connected_createrole");
  if (identity.rolcreatedb) failures.push("runtime_connected_createdb");
  if (identity.rolinherit) failures.push("runtime_connected_inherit");
  if (identity.ownedMerchantTables.length > 0) {
    failures.push(
      `runtime_owns_tables:${identity.ownedMerchantTables.join(",")}`,
    );
  }
  if (identity.roleMemberships.length > 0) {
    failures.push(
      `runtime_has_role_membership:${identity.roleMemberships.join(",")}`,
    );
  }
  if (identity.adminOptionMemberships.length > 0) {
    failures.push(
      `runtime_has_admin_option:${identity.adminOptionMemberships.join(",")}`,
    );
  }

  if (!opts.skipGrantChecks) {
    for (const table of controlTables) {
      const exists = await client.queryRows<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'r'
         ) AS exists`,
        [table],
      );
      if (!exists[0]?.exists) continue;
      const priv = await client.queryRows<{ has: boolean }>(
        `SELECT has_table_privilege(current_user, format('%I.%I', 'public', $1::text), 'SELECT') AS has`,
        [table],
      );
      if (priv[0]?.has) {
        failures.push(`runtime_can_select_control:${table}`);
      }
    }

    const prismaMig = await client.queryRows<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
       ) AS exists`,
    );
    if (prismaMig[0]?.exists) {
      const priv = await client.queryRows<{ has: boolean }>(
        `SELECT has_table_privilege(current_user, 'public._prisma_migrations', 'SELECT') AS has`,
      );
      if (priv[0]?.has) {
        failures.push("runtime_can_select_prisma_migrations");
      }
    }

    if (opts.requireMerchantSelect) {
      let anySelect = false;
      for (const table of merchantTables) {
        const priv = await client.queryRows<{ has: boolean }>(
          `SELECT has_table_privilege(current_user, format('%I.%I', 'public', $1::text), 'SELECT') AS has`,
          [table],
        );
        if (priv[0]?.has) {
          anySelect = true;
          break;
        }
      }
      if (!anySelect) {
        failures.push("runtime_missing_required_merchant_select");
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`runtime_identity_rejected:${failures.join("|")}`);
  }
  return identity;
}

export function prismaAsIdentityClient(
  prisma: PrismaClient,
): IdentitySqlClient {
  return {
    async queryRows<T extends SqlRow = SqlRow>(
      sql: string,
      params: unknown[] = [],
    ): Promise<T[]> {
      // Prisma $queryRawUnsafe uses $1, $2 positional parameters.
      return prisma.$queryRawUnsafe<T[]>(sql, ...params);
    },
  };
}

export function pgClientAsIdentityClient(client: {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: SqlRow[] }>;
}): IdentitySqlClient {
  return {
    async queryRows<T extends SqlRow = SqlRow>(
      sql: string,
      params: unknown[] = [],
    ): Promise<T[]> {
      const res = await client.query(sql, params);
      return res.rows as T[];
    },
  };
}

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var prismaRuntimeUrl: string | undefined;
  // eslint-disable-next-line no-var
  var prismaIdentityVerifiedUrl: string | undefined;
  // eslint-disable-next-line no-var
  var prismaInitPromise: Promise<PrismaClient> | undefined;
  // eslint-disable-next-line no-var
  var prismaInitFailure: Error | undefined;
}

function createPrismaClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

/**
 * Concurrency-safe verified runtime Prisma initialization.
 * Two concurrent first requests share one init promise; failure rejects all
 * waiters, disconnects the unsafe client, and leaves no usable global client.
 */
export async function getVerifiedRuntimePrisma(
  env: NodeJS.ProcessEnv = process.env,
): Promise<PrismaClient> {
  const resolvedUrl = resolveRuntimeDatabaseUrl({}, env);

  if (
    global.prismaGlobal &&
    global.prismaRuntimeUrl === resolvedUrl &&
    global.prismaIdentityVerifiedUrl === resolvedUrl
  ) {
    return global.prismaGlobal;
  }

  // If a prior init failed for this URL, do not retry indefinitely.
  if (
    global.prismaInitFailure &&
    global.prismaRuntimeUrl === resolvedUrl &&
    !global.prismaGlobal
  ) {
    throw global.prismaInitFailure;
  }

  if (global.prismaInitPromise) {
    return global.prismaInitPromise;
  }

  global.prismaInitPromise = (async () => {
    const previous = global.prismaGlobal;
    const client = createPrismaClient(resolvedUrl);
    // Mark URL early so concurrent callers wait on this promise rather than
    // constructing a second client.
    global.prismaRuntimeUrl = resolvedUrl;
    try {
      await client.$connect();
      let expectedDatabase: string | undefined;
      try {
        expectedDatabase = normalizeDatabaseUrlIdentity(resolvedUrl).database;
      } catch {
        expectedDatabase = undefined;
      }
      await assertSafeRuntimeConnectedIdentity(prismaAsIdentityClient(client), {
        expectedDatabase,
        // Application startup must reject privileged identity even before
        // enforcement grants exist. Merchant SELECT is optional at connect;
        // missing SELECT is still covered by dedicated adversarial tests that
        // set requireMerchantSelect.
        skipGrantChecks: false,
        requireMerchantSelect: env.STOCKY_REQUIRE_RUNTIME_MERCHANT_SELECT === "1",
      });
      global.prismaGlobal = client;
      global.prismaIdentityVerifiedUrl = resolvedUrl;
      global.prismaInitFailure = undefined;
      if (previous && previous !== client) {
        void previous.$disconnect();
      }
      return client;
    } catch (err) {
      const failure =
        err instanceof Error
          ? err
          : new Error(`runtime_identity_init_failed:${String(err)}`);
      global.prismaInitFailure = failure;
      global.prismaGlobal = undefined;
      global.prismaIdentityVerifiedUrl = undefined;
      await client.$disconnect().catch(() => undefined);
      throw failure;
    } finally {
      global.prismaInitPromise = undefined;
    }
  })();

  return global.prismaInitPromise;
}

/**
 * Drop the lazily-cached runtime Prisma client. Test harnesses only.
 * Forbidden in production. After reset, the next access re-verifies identity.
 * Not an ordinary production runtime export path.
 */
export async function resetVerifiedPrismaSingletonForTests(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "resetVerifiedPrismaSingletonForTests is forbidden when NODE_ENV=production",
    );
  }
  // Wait for any in-flight init so we do not leave a racing verified client.
  if (global.prismaInitPromise) {
    await global.prismaInitPromise.catch(() => undefined);
  }
  await global.prismaGlobal?.$disconnect().catch(() => undefined);
  global.prismaGlobal = undefined;
  global.prismaRuntimeUrl = undefined;
  global.prismaIdentityVerifiedUrl = undefined;
  global.prismaInitPromise = undefined;
  global.prismaInitFailure = undefined;
}

export function classifyDatabaseUrl(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
): {
  classification: "migration" | "runtime" | "ambiguous" | "unknown";
  hasPoolerPattern: boolean;
  hostRedacted: true;
} {
  const migration =
    env.DATABASE_MIGRATION_URL?.trim() ||
    env.TENANT_MAINTENANCE_DATABASE_URL?.trim() ||
    "";
  const runtime = env.DATABASE_RUNTIME_URL?.trim() || "";
  let classification: "migration" | "runtime" | "ambiguous" | "unknown" =
    "unknown";
  if (runtime && databaseUrlsSemanticallyEqual(url, runtime)) {
    classification = "runtime";
  } else if (migration && databaseUrlsSemanticallyEqual(url, migration)) {
    classification = "migration";
  } else if (
    env.DATABASE_URL?.trim() &&
    databaseUrlsSemanticallyEqual(url, env.DATABASE_URL.trim())
  ) {
    classification = "ambiguous";
  }
  return {
    classification,
    hasPoolerPattern: POOLER_PATTERN.test(url),
    hostRedacted: true,
  };
}
