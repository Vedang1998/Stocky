/**
 * Migration-owner vs runtime database URL resolution for PR 3 enforcement.
 *
 * DATABASE_MIGRATION_URL / TENANT_MAINTENANCE_DATABASE_URL — privileged owner
 * DATABASE_RUNTIME_URL — restricted runtime role (RLS subject)
 * DATABASE_URL — ambiguous legacy; must not silently become production runtime
 *   when a privileged migration URL is also configured.
 *
 * F-PR3C-01: identity helpers are shared with the application runtime module.
 * URL comparison is an early defence only — not authority.
 */
import { Client } from "pg";
import {
  formatPostgresTimeoutMs,
  resolveEnforcementLockTimeoutMs,
  resolveEnforcementStatementTimeoutMs,
} from "./timeouts";
import {
  assertSafeRuntimeConnectedIdentity as assertSafeRuntimeConnectedIdentityShared,
  classifyDatabaseUrl,
  databaseUrlsSemanticallyEqual,
  defaultMigrationRoleName,
  defaultRuntimeRoleName,
  normalizeDatabaseUrlIdentity,
  pgClientAsIdentityClient,
  readConnectedIdentity as readConnectedIdentityShared,
  resolveRuntimeDatabaseUrl,
  type ConnectedIdentity,
  type RuntimeIdentityAssertOptions,
} from "../../app/db/runtime-identity.server";

const POOLER_PATTERN = /pooler|pgbouncer/i;

export {
  classifyDatabaseUrl,
  databaseUrlsSemanticallyEqual,
  defaultMigrationRoleName,
  defaultRuntimeRoleName,
  normalizeDatabaseUrlIdentity,
  resolveRuntimeDatabaseUrl,
};
export type { ConnectedIdentity };

export async function readConnectedIdentity(
  client: Client,
): Promise<ConnectedIdentity> {
  return readConnectedIdentityShared(pgClientAsIdentityClient(client));
}

/**
 * Fail closed if the connected role is not a safe restricted runtime role.
 */
export async function assertSafeRuntimeConnectedIdentity(
  client: Client,
  expectedRuntimeRoleOrOptions?: string | RuntimeIdentityAssertOptions,
): Promise<ConnectedIdentity> {
  return assertSafeRuntimeConnectedIdentityShared(
    pgClientAsIdentityClient(client),
    expectedRuntimeRoleOrOptions,
  );
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

/**
 * Bootstrap administrator connection for disposable test setup only.
 * Never used for Prisma migrations, enforcement apply, or runtime.
 */
export function resolveBootstrapDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const url =
    env.STOCKY_BOOTSTRAP_DATABASE_URL?.trim() ||
    env.DATABASE_URL?.trim() ||
    "";
  if (!url) {
    throw new Error(
      "STOCKY_BOOTSTRAP_DATABASE_URL or DATABASE_URL is required for bootstrap administration",
    );
  }
  return url;
}

export async function getBootstrapClient(): Promise<Client> {
  const connectionString = resolveBootstrapDatabaseUrl();
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

export async function getRuntimeClient(
  options: { requireRuntime?: boolean; verifyIdentity?: boolean } = {},
): Promise<Client> {
  const connectionString = resolveRuntimeDatabaseUrl(options);
  const client = new Client({ connectionString });
  await client.connect();
  // Always verify connected identity for runtime clients — URL text is not
  // authority (F-PR3C-01). Opt-out only for disposable probe tooling via
  // verifyIdentity: false.
  const verify = options.verifyIdentity !== false;
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
