/**
 * Migration-owner vs runtime database URL resolution for PR 3 enforcement.
 *
 * DATABASE_MIGRATION_URL / TENANT_MAINTENANCE_DATABASE_URL — privileged owner
 * DATABASE_RUNTIME_URL — restricted runtime role (RLS subject)
 * DATABASE_URL — ambiguous legacy; must not silently become production runtime
 *   when a privileged migration URL is also configured.
 */
import { Client } from "pg";
import {
  formatPostgresTimeoutMs,
  resolveEnforcementLockTimeoutMs,
  resolveEnforcementStatementTimeoutMs,
} from "./timeouts";

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
    if (migration && runtime === migration) {
      throw new Error(
        "DATABASE_RUNTIME_URL must not equal the migration/maintenance URL",
      );
    }
    return runtime;
  }

  if (runtime) {
    if (migration && runtime === migration) {
      throw new Error(
        "DATABASE_RUNTIME_URL must not equal the migration/maintenance URL",
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

  return client;
}

export async function getRuntimeClient(
  options: { requireRuntime?: boolean } = {},
): Promise<Client> {
  const connectionString = resolveRuntimeDatabaseUrl(options);
  const client = new Client({ connectionString });
  await client.connect();
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
  if (runtime && url === runtime) classification = "runtime";
  else if (migration && url === migration) classification = "migration";
  else if (process.env.DATABASE_URL?.trim() === url) classification = "ambiguous";
  return {
    classification,
    hasPoolerPattern: POOLER_PATTERN.test(url),
    hostRedacted: true,
  };
}
