import { Client } from "pg";
import {
  formatPostgresTimeoutMs,
  resolveLockTimeoutMs,
  resolveStatementTimeoutMs,
} from "./timeouts";

const POOLER_PATTERN = /pooler|pgbouncer/i;

export function resolveMaintenanceDatabaseUrl(): string {
  const url =
    process.env.TENANT_MAINTENANCE_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "";
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
  /** Override lock timeout milliseconds (still validated when read from env if omitted). */
  lockTimeoutMs?: number;
  /** Override statement timeout milliseconds. */
  statementTimeoutMs?: number;
};

/**
 * Dedicated pg.Client for CREATE INDEX CONCURRENTLY (not pooled, not in a transaction).
 * Applies finite lock_timeout and statement_timeout on the same pinned connection.
 */
export async function getMaintenanceClient(
  options: MaintenanceClientOptions = {},
): Promise<Client> {
  const connectionString = resolveMaintenanceDatabaseUrl();
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
