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

async function closeClientQuietly(client: Client): Promise<void> {
  try {
    await client.end();
  } catch {
    // ignore secondary close failure
  }
}

/**
 * Session-level advisory lock on a dedicated non-pooled PostgreSQL connection (F-PR1-07 / R4).
 * Unlock requires the same backend PID and a true unlock result; the client is always closed.
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
      await closeClientQuietly(client);
      throw new Error(
        "Concurrent tenant backfill apply is denied (advisory lock held)",
      );
    }

    const backendPid = row.pid;
    let released = false;

    return {
      client,
      backendPid,
      release: async () => {
        if (released) {
          return;
        }
        released = true;
        try {
          const unlock = await client.query<{
            unlocked: boolean;
            pid: number;
          }>(
            `SELECT pg_advisory_unlock($1) AS unlocked, pg_backend_pid() AS pid`,
            [TENANT_BACKFILL_ADVISORY_LOCK_KEY],
          );
          const unlockRow = unlock.rows[0];
          if (!unlockRow) {
            throw new Error(
              "Failed to release tenant backfill advisory lock (empty unlock result)",
            );
          }
          if (unlockRow.pid !== backendPid) {
            throw new Error(
              `Apply lock release backend PID mismatch: acquired=${backendPid} release=${unlockRow.pid}`,
            );
          }
          if (!unlockRow.unlocked) {
            throw new Error(
              "Failed to release tenant backfill advisory lock (unlock returned false)",
            );
          }
        } finally {
          await closeClientQuietly(client);
        }
      },
    };
  } catch (error) {
    await closeClientQuietly(client);
    throw error;
  }
}
