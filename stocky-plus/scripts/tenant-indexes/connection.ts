import { Client } from "pg";
import {
  formatPostgresTimeoutMs,
  resolveLockTimeoutMs,
  resolveStatementTimeoutMs,
} from "./timeouts";

const POOLER_PATTERN = /pooler|pgbouncer/i;

export type ResolveMaintenanceUrlOptions = {
  /**
   * When true (mutating apply), TENANT_MAINTENANCE_DATABASE_URL is required.
   * DATABASE_URL alone is insufficient. String-pattern pooler rejection is only a
   * guardrail — operators must still supply a genuinely direct PostgreSQL endpoint.
   */
  requireExplicitMaintenanceUrl?: boolean;
};

export function resolveMaintenanceDatabaseUrl(
  options: ResolveMaintenanceUrlOptions = {},
): string {
  const explicit = process.env.TENANT_MAINTENANCE_DATABASE_URL?.trim() || "";
  const fallback = process.env.DATABASE_URL?.trim() || "";

  if (options.requireExplicitMaintenanceUrl) {
    if (!explicit) {
      throw new Error(
        "TENANT_MAINTENANCE_DATABASE_URL is required for tenant:indexes:apply (DATABASE_URL alone is not accepted for mutating index apply)",
      );
    }
    if (POOLER_PATTERN.test(explicit)) {
      throw new Error(
        "TENANT_MAINTENANCE_DATABASE_URL must not use a pooler or PgBouncer endpoint",
      );
    }
    return explicit;
  }

  const url = explicit || fallback;
  if (!url) {
    throw new Error(
      "TENANT_MAINTENANCE_DATABASE_URL or DATABASE_URL is required for tenant index tooling",
    );
  }
  if (POOLER_PATTERN.test(url)) {
    throw new Error(
      "Tenant index maintenance must not use a pooler or PgBouncer endpoint",
    );
  }
  return url;
}

export type MaintenanceClientOptions = {
  lockTimeoutMs?: number;
  statementTimeoutMs?: number;
  requireExplicitMaintenanceUrl?: boolean;
};

/**
 * Dedicated pg.Client for CREATE INDEX CONCURRENTLY (not pooled, not in a transaction).
 * Applies finite lock_timeout and statement_timeout on the same pinned connection.
 */
export async function getMaintenanceClient(
  options: MaintenanceClientOptions = {},
): Promise<Client> {
  const connectionString = resolveMaintenanceDatabaseUrl({
    requireExplicitMaintenanceUrl: options.requireExplicitMaintenanceUrl,
  });
  const client = new Client({ connectionString });
  await client.connect();

  const lockTimeoutMs = options.lockTimeoutMs ?? resolveLockTimeoutMs();
  const statementTimeoutMs =
    options.statementTimeoutMs ?? resolveStatementTimeoutMs();

  await client.query(
    `SET lock_timeout = '${formatPostgresTimeoutMs(lockTimeoutMs)}'`,
  );
  await client.query(
    `SET statement_timeout = '${formatPostgresTimeoutMs(statementTimeoutMs)}'`,
  );

  return client;
}
