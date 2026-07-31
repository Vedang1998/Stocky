import { Client } from "pg";
import { TENANT_BACKFILL_ADVISORY_LOCK_KEY } from "./tables";

export function requireMaintenanceDatabaseUrl(): string {
  const url = process.env.TENANT_MAINTENANCE_DATABASE_URL;
  if (!url || url.trim().length === 0) {
    throw new Error(
      "TENANT_MAINTENANCE_DATABASE_URL is required for tenant backfill apply mode",
    );
  }
  if (/pooler|pgbouncer/i.test(url)) {
    throw new Error(
      "TENANT_MAINTENANCE_DATABASE_URL must not use a pooler or PgBouncer endpoint",
    );
  }
  return url;
}

export type ApplyLockHandle = {
  client: Client;
  backendPid: number;
  release: () => Promise<void>;
};

/**
 * Session-level advisory lock on a dedicated non-pooled PostgreSQL connection (F-PR1-07).
 */
export async function acquireApplyLock(): Promise<ApplyLockHandle> {
  const connectionString = requireMaintenanceDatabaseUrl();
  const client = new Client({ connectionString });

  try {
    await client.connect();
    const result = await client.query<{ locked: boolean; pid: number }>(
      `SELECT pg_try_advisory_lock($1) AS locked, pg_backend_pid() AS pid`,
      [TENANT_BACKFILL_ADVISORY_LOCK_KEY],
    );
    const row = result.rows[0];
    if (!row?.locked) {
      await client.end();
      throw new Error(
        "Concurrent tenant backfill apply is denied (advisory lock held)",
      );
    }

    const backendPid = row.pid;
    return {
      client,
      backendPid,
      release: async () => {
        const unlock = await client.query<{ unlocked: boolean }>(
          `SELECT pg_advisory_unlock($1) AS unlocked`,
          [TENANT_BACKFILL_ADVISORY_LOCK_KEY],
        );
        if (!unlock.rows[0]?.unlocked) {
          await client.end();
          throw new Error(
            "Failed to release tenant backfill advisory lock (unlock returned false)",
          );
        }
        await client.end();
      },
    };
  } catch (error) {
    try {
      await client.end();
    } catch {
      // ignore secondary close failure
    }
    throw error;
  }
}
