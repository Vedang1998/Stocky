import { Client } from "pg";

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
  lockTimeout?: string;
  statementTimeout?: string;
};

const DEFAULT_LOCK_TIMEOUT = "5s";
/** CONCURRENTLY builds can run long; disable statement timeout on maintenance sessions. */
const DEFAULT_STATEMENT_TIMEOUT = "0";

/**
 * Dedicated pg.Client for CREATE INDEX CONCURRENTLY (not pooled, not in a transaction).
 */
export async function getMaintenanceClient(
  options: MaintenanceClientOptions = {},
): Promise<Client> {
  const connectionString = resolveMaintenanceDatabaseUrl();
  const client = new Client({ connectionString });
  await client.connect();

  const lockTimeout = options.lockTimeout ?? DEFAULT_LOCK_TIMEOUT;
  const statementTimeout =
    options.statementTimeout ?? DEFAULT_STATEMENT_TIMEOUT;

  await client.query(`SET lock_timeout = '${lockTimeout}'`);
  await client.query(`SET statement_timeout = '${statementTimeout}'`);

  return client;
}
